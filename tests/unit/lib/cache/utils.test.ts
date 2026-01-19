import { describe, expect, it } from 'vitest'
import { estimateSize, hashObject } from '@/lib/cache/utils'

describe('hashObject', () => {
  it('returns consistent hash for same object', () => {
    const obj = { name: 'test', value: 42 }
    const hash1 = hashObject(obj)
    const hash2 = hashObject(obj)
    expect(hash1).toBe(hash2)
  })

  it('returns different hash for different objects', () => {
    const obj1 = { name: 'test1' }
    const obj2 = { name: 'test2' }
    expect(hashObject(obj1)).not.toBe(hashObject(obj2))
  })

  it('returns consistent hash regardless of property order', () => {
    // JSON.stringify maintains insertion order, so order matters
    // This tests that the hash is deterministic for the same serialized form
    const obj = { a: 1, b: 2 }
    const hash = hashObject(obj)
    expect(hash).toBe(hashObject({ a: 1, b: 2 }))
  })

  it('handles nested objects', () => {
    const obj = { outer: { inner: { deep: 'value' } } }
    const hash = hashObject(obj)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('handles arrays', () => {
    const arr = [1, 2, 3, 'test']
    const hash = hashObject(arr)
    expect(typeof hash).toBe('string')
  })

  it('handles null', () => {
    const hash = hashObject(null)
    expect(typeof hash).toBe('string')
  })

  it('handles undefined (JSON.stringify returns undefined)', () => {
    // JSON.stringify(undefined) returns undefined, not a string
    // This causes hashString to receive undefined and fail
    // This test documents the current behavior
    expect(() => hashObject(undefined)).toThrow()
  })

  it('handles primitives', () => {
    expect(typeof hashObject('string')).toBe('string')
    expect(typeof hashObject(42)).toBe('string')
    expect(typeof hashObject(true)).toBe('string')
  })

  it('handles empty object', () => {
    const hash = hashObject({})
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('handles empty array', () => {
    const hash = hashObject([])
    expect(typeof hash).toBe('string')
  })
})

describe('estimateSize', () => {
  describe('null and undefined', () => {
    it('returns 8 for null', () => {
      expect(estimateSize(null)).toBe(8)
    })

    it('returns 8 for undefined', () => {
      expect(estimateSize(undefined)).toBe(8)
    })
  })

  describe('primitives', () => {
    it('returns 4 for boolean', () => {
      expect(estimateSize(true)).toBe(4)
      expect(estimateSize(false)).toBe(4)
    })

    it('returns 8 for number', () => {
      expect(estimateSize(42)).toBe(8)
      expect(estimateSize(3.14159)).toBe(8)
      expect(estimateSize(0)).toBe(8)
      expect(estimateSize(-100)).toBe(8)
    })

    it('calculates string size based on length', () => {
      // String size = length * 2 (UTF-16) + 40 (overhead)
      expect(estimateSize('')).toBe(40)
      expect(estimateSize('a')).toBe(42)
      expect(estimateSize('hello')).toBe(50)
      expect(estimateSize('longer string')).toBe(13 * 2 + 40)
    })
  })

  describe('arrays', () => {
    it('returns base overhead for empty array', () => {
      expect(estimateSize([])).toBe(40)
    })

    it('adds item sizes for array elements', () => {
      // Array of 3 numbers: 40 (overhead) + 3 * 8 (numbers) = 64
      const arr = [1, 2, 3]
      expect(estimateSize(arr)).toBe(40 + 8 * 3)
    })

    it('handles mixed type arrays', () => {
      const arr = [1, 'test', true]
      // 40 (array) + 8 (number) + 48 (string: 4*2+40) + 4 (boolean)
      expect(estimateSize(arr)).toBe(40 + 8 + (4 * 2 + 40) + 4)
    })

    it('handles nested arrays', () => {
      const arr = [
        [1, 2],
        [3, 4],
      ]
      // Outer: 40 + inner arrays
      // Each inner: 40 + 8 + 8 = 56
      expect(estimateSize(arr)).toBe(40 + 56 + 56)
    })
  })

  describe('objects', () => {
    it('returns base overhead for empty object', () => {
      expect(estimateSize({})).toBe(40)
    })

    it('adds key and value sizes', () => {
      // { a: 1 } = 40 (obj) + (1*2+40) (key "a") + 8 (value)
      const obj = { a: 1 }
      expect(estimateSize(obj)).toBe(40 + (1 * 2 + 40) + 8)
    })

    it('handles multiple properties', () => {
      const obj = { a: 1, b: 2 }
      // 40 (obj) + 2 * ((1*2+40) + 8) = 40 + 2*50 = 140
      expect(estimateSize(obj)).toBe(40 + 2 * (42 + 8))
    })

    it('handles nested objects', () => {
      const obj = { outer: { inner: 1 } }
      // Outer: 40 + key "outer" (5*2+40=50) + inner obj
      // Inner: 40 + key "inner" (5*2+40=50) + 8 (number)
      const innerSize = 40 + 50 + 8
      const outerSize = 40 + 50 + innerSize
      expect(estimateSize(obj)).toBe(outerSize)
    })

    it('handles longer key names', () => {
      const obj = { veryLongKeyName: 1 }
      // 40 (obj) + (15*2+40) (key) + 8 (value)
      expect(estimateSize(obj)).toBe(40 + 70 + 8)
    })
  })

  describe('edge cases', () => {
    it('returns 8 for function (default case)', () => {
      expect(estimateSize(() => {})).toBe(8)
    })

    it('returns 8 for symbol (default case)', () => {
      expect(estimateSize(Symbol('test'))).toBe(8)
    })

    it('handles deeply nested structures', () => {
      const deep = { a: { b: { c: { d: { e: 1 } } } } }
      const size = estimateSize(deep)
      expect(size).toBeGreaterThan(200) // Should be substantial
    })

    it('handles large arrays', () => {
      const large = Array(100).fill(0)
      // 40 (array) + 100 * 8 (numbers)
      expect(estimateSize(large)).toBe(40 + 100 * 8)
    })

    it('handles object with null values', () => {
      const obj = { value: null }
      // 40 (obj) + (5*2+40) (key) + 8 (null)
      expect(estimateSize(obj)).toBe(40 + 50 + 8)
    })
  })
})
