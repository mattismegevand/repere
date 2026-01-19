import { expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, '../fixtures')

// DuckDB-WASM initialization can take 15-20s on first load
const APP_READY_TIMEOUT = 20000
const DATA_LOAD_TIMEOUT = 15000

export async function loadFile(page: Page, filename: string, mimeType = 'text/csv') {
  const filePath = path.join(FIXTURES_DIR, filename)
  const buffer = fs.readFileSync(filePath)

  const dataTransfer = await page.evaluateHandle(
    ({ bufferData, name, mime }) => {
      const dt = new DataTransfer()
      const file = new File([new Uint8Array(bufferData)], name, { type: mime })
      dt.items.add(file)
      return dt
    },
    { bufferData: Array.from(buffer), name: filename, mime: mimeType }
  )

  const dropZone = page.locator('div.cursor-pointer').filter({ hasText: 'Drop a file to start exploring' })
  await dropZone.dispatchEvent('drop', { dataTransfer })
}

export async function waitForAppReady(page: Page) {
  await expect(page.getByText('Drop a file to start exploring')).toBeVisible({ timeout: APP_READY_TIMEOUT })
}

export async function loadSampleCSV(page: Page) {
  await loadFile(page, 'sample.csv')
  await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: DATA_LOAD_TIMEOUT })
}

// After loading a file, app defaults to canvas view
// Button accessible name includes the action: "Switch to Table view" or "Switch to Canvas view"
export async function switchToCanvas(page: Page) {
  // If we see "Switch to Canvas view" button, we're on table - click to go to canvas
  const switchToCanvasBtn = page.getByRole('button', { name: /Switch to Canvas/i })
  if (await switchToCanvasBtn.isVisible()) {
    await switchToCanvasBtn.click()
  }
  await expect(page.locator('.react-flow')).toBeVisible()
}

export async function switchToTable(page: Page) {
  // If we see "Switch to Table view" button, we're on canvas - click to go to table
  const switchToTableBtn = page.getByRole('button', { name: /Switch to Table/i })
  if (await switchToTableBtn.isVisible()) {
    await switchToTableBtn.click()
  }
  // Wait for grid to be visible
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 5000 })
}

// Load sample CSV and switch to table view for tests that need the grid
async function _loadSampleCSVAndShowTable(page: Page) {
  await loadSampleCSV(page)
  await switchToTable(page)
}

export function getColumnHeader(page: Page, columnName: string) {
  return page.getByRole('columnheader', { name: new RegExp(columnName, 'i') })
}

export async function applySort(page: Page, columnName: string) {
  await page.getByRole('button', { name: `Sort ${columnName}` }).click()
  // After sorting, the button name changes to include "currently ascending/descending"
  await expect(page.getByRole('button', { name: new RegExp(`Sort ${columnName}, currently`, 'i') })).toBeVisible()
}

export async function openFilterPopover(page: Page, columnName: string) {
  await page.getByRole('button', { name: `Filter ${columnName}` }).click()
  // Wait for filter popover to open (it has data-tour="column-filter")
  await expect(page.locator('[data-tour="column-filter"]')).toBeVisible({ timeout: 5000 })
}

// Operator symbols in the filter UI
const OPERATOR_SYMBOLS: Record<string, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  contains: 'contains',
  notContains: 'excludes',
  startsWith: 'starts',
  endsWith: 'ends',
  isNull: 'empty',
  isNotNull: 'not empty',
}

export async function applyFilter(page: Page, columnName: string, operator: string = 'eq', value?: string) {
  await openFilterPopover(page, columnName)

  // Click operator button (buttons show symbols like "=", "contains", etc.)
  const symbol = OPERATOR_SYMBOLS[operator] || operator
  const filterPopover = page.locator('[data-tour="column-filter"]')
  await filterPopover.getByRole('button', { name: symbol, exact: true }).click()

  // Fill value if provided
  if (value !== undefined) {
    const input = filterPopover.locator('input')
    await input.fill(value)
  }

  // Click Apply
  await filterPopover.getByRole('button', { name: 'Apply' }).click()

  // Wait for popover to close
  await expect(filterPopover).not.toBeVisible({ timeout: 5000 })
}

export async function openCommandPalette(page: Page) {
  await page.keyboard.press('Meta+k')
  await expect(page.locator('[cmdk-input]')).toBeVisible()
}
