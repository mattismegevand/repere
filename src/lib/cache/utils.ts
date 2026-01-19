/**
 * Simple hash function for strings (djb2 algorithm)
 */
function hashString(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}

/**
 * Hash an object by JSON-serializing and hashing the result
 */
export function hashObject(obj: unknown): string {
  return hashString(JSON.stringify(obj))
}

/**
 * Estimate the memory size of a value in bytes.
 * This is a rough approximation for cache budgeting.
 */
export function estimateSize(value: unknown): number {
  if (value === null || value === undefined) {
    return 8
  }

  switch (typeof value) {
    case 'boolean':
      return 4
    case 'number':
      return 8
    case 'string':
      return (value as string).length * 2 + 40 // UTF-16 + object overhead
    case 'object': {
      if (Array.isArray(value)) {
        let size = 40 // Array overhead
        for (const item of value) {
          size += estimateSize(item)
        }
        return size
      }

      // Regular object
      let size = 40 // Object overhead
      for (const key in value as Record<string, unknown>) {
        if (Object.hasOwn(value, key)) {
          size += key.length * 2 + 40 // Key string
          size += estimateSize((value as Record<string, unknown>)[key])
        }
      }
      return size
    }
    default:
      return 8
  }
}
