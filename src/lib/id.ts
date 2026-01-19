export function generateId(prefix: string, randomLength = 6): string {
  const timestamp = Date.now()
  const random = Math.random()
    .toString(36)
    .slice(2, 2 + randomLength)
  return `${prefix}_${timestamp}_${random}`
}

export function generateShortId(length = 4): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length)
}

export function generateTimestampId(prefix: string): string {
  const timestamp = Date.now().toString(36)
  return `${prefix}_${timestamp}`
}
