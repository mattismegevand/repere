import { describe, expect, it } from 'vitest'
import { renameColumnsPlugin } from '@/lib/operations/plugins/rename-columns'
import type { Column } from '@/types/dataset'
import type { RenameColumnsOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'first_name', type: 'VARCHAR', nullable: true },
  { name: 'last_name', type: 'VARCHAR', nullable: true },
  { name: 'email', type: 'VARCHAR', nullable: true },
]

const mockContext = {
  sourceTableName: 'users',
  sourceColumns: mockColumns,
}

describe('renameColumnsPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with single rename', () => {
      const result = renameColumnsPlugin.validate({ renames: [{ from: 'first_name', to: 'given_name' }] }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'renameColumns',
        renames: [{ from: 'first_name', to: 'given_name' }],
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with multiple renames', () => {
      const result = renameColumnsPlugin.validate(
        {
          renames: [
            { from: 'first_name', to: 'given_name' },
            { from: 'last_name', to: 'family_name' },
          ],
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect((result.operation as RenameColumnsOperation).renames).toHaveLength(2)
    })

    it('returns error for empty renames array', () => {
      const result = renameColumnsPlugin.validate({ renames: [] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('renameColumns requires at least one rename')
    })

    it('returns error for missing renames', () => {
      const result = renameColumnsPlugin.validate({}, mockColumns)
      expect(result.valid).toBe(false)
    })

    it('returns error for non-existent source column', () => {
      const result = renameColumnsPlugin.validate({ renames: [{ from: 'nonexistent', to: 'new_name' }] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "nonexistent" does not exist')
    })

    it('returns error for empty target name', () => {
      const result = renameColumnsPlugin.validate({ renames: [{ from: 'first_name', to: '' }] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('must be a non-empty string')
    })

    it('returns error when target name conflicts with existing column', () => {
      const result = renameColumnsPlugin.validate({ renames: [{ from: 'first_name', to: 'email' }] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "email" already exists')
    })

    it('allows renaming to same name (no-op)', () => {
      const result = renameColumnsPlugin.validate({ renames: [{ from: 'first_name', to: 'first_name' }] }, mockColumns)
      expect(result.valid).toBe(true)
    })
  })

  describe('buildSql', () => {
    it('generates SELECT with AS for single rename', () => {
      const op: RenameColumnsOperation = {
        type: 'renameColumns',
        renames: [{ from: 'first_name', to: 'given_name' }],
      }
      const sql = renameColumnsPlugin.buildSql(op, mockContext)
      expect(sql).toContain('"first_name" AS "given_name"')
      expect(sql).toContain('FROM "users"')
    })

    it('generates SELECT with multiple AS clauses', () => {
      const op: RenameColumnsOperation = {
        type: 'renameColumns',
        renames: [
          { from: 'first_name', to: 'given_name' },
          { from: 'last_name', to: 'family_name' },
        ],
      }
      const sql = renameColumnsPlugin.buildSql(op, mockContext)
      expect(sql).toContain('"first_name" AS "given_name"')
      expect(sql).toContain('"last_name" AS "family_name"')
    })

    it('preserves unrenamed columns', () => {
      const op: RenameColumnsOperation = {
        type: 'renameColumns',
        renames: [{ from: 'first_name', to: 'given_name' }],
      }
      const sql = renameColumnsPlugin.buildSql(op, mockContext)
      expect(sql).toContain('"id"')
      expect(sql).toContain('"email"')
    })

    it('escapes special characters in column names', () => {
      const op: RenameColumnsOperation = {
        type: 'renameColumns',
        renames: [{ from: 'first_name', to: 'given-name' }],
      }
      const sql = renameColumnsPlugin.buildSql(op, mockContext)
      expect(sql).toContain('"first_name" AS "given-name"')
    })
  })

  describe('getSummary', () => {
    it('returns from -> to for single rename', () => {
      const op: RenameColumnsOperation = {
        type: 'renameColumns',
        renames: [{ from: 'old', to: 'new' }],
      }
      expect(renameColumnsPlugin.getSummary(op)).toBe('old -> new')
    })

    it('returns count for multiple renames', () => {
      const op: RenameColumnsOperation = {
        type: 'renameColumns',
        renames: [
          { from: 'a', to: 'b' },
          { from: 'c', to: 'd' },
        ],
      }
      expect(renameColumnsPlugin.getSummary(op)).toBe('Rename 2 columns')
    })

    it('returns count for many renames', () => {
      const op: RenameColumnsOperation = {
        type: 'renameColumns',
        renames: [
          { from: 'a', to: 'b' },
          { from: 'c', to: 'd' },
          { from: 'e', to: 'f' },
          { from: 'g', to: 'h' },
        ],
      }
      expect(renameColumnsPlugin.getSummary(op)).toBe('Rename 4 columns')
    })
  })

  describe('merge', () => {
    it('merges two rename operations', () => {
      const existing: RenameColumnsOperation = {
        type: 'renameColumns',
        renames: [{ from: 'a', to: 'b' }],
      }
      const incoming: RenameColumnsOperation = {
        type: 'renameColumns',
        renames: [{ from: 'c', to: 'd' }],
      }
      const merged = renameColumnsPlugin.merge!(existing, incoming)
      expect(merged.renames).toHaveLength(2)
    })

    it('overwrites rename for same column', () => {
      const existing: RenameColumnsOperation = {
        type: 'renameColumns',
        renames: [{ from: 'a', to: 'b' }],
      }
      const incoming: RenameColumnsOperation = {
        type: 'renameColumns',
        renames: [{ from: 'a', to: 'c' }],
      }
      const merged = renameColumnsPlugin.merge!(existing, incoming)
      expect(merged.renames).toHaveLength(1)
      expect(merged.renames[0]).toEqual({ from: 'a', to: 'c' })
    })

    it('canMerge returns true', () => {
      expect(renameColumnsPlugin.canMerge!({} as RenameColumnsOperation, {} as RenameColumnsOperation)).toBe(true)
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(renameColumnsPlugin.type).toBe('renameColumns')
    })

    it('has correct category', () => {
      expect(renameColumnsPlugin.category).toBe('column')
    })

    it('has tool definition with required renames parameter', () => {
      expect(renameColumnsPlugin.toolDefinition.name).toBe('renameColumns')
      expect(renameColumnsPlugin.toolDefinition.parameters.required).toContain('renames')
    })
  })
})
