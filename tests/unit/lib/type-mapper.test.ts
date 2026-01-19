import { describe, expect, it } from 'vitest'
import { mapColumnTypeToDuckDB, mapDuckDBType } from '@/lib/duckdb/type-mapper'

describe('mapDuckDBType', () => {
  describe('integer types', () => {
    it('maps INTEGER to number', () => {
      expect(mapDuckDBType('INTEGER')).toBe('number')
    })

    it('maps INT to number', () => {
      expect(mapDuckDBType('INT')).toBe('number')
    })

    it('maps BIGINT to number', () => {
      expect(mapDuckDBType('BIGINT')).toBe('number')
    })

    it('maps SMALLINT to number', () => {
      expect(mapDuckDBType('SMALLINT')).toBe('number')
    })

    it('maps TINYINT to number', () => {
      expect(mapDuckDBType('TINYINT')).toBe('number')
    })

    it('maps HUGEINT to number', () => {
      expect(mapDuckDBType('HUGEINT')).toBe('number')
    })

    it('maps UHUGEINT to number', () => {
      expect(mapDuckDBType('UHUGEINT')).toBe('number')
    })

    it('maps UBIGINT to number', () => {
      expect(mapDuckDBType('UBIGINT')).toBe('number')
    })

    it('maps UINTEGER to number', () => {
      expect(mapDuckDBType('UINTEGER')).toBe('number')
    })
  })

  describe('decimal/float types', () => {
    it('maps DOUBLE to number', () => {
      expect(mapDuckDBType('DOUBLE')).toBe('number')
    })

    it('maps FLOAT to number', () => {
      expect(mapDuckDBType('FLOAT')).toBe('number')
    })

    it('maps REAL to number', () => {
      expect(mapDuckDBType('REAL')).toBe('number')
    })

    it('maps DECIMAL to number', () => {
      expect(mapDuckDBType('DECIMAL')).toBe('number')
    })

    it('maps DECIMAL(10,2) to number', () => {
      expect(mapDuckDBType('DECIMAL(10,2)')).toBe('number')
    })

    it('maps NUMERIC to number', () => {
      expect(mapDuckDBType('NUMERIC')).toBe('number')
    })

    it('maps NUMERIC(18,4) to number', () => {
      expect(mapDuckDBType('NUMERIC(18,4)')).toBe('number')
    })
  })

  describe('string types', () => {
    it('maps VARCHAR to string', () => {
      expect(mapDuckDBType('VARCHAR')).toBe('string')
    })

    it('maps VARCHAR(100) to string (strips length)', () => {
      expect(mapDuckDBType('VARCHAR(100)')).toBe('string')
    })

    it('maps TEXT to string', () => {
      expect(mapDuckDBType('TEXT')).toBe('string')
    })

    it('maps CHAR to string', () => {
      expect(mapDuckDBType('CHAR')).toBe('string')
    })

    it('maps CHAR(10) to string', () => {
      expect(mapDuckDBType('CHAR(10)')).toBe('string')
    })

    it('maps STRING to string', () => {
      expect(mapDuckDBType('STRING')).toBe('string')
    })
  })

  describe('boolean type', () => {
    it('maps BOOLEAN to boolean', () => {
      expect(mapDuckDBType('BOOLEAN')).toBe('boolean')
    })

    it('maps BOOL to boolean', () => {
      expect(mapDuckDBType('BOOL')).toBe('boolean')
    })
  })

  describe('date types', () => {
    it('maps DATE to date', () => {
      expect(mapDuckDBType('DATE')).toBe('date')
    })
  })

  describe('time types', () => {
    it('maps TIME to time', () => {
      expect(mapDuckDBType('TIME')).toBe('time')
    })

    it('maps TIME WITH TIME ZONE to time', () => {
      expect(mapDuckDBType('TIME WITH TIME ZONE')).toBe('time')
    })
  })

  describe('timestamp types', () => {
    it('maps TIMESTAMP to timestamp', () => {
      expect(mapDuckDBType('TIMESTAMP')).toBe('timestamp')
    })

    it('maps TIMESTAMP WITH TIME ZONE to timestamp', () => {
      expect(mapDuckDBType('TIMESTAMP WITH TIME ZONE')).toBe('timestamp')
    })

    it('maps TIMESTAMPTZ to timestamp', () => {
      expect(mapDuckDBType('TIMESTAMPTZ')).toBe('timestamp')
    })

    it('maps TIMESTAMP_S to timestamp', () => {
      expect(mapDuckDBType('TIMESTAMP_S')).toBe('timestamp')
    })

    it('maps TIMESTAMP_MS to timestamp', () => {
      expect(mapDuckDBType('TIMESTAMP_MS')).toBe('timestamp')
    })

    it('maps TIMESTAMP_NS to timestamp', () => {
      expect(mapDuckDBType('TIMESTAMP_NS')).toBe('timestamp')
    })
  })

  describe('uuid type', () => {
    it('maps UUID to uuid', () => {
      expect(mapDuckDBType('UUID')).toBe('uuid')
    })
  })

  describe('json types', () => {
    it('maps JSON to json', () => {
      expect(mapDuckDBType('JSON')).toBe('json')
    })

    it('maps JSONB to json', () => {
      expect(mapDuckDBType('JSONB')).toBe('json')
    })
  })

  describe('blob type', () => {
    it('maps BLOB to blob', () => {
      expect(mapDuckDBType('BLOB')).toBe('blob')
    })

    it('maps BYTEA to blob', () => {
      expect(mapDuckDBType('BYTEA')).toBe('blob')
    })
  })

  describe('interval type', () => {
    it('maps INTERVAL to interval', () => {
      expect(mapDuckDBType('INTERVAL')).toBe('interval')
    })
  })

  describe('array types', () => {
    it('maps INTEGER[] to array', () => {
      expect(mapDuckDBType('INTEGER[]')).toBe('array')
    })

    it('maps VARCHAR[] to array', () => {
      expect(mapDuckDBType('VARCHAR[]')).toBe('array')
    })

    it('maps DOUBLE[] to array', () => {
      expect(mapDuckDBType('DOUBLE[]')).toBe('array')
    })

    it('maps LIST type to array', () => {
      expect(mapDuckDBType('LIST')).toBe('array')
    })

    it('maps LIST(INTEGER) to array', () => {
      expect(mapDuckDBType('LIST(INTEGER)')).toBe('array')
    })
  })

  describe('struct and map types', () => {
    // Note: The type-mapper uses substring matching, so complex nested types
    // like STRUCT(a INTEGER, b VARCHAR) will be misidentified based on their
    // inner type names. Only simple STRUCT and MAP types are correctly identified.
    it('maps STRUCT to json', () => {
      expect(mapDuckDBType('STRUCT')).toBe('json')
    })

    it('maps MAP to json', () => {
      expect(mapDuckDBType('MAP')).toBe('json')
    })
  })

  describe('unknown types', () => {
    it('returns unknown for unrecognized types', () => {
      expect(mapDuckDBType('GEOMETRY')).toBe('unknown')
    })

    it('returns unknown for empty string', () => {
      expect(mapDuckDBType('')).toBe('unknown')
    })

    it('returns unknown for gibberish', () => {
      expect(mapDuckDBType('FOOBAR')).toBe('unknown')
    })
  })

  describe('case insensitivity', () => {
    it('handles lowercase types', () => {
      expect(mapDuckDBType('integer')).toBe('number')
      expect(mapDuckDBType('varchar')).toBe('string')
      expect(mapDuckDBType('boolean')).toBe('boolean')
    })

    it('handles mixed case types', () => {
      expect(mapDuckDBType('VarChar')).toBe('string')
      expect(mapDuckDBType('TimeStamp')).toBe('timestamp')
      expect(mapDuckDBType('BigInt')).toBe('number')
    })
  })
})

describe('mapColumnTypeToDuckDB', () => {
  it('maps number to DOUBLE', () => {
    expect(mapColumnTypeToDuckDB('number')).toBe('DOUBLE')
  })

  it('maps string to VARCHAR', () => {
    expect(mapColumnTypeToDuckDB('string')).toBe('VARCHAR')
  })

  it('maps boolean to BOOLEAN', () => {
    expect(mapColumnTypeToDuckDB('boolean')).toBe('BOOLEAN')
  })

  it('maps date to DATE', () => {
    expect(mapColumnTypeToDuckDB('date')).toBe('DATE')
  })

  it('maps time to TIME', () => {
    expect(mapColumnTypeToDuckDB('time')).toBe('TIME')
  })

  it('maps timestamp to TIMESTAMP', () => {
    expect(mapColumnTypeToDuckDB('timestamp')).toBe('TIMESTAMP')
  })

  it('maps uuid to UUID', () => {
    expect(mapColumnTypeToDuckDB('uuid')).toBe('UUID')
  })

  it('maps json to JSON', () => {
    expect(mapColumnTypeToDuckDB('json')).toBe('JSON')
  })

  it('maps blob to BLOB', () => {
    expect(mapColumnTypeToDuckDB('blob')).toBe('BLOB')
  })

  it('maps interval to INTERVAL', () => {
    expect(mapColumnTypeToDuckDB('interval')).toBe('INTERVAL')
  })

  it('maps array to VARCHAR[] (default)', () => {
    expect(mapColumnTypeToDuckDB('array')).toBe('VARCHAR[]')
  })

  it('maps unknown to VARCHAR (safe fallback)', () => {
    expect(mapColumnTypeToDuckDB('unknown')).toBe('VARCHAR')
  })

  it('maps unrecognized type to VARCHAR (safe fallback)', () => {
    // @ts-expect-error testing fallback for invalid type
    expect(mapColumnTypeToDuckDB('invalid')).toBe('VARCHAR')
  })
})

describe('type mapping roundtrip', () => {
  it('maintains consistency for common types', () => {
    // number -> DOUBLE -> number
    expect(mapDuckDBType(mapColumnTypeToDuckDB('number'))).toBe('number')

    // string -> VARCHAR -> string
    expect(mapDuckDBType(mapColumnTypeToDuckDB('string'))).toBe('string')

    // boolean -> BOOLEAN -> boolean
    expect(mapDuckDBType(mapColumnTypeToDuckDB('boolean'))).toBe('boolean')

    // date -> DATE -> date
    expect(mapDuckDBType(mapColumnTypeToDuckDB('date'))).toBe('date')

    // timestamp -> TIMESTAMP -> timestamp
    expect(mapDuckDBType(mapColumnTypeToDuckDB('timestamp'))).toBe('timestamp')
  })
})
