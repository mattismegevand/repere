use crate::duckdb_state::DuckDBState;
use crate::xlsx_loader::load_xlsx;
use base64::Engine;
use duckdb::types::ValueRef;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::fs;
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub duckdb_type: String,
}

#[derive(Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Map<String, Value>>,
    pub row_count: usize,
}

#[derive(Serialize, Deserialize)]
pub struct LoadResult {
    pub table_name: String,
    pub columns: Vec<ColumnInfo>,
    pub row_count: i64,
}

#[tauri::command]
pub fn duckdb_query(state: State<'_, DuckDBState>, sql: String) -> Result<QueryResult, String> {
    let conn = state
        .connection
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("SQL error: {}", e))?;

    // Execute query
    let mut rows = stmt
        .query([])
        .map_err(|e| format!("Query execution error: {}", e))?;

    // Collect rows and extract column names from the first row
    let mut result_rows: Vec<Map<String, Value>> = Vec::new();
    let mut column_names: Vec<String> = Vec::new();

    while let Some(row) = rows.next().map_err(|e| format!("Row error: {}", e))? {
        // Get column info from first row (after statement has been stepped)
        if column_names.is_empty() {
            let stmt_ref = row.as_ref();
            let count = stmt_ref.column_count();
            column_names = (0..count)
                .map(|i| {
                    stmt_ref
                        .column_name(i)
                        .map_or("?".to_string(), |s| s.to_string())
                })
                .collect();
        }

        let mut map = Map::new();
        for (i, name) in column_names.iter().enumerate() {
            let value = value_ref_to_json(row.get_ref(i).unwrap_or(ValueRef::Null));
            map.insert(name.clone(), value);
        }
        result_rows.push(map);
    }

    // Build column info with Unknown types (frontend handles type inference)
    let columns: Vec<ColumnInfo> = column_names
        .iter()
        .map(|name| ColumnInfo {
            name: name.clone(),
            duckdb_type: "Unknown".to_string(),
        })
        .collect();

    let row_count = result_rows.len();

    Ok(QueryResult {
        columns,
        rows: result_rows,
        row_count,
    })
}

#[tauri::command]
pub fn duckdb_execute(state: State<'_, DuckDBState>, sql: String) -> Result<usize, String> {
    let conn = state
        .connection
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    conn.execute(&sql, [])
        .map_err(|e| format!("SQL error: {}", e))
}

#[tauri::command]
pub fn duckdb_load_file(
    state: State<'_, DuckDBState>,
    table_name: String,
    file_path: String,
    file_type: String,
) -> Result<LoadResult, String> {
    let conn = state
        .connection
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let sql = match file_type.to_lowercase().as_str() {
        "csv" => format!(
            "CREATE TABLE \"{}\" AS SELECT * FROM read_csv_auto('{}')",
            table_name, file_path
        ),
        "json" | "jsonl" => format!(
            "CREATE TABLE \"{}\" AS SELECT * FROM read_json_auto('{}')",
            table_name, file_path
        ),
        "parquet" => format!(
            "CREATE TABLE \"{}\" AS SELECT * FROM read_parquet('{}')",
            table_name, file_path
        ),
        "xlsx" | "xls" => {
            load_xlsx(&conn, &table_name, &file_path)?;
            String::new()
        }
        _ => return Err(format!("Unsupported file type: {}", file_type)),
    };

    if !sql.is_empty() {
        conn.execute(&sql, [])
            .map_err(|e| format!("Failed to load file: {}", e))?;
    }

    let columns = describe_table(&conn, &table_name)?;
    let row_count = count_table(&conn, &table_name)?;

    Ok(LoadResult {
        table_name,
        columns,
        row_count,
    })
}

#[tauri::command]
pub fn duckdb_describe(
    state: State<'_, DuckDBState>,
    table_name: String,
) -> Result<Vec<ColumnInfo>, String> {
    let conn = state
        .connection
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    describe_table(&conn, &table_name)
}

#[tauri::command]
pub fn duckdb_count(state: State<'_, DuckDBState>, table_name: String) -> Result<i64, String> {
    let conn = state
        .connection
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    count_table(&conn, &table_name)
}

#[tauri::command]
pub fn duckdb_export_parquet(
    state: State<'_, DuckDBState>,
    table_name: String,
    output_path: String,
) -> Result<(), String> {
    let conn = state
        .connection
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let sql = format!(
        "COPY \"{}\" TO '{}' (FORMAT PARQUET)",
        table_name, output_path
    );

    conn.execute(&sql, [])
        .map_err(|e| format!("Failed to export: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn duckdb_export_to_bytes(
    state: State<'_, DuckDBState>,
    table_name: String,
) -> Result<Vec<u8>, String> {
    let conn = state
        .connection
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let temp_dir = tempfile::tempdir().map_err(|e| format!("Failed to create temp dir: {}", e))?;
    let temp_path = temp_dir.path().join(format!("{}.parquet", table_name));
    let temp_path_str = temp_path.to_string_lossy();

    let sql = format!(
        "COPY \"{}\" TO '{}' (FORMAT PARQUET)",
        table_name, temp_path_str
    );

    conn.execute(&sql, [])
        .map_err(|e| format!("Failed to export: {}", e))?;

    let bytes = fs::read(&temp_path).map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(bytes)
}

#[tauri::command]
pub fn duckdb_load_parquet_bytes(
    state: State<'_, DuckDBState>,
    table_name: String,
    bytes: Vec<u8>,
) -> Result<LoadResult, String> {
    let conn = state
        .connection
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let temp_dir = tempfile::tempdir().map_err(|e| format!("Failed to create temp dir: {}", e))?;
    let temp_path = temp_dir.path().join(format!("{}.parquet", table_name));

    fs::write(&temp_path, &bytes).map_err(|e| format!("Failed to write temp file: {}", e))?;

    let sql = format!(
        "CREATE TABLE \"{}\" AS SELECT * FROM read_parquet('{}')",
        table_name,
        temp_path.to_string_lossy()
    );

    conn.execute(&sql, [])
        .map_err(|e| format!("Failed to load parquet: {}", e))?;

    let columns = describe_table(&conn, &table_name)?;
    let row_count = count_table(&conn, &table_name)?;

    Ok(LoadResult {
        table_name,
        columns,
        row_count,
    })
}

fn describe_table(conn: &duckdb::Connection, table_name: &str) -> Result<Vec<ColumnInfo>, String> {
    let sql = format!("DESCRIBE \"{}\"", table_name);
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to describe: {}", e))?;

    let mut rows = stmt.query([]).map_err(|e| format!("Query error: {}", e))?;

    let mut columns = Vec::new();
    while let Some(row) = rows.next().map_err(|e| format!("Row error: {}", e))? {
        columns.push(ColumnInfo {
            name: row.get(0).unwrap_or_default(),
            duckdb_type: row.get(1).unwrap_or_default(),
        });
    }

    Ok(columns)
}

fn count_table(conn: &duckdb::Connection, table_name: &str) -> Result<i64, String> {
    let sql = format!("SELECT COUNT(*) FROM \"{}\"", table_name);
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare count: {}", e))?;

    let mut rows = stmt
        .query([])
        .map_err(|e| format!("Count query error: {}", e))?;

    if let Some(row) = rows.next().map_err(|e| format!("Count row error: {}", e))? {
        Ok(row.get(0).unwrap_or(0))
    } else {
        Ok(0)
    }
}

fn value_ref_to_json(value: ValueRef) -> Value {
    match value {
        ValueRef::Null => Value::Null,
        ValueRef::Boolean(b) => Value::Bool(b),
        ValueRef::TinyInt(n) => Value::Number(n.into()),
        ValueRef::SmallInt(n) => Value::Number(n.into()),
        ValueRef::Int(n) => Value::Number(n.into()),
        ValueRef::BigInt(n) => {
            if n > i32::MAX as i64 || n < i32::MIN as i64 {
                Value::String(n.to_string())
            } else {
                Value::Number(n.into())
            }
        }
        ValueRef::HugeInt(n) => Value::String(n.to_string()),
        ValueRef::UTinyInt(n) => Value::Number(n.into()),
        ValueRef::USmallInt(n) => Value::Number(n.into()),
        ValueRef::UInt(n) => Value::Number(n.into()),
        ValueRef::UBigInt(n) => {
            if n > i64::MAX as u64 {
                Value::String(n.to_string())
            } else {
                Value::Number((n as i64).into())
            }
        }
        ValueRef::Float(f) => serde_json::Number::from_f64(f as f64)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        ValueRef::Double(f) => serde_json::Number::from_f64(f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        ValueRef::Decimal(d) => Value::String(d.to_string()),
        ValueRef::Timestamp(unit, val) => {
            let micros = match unit {
                duckdb::types::TimeUnit::Second => val * 1_000_000,
                duckdb::types::TimeUnit::Millisecond => val * 1_000,
                duckdb::types::TimeUnit::Microsecond => val,
                duckdb::types::TimeUnit::Nanosecond => val / 1_000,
            };
            if let Some(dt) = chrono::DateTime::from_timestamp_micros(micros) {
                Value::String(dt.format("%Y-%m-%dT%H:%M:%S%.6fZ").to_string())
            } else {
                Value::String(val.to_string())
            }
        }
        ValueRef::Text(bytes) => Value::String(String::from_utf8_lossy(bytes).to_string()),
        ValueRef::Blob(bytes) => {
            Value::String(base64::engine::general_purpose::STANDARD.encode(bytes))
        }
        ValueRef::Date32(days) => {
            if let Some(date) = chrono::NaiveDate::from_num_days_from_ce_opt(days + 719163) {
                Value::String(date.to_string())
            } else {
                Value::String(days.to_string())
            }
        }
        ValueRef::Time64(unit, val) => {
            let micros = match unit {
                duckdb::types::TimeUnit::Second => val * 1_000_000,
                duckdb::types::TimeUnit::Millisecond => val * 1_000,
                duckdb::types::TimeUnit::Microsecond => val,
                duckdb::types::TimeUnit::Nanosecond => val / 1_000,
            };
            let secs = (micros / 1_000_000) as u32;
            let nano = ((micros % 1_000_000) * 1_000) as u32;
            if let Some(time) = chrono::NaiveTime::from_num_seconds_from_midnight_opt(secs, nano) {
                Value::String(time.to_string())
            } else {
                Value::String(val.to_string())
            }
        }
        ValueRef::Interval {
            months,
            days,
            nanos,
        } => Value::String(format!("{} months {} days {} nanos", months, days, nanos)),
        ValueRef::List(_, _) | ValueRef::Array(_, _) => Value::String("[array]".to_string()),
        ValueRef::Enum(_, _) => Value::String("[enum]".to_string()),
        ValueRef::Struct(_, _) => Value::String("[struct]".to_string()),
        ValueRef::Map(_, _) => Value::String("[map]".to_string()),
        ValueRef::Union(_, _) => Value::String("[union]".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use duckdb::types::TimeUnit;
    use duckdb::Connection;

    #[test]
    fn test_value_ref_to_json_null() {
        let result = value_ref_to_json(ValueRef::Null);
        assert_eq!(result, Value::Null);
    }

    #[test]
    fn test_value_ref_to_json_boolean() {
        assert_eq!(
            value_ref_to_json(ValueRef::Boolean(true)),
            Value::Bool(true)
        );
        assert_eq!(
            value_ref_to_json(ValueRef::Boolean(false)),
            Value::Bool(false)
        );
    }

    #[test]
    fn test_value_ref_to_json_integers() {
        assert_eq!(
            value_ref_to_json(ValueRef::TinyInt(42)),
            Value::Number(42.into())
        );
        assert_eq!(
            value_ref_to_json(ValueRef::SmallInt(1000)),
            Value::Number(1000.into())
        );
        assert_eq!(
            value_ref_to_json(ValueRef::Int(100000)),
            Value::Number(100000.into())
        );
        assert_eq!(
            value_ref_to_json(ValueRef::BigInt(1000000)),
            Value::Number(1000000.into())
        );
    }

    #[test]
    fn test_value_ref_to_json_bigint_large() {
        // BigInt larger than i32::MAX should be converted to string
        let large_value: i64 = i32::MAX as i64 + 1;
        let result = value_ref_to_json(ValueRef::BigInt(large_value));
        assert_eq!(result, Value::String(large_value.to_string()));
    }

    #[test]
    fn test_value_ref_to_json_bigint_negative_large() {
        // BigInt smaller than i32::MIN should be converted to string
        let large_value: i64 = i32::MIN as i64 - 1;
        let result = value_ref_to_json(ValueRef::BigInt(large_value));
        assert_eq!(result, Value::String(large_value.to_string()));
    }

    #[test]
    fn test_value_ref_to_json_huge_int() {
        let result = value_ref_to_json(ValueRef::HugeInt(123456789012345));
        assert_eq!(result, Value::String("123456789012345".to_string()));
    }

    #[test]
    fn test_value_ref_to_json_unsigned_integers() {
        assert_eq!(
            value_ref_to_json(ValueRef::UTinyInt(255)),
            Value::Number(255.into())
        );
        assert_eq!(
            value_ref_to_json(ValueRef::USmallInt(65535)),
            Value::Number(65535.into())
        );
        assert_eq!(
            value_ref_to_json(ValueRef::UInt(4294967295)),
            Value::Number(4294967295i64.into())
        );
    }

    #[test]
    fn test_value_ref_to_json_ubigint_large() {
        // UBigInt larger than i64::MAX should be converted to string
        let large_value: u64 = i64::MAX as u64 + 1;
        let result = value_ref_to_json(ValueRef::UBigInt(large_value));
        assert_eq!(result, Value::String(large_value.to_string()));
    }

    #[test]
    fn test_value_ref_to_json_float() {
        let result = value_ref_to_json(ValueRef::Float(3.14));
        if let Value::Number(n) = result {
            assert!((n.as_f64().unwrap() - 3.14).abs() < 0.01);
        } else {
            panic!("Expected Number");
        }
    }

    #[test]
    fn test_value_ref_to_json_double() {
        let result = value_ref_to_json(ValueRef::Double(3.14159));
        if let Value::Number(n) = result {
            assert!((n.as_f64().unwrap() - 3.14159).abs() < 0.0001);
        } else {
            panic!("Expected Number");
        }
    }

    #[test]
    fn test_value_ref_to_json_text() {
        let result = value_ref_to_json(ValueRef::Text(b"Hello, World!"));
        assert_eq!(result, Value::String("Hello, World!".to_string()));
    }

    #[test]
    fn test_value_ref_to_json_blob() {
        let bytes = vec![0x48, 0x65, 0x6c, 0x6c, 0x6f]; // "Hello" in bytes
        let result = value_ref_to_json(ValueRef::Blob(&bytes));
        // Should be base64 encoded
        assert_eq!(result, Value::String("SGVsbG8=".to_string()));
    }

    #[test]
    fn test_value_ref_to_json_timestamp_microsecond() {
        // Test that timestamp converts to ISO format string
        let micros: i64 = 1705322445123456;
        let result = value_ref_to_json(ValueRef::Timestamp(TimeUnit::Microsecond, micros));
        if let Value::String(s) = result {
            // Should contain a date and include microseconds
            assert!(
                s.contains("2024-01-15"),
                "Expected date 2024-01-15 in {}",
                s
            );
            // Time format includes microseconds (6 decimal places)
            assert!(s.contains(".123456"), "Expected microseconds in {}", s);
        } else {
            panic!("Expected String");
        }
    }

    #[test]
    fn test_value_ref_to_json_timestamp_millisecond() {
        let millis: i64 = 1705322445123;
        let result = value_ref_to_json(ValueRef::Timestamp(TimeUnit::Millisecond, millis));
        if let Value::String(s) = result {
            assert!(s.contains("2024-01-15"));
        } else {
            panic!("Expected String");
        }
    }

    #[test]
    fn test_value_ref_to_json_date32() {
        // Days since Unix epoch for 2024-01-15
        let days = 19737;
        let result = value_ref_to_json(ValueRef::Date32(days));
        if let Value::String(s) = result {
            assert!(s.contains("2024-01-15"));
        } else {
            panic!("Expected String, got {:?}", result);
        }
    }

    #[test]
    fn test_value_ref_to_json_interval() {
        let result = value_ref_to_json(ValueRef::Interval {
            months: 2,
            days: 15,
            nanos: 3600000000000,
        });
        assert_eq!(
            result,
            Value::String("2 months 15 days 3600000000000 nanos".to_string())
        );
    }

    #[test]
    fn test_describe_table() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE test (id INTEGER, name VARCHAR, value DOUBLE)",
            [],
        )
        .unwrap();

        let columns = describe_table(&conn, "test").unwrap();

        assert_eq!(columns.len(), 3);
        assert_eq!(columns[0].name, "id");
        assert_eq!(columns[0].duckdb_type, "INTEGER");
        assert_eq!(columns[1].name, "name");
        assert_eq!(columns[1].duckdb_type, "VARCHAR");
        assert_eq!(columns[2].name, "value");
        assert_eq!(columns[2].duckdb_type, "DOUBLE");
    }

    #[test]
    fn test_count_table() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("CREATE TABLE test (id INTEGER)", []).unwrap();
        conn.execute("INSERT INTO test VALUES (1), (2), (3)", [])
            .unwrap();

        let count = count_table(&conn, "test").unwrap();
        assert_eq!(count, 3);
    }

    #[test]
    fn test_count_table_empty() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("CREATE TABLE test (id INTEGER)", []).unwrap();

        let count = count_table(&conn, "test").unwrap();
        assert_eq!(count, 0);
    }
}
