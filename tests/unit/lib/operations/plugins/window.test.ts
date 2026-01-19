import { describe, expect, it } from 'vitest'
import { windowPlugin } from '@/lib/operations/plugins/window'
import type { Column } from '@/types/dataset'
import type { WindowOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'category', type: 'VARCHAR', nullable: true },
  { name: 'amount', type: 'DECIMAL', nullable: true },
  { name: 'date', type: 'DATE', nullable: true },
]

const mockContext = {
  sourceTableName: 'sales',
  sourceColumns: mockColumns,
}

describe('windowPlugin', () => {
  describe('validate', () => {
    it('returns valid operation for row_number', () => {
      const result = windowPlugin.validate(
        {
          function: 'row_number',
          outputColumn: 'row_num',
          partitionBy: ['category'],
          orderBy: [{ column: 'date', direction: 'ASC' }],
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'window',
        function: 'row_number',
        outputColumn: 'row_num',
        partitionBy: ['category'],
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation for rank', () => {
      const result = windowPlugin.validate(
        {
          function: 'rank',
          outputColumn: 'rank_num',
          partitionBy: ['category'],
          orderBy: [{ column: 'amount', direction: 'DESC' }],
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation for dense_rank', () => {
      const result = windowPlugin.validate(
        {
          function: 'dense_rank',
          outputColumn: 'dense_rank_num',
          partitionBy: [],
          orderBy: [{ column: 'amount', direction: 'DESC' }],
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation for ntile', () => {
      const result = windowPlugin.validate(
        {
          function: 'ntile',
          outputColumn: 'quartile',
          partitionBy: ['category'],
          orderBy: [{ column: 'amount', direction: 'ASC' }],
          ntileBuckets: 4,
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect((result.operation as WindowOperation).ntileBuckets).toBe(4)
    })

    it('returns valid operation for lag with column', () => {
      const result = windowPlugin.validate(
        {
          function: 'lag',
          column: 'amount',
          outputColumn: 'prev_amount',
          partitionBy: ['category'],
          orderBy: [{ column: 'date', direction: 'ASC' }],
          offset: 1,
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect((result.operation as WindowOperation).offset).toBe(1)
    })

    it('returns valid operation for lead with default value', () => {
      const result = windowPlugin.validate(
        {
          function: 'lead',
          column: 'amount',
          outputColumn: 'next_amount',
          partitionBy: ['category'],
          orderBy: [{ column: 'date', direction: 'ASC' }],
          offset: 2,
          defaultValue: 0,
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect((result.operation as WindowOperation).defaultValue).toBe(0)
    })

    it('returns valid operation for sum aggregate', () => {
      const result = windowPlugin.validate(
        {
          function: 'sum',
          column: 'amount',
          outputColumn: 'running_total',
          partitionBy: ['category'],
          orderBy: [{ column: 'date', direction: 'ASC' }],
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation for avg aggregate', () => {
      const result = windowPlugin.validate(
        {
          function: 'avg',
          column: 'amount',
          outputColumn: 'running_avg',
          partitionBy: ['category'],
          orderBy: [{ column: 'date', direction: 'ASC' }],
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation for first_value', () => {
      const result = windowPlugin.validate(
        {
          function: 'first_value',
          column: 'amount',
          outputColumn: 'first_amount',
          partitionBy: ['category'],
          orderBy: [{ column: 'date', direction: 'ASC' }],
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation for last_value', () => {
      const result = windowPlugin.validate(
        {
          function: 'last_value',
          column: 'amount',
          outputColumn: 'last_amount',
          partitionBy: ['category'],
          orderBy: [{ column: 'date', direction: 'ASC' }],
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
    })

    it('normalizes direction to uppercase', () => {
      const result = windowPlugin.validate(
        {
          function: 'row_number',
          outputColumn: 'row_num',
          partitionBy: [],
          orderBy: [{ column: 'date', direction: 'asc' }],
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect((result.operation as WindowOperation).orderBy[0].direction).toBe('ASC')
    })

    it('returns error for missing function', () => {
      const result = windowPlugin.validate(
        {
          outputColumn: 'test',
          partitionBy: [],
          orderBy: [],
        },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('window requires a function')
    })

    it('returns error for missing outputColumn', () => {
      const result = windowPlugin.validate(
        {
          function: 'row_number',
          partitionBy: [],
          orderBy: [],
        },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('window requires an outputColumn')
    })

    it('returns error for missing partitionBy', () => {
      const result = windowPlugin.validate(
        {
          function: 'row_number',
          outputColumn: 'test',
          orderBy: [],
        },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('window requires partitionBy array')
    })

    it('returns error for missing orderBy', () => {
      const result = windowPlugin.validate(
        {
          function: 'row_number',
          outputColumn: 'test',
          partitionBy: [],
        },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('window requires orderBy array')
    })

    it('returns error for non-existent partition column', () => {
      const result = windowPlugin.validate(
        {
          function: 'row_number',
          outputColumn: 'test',
          partitionBy: ['nonexistent'],
          orderBy: [{ column: 'date', direction: 'ASC' }],
        },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "nonexistent" does not exist')
    })

    it('returns error for non-existent orderBy column', () => {
      const result = windowPlugin.validate(
        {
          function: 'row_number',
          outputColumn: 'test',
          partitionBy: ['category'],
          orderBy: [{ column: 'invalid', direction: 'ASC' }],
        },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "invalid" does not exist')
    })

    it('returns error for lag without column', () => {
      const result = windowPlugin.validate(
        {
          function: 'lag',
          outputColumn: 'prev_val',
          partitionBy: [],
          orderBy: [{ column: 'date', direction: 'ASC' }],
        },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Window function "lag" requires a source column')
    })

    it('returns error for sum without column', () => {
      const result = windowPlugin.validate(
        {
          function: 'sum',
          outputColumn: 'running_sum',
          partitionBy: [],
          orderBy: [{ column: 'date', direction: 'ASC' }],
        },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Window function "sum" requires a source column')
    })

    it('returns error for non-existent source column', () => {
      const result = windowPlugin.validate(
        {
          function: 'sum',
          column: 'invalid',
          outputColumn: 'sum',
          partitionBy: [],
          orderBy: [{ column: 'date', direction: 'ASC' }],
        },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "invalid" does not exist')
    })
  })

  describe('buildSql', () => {
    it('generates SQL for row_number', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'row_number',
        outputColumn: 'row_num',
        partitionBy: ['category'],
        orderBy: [{ column: 'date', direction: 'ASC' }],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toBe(
        'SELECT *, ROW_NUMBER() OVER (PARTITION BY "category" ORDER BY "date" ASC) AS "row_num" FROM "sales"'
      )
    })

    it('generates SQL for rank', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'rank',
        outputColumn: 'rank_num',
        partitionBy: ['category'],
        orderBy: [{ column: 'amount', direction: 'DESC' }],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('RANK()')
      expect(sql).toContain('ORDER BY "amount" DESC')
    })

    it('generates SQL for dense_rank', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'dense_rank',
        outputColumn: 'dense_rank_num',
        partitionBy: [],
        orderBy: [{ column: 'amount', direction: 'DESC' }],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('DENSE_RANK()')
      expect(sql).not.toContain('PARTITION BY')
    })

    it('generates SQL for ntile with buckets', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'ntile',
        outputColumn: 'quartile',
        partitionBy: ['category'],
        orderBy: [{ column: 'amount', direction: 'ASC' }],
        ntileBuckets: 4,
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('NTILE(4)')
    })

    it('generates SQL for ntile with default buckets', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'ntile',
        outputColumn: 'quartile',
        partitionBy: [],
        orderBy: [{ column: 'amount', direction: 'ASC' }],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('NTILE(4)')
    })

    it('generates SQL for lag', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'lag',
        column: 'amount',
        outputColumn: 'prev_amount',
        partitionBy: ['category'],
        orderBy: [{ column: 'date', direction: 'ASC' }],
        offset: 1,
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('LAG("amount", 1)')
    })

    it('generates SQL for lag with default value', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'lag',
        column: 'amount',
        outputColumn: 'prev_amount',
        partitionBy: [],
        orderBy: [{ column: 'date', direction: 'ASC' }],
        offset: 1,
        defaultValue: 0,
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('LAG("amount", 1, 0)')
    })

    it('generates SQL for lead', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'lead',
        column: 'amount',
        outputColumn: 'next_amount',
        partitionBy: ['category'],
        orderBy: [{ column: 'date', direction: 'ASC' }],
        offset: 2,
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('LEAD("amount", 2)')
    })

    it('generates SQL for lead with default value', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'lead',
        column: 'amount',
        outputColumn: 'next_amount',
        partitionBy: [],
        orderBy: [{ column: 'date', direction: 'ASC' }],
        defaultValue: 'N/A',
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('LEAD("amount", 1, \'N/A\')')
    })

    it('generates SQL for first_value', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'first_value',
        column: 'amount',
        outputColumn: 'first_amount',
        partitionBy: ['category'],
        orderBy: [{ column: 'date', direction: 'ASC' }],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('FIRST_VALUE("amount")')
    })

    it('generates SQL for last_value', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'last_value',
        column: 'amount',
        outputColumn: 'last_amount',
        partitionBy: ['category'],
        orderBy: [{ column: 'date', direction: 'ASC' }],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('LAST_VALUE("amount")')
    })

    it('generates SQL for sum', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'sum',
        column: 'amount',
        outputColumn: 'running_total',
        partitionBy: ['category'],
        orderBy: [{ column: 'date', direction: 'ASC' }],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('SUM("amount")')
    })

    it('generates SQL for avg', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'avg',
        column: 'amount',
        outputColumn: 'running_avg',
        partitionBy: ['category'],
        orderBy: [{ column: 'date', direction: 'ASC' }],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('AVG("amount")')
    })

    it('generates SQL for count', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'count',
        column: 'id',
        outputColumn: 'running_count',
        partitionBy: ['category'],
        orderBy: [{ column: 'date', direction: 'ASC' }],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('COUNT("id")')
    })

    it('generates SQL for min', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'min',
        column: 'amount',
        outputColumn: 'min_so_far',
        partitionBy: ['category'],
        orderBy: [{ column: 'date', direction: 'ASC' }],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('MIN("amount")')
    })

    it('generates SQL for max', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'max',
        column: 'amount',
        outputColumn: 'max_so_far',
        partitionBy: ['category'],
        orderBy: [{ column: 'date', direction: 'ASC' }],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('MAX("amount")')
    })

    it('generates SQL with multiple partition columns', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'row_number',
        outputColumn: 'row_num',
        partitionBy: ['category', 'date'],
        orderBy: [{ column: 'amount', direction: 'DESC' }],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('PARTITION BY "category", "date"')
    })

    it('generates SQL with multiple orderBy columns', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'row_number',
        outputColumn: 'row_num',
        partitionBy: ['category'],
        orderBy: [
          { column: 'date', direction: 'ASC' },
          { column: 'amount', direction: 'DESC' },
        ],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('ORDER BY "date" ASC, "amount" DESC')
    })

    it('generates SQL without partition (empty partitionBy)', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'row_number',
        outputColumn: 'row_num',
        partitionBy: [],
        orderBy: [{ column: 'date', direction: 'ASC' }],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).not.toContain('PARTITION BY')
      expect(sql).toContain('ORDER BY "date" ASC')
    })

    it('generates SQL without order (empty orderBy)', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'row_number',
        outputColumn: 'row_num',
        partitionBy: ['category'],
        orderBy: [],
      }
      const sql = windowPlugin.buildSql(op, mockContext)
      expect(sql).toContain('PARTITION BY "category"')
      expect(sql).not.toContain('ORDER BY')
    })
  })

  describe('getSummary', () => {
    it('returns summary for ranking function', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'row_number',
        outputColumn: 'row_num',
        partitionBy: ['category'],
        orderBy: [{ column: 'date', direction: 'ASC' }],
      }
      expect(windowPlugin.getSummary(op)).toBe('row_number() over category')
    })

    it('returns summary for aggregate function with column', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'sum',
        column: 'amount',
        outputColumn: 'running_total',
        partitionBy: ['category'],
        orderBy: [{ column: 'date', direction: 'ASC' }],
      }
      expect(windowPlugin.getSummary(op)).toBe('sum(amount) over category')
    })

    it('returns summary with multiple partition columns', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'row_number',
        outputColumn: 'row_num',
        partitionBy: ['category', 'region'],
        orderBy: [{ column: 'date', direction: 'ASC' }],
      }
      expect(windowPlugin.getSummary(op)).toBe('row_number() over category, region')
    })

    it('returns summary without partition', () => {
      const op: WindowOperation = {
        type: 'window',
        function: 'row_number',
        outputColumn: 'row_num',
        partitionBy: [],
        orderBy: [{ column: 'date', direction: 'ASC' }],
      }
      expect(windowPlugin.getSummary(op)).toBe('row_number()')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(windowPlugin.type).toBe('window')
    })

    it('has correct category', () => {
      expect(windowPlugin.category).toBe('aggregate')
    })

    it('has tool definition with required parameters', () => {
      expect(windowPlugin.toolDefinition.name).toBe('window')
      expect(windowPlugin.toolDefinition.parameters.required).toContain('function')
      expect(windowPlugin.toolDefinition.parameters.required).toContain('outputColumn')
      expect(windowPlugin.toolDefinition.parameters.required).toContain('partitionBy')
      expect(windowPlugin.toolDefinition.parameters.required).toContain('orderBy')
    })
  })
})
