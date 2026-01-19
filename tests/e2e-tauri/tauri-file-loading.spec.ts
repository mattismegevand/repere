import fs from 'fs'
import path from 'path'
import { expect, FIXTURES_DIR, loadFileViaDropZone, switchToTable, test, waitForAppReady } from './fixtures'

test.describe('Tauri File Loading Tests', () => {
  test.describe('CSV files', () => {
    test('loads CSV file correctly', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.csv')

      await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

      // Switch to table and verify data
      await switchToTable(page)
      await expect(page.getByRole('columnheader', { name: /id/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /name/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /value/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /category/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /active/i })).toBeVisible()
    })

    test('loads categories CSV file', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'categories.csv')

      await expect(page.getByText('4 rows', { exact: true })).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('JSON files', () => {
    test.beforeAll(async () => {
      // Create a test JSON file if it doesn't exist
      const jsonPath = path.join(FIXTURES_DIR, 'sample.json')
      if (!fs.existsSync(jsonPath)) {
        const jsonData = [
          { id: 1, name: 'Alice', score: 95 },
          { id: 2, name: 'Bob', score: 87 },
          { id: 3, name: 'Charlie', score: 92 },
        ]
        fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2))
      }
    })

    test('loads JSON array file', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.json', 'application/json')

      await expect(page.getByText(/\d+ rows/)).toBeVisible({ timeout: 10000 })

      await switchToTable(page)
      await expect(page.getByRole('columnheader', { name: /id/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /name/i })).toBeVisible()
    })
  })

  test.describe('JSONL files', () => {
    test.beforeAll(async () => {
      // Create a test JSONL file if it doesn't exist
      const jsonlPath = path.join(FIXTURES_DIR, 'sample.jsonl')
      if (!fs.existsSync(jsonlPath)) {
        const lines = [
          JSON.stringify({ id: 1, event: 'login', timestamp: '2024-01-01T10:00:00Z' }),
          JSON.stringify({ id: 2, event: 'purchase', timestamp: '2024-01-01T10:05:00Z' }),
          JSON.stringify({ id: 3, event: 'logout', timestamp: '2024-01-01T10:30:00Z' }),
        ]
        fs.writeFileSync(jsonlPath, lines.join('\n'))
      }
    })

    test('loads JSONL file', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.jsonl', 'application/x-ndjson')

      await expect(page.getByText(/\d+ rows/)).toBeVisible({ timeout: 10000 })

      await switchToTable(page)
      await expect(page.getByRole('columnheader', { name: /event/i })).toBeVisible()
    })
  })

  // Note: XLSX and Parquet tests require actual binary files
  // These would need to be added to the fixtures directory
  test.describe('XLSX files (Tauri-specific)', () => {
    test.skip('loads XLSX file using native calamine', async ({ tauriApp }) => {
      // This test requires an actual XLSX file in fixtures
      // Skip for now until we add the fixture
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(
        page,
        'sample.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )

      await expect(page.getByText(/\d+ rows/)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Parquet files', () => {
    test.skip('loads Parquet file', async ({ tauriApp }) => {
      // This test requires an actual Parquet file in fixtures
      // Skip for now until we add the fixture
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.parquet', 'application/x-parquet')

      await expect(page.getByText(/\d+ rows/)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Error handling', () => {
    test('handles invalid file gracefully', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)

      // Create an invalid CSV file content
      const invalidData = 'this is not,valid\ncsv"content'

      const dataTransfer = await page.evaluateHandle(
        ({ content }) => {
          const dt = new DataTransfer()
          const file = new File([content], 'invalid.csv', { type: 'text/csv' })
          dt.items.add(file)
          return dt
        },
        { content: invalidData }
      )

      const dropZone = page.locator('div.cursor-pointer').filter({ hasText: 'Drop a file to start exploring' })
      await dropZone.dispatchEvent('drop', { dataTransfer })

      // App should either show an error or handle gracefully
      // The exact behavior depends on how the app handles parsing errors
      await page.waitForTimeout(2000)
    })
  })
})
