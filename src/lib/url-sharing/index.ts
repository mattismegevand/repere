export interface UrlShareResult {
  success: boolean
  url?: string
  error?: string
  tooLarge?: boolean
  compressedSize?: number
  uncompressedSize?: number
}

// Max compressed size for URL sharing (500KB after base64 = ~375KB compressed)
const MAX_COMPRESSED_SIZE = 375 * 1024

/**
 * Convert a Blob to a base64url-encoded string.
 */
async function blobToBase64Url(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Convert to base64
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)

  // Convert to base64url (URL-safe)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Convert a base64url-encoded string back to a Blob.
 */
function base64UrlToBlob(base64url: string): Blob {
  // Convert base64url back to base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')

  // Add padding if needed
  while (base64.length % 4) {
    base64 += '='
  }

  // Decode base64
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Blob([bytes], { type: 'application/zip' })
}

/**
 * Generate a shareable URL from a session blob.
 */
export async function generateShareableUrl(sessionBlob: Blob): Promise<UrlShareResult> {
  const compressedSize = sessionBlob.size
  const uncompressedSize = compressedSize // ZIP is already compressed

  if (compressedSize > MAX_COMPRESSED_SIZE) {
    return {
      success: false,
      error: `Session is too large for URL sharing (${Math.round(compressedSize / 1024)}KB). Maximum is ${Math.round(MAX_COMPRESSED_SIZE / 1024)}KB.`,
      tooLarge: true,
      compressedSize,
      uncompressedSize,
    }
  }

  try {
    const encoded = await blobToBase64Url(sessionBlob)
    const url = `${window.location.origin}${window.location.pathname}#data=${encoded}`

    return {
      success: true,
      url,
      compressedSize,
      uncompressedSize,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate URL',
    }
  }
}

/**
 * Check if the current URL contains a session in the hash.
 */
export function hasUrlSession(): boolean {
  const hash = window.location.hash
  return hash.startsWith('#data=')
}

/**
 * Parse a session from the URL hash.
 * Returns the session blob if present, null otherwise.
 */
export function parseUrlSession(): Blob | null {
  const hash = window.location.hash
  if (!hash.startsWith('#data=')) {
    return null
  }

  const encoded = hash.slice(6) // Remove '#data='
  if (!encoded) {
    return null
  }

  try {
    return base64UrlToBlob(encoded)
  } catch (err) {
    console.error('Failed to parse URL session:', err)
    return null
  }
}

/**
 * Clear the session hash from the URL without triggering a page reload.
 */
export function clearUrlHash(): void {
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}
