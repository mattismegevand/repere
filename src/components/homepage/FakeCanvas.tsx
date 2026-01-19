interface FakeNodeProps {
  x: number
  y: number
  label: string
  type: 'dataset' | 'filter' | 'sort' | 'pivot' | 'join' | 'union' | 'chart' | 'export'
  name: string
  stats?: string
  isActive?: boolean
  rowCount?: string
  icon?: 'chart' | 'download'
}

const NODE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  dataset: { fill: 'rgba(59, 130, 246, 0.1)', stroke: '#3b82f6', text: '#2563eb' },
  filter: { fill: 'rgba(59, 130, 246, 0.1)', stroke: '#3b82f6', text: '#2563eb' },
  sort: { fill: 'rgba(59, 130, 246, 0.1)', stroke: '#3b82f6', text: '#2563eb' },
  pivot: { fill: 'rgba(168, 85, 247, 0.1)', stroke: '#a855f7', text: '#9333ea' },
  join: { fill: 'rgba(249, 115, 22, 0.1)', stroke: '#f97316', text: '#ea580c' },
  union: { fill: 'rgba(249, 115, 22, 0.1)', stroke: '#f97316', text: '#ea580c' },
  chart: { fill: 'rgba(244, 63, 94, 0.1)', stroke: '#f43f5e', text: '#e11d48' },
  export: { fill: 'rgba(20, 184, 166, 0.1)', stroke: '#14b8a6', text: '#0d9488' },
}

function FakeNode({ x, y, label, type, name, stats, isActive, rowCount, icon }: FakeNodeProps) {
  const colors = NODE_COLORS[type] || NODE_COLORS.dataset
  const isTerminal = type === 'chart' || type === 'export'

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Node container */}
      <rect
        width="140"
        height="70"
        rx="8"
        fill="var(--color-bg-primary)"
        stroke={isActive ? 'var(--color-accent)' : 'var(--color-border)'}
        strokeWidth={isActive ? 2 : 1}
        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.05))"
      />

      {/* Row count badge */}
      {rowCount && (
        <g transform="translate(120, -8)">
          <rect width="32" height="16" rx="8" fill="#3b82f6" />
          <text x="16" y="12" textAnchor="middle" fill="white" fontSize="9" fontWeight="500">
            {rowCount}
          </text>
        </g>
      )}

      {/* Header */}
      <line x1="0" y1="26" x2="140" y2="26" stroke="var(--color-border)" strokeWidth="1" />

      {/* Label badge */}
      <rect x="8" y="5" width="45" height="16" rx="4" fill={colors.fill} />
      <text x="30" y="16" textAnchor="middle" fontSize="8" fontWeight="600" fill={colors.text}>
        {label}
      </text>

      {/* Name */}
      <text x="58" y="16" fontSize="10" fontWeight="500" fill="var(--color-text-primary)">
        {name}
      </text>

      {/* Stats or icon */}
      {icon === 'chart' ? (
        <g transform="translate(50, 36)">
          {/* Mini bar chart icon */}
          <rect x="0" y="12" width="8" height="12" fill={colors.stroke} rx="1" />
          <rect x="12" y="6" width="8" height="18" fill={colors.stroke} rx="1" />
          <rect x="24" y="0" width="8" height="24" fill={colors.stroke} rx="1" />
        </g>
      ) : icon === 'download' ? (
        <g transform="translate(55, 38)">
          {/* Download icon */}
          <path
            d="M12 4v12m0 0l-4-4m4 4l4-4"
            stroke={colors.stroke}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M4 18h16" stroke={colors.stroke} strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : stats ? (
        <text x="8" y="45" fontSize="9" fill="var(--color-text-muted)">
          {stats}
        </text>
      ) : null}

      {/* Source handle (right) - not for terminal nodes */}
      {!isTerminal && (
        <circle cx="140" cy="35" r="4" fill="var(--color-accent)" stroke="var(--color-bg-primary)" strokeWidth="2" />
      )}

      {/* Target handle (left) - only for non-dataset */}
      {type !== 'dataset' && (
        <circle cx="0" cy="35" r="4" fill="var(--color-accent)" stroke="var(--color-bg-primary)" strokeWidth="2" />
      )}
    </g>
  )
}

interface EdgeProps {
  from: { x: number; y: number }
  to: { x: number; y: number }
  animated?: boolean
}

function FakeEdge({ from, to, animated }: EdgeProps) {
  const midX = (from.x + to.x) / 2

  return (
    <path
      d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
      fill="none"
      stroke="var(--color-border)"
      strokeWidth="2"
      className={animated ? 'animate-pulse' : ''}
    />
  )
}

export function FakeCanvas() {
  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-bg-primary)] relative min-w-[700px]">
      {/* Canvas background with dots */}
      <svg
        width="100%"
        height="280"
        viewBox="0 0 900 280"
        className="bg-[var(--color-bg-secondary)]"
        aria-label="Pipeline canvas preview"
      >
        <title>Pipeline canvas showing data transformations</title>
        {/* Dot pattern */}
        <defs>
          <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1" fill="var(--color-border)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />

        {/* Edges - orders to union */}
        <FakeEdge from={{ x: 160, y: 55 }} to={{ x: 200, y: 125 }} />
        {/* Edges - customers to union */}
        <FakeEdge from={{ x: 160, y: 195 }} to={{ x: 200, y: 125 }} />
        {/* Union to Filter */}
        <FakeEdge from={{ x: 340, y: 125 }} to={{ x: 360, y: 125 }} />
        {/* Filter to Pivot */}
        <FakeEdge from={{ x: 500, y: 125 }} to={{ x: 520, y: 125 }} />
        {/* Pivot to Chart (branch up) */}
        <FakeEdge from={{ x: 660, y: 125 }} to={{ x: 700, y: 55 }} animated />
        {/* Pivot to Export (branch down) */}
        <FakeEdge from={{ x: 660, y: 125 }} to={{ x: 700, y: 195 }} />

        {/* Dataset nodes */}
        <FakeNode x={20} y={20} label="Dataset" type="dataset" name="orders" stats="125K rows" rowCount="125K" />
        <FakeNode x={20} y={160} label="Dataset" type="dataset" name="customers" stats="8.5K rows" rowCount="8.5K" />

        {/* Transform nodes */}
        <FakeNode x={200} y={90} label="Union" type="union" name="combined" stats="all rows" isActive />
        <FakeNode x={360} y={90} label="Filter" type="filter" name="active" stats="status = 'active'" />
        <FakeNode x={520} y={90} label="Pivot" type="pivot" name="by_region" stats="SUM(revenue)" />

        {/* Terminal nodes */}
        <FakeNode x={700} y={20} label="Chart" type="chart" name="bar_chart" icon="chart" />
        <FakeNode x={700} y={160} label="Export" type="export" name="report.csv" icon="download" />
      </svg>

      {/* Mini controls */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1">
        <div className="flex items-center justify-center w-6 h-6 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded shadow-sm text-[var(--color-text-muted)] text-xs">
          +
        </div>
        <div className="flex items-center justify-center w-6 h-6 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded shadow-sm text-[var(--color-text-muted)] text-xs">
          -
        </div>
      </div>
    </div>
  )
}
