import { useCallback, useEffect, useRef } from 'react'
import { resetGlobalCacheManager } from '@/lib/cache'
import { useDuckDB } from '@/lib/duckdb'
import { pickFiles } from '@/lib/file-system'
import { usePipeline } from '@/lib/pipeline'
import { useChatStore } from '@/stores/chatStore'
import { usePanelStore } from '@/stores/panelStore'
import { CTASection } from './CTASection'
import { DataFlowAnimation } from './DataFlowAnimation'
import { EnterpriseSection } from './EnterpriseSection'
import { FeatureShowcase } from './FeatureShowcase'
import { FileFormatComparison } from './FileFormatComparison'
import { Footer } from './Footer'
import { HeroSection } from './HeroSection'
import { HowItWorks } from './HowItWorks'
import { GlowContainer } from './MouseGlow'
import { OperationsGrid } from './OperationsGrid'
import { ProductShowcase } from './ProductShowcase'
import { RoadmapSection } from './RoadmapSection'

// Track if hero animations have played (persists across StrictMode remounts)
let heroAnimated = false

interface HomepageProps {
  isDragOver?: boolean
}

export function Homepage({ isDragOver = false }: HomepageProps) {
  const { loading: dbLoading } = useDuckDB()
  const { loadDatasetFromPicked, loadSession, setError, forceSave, getDatasets, setActiveNode, clearAllData } =
    usePipeline()
  const startTour = usePanelStore((s) => s.startTour)
  const setCanvasMode = usePanelStore((s) => s.setCanvasMode)
  const setShowHomepage = usePanelStore((s) => s.setShowHomepage)
  const resetChat = useChatStore((s) => s.reset)
  const containerRef = useRef<HTMLDivElement>(null)

  // Only animate on first mount (prevents double animation in StrictMode)
  const shouldAnimate = useRef(!heroAnimated)
  heroAnimated = true
  const animationClass = shouldAnimate.current ? 'animate-fade-in-up' : ''

  const handleOpenFile = useCallback(async () => {
    const pickedFiles = await pickFiles(true)
    let firstDataset = null
    for (const picked of pickedFiles) {
      const dataset = await loadDatasetFromPicked(picked)
      if (dataset) {
        if (!firstDataset) firstDataset = dataset
        await forceSave()
      }
    }
    if (firstDataset) {
      setActiveNode(firstDataset.id)
      setShowHomepage(false)
      setCanvasMode(true)
    }
  }, [loadDatasetFromPicked, forceSave, setCanvasMode, setActiveNode, setShowHomepage])

  const handleLoadSampleData = useCallback(async () => {
    try {
      // Clear all existing data first
      await clearAllData()
      resetChat()
      resetGlobalCacheManager()

      const response = await fetch('/sample-data/demo.repere')
      const blob = await response.blob()
      const file = new File([blob], 'demo.repere', { type: 'application/json' })
      await loadSession(file)

      // Switch to canvas view and select the orders dataset
      setShowHomepage(false)
      setCanvasMode(true)
      const datasets = getDatasets()
      const ordersDataset = datasets.find((d) => d.name === 'orders')
      if (ordersDataset) {
        setActiveNode(ordersDataset.id)
      }
    } catch (_err) {
      setError('Failed to load sample data')
    }
  }, [loadSession, setError, setCanvasMode, getDatasets, setActiveNode, setShowHomepage, clearAllData, resetChat])

  // Parallax scroll effect
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollY = container.scrollTop
      container.style.setProperty('--scroll-y', `${scrollY}px`)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <GlowContainer className="h-full overflow-y-auto bg-[var(--color-bg-primary)]">
      <div ref={containerRef} className="h-full overflow-y-auto">
        {/* Hero */}
        <HeroSection
          onOpenFile={handleOpenFile}
          onLoadSampleData={handleLoadSampleData}
          onStartTour={startTour}
          animationClass={animationClass}
          isDragOver={isDragOver}
          dbLoading={dbLoading}
        />

        {/* Main content */}
        <div className="max-w-5xl mx-auto px-6">
          {/* Product showcase with fake grid/canvas */}
          <ProductShowcase />

          {/* Data flow animation */}
          <div className="py-4">
            <DataFlowAnimation />
          </div>

          <FeatureShowcase />

          {/* File format comparison */}
          <FileFormatComparison />

          <HowItWorks />
          <OperationsGrid />
          <CTASection onOpenFile={handleOpenFile} onLoadSampleData={handleLoadSampleData} dbLoading={dbLoading} />
          <RoadmapSection />
          <EnterpriseSection />
          <Footer />
        </div>
      </div>
    </GlowContainer>
  )
}
