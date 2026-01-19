import { describe, expect, it } from 'vitest'
import { joinPlugin } from '@/lib/operations/plugins/join'
import type { Column } from '@/types/dataset'
import type { Dataset, JoinOperation } from '@/types/pipeline'

const leftColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'name', type: 'VARCHAR', nullable: true },
  { name: 'category_id', type: 'INTEGER', nullable: true },
]

const rightColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'category_name', type: 'VARCHAR', nullable: true },
]

const mockNodes: Record<string, Dataset> = {
  categories: {
    id: 'categories',
    type: 'dataset',
    name: 'Categories',
    fileName: 'categories.csv',
    fileSize: 500,
    rowCount: 10,
    columns: rightColumns,
    tableName: 'categories',
    createdAt: new Date(),
    position: { x: 100, y: 0 },
  },
}

const mockContext = {
  sourceTableName: 'products',
  sourceColumns: leftColumns,
  additionalSources: {
    categories: { tableName: 'categories', columns: rightColumns },
  },
}

describe('joinPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with inner join', () => {
      const result = joinPlugin.validate(
        {
          joinType: 'inner',
          rightSourceId: 'categories',
          conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
        },
        leftColumns,
        mockNodes
      )
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'join',
        joinType: 'inner',
        rightSourceId: 'categories',
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with left join', () => {
      const result = joinPlugin.validate(
        {
          joinType: 'left',
          rightSourceId: 'categories',
          conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
        },
        leftColumns,
        mockNodes
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with right join', () => {
      const result = joinPlugin.validate(
        {
          joinType: 'right',
          rightSourceId: 'categories',
          conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
        },
        leftColumns,
        mockNodes
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with full join', () => {
      const result = joinPlugin.validate(
        {
          joinType: 'full',
          rightSourceId: 'categories',
          conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
        },
        leftColumns,
        mockNodes
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with cross join (no conditions)', () => {
      const result = joinPlugin.validate({ joinType: 'cross', rightSourceId: 'categories' }, leftColumns, mockNodes)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with multiple conditions', () => {
      const result = joinPlugin.validate(
        {
          joinType: 'inner',
          rightSourceId: 'categories',
          conditions: [
            { leftColumn: 'category_id', rightColumn: 'id', operator: '=' },
            { leftColumn: 'name', rightColumn: 'category_name', operator: '!=' },
          ],
          conditionCombineMode: 'and',
        },
        leftColumns,
        mockNodes
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with OR conditions', () => {
      const result = joinPlugin.validate(
        {
          joinType: 'inner',
          rightSourceId: 'categories',
          conditions: [
            { leftColumn: 'category_id', rightColumn: 'id', operator: '=' },
            { leftColumn: 'id', rightColumn: 'id', operator: '=' },
          ],
          conditionCombineMode: 'or',
        },
        leftColumns,
        mockNodes
      )
      expect(result.valid).toBe(true)
      expect((result.operation as JoinOperation).conditionCombineMode).toBe('or')
    })

    it('returns error for missing joinType', () => {
      const result = joinPlugin.validate(
        {
          rightSourceId: 'categories',
          conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
        },
        leftColumns,
        mockNodes
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('join requires a joinType')
    })

    it('returns error for invalid joinType', () => {
      const result = joinPlugin.validate(
        {
          joinType: 'invalid',
          rightSourceId: 'categories',
          conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
        },
        leftColumns,
        mockNodes
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Invalid join type')
    })

    it('returns error for missing rightSourceId', () => {
      const result = joinPlugin.validate(
        {
          joinType: 'inner',
          conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
        },
        leftColumns,
        mockNodes
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('join requires a rightSourceId')
    })

    it('returns error for non-existent rightSourceId', () => {
      const result = joinPlugin.validate(
        {
          joinType: 'inner',
          rightSourceId: 'nonexistent',
          conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
        },
        leftColumns,
        mockNodes
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Table with ID "nonexistent" does not exist')
    })

    it('returns error for non-cross join without conditions', () => {
      const result = joinPlugin.validate(
        { joinType: 'inner', rightSourceId: 'categories', conditions: [] },
        leftColumns,
        mockNodes
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Non-cross joins require at least one condition')
    })

    it('returns error for invalid left column', () => {
      const result = joinPlugin.validate(
        {
          joinType: 'inner',
          rightSourceId: 'categories',
          conditions: [{ leftColumn: 'invalid', rightColumn: 'id', operator: '=' }],
        },
        leftColumns,
        mockNodes
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "invalid" does not exist')
    })

    it('returns error for invalid right column', () => {
      const result = joinPlugin.validate(
        {
          joinType: 'inner',
          rightSourceId: 'categories',
          conditions: [{ leftColumn: 'category_id', rightColumn: 'invalid', operator: '=' }],
        },
        leftColumns,
        mockNodes
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "invalid" does not exist')
    })
  })

  describe('buildSql', () => {
    it('generates INNER JOIN SQL', () => {
      const op: JoinOperation = {
        type: 'join',
        joinType: 'inner',
        rightSourceId: 'categories',
        conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
      }
      const sql = joinPlugin.buildSql(op, mockContext)
      expect(sql).toContain('INNER JOIN')
      expect(sql).toContain('"products" l')
      expect(sql).toContain('"categories" r')
      expect(sql).toContain('ON l."category_id" = r."id"')
    })

    it('generates LEFT JOIN SQL', () => {
      const op: JoinOperation = {
        type: 'join',
        joinType: 'left',
        rightSourceId: 'categories',
        conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
      }
      const sql = joinPlugin.buildSql(op, mockContext)
      expect(sql).toContain('LEFT JOIN')
    })

    it('generates RIGHT JOIN SQL', () => {
      const op: JoinOperation = {
        type: 'join',
        joinType: 'right',
        rightSourceId: 'categories',
        conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
      }
      const sql = joinPlugin.buildSql(op, mockContext)
      expect(sql).toContain('RIGHT JOIN')
    })

    it('generates FULL JOIN SQL', () => {
      const op: JoinOperation = {
        type: 'join',
        joinType: 'full',
        rightSourceId: 'categories',
        conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
      }
      const sql = joinPlugin.buildSql(op, mockContext)
      expect(sql).toContain('FULL JOIN')
    })

    it('generates CROSS JOIN SQL without ON clause', () => {
      const op: JoinOperation = {
        type: 'join',
        joinType: 'cross',
        rightSourceId: 'categories',
        conditions: [],
      }
      const sql = joinPlugin.buildSql(op, mockContext)
      expect(sql).toContain('CROSS JOIN')
      expect(sql).not.toContain(' ON ')
    })

    it('generates multiple conditions with AND', () => {
      const op: JoinOperation = {
        type: 'join',
        joinType: 'inner',
        rightSourceId: 'categories',
        conditions: [
          { leftColumn: 'category_id', rightColumn: 'id', operator: '=' },
          { leftColumn: 'name', rightColumn: 'category_name', operator: '!=' },
        ],
        conditionCombineMode: 'and',
      }
      const sql = joinPlugin.buildSql(op, mockContext)
      expect(sql).toContain(' AND ')
    })

    it('generates multiple conditions with OR', () => {
      const op: JoinOperation = {
        type: 'join',
        joinType: 'inner',
        rightSourceId: 'categories',
        conditions: [
          { leftColumn: 'category_id', rightColumn: 'id', operator: '=' },
          { leftColumn: 'id', rightColumn: 'id', operator: '=' },
        ],
        conditionCombineMode: 'or',
      }
      const sql = joinPlugin.buildSql(op, mockContext)
      expect(sql).toContain(' OR ')
    })

    it('aliases conflicting column names', () => {
      const op: JoinOperation = {
        type: 'join',
        joinType: 'inner',
        rightSourceId: 'categories',
        conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
      }
      const sql = joinPlugin.buildSql(op, mockContext)
      // 'id' exists in both tables, should be aliased
      expect(sql).toContain('r."id" AS "categories_id"')
    })

    it('throws error without additionalSources', () => {
      const op: JoinOperation = {
        type: 'join',
        joinType: 'inner',
        rightSourceId: 'categories',
        conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
      }
      expect(() => joinPlugin.buildSql(op, { ...mockContext, additionalSources: undefined })).toThrow(
        'Join requires additionalSources'
      )
    })
  })

  describe('getSummary', () => {
    it('returns summary for inner join', () => {
      const op: JoinOperation = {
        type: 'join',
        joinType: 'inner',
        rightSourceId: 'categories',
        conditions: [{ leftColumn: 'category_id', rightColumn: 'id', operator: '=' }],
      }
      expect(joinPlugin.getSummary(op)).toBe('⋈ INNER: category_id=id')
    })

    it('returns summary for cross join', () => {
      const op: JoinOperation = {
        type: 'join',
        joinType: 'cross',
        rightSourceId: 'categories',
        conditions: [],
      }
      expect(joinPlugin.getSummary(op)).toBe('× CROSS: ')
    })

    it('returns summary with multiple conditions', () => {
      const op: JoinOperation = {
        type: 'join',
        joinType: 'left',
        rightSourceId: 'categories',
        conditions: [
          { leftColumn: 'a', rightColumn: 'b', operator: '=' },
          { leftColumn: 'c', rightColumn: 'd', operator: '=' },
        ],
      }
      expect(joinPlugin.getSummary(op)).toBe('⋈ LEFT: a=b, c=d')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(joinPlugin.type).toBe('join')
    })

    it('has correct category', () => {
      expect(joinPlugin.category).toBe('combine')
    })

    it('has tool definition with required parameters', () => {
      expect(joinPlugin.toolDefinition.name).toBe('join')
      expect(joinPlugin.toolDefinition.parameters.required).toContain('joinType')
      expect(joinPlugin.toolDefinition.parameters.required).toContain('rightSourceId')
      expect(joinPlugin.toolDefinition.parameters.required).toContain('conditions')
    })
  })
})
