use serde::{Deserialize, Serialize};
use std::fs;
use std::process::Command;
use tempfile::TempDir;

#[derive(Serialize, Deserialize)]
pub struct PythonColumnInfo {
    pub name: String,
    pub dtype: String,
}

#[derive(Serialize, Deserialize)]
pub struct PythonExecutionResult {
    pub success: bool,
    pub output_data: Option<Vec<u8>>,
    pub row_count: Option<usize>,
    pub columns: Option<Vec<PythonColumnInfo>>,
    pub stdout: String,
    pub stderr: String,
    pub error: Option<String>,
    pub matplotlib_output: Option<String>,
    pub execution_time_ms: u64,
}

#[derive(Serialize, Deserialize)]
struct PythonRunnerOutput {
    success: bool,
    has_result: Option<bool>,
    row_count: Option<usize>,
    columns: Option<Vec<PythonColumnInfo>>,
    output_path: Option<String>,
    stdout: Option<String>,
    stderr: Option<String>,
    error: Option<String>,
    traceback: Option<String>,
    matplotlib_output: Option<String>,
}

/// Check if Python 3 is available with required packages
#[tauri::command]
pub fn python_check() -> Result<PythonCheckResult, String> {
    // Try to find Python
    let python_cmd = find_python().ok_or("Python 3 not found")?;

    // Check version
    let version_output = Command::new(&python_cmd)
        .args(["--version"])
        .output()
        .map_err(|e| format!("Failed to check Python version: {}", e))?;

    let version = String::from_utf8_lossy(&version_output.stdout).trim().to_string();

    // Check for required packages
    let packages_check = Command::new(&python_cmd)
        .args(["-c", "import pandas, numpy, matplotlib, pyarrow; print('ok')"])
        .output()
        .map_err(|e| format!("Failed to check packages: {}", e))?;

    let packages_ok = packages_check.status.success();

    let missing_packages = if !packages_ok {
        let err = String::from_utf8_lossy(&packages_check.stderr);
        // Parse which packages are missing
        let mut missing = Vec::new();
        for pkg in ["pandas", "numpy", "matplotlib", "pyarrow"] {
            if err.contains(&format!("No module named '{}'", pkg)) {
                missing.push(pkg.to_string());
            }
        }
        if missing.is_empty() {
            // Some other import error
            missing.push("unknown".to_string());
        }
        Some(missing)
    } else {
        None
    };

    Ok(PythonCheckResult {
        available: true,
        version,
        packages_ok,
        missing_packages,
        python_path: python_cmd,
    })
}

#[derive(Serialize, Deserialize)]
pub struct PythonCheckResult {
    pub available: bool,
    pub version: String,
    pub packages_ok: bool,
    pub missing_packages: Option<Vec<String>>,
    pub python_path: String,
}

/// Find Python 3 executable
fn find_python() -> Option<String> {
    // Try common Python 3 command names
    let candidates = ["python3", "python", "python3.11", "python3.10", "python3.9"];

    for cmd in candidates {
        if let Ok(output) = Command::new(cmd).args(["--version"]).output() {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout);
                // Make sure it's Python 3
                if version.contains("Python 3") {
                    return Some(cmd.to_string());
                }
            }
        }
    }

    None
}

/// Execute Python code with input data from Parquet bytes
#[tauri::command]
pub fn python_execute(code: String, input_data: Vec<u8>) -> Result<PythonExecutionResult, String> {
    let start = std::time::Instant::now();

    // Find Python
    let python_cmd = find_python().ok_or("Python 3 not found")?;

    // Create temp directory for files
    let temp_dir = TempDir::new().map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let input_path = temp_dir.path().join("input.parquet");
    let output_path = temp_dir.path().join("output.parquet");
    let code_path = temp_dir.path().join("code.py");
    let matplotlib_path = temp_dir.path().join("matplotlib.png");

    // Write input data
    fs::write(&input_path, &input_data).map_err(|e| format!("Failed to write input: {}", e))?;

    // Write code file
    fs::write(&code_path, &code).map_err(|e| format!("Failed to write code: {}", e))?;

    // Get the runner script path (bundled with app or use embedded)
    let runner_script = include_str!("../python_runner.py");
    let runner_path = temp_dir.path().join("runner.py");
    fs::write(&runner_path, runner_script).map_err(|e| format!("Failed to write runner: {}", e))?;

    // Execute Python
    let output = Command::new(&python_cmd)
        .args([
            runner_path.to_string_lossy().as_ref(),
            input_path.to_string_lossy().as_ref(),
            output_path.to_string_lossy().as_ref(),
            code_path.to_string_lossy().as_ref(),
            "--matplotlib",
            matplotlib_path.to_string_lossy().as_ref(),
        ])
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let execution_time_ms = start.elapsed().as_millis() as u64;

    // Parse output JSON from stdout
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    // Try to parse JSON result
    if let Ok(result) = serde_json::from_str::<PythonRunnerOutput>(&stdout) {
        // Read output parquet if it exists
        let output_data = if result.has_result.unwrap_or(false) && output_path.exists() {
            fs::read(&output_path).ok()
        } else {
            None
        };

        // Read matplotlib output if it exists
        let matplotlib_output = if matplotlib_path.exists() {
            fs::read(&matplotlib_path)
                .ok()
                .map(|bytes| base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes))
        } else {
            result.matplotlib_output
        };

        Ok(PythonExecutionResult {
            success: result.success,
            output_data,
            row_count: result.row_count,
            columns: result.columns,
            stdout: result.stdout.unwrap_or_default(),
            stderr: result.stderr.unwrap_or_else(|| stderr.clone()),
            error: result.error.or(result.traceback),
            matplotlib_output,
            execution_time_ms,
        })
    } else {
        // Failed to parse output - return raw output as error
        Ok(PythonExecutionResult {
            success: false,
            output_data: None,
            row_count: None,
            columns: None,
            stdout: stdout.clone(),
            stderr,
            error: Some(format!("Failed to parse Python output: {}", stdout)),
            matplotlib_output: None,
            execution_time_ms,
        })
    }
}
