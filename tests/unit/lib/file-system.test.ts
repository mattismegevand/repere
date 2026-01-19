import { describe, expect, it } from 'vitest'
import { getFileExtension } from '@/lib/file-system'

describe('getFileExtension', () => {
  it('returns csv for .csv files', () => {
    expect(getFileExtension('data.csv')).toBe('csv')
  })

  it('returns parquet for .parquet files', () => {
    expect(getFileExtension('data.parquet')).toBe('parquet')
  })

  it('returns xlsx for .xlsx files', () => {
    expect(getFileExtension('data.xlsx')).toBe('xlsx')
  })

  it('handles files with multiple dots', () => {
    expect(getFileExtension('my.data.file.csv')).toBe('csv')
  })

  it('returns lowercase extension', () => {
    expect(getFileExtension('DATA.CSV')).toBe('csv')
  })

  it('returns empty string for files without extension', () => {
    expect(getFileExtension('noextension')).toBe('noextension')
  })
})
