import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import './tour-styles.css'
import { useEffect, useRef } from 'react'
import { resetGlobalCacheManager } from '@/lib/cache'
import { usePipeline } from '@/lib/pipeline'
import { formatShortcut } from '@/lib/platform'
import { usePanelStore } from '@/stores'
import { useChatStore } from '@/stores/chatStore'
import type { FilterOperation, PivotOperation, SortOperation } from '@/types'

export function OnboardingTour() {
  const tourActive = usePanelStore((s) => s.tourActive)
  const setTourActive = usePanelStore((s) => s.setTourActive)
  const setCanvasMode = usePanelStore((s) => s.setCanvasMode)
  const setSqlPanel = usePanelStore((s) => s.setSqlPanel)
  const setCommandPalette = usePanelStore((s) => s.setCommandPalette)
  const setShowHomepage = usePanelStore((s) => s.setShowHomepage)
  const { loadSession, applyOrReplaceOperation, clearAllData, discardDraft, setActiveNode, getDatasets } = usePipeline()
  const resetChat = useChatStore((s) => s.reset)
  const isRunningRef = useRef(false)
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)

  // Store functions in refs to avoid stale closures
  const loadSessionRef = useRef(loadSession)
  const applyOpRef = useRef(applyOrReplaceOperation)
  const clearAllRef = useRef(clearAllData)
  const discardDraftRef = useRef(discardDraft)
  const resetChatRef = useRef(resetChat)
  const setCanvasModeRef = useRef(setCanvasMode)
  const setSqlPanelRef = useRef(setSqlPanel)
  const setCommandPaletteRef = useRef(setCommandPalette)
  const setShowHomepageRef = useRef(setShowHomepage)
  const setActiveNodeRef = useRef(setActiveNode)
  const getDatasetsRef = useRef(getDatasets)
  loadSessionRef.current = loadSession
  applyOpRef.current = applyOrReplaceOperation
  clearAllRef.current = clearAllData
  discardDraftRef.current = discardDraft
  resetChatRef.current = resetChat
  setCanvasModeRef.current = setCanvasMode
  setSqlPanelRef.current = setSqlPanel
  setCommandPaletteRef.current = setCommandPalette
  setShowHomepageRef.current = setShowHomepage
  setActiveNodeRef.current = setActiveNode
  getDatasetsRef.current = getDatasets

  useEffect(() => {
    if (!tourActive || isRunningRef.current) return

    isRunningRef.current = true

    async function runTour() {
      // Clear all existing data first
      await clearAllRef.current()
      resetChatRef.current()
      resetGlobalCacheManager()

      // Step 1: Load demo session
      try {
        const response = await fetch('/sample-data/demo.repere')
        const blob = await response.blob()
        const file = new File([blob], 'demo.repere')
        const result = await loadSessionRef.current(file)
        if (!result.success) {
          throw new Error('Failed to load demo session')
        }
      } catch (err) {
        console.error('Failed to load sample data:', err)
        setTourActive(false)
        isRunningRef.current = false
        return
      }

      // Wait for UI to settle
      await new Promise((r) => setTimeout(r, 500))

      // Hide homepage and select the orders dataset as active
      setShowHomepageRef.current(false)
      const datasets = getDatasetsRef.current()
      const ordersDataset = datasets.find((d) => d.name === 'orders')
      if (ordersDataset) {
        setActiveNodeRef.current(ordersDataset.id)
        await new Promise((r) => setTimeout(r, 300))
      }

      // Start tour on table view
      const driverObj = driver({
        showProgress: true,
        allowClose: true,
        animate: true,
        smoothScroll: true,
        overlayColor: 'black',
        overlayOpacity: 0.5,
        stagePadding: 8,
        stageRadius: 6,
        popoverOffset: 12,
        nextBtnText: 'Next →',
        prevBtnText: '← Back',
        doneBtnText: 'Done',
        progressText: '{{current}}/{{total}}',
        steps: [
          // Step 1: Welcome
          {
            popover: {
              title: 'Your data, loaded instantly',
              description: '50,000 orders loaded in milliseconds. Files never leave your browser.',
            },
          },
          // Step 2: Filter button
          {
            element: '[data-tour="filter-button"]',
            popover: {
              title: 'Filter any column',
              description: 'Press F on any column header to filter. Try filtering unit_price > $100...',
              side: 'left',
              align: 'start',
              onNextClick: async () => {
                const filterOp: FilterOperation = {
                  type: 'filter',
                  expression: {
                    type: 'group',
                    combineMode: 'and',
                    children: [{ type: 'condition', filter: { column: 'unit_price', operator: 'gt', value: 100 } }],
                  },
                }
                await applyOpRef.current(filterOp)
                await new Promise((r) => setTimeout(r, 300))
                driverObj.moveNext()
              },
            },
          },
          // Step 3: Filtered
          {
            popover: {
              title: 'Filtered: unit_price > $100',
              description: 'Only high-value orders are shown. Each filter creates a new view in your pipeline.',
              onNextClick: async () => {
                const sortOp: SortOperation = {
                  type: 'sort',
                  sorts: [{ column: 'unit_price', direction: 'desc' }],
                }
                await applyOpRef.current(sortOp)
                await new Promise((r) => setTimeout(r, 300))
                driverObj.moveNext()
              },
            },
          },
          // Step 4: Sorted
          {
            popover: {
              title: 'Sorted by unit_price',
              description: 'Highest first. You can also write custom SQL...',
              onNextClick: async () => {
                setSqlPanelRef.current(true)
                await new Promise((r) => setTimeout(r, 300))
                driverObj.moveNext()
              },
            },
          },
          // Step 5: SQL
          {
            element: '[data-tour="sql-panel"]',
            popover: {
              title: 'Write SQL',
              description: `Full DuckDB SQL. Edit the query or write your own. Toggle with ${formatShortcut('⌘`')}.`,
              side: 'top',
              align: 'center',
              onNextClick: async () => {
                setSqlPanelRef.current(false)
                await new Promise((r) => setTimeout(r, 200))
                const pivotOp: PivotOperation = {
                  type: 'pivot',
                  rowColumns: ['status'],
                  aggregations: [
                    { column: 'unit_price', function: 'sum', alias: 'Total Revenue' },
                    { column: 'quantity', function: 'sum', alias: 'Units Sold' },
                  ],
                  showSubtotals: false,
                  showGrandTotal: true,
                }
                await applyOpRef.current(pivotOp)
                await new Promise((r) => setTimeout(r, 500))
                driverObj.moveNext()
              },
            },
          },
          // Step 6: Pivot table
          {
            element: '[data-tour="pivot-table"]',
            popover: {
              title: 'Pivot table with drill-down',
              description: 'Grouped by order status. Click any value to filter and drill down.',
              side: 'left',
              align: 'start',
              onNextClick: async () => {
                // Click a cell to demonstrate drill-down
                const cell = document.querySelector(
                  '[data-tour="pivot-table"] tbody tr:nth-child(2) td:nth-child(2)'
                ) as HTMLElement
                if (cell) cell.click()
                await new Promise((r) => setTimeout(r, 400))
                driverObj.moveNext()
              },
            },
          },
          // Step 7: Drill-down result
          {
            popover: {
              title: 'Drilled down!',
              description: 'Clicking a value filters the data. A new view is added to your pipeline.',
              onNextClick: async () => {
                setCanvasModeRef.current(true)
                await new Promise((r) => setTimeout(r, 400))
                driverObj.moveNext()
              },
            },
          },
          // Step 8: Canvas
          {
            element: '[data-tour="pipeline-canvas"]',
            popover: {
              title: 'Visual pipeline',
              description: 'Every transformation is a node. Click any to jump back and explore.',
              side: 'left',
              align: 'center',
              onNextClick: async () => {
                setCanvasModeRef.current(false)
                await new Promise((r) => setTimeout(r, 300))
                setCommandPaletteRef.current(true)
                await new Promise((r) => setTimeout(r, 300))
                driverObj.moveNext()
              },
            },
          },
          // Step 9: Command palette
          {
            element: '[cmdk-root]',
            popover: {
              title: 'Command palette',
              description: `${formatShortcut('⌘K')} opens this. Export to CSV, Parquet, or share via URL.`,
              side: 'bottom',
              align: 'center',
              onNextClick: () => {
                setCommandPaletteRef.current(false)
                driverObj.moveNext()
              },
            },
          },
          // Step 10: Final with options
          {
            popover: {
              title: "You're ready!",
              description: `${formatShortcut('⌘K')} for commands, ${formatShortcut('⌘Z')} to undo, ${formatShortcut('⌘/')} for help.`,
              prevBtnText: 'Back to homepage',
              nextBtnText: 'Keep exploring',
              onPrevClick: async () => {
                driverObj.destroy()
                await discardDraftRef.current()
                await clearAllRef.current()
                resetChatRef.current()
                resetGlobalCacheManager()
                setShowHomepageRef.current(true)
              },
              onNextClick: () => {
                driverObj.destroy()
              },
            },
          },
        ],
        onDestroyed: () => {
          setTourActive(false)
          isRunningRef.current = false
        },
      })

      driverRef.current = driverObj
      driverObj.drive()
    }

    runTour()

    return () => {
      if (driverRef.current) {
        driverRef.current.destroy()
      }
      isRunningRef.current = false
    }
  }, [tourActive, setTourActive, setCanvasMode, setSqlPanel, setCommandPalette, setShowHomepage])

  return null
}
