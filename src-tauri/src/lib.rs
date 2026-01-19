mod duckdb_commands;
mod duckdb_state;
mod python;
mod xlsx_loader;

use duckdb_commands::*;
use duckdb_state::DuckDBState;
use python::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DuckDBState::new().expect("Failed to initialize DuckDB"))
        .invoke_handler(tauri::generate_handler![
            duckdb_query,
            duckdb_execute,
            duckdb_load_file,
            duckdb_describe,
            duckdb_count,
            duckdb_export_parquet,
            duckdb_export_to_bytes,
            duckdb_load_parquet_bytes,
            python_check,
            python_execute,
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
