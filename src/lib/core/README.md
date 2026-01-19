# Core Engine

The core engine contains pure, side-effect-free logic for pipeline operations. It is the single source of truth for how pipelines behave, independent of React, DuckDB, or any specific runtime.

## Design Principles

1. **Pure Functions**: Commands return `{ state, effects }` - no side effects
2. **Deterministic**: Same input → same output, always
3. **Testable**: No mocking required, just input/output assertions
4. **Runtime Agnostic**: Works in browser, Node, or any JS environment

## Architecture

```
core/
├── engine/
│   ├── PipelineEngine.ts    # Main engine class
│   ├── types.ts             # State, Command, Effect types
│   └── commands/            # Command handlers
│       ├── addNode.ts
│       ├── removeNode.ts
│       ├── applyOperation.ts
│       └── ...
├── adapters/                # Adapter implementations
└── index.ts                 # Public API
```

## Core Concepts

### Commands

Commands are pure functions that transform state and declare effects:

```typescript
interface CommandResult<S> {
  state: S
  effects: Effect[]
}

type Command<S, P> = (state: S, params: P) => CommandResult<S>
```

### Effects

Effects describe side effects to be executed by adapters:

```typescript
type Effect =
  | { type: 'duckdb.createView'; viewName: string; sql: string }
  | { type: 'duckdb.dropView'; viewName: string }
  | { type: 'duckdb.query'; sql: string; resultKey: string }
  | { type: 'persist.saveSession'; session: SessionExport }
  | { type: 'analytics.track'; event: string; properties: Record<string, unknown> }
```

The adapter layer (usePipeline, PipelineService) executes these effects.

### State

Pipeline state is a plain object:

```typescript
interface PipelineState {
  nodes: Record<string, PipelineNode>
  edges: PipelineEdge[]
  activeNodeId: string | null
  selectedNodeId: string | null
  openNodeIds: string[]
  undoStack: PipelineSnapshot[]
  redoStack: PipelineSnapshot[]
}
```

## Usage

```typescript
import { PipelineEngine } from '@/lib/core'

// Create engine with initial state
const engine = new PipelineEngine(initialState)

// Execute a command
const { state, effects } = engine.applyOperation({
  nodeId: 'view_123',
  operation: { type: 'filter', expression: {...} }
})

// State is the new pipeline state
// Effects are side effects to execute (DuckDB calls, etc.)
```

## Integration with Adapters

The adapter layer (in `src/lib/pipeline/`) bridges the core engine with React and DuckDB:

1. **usePipeline hook**: Dispatches commands to engine, executes effects via PipelineService
2. **PipelineService**: Executes DuckDB effects (createView, dropView, query)
3. **Zustand stores**: Hold the engine state, subscribe to changes

```
UI Component
    │
    ▼ (dispatch command)
usePipeline
    │
    ├──▶ PipelineEngine.command() → { state, effects }
    │
    ├──▶ Zustand store.setState(state)
    │
    └──▶ PipelineService.executeEffects(effects)
             │
             ▼
         DuckDB (CREATE VIEW, DROP VIEW, etc.)
```

## Testing

Core engine code is trivially testable:

```typescript
import { applyFilter } from '@/lib/core/engine/commands/applyOperation'

test('applyFilter creates view with correct SQL', () => {
  const state = createInitialState()
  const { state: newState, effects } = applyFilter(state, {
    nodeId: 'node_1',
    operation: { type: 'filter', expression: {...} }
  })

  expect(newState.nodes['node_2'].operation.type).toBe('filter')
  expect(effects).toContainEqual({
    type: 'duckdb.createView',
    viewName: expect.any(String),
    sql: expect.stringContaining('WHERE')
  })
})
```

## Graph Operations

Pure DAG operations are available in `@/lib/graph/dag-operations`:

```typescript
import { getDescendants, getTopologicalOrder } from '@/lib/graph/dag-operations'

// Get all nodes that depend on a node
const descendants = getDescendants(nodes, edges, 'node_1')

// Get nodes in execution order
const ordered = getTopologicalOrder(nodes, edges)
```
