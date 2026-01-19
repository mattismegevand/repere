import { expect, test } from '@playwright/test'
import { waitForAppReady } from './fixtures'

test.describe('Onboarding Tour', () => {
  test('shows tour trigger on homepage', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)

    // Should show the "take a quick tour" button
    await expect(page.getByRole('button', { name: 'take a quick tour' })).toBeVisible()
  })

  test('starts tour when clicking tour trigger', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)

    // Click the tour trigger
    await page.getByRole('button', { name: 'take a quick tour' }).click()

    // Should load data and show the driver.js popover
    await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Your data, loaded instantly')).toBeVisible()
  })

  test('tour progresses through steps', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)

    // Start the tour
    await page.getByRole('button', { name: 'take a quick tour' }).click()

    // Wait for first step
    await expect(page.getByText('Your data, loaded instantly')).toBeVisible({ timeout: 15000 })

    // Click next to go to filter step
    await page.locator('.driver-popover-next-btn').click()
    await expect(page.getByText('Filter any column')).toBeVisible({ timeout: 5000 })

    // Click next again - tour progresses (content may vary)
    await page.locator('.driver-popover-next-btn').click()
    // Should still have a tour popover visible
    await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 5000 })
  })

  test('tour trigger link is visible on homepage', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)

    // Should show "take a quick tour" button
    await expect(page.getByRole('button', { name: 'take a quick tour' })).toBeVisible()
  })

  test('tour trigger link starts the tour', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)

    // Click the tour trigger
    await page.getByRole('button', { name: 'take a quick tour' }).click()

    // Should show the driver.js popover after loading data
    await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 15000 })
  })
})
