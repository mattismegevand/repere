import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

import { open, save } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'
import { pickFilesTauri, readFileTauri, saveFileTauri } from '@/lib/file-system/tauri-file-ops'

const mockOpen = vi.mocked(open)
const mockSave = vi.mocked(save)
const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)

describe('tauri-file-ops', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('pickFilesTauri', () => {
    it('should return empty array when dialog is cancelled', async () => {
      mockOpen.mockResolvedValue(null)

      const result = await pickFilesTauri()

      expect(result).toEqual([])
    })

    it('should handle single file selection', async () => {
      mockOpen.mockResolvedValue('/Users/test/data.csv')

      const result = await pickFilesTauri(false)

      expect(mockOpen).toHaveBeenCalledWith({
        multiple: false,
        filters: [
          {
            name: 'Data Files',
            extensions: ['csv', 'json', 'jsonl', 'parquet', 'xlsx', 'repere'],
          },
        ],
      })
      expect(result).toEqual([{ name: 'data.csv', path: '/Users/test/data.csv' }])
    })

    it('should handle multiple file selection', async () => {
      mockOpen.mockResolvedValue(['/path/file1.csv', '/path/file2.json'])

      const result = await pickFilesTauri(true)

      expect(mockOpen).toHaveBeenCalledWith({
        multiple: true,
        filters: expect.any(Array),
      })
      expect(result).toEqual([
        { name: 'file1.csv', path: '/path/file1.csv' },
        { name: 'file2.json', path: '/path/file2.json' },
      ])
    })

    it('should extract filename from Unix paths', async () => {
      mockOpen.mockResolvedValue('/home/user/documents/data.parquet')

      const result = await pickFilesTauri()

      expect(result[0].name).toBe('data.parquet')
    })

    it('should extract filename from Windows paths', async () => {
      mockOpen.mockResolvedValue('C:\\Users\\test\\Documents\\data.xlsx')

      const result = await pickFilesTauri()

      expect(result[0].name).toBe('data.xlsx')
    })

    it('should handle path with no filename (trailing slash)', async () => {
      mockOpen.mockResolvedValue('/path/to/folder/')

      const result = await pickFilesTauri()

      // Empty string after split will result in 'unknown'
      expect(result[0].name).toBe('unknown')
    })
  })

  describe('readFileTauri', () => {
    it('should read file and return Uint8Array', async () => {
      const mockData = new Uint8Array([72, 101, 108, 108, 111])
      mockReadFile.mockResolvedValue(mockData)

      const result = await readFileTauri('/path/to/file.txt')

      expect(mockReadFile).toHaveBeenCalledWith('/path/to/file.txt')
      expect(result).toBe(mockData)
    })

    it('should propagate read errors', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'))

      await expect(readFileTauri('/missing/file.txt')).rejects.toThrow('File not found')
    })
  })

  describe('saveFileTauri', () => {
    it('should return null when save dialog is cancelled', async () => {
      mockSave.mockResolvedValue(null)

      const result = await saveFileTauri('test.csv', new Uint8Array([1, 2, 3]), [{ name: 'CSV', extensions: ['csv'] }])

      expect(result).toBeNull()
      expect(mockWriteFile).not.toHaveBeenCalled()
    })

    it('should save Uint8Array contents', async () => {
      mockSave.mockResolvedValue('/path/to/saved.csv')
      mockWriteFile.mockResolvedValue(undefined)

      const data = new Uint8Array([1, 2, 3, 4, 5])
      const result = await saveFileTauri('test.csv', data, [{ name: 'CSV', extensions: ['csv'] }])

      expect(mockSave).toHaveBeenCalledWith({
        defaultPath: 'test.csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })
      expect(mockWriteFile).toHaveBeenCalledWith('/path/to/saved.csv', data)
      expect(result).toBe('/path/to/saved.csv')
    })

    it('should convert Blob to Uint8Array before saving', async () => {
      mockSave.mockResolvedValue('/path/to/saved.json')
      mockWriteFile.mockResolvedValue(undefined)

      // Create a mock Blob with arrayBuffer support
      const textContent = '{"test": true}'
      const encoder = new TextEncoder()
      const encodedData = encoder.encode(textContent)

      const mockBlob = {
        arrayBuffer: vi.fn().mockResolvedValue(encodedData.buffer),
      }
      // Make it pass instanceof Blob check
      Object.setPrototypeOf(mockBlob, Blob.prototype)

      const result = await saveFileTauri('data.json', mockBlob as unknown as Blob, [
        { name: 'JSON', extensions: ['json'] },
      ])

      expect(mockWriteFile).toHaveBeenCalledWith('/path/to/saved.json', expect.any(Uint8Array))
      expect(result).toBe('/path/to/saved.json')

      // Verify the Blob was correctly converted
      const writtenData = mockWriteFile.mock.calls[0][1] as Uint8Array
      const text = new TextDecoder().decode(writtenData)
      expect(text).toBe('{"test": true}')
    })

    it('should pass multiple filters correctly', async () => {
      mockSave.mockResolvedValue('/path/file.parquet')
      mockWriteFile.mockResolvedValue(undefined)

      await saveFileTauri('export.parquet', new Uint8Array([1]), [
        { name: 'Parquet', extensions: ['parquet'] },
        { name: 'CSV', extensions: ['csv'] },
      ])

      expect(mockSave).toHaveBeenCalledWith({
        defaultPath: 'export.parquet',
        filters: [
          { name: 'Parquet', extensions: ['parquet'] },
          { name: 'CSV', extensions: ['csv'] },
        ],
      })
    })

    it('should propagate write errors', async () => {
      mockSave.mockResolvedValue('/path/to/file.csv')
      mockWriteFile.mockRejectedValue(new Error('Permission denied'))

      await expect(
        saveFileTauri('test.csv', new Uint8Array([1]), [{ name: 'CSV', extensions: ['csv'] }])
      ).rejects.toThrow('Permission denied')
    })
  })
})
