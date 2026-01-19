use duckdb::Connection;
use std::sync::Mutex;

pub struct DuckDBState {
    pub connection: Mutex<Connection>,
}

impl DuckDBState {
    pub fn new() -> Result<Self, duckdb::Error> {
        let conn = Connection::open_in_memory()?;
        Ok(Self {
            connection: Mutex::new(conn),
        })
    }
}
