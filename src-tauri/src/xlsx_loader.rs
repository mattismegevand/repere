use calamine::{open_workbook, Data, Range, Reader, Xlsx};
use duckdb::Connection;
use std::path::Path;

pub fn load_xlsx(conn: &Connection, table_name: &str, file_path: &str) -> Result<(), String> {
    let path = Path::new(file_path);
    let mut workbook: Xlsx<_> =
        open_workbook(path).map_err(|e| format!("Failed to open XLSX file: {}", e))?;

    let sheet_names = workbook.sheet_names().to_vec();
    if sheet_names.is_empty() {
        return Err("XLSX file has no sheets".to_string());
    }

    let range: Range<Data> = workbook
        .worksheet_range(&sheet_names[0])
        .map_err(|e| format!("Failed to read sheet: {}", e))?;

    if range.is_empty() {
        return Err("Sheet is empty".to_string());
    }

    let mut rows_iter = range.rows();

    let headers: Vec<String> = rows_iter
        .next()
        .ok_or("No header row")?
        .iter()
        .enumerate()
        .map(|(i, cell): (usize, &Data)| {
            let name = cell_to_string(cell);
            if name.trim().is_empty() {
                format!("column_{}", i + 1)
            } else {
                sanitize_column_name(&name)
            }
        })
        .collect();

    if headers.is_empty() {
        return Err("No columns found".to_string());
    }

    let columns_def: Vec<String> = headers
        .iter()
        .map(|h| format!("\"{}\" VARCHAR", h))
        .collect();

    let create_sql = format!(
        "CREATE TABLE \"{}\" ({})",
        table_name,
        columns_def.join(", ")
    );

    conn.execute(&create_sql, [])
        .map_err(|e| format!("Failed to create table: {}", e))?;

    let placeholders: Vec<String> = (0..headers.len()).map(|_| "?".to_string()).collect();
    let insert_sql = format!(
        "INSERT INTO \"{}\" VALUES ({})",
        table_name,
        placeholders.join(", ")
    );

    let mut stmt = conn
        .prepare(&insert_sql)
        .map_err(|e| format!("Failed to prepare insert: {}", e))?;

    for row in rows_iter {
        let values: Vec<String> = row
            .iter()
            .take(headers.len())
            .map(|cell: &Data| cell_to_string(cell))
            .collect();

        let params: Vec<&dyn duckdb::ToSql> =
            values.iter().map(|v| v as &dyn duckdb::ToSql).collect();

        stmt.execute(params.as_slice())
            .map_err(|e| format!("Failed to insert row: {}", e))?;
    }

    Ok(())
}

fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(s) => s.clone(),
        Data::Float(f) => f.to_string(),
        Data::Int(i) => i.to_string(),
        Data::Bool(b) => b.to_string(),
        Data::DateTime(dt) => {
            // ExcelDateTime stores the value - format it
            format!("{}", dt)
        }
        Data::DateTimeIso(s) => s.clone(),
        Data::DurationIso(s) => s.clone(),
        Data::Error(e) => format!("#ERROR: {:?}", e),
    }
}

fn sanitize_column_name(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();

    if sanitized.chars().next().is_none_or(|c| c.is_numeric()) {
        format!("col_{}", sanitized)
    } else {
        sanitized
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_column_name_simple() {
        assert_eq!(sanitize_column_name("name"), "name");
        assert_eq!(sanitize_column_name("column_1"), "column_1");
        assert_eq!(sanitize_column_name("MyColumn"), "MyColumn");
    }

    #[test]
    fn test_sanitize_column_name_with_spaces() {
        assert_eq!(sanitize_column_name("column name"), "column_name");
        assert_eq!(sanitize_column_name("first name"), "first_name");
        assert_eq!(sanitize_column_name("user id"), "user_id");
    }

    #[test]
    fn test_sanitize_column_name_with_special_chars() {
        assert_eq!(sanitize_column_name("column-name"), "column_name");
        assert_eq!(sanitize_column_name("column.name"), "column_name");
        assert_eq!(sanitize_column_name("column@name"), "column_name");
        assert_eq!(sanitize_column_name("column#name"), "column_name");
        assert_eq!(sanitize_column_name("column!name?"), "column_name_");
    }

    #[test]
    fn test_sanitize_column_name_starting_with_number() {
        assert_eq!(sanitize_column_name("1column"), "col_1column");
        assert_eq!(sanitize_column_name("123"), "col_123");
        assert_eq!(sanitize_column_name("9_test"), "col_9_test");
    }

    #[test]
    fn test_sanitize_column_name_empty() {
        assert_eq!(sanitize_column_name(""), "col_");
    }

    #[test]
    fn test_sanitize_column_name_unicode() {
        // Unicode letters should be preserved
        assert_eq!(sanitize_column_name("名前"), "名前");
        assert_eq!(sanitize_column_name("Ñame"), "Ñame");
    }

    #[test]
    fn test_sanitize_column_name_mixed() {
        assert_eq!(
            sanitize_column_name("User Name (Primary)"),
            "User_Name__Primary_"
        );
        assert_eq!(sanitize_column_name("Total $$$ Amount"), "Total_____Amount");
    }

    #[test]
    fn test_cell_to_string_empty() {
        assert_eq!(cell_to_string(&Data::Empty), "");
    }

    #[test]
    fn test_cell_to_string_string() {
        assert_eq!(cell_to_string(&Data::String("Hello".to_string())), "Hello");
    }

    #[test]
    fn test_cell_to_string_float() {
        assert_eq!(cell_to_string(&Data::Float(3.14)), "3.14");
        assert_eq!(cell_to_string(&Data::Float(100.0)), "100");
    }

    #[test]
    fn test_cell_to_string_int() {
        assert_eq!(cell_to_string(&Data::Int(42)), "42");
        assert_eq!(cell_to_string(&Data::Int(-100)), "-100");
    }

    #[test]
    fn test_cell_to_string_bool() {
        assert_eq!(cell_to_string(&Data::Bool(true)), "true");
        assert_eq!(cell_to_string(&Data::Bool(false)), "false");
    }
}
