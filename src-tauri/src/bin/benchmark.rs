//! Standalone DuckDB benchmark binary for native performance testing.
//! Usage: benchmark <scenario> <data-path> [secondary-data-path] <iterations>

use duckdb::Connection;
use serde::Serialize;
use std::env;
use std::time::Instant;

#[derive(Serialize)]
struct BenchmarkOutput {
    scenario: String,
    timings_ms: Vec<f64>,
    success: bool,
    error: Option<String>,
}

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 4 {
        eprintln!("Usage: benchmark <scenario> <data-path> <iterations>");
        eprintln!("       benchmark <scenario> <data-path> <secondary-data-path> <iterations>");
        eprintln!("");
        eprintln!("Scenarios:");
        eprintln!("  file-load-csv       Load CSV file");
        eprintln!("  file-load-parquet   Load Parquet file");
        eprintln!("  query-select-all    SELECT * from table");
        eprintln!("  query-filter        Filter with compound conditions");
        eprintln!("  query-sort          Sort by multiple columns");
        eprintln!("  query-aggregate     GROUP BY with aggregations");
        eprintln!("  op-filter           Filter operation");
        eprintln!("  op-sort             Sort operation");
        eprintln!("  op-join             Join operation (requires secondary data path)");
        eprintln!("  op-pivot            Pivot operation");
        eprintln!("  op-window           Window function operation");
        eprintln!("  view-create         Create view");
        eprintln!("  view-chain-5        Query through 5 chained views");
        std::process::exit(1);
    }

    let scenario = &args[1];
    let data_path = &args[2];

    // Check if we have a secondary data path (for joins)
    let (secondary_path, iterations) = if args.len() == 5 {
        (Some(args[3].clone()), args[4].parse::<usize>().unwrap_or(5))
    } else {
        (None, args[3].parse::<usize>().unwrap_or(5))
    };

    let result = run_benchmark(scenario, data_path, secondary_path.as_deref(), iterations);

    println!("{}", serde_json::to_string(&result).unwrap());
}

fn run_benchmark(
    scenario: &str,
    data_path: &str,
    secondary_path: Option<&str>,
    iterations: usize,
) -> BenchmarkOutput {
    let conn = match Connection::open_in_memory() {
        Ok(c) => c,
        Err(e) => {
            return BenchmarkOutput {
                scenario: scenario.to_string(),
                timings_ms: vec![],
                success: false,
                error: Some(format!("Failed to open connection: {}", e)),
            }
        }
    };

    // Setup: load initial data for non-file-load scenarios
    if !scenario.starts_with("file-load") {
        if let Err(e) = setup_data(&conn, data_path, secondary_path) {
            return BenchmarkOutput {
                scenario: scenario.to_string(),
                timings_ms: vec![],
                success: false,
                error: Some(format!("Setup failed: {}", e)),
            };
        }
    }

    // Run benchmark
    let mut timings: Vec<f64> = Vec::with_capacity(iterations);

    for _ in 0..iterations {
        // For file-load scenarios, we need to drop the table first
        if scenario.starts_with("file-load") {
            let _ = conn.execute("DROP TABLE IF EXISTS benchmark_data", []);
        }

        let start = Instant::now();
        let result = run_scenario(&conn, scenario, data_path);
        let elapsed = start.elapsed().as_secs_f64() * 1000.0;

        match result {
            Ok(_) => timings.push(elapsed),
            Err(e) => {
                return BenchmarkOutput {
                    scenario: scenario.to_string(),
                    timings_ms: timings,
                    success: false,
                    error: Some(e),
                };
            }
        }
    }

    // Cleanup
    let _ = cleanup(&conn);

    BenchmarkOutput {
        scenario: scenario.to_string(),
        timings_ms: timings,
        success: true,
        error: None,
    }
}

fn setup_data(
    conn: &Connection,
    data_path: &str,
    secondary_path: Option<&str>,
) -> Result<(), String> {
    // Load main data
    let ext = data_path.split('.').last().unwrap_or("csv");
    let sql = match ext {
        "parquet" => format!(
            "CREATE TABLE benchmark_data AS SELECT * FROM read_parquet('{}')",
            data_path
        ),
        _ => format!(
            "CREATE TABLE benchmark_data AS SELECT * FROM read_csv_auto('{}')",
            data_path
        ),
    };

    conn.execute(&sql, [])
        .map_err(|e| format!("Failed to load main data: {}", e))?;

    // Load secondary data if provided (for joins)
    if let Some(path) = secondary_path {
        let ext = path.split('.').last().unwrap_or("csv");
        let sql = match ext {
            "parquet" => format!(
                "CREATE TABLE join_table AS SELECT * FROM read_parquet('{}')",
                path
            ),
            _ => format!(
                "CREATE TABLE join_table AS SELECT * FROM read_csv_auto('{}')",
                path
            ),
        };
        conn.execute(&sql, [])
            .map_err(|e| format!("Failed to load secondary data: {}", e))?;
    }

    Ok(())
}

fn run_scenario(conn: &Connection, scenario: &str, data_path: &str) -> Result<(), String> {
    match scenario {
        "file-load-csv" => {
            let sql = format!(
                "CREATE TABLE benchmark_data AS SELECT * FROM read_csv_auto('{}')",
                data_path
            );
            conn.execute(&sql, [])
                .map_err(|e| format!("File load error: {}", e))?;
        }
        "file-load-parquet" => {
            let sql = format!(
                "CREATE TABLE benchmark_data AS SELECT * FROM read_parquet('{}')",
                data_path
            );
            conn.execute(&sql, [])
                .map_err(|e| format!("File load error: {}", e))?;
        }
        "query-select-all" => {
            let mut stmt = conn
                .prepare("SELECT * FROM benchmark_data")
                .map_err(|e| format!("Prepare error: {}", e))?;
            let mut rows = stmt.query([]).map_err(|e| format!("Query error: {}", e))?;
            while rows
                .next()
                .map_err(|e| format!("Row error: {}", e))?
                .is_some()
            {}
        }
        "query-filter" => {
            let sql = "SELECT * FROM benchmark_data WHERE value > 5000 AND category IN ('Electronics', 'Clothing', 'Food') AND active = true";
            let mut stmt = conn
                .prepare(sql)
                .map_err(|e| format!("Prepare error: {}", e))?;
            let mut rows = stmt.query([]).map_err(|e| format!("Query error: {}", e))?;
            while rows
                .next()
                .map_err(|e| format!("Row error: {}", e))?
                .is_some()
            {}
        }
        "query-sort" => {
            let sql = "SELECT * FROM benchmark_data ORDER BY value DESC, name ASC";
            let mut stmt = conn
                .prepare(sql)
                .map_err(|e| format!("Prepare error: {}", e))?;
            let mut rows = stmt.query([]).map_err(|e| format!("Query error: {}", e))?;
            while rows
                .next()
                .map_err(|e| format!("Row error: {}", e))?
                .is_some()
            {}
        }
        "query-aggregate" => {
            let sql = "SELECT category, region, COUNT(*) as cnt, SUM(value) as total, AVG(score) as avg_score FROM benchmark_data GROUP BY category, region";
            let mut stmt = conn
                .prepare(sql)
                .map_err(|e| format!("Prepare error: {}", e))?;
            let mut rows = stmt.query([]).map_err(|e| format!("Query error: {}", e))?;
            while rows
                .next()
                .map_err(|e| format!("Row error: {}", e))?
                .is_some()
            {}
        }
        "op-filter" => {
            let sql = "CREATE VIEW filter_view AS SELECT * FROM benchmark_data WHERE value > 5000 AND active = true";
            conn.execute("DROP VIEW IF EXISTS filter_view", [])
                .map_err(|e| format!("Drop error: {}", e))?;
            conn.execute(sql, [])
                .map_err(|e| format!("Create view error: {}", e))?;
            // Force materialization by querying
            let mut stmt = conn
                .prepare("SELECT * FROM filter_view")
                .map_err(|e| format!("Query error: {}", e))?;
            let mut rows = stmt.query([]).map_err(|e| format!("Query error: {}", e))?;
            while rows
                .next()
                .map_err(|e| format!("Row error: {}", e))?
                .is_some()
            {}
        }
        "op-sort" => {
            let sql = "CREATE VIEW sort_view AS SELECT * FROM benchmark_data ORDER BY value DESC, date ASC";
            conn.execute("DROP VIEW IF EXISTS sort_view", [])
                .map_err(|e| format!("Drop error: {}", e))?;
            conn.execute(sql, [])
                .map_err(|e| format!("Create view error: {}", e))?;
            let mut stmt = conn
                .prepare("SELECT * FROM sort_view")
                .map_err(|e| format!("Query error: {}", e))?;
            let mut rows = stmt.query([]).map_err(|e| format!("Query error: {}", e))?;
            while rows
                .next()
                .map_err(|e| format!("Row error: {}", e))?
                .is_some()
            {}
        }
        "op-join" => {
            let sql = "CREATE VIEW join_view AS SELECT b.*, j.extra_value, j.description FROM benchmark_data b INNER JOIN join_table j ON b.id = j.id";
            conn.execute("DROP VIEW IF EXISTS join_view", [])
                .map_err(|e| format!("Drop error: {}", e))?;
            conn.execute(sql, [])
                .map_err(|e| format!("Create view error: {}", e))?;
            let mut stmt = conn
                .prepare("SELECT * FROM join_view")
                .map_err(|e| format!("Query error: {}", e))?;
            let mut rows = stmt.query([]).map_err(|e| format!("Query error: {}", e))?;
            while rows
                .next()
                .map_err(|e| format!("Row error: {}", e))?
                .is_some()
            {}
        }
        "op-pivot" => {
            let sql = "SELECT category, SUM(CASE WHEN region = 'North' THEN value ELSE 0 END) as North, SUM(CASE WHEN region = 'South' THEN value ELSE 0 END) as South, SUM(CASE WHEN region = 'East' THEN value ELSE 0 END) as East, SUM(CASE WHEN region = 'West' THEN value ELSE 0 END) as West FROM benchmark_data GROUP BY category";
            let mut stmt = conn
                .prepare(sql)
                .map_err(|e| format!("Prepare error: {}", e))?;
            let mut rows = stmt.query([]).map_err(|e| format!("Query error: {}", e))?;
            while rows
                .next()
                .map_err(|e| format!("Row error: {}", e))?
                .is_some()
            {}
        }
        "op-window" => {
            let sql = "SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY value DESC) as rank, SUM(value) OVER (PARTITION BY category ORDER BY date ROWS UNBOUNDED PRECEDING) as running_total FROM benchmark_data";
            let mut stmt = conn
                .prepare(sql)
                .map_err(|e| format!("Prepare error: {}", e))?;
            let mut rows = stmt.query([]).map_err(|e| format!("Query error: {}", e))?;
            while rows
                .next()
                .map_err(|e| format!("Row error: {}", e))?
                .is_some()
            {}
        }
        "view-create" => {
            conn.execute("DROP VIEW IF EXISTS test_view", [])
                .map_err(|e| format!("Drop error: {}", e))?;
            let sql = "CREATE VIEW test_view AS SELECT * FROM benchmark_data WHERE value > 5000";
            conn.execute(sql, [])
                .map_err(|e| format!("Create view error: {}", e))?;
        }
        "view-chain-5" => {
            // Create 5 chained views
            for i in 1..=5 {
                let prev = if i == 1 {
                    "benchmark_data".to_string()
                } else {
                    format!("chain_view_{}", i - 1)
                };
                conn.execute(&format!("DROP VIEW IF EXISTS chain_view_{}", i), [])
                    .map_err(|e| format!("Drop error: {}", e))?;
                let sql = format!(
                    "CREATE VIEW chain_view_{} AS SELECT * FROM {} WHERE value > {}",
                    i,
                    prev,
                    i * 1000
                );
                conn.execute(&sql, [])
                    .map_err(|e| format!("Create view error: {}", e))?;
            }
            // Query through the chain
            let mut stmt = conn
                .prepare("SELECT * FROM chain_view_5")
                .map_err(|e| format!("Query error: {}", e))?;
            let mut rows = stmt.query([]).map_err(|e| format!("Query error: {}", e))?;
            while rows
                .next()
                .map_err(|e| format!("Row error: {}", e))?
                .is_some()
            {}
        }
        _ => {
            return Err(format!("Unknown scenario: {}", scenario));
        }
    }

    Ok(())
}

fn cleanup(conn: &Connection) -> Result<(), String> {
    let _ = conn.execute("DROP TABLE IF EXISTS benchmark_data", []);
    let _ = conn.execute("DROP TABLE IF EXISTS join_table", []);
    let _ = conn.execute("DROP VIEW IF EXISTS filter_view", []);
    let _ = conn.execute("DROP VIEW IF EXISTS sort_view", []);
    let _ = conn.execute("DROP VIEW IF EXISTS join_view", []);
    let _ = conn.execute("DROP VIEW IF EXISTS test_view", []);
    for i in 1..=5 {
        let _ = conn.execute(&format!("DROP VIEW IF EXISTS chain_view_{}", i), []);
    }
    Ok(())
}
