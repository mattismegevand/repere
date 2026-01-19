# repere - Local-First Data Pipeline Explorer

A data exploration tool for datasets too large for spreadsheets. Uses DuckDB to execute SQL on CSV, JSON, JSONL, Parquet, and XLSX files. Available as a web app (DuckDB-WASM) and desktop app (Tauri + native DuckDB).

## Tech Stack
- React 19 + Vite 7 + TypeScript 5.9 + Bun
- DuckDB-WASM 1.33 (web) / Native DuckDB (desktop via Tauri)
- TanStack Virtual, React Flow 12, ECharts, Zustand 5, Tailwind CSS v4
- Biome for linting/formatting

## Code Style
- Simple abstractions, minimal comments, self-documenting code
- Avoid over-engineering
- Reuse existing components (check `components/ui/` before creating new UI)
- Prioritize code quality and good abstractions over stability
- **Use Context7 for external libraries**: Always query Context7 for up-to-date documentation when using external functions/libraries

## Workflow
- **Commit after each important phase**: Don't accumulate changes-commit frequently after completing meaningful chunks of work
- **Before committing**: Run `bun run test`, `bun run lint`, `bun run format`, and `bun run knip`
- **Build verification**: `bun run build` to catch type errors

## Commands
Always use `bun` instead of `npm` or `npx`:
- `bun run dev` - Development server
- `bun run build` - Production build
- `bun run lint` - Run linter
- `bun run format` - Format code
- `bun run test` - Run tests
- `bun add <package>` - Add packages

## File Structure
```
src/
  components/    # UI components (data-grid/, pipeline-canvas/, operation-dialogs/, ui/, etc.)
  lib/           # Core logic (duckdb/, pipeline/, operations/, file-system/, etc.)
  stores/        # Zustand stores (14+ specialized stores)
  types/         # TypeScript types
```

## Key Concepts
- **Pipeline DAG**: Datasets (root nodes) + DataViews (derived SQL VIEWs)
- **Smart replace/stack**: Same op type without children = replace; otherwise = stack new view
- **Lazy evaluation**: Views are DuckDB VIEWs, not materialized

## Patterns to Follow

### Zustand
- **Individual selectors**: `usePipelineStore((s) => s.activeNodeId)` - prevents unnecessary re-renders
- **`subscribeWithSelector`**: Required middleware for imperative `getState()` access
- **Discriminated unions**: For state machines (see `PipelineMode` in pipelineStore, `DialogState` in dialogStore)
- **`persist` middleware**: Use `partialize` for localStorage - never manual `localStorage.setItem()`

### Hooks
- **Optional service pattern**: `useSomethingOptional()` returns `null`, never throws
- **Mounted check for async**: `let mounted = true` in useEffect cleanup
- **Composed hooks**: `usePipeline` composes multiple focused hooks

### DuckDB
- **Always use `DuckDBClient` interface**: Never raw `conn`/`db` access
- **Operations plugin system**: Located in `lib/operations/`

### Components
- **`NodeShell`**: Shared node structure wrapper (pipeline-canvas)
- **`memo()`**: Required for React Flow nodes, grid rows/cells
- **Split contexts by concern**: See DataGrid (`ColumnsContext`, `RowDataContext`, `SelectionContext`)

## Testing
- Unit tests: `tests/unit/` - Vitest
- E2E tests: `tests/e2e/` - Playwright
- **Write tests when fixing bugs** to prevent regressions

## Security Notes
- Custom SQL operations pass user input directly to DuckDB (intentional)
- Use `escapeIdentifier()` for column/table names, `escapeValue()` for values

## Tauri Build Optimization
For faster Rust/Tauri builds, install sccache:
```bash
cargo install sccache
```

## Known Limitations
- 50 undo/redo history limit
- Session files >5MB embed data as CSV; larger require re-upload
- Touch support limited to iPad/tablet

## Anti-Patterns (Avoid These)
- **Don't destructure whole Zustand store**: Use individual selectors like `(s) => s.field`
- **Don't use DOM queries for library interaction**: Use controlled state (e.g., cmdk `value`/`onValueChange`)
- **Don't use module-level mutable counters**: Use `Date.now()` or store state for unique IDs
- **Don't manually manage localStorage**: Use Zustand `persist` middleware
- **Don't bypass DuckDBClient abstraction**: Never use raw `conn.query()`
- **Don't add backward compatibility code**: Keep the codebase clean
- **Don't duplicate node structure**: Use `NodeShell` wrapper

## Best Practices

### Component Patterns
- **Reuse first**: Check `components/ui/` before creating new UI components
- **Composition over props**: Prefer `children` and render props over complex prop drilling
- **Colocation**: Keep components close to where they're used; only move to `ui/` when reused 3+ times
- **Single responsibility**: One component = one job. Split complex components into smaller pieces
- **Variant/size pattern**: Use discriminated unions for component variants (see `Button.tsx`)

### State Management
- **Zustand stores** (`stores/`): Cross-component state, global app state, persisted state
- **Selector pattern**: Always use `useStore((s) => s.field)`, never destructure entire store
- **Local state** (`useState`): UI state local to a component (open/closed, hover, focus)
- **Derived state**: Compute in render or useMemo, don't duplicate in stores
- **Store pattern**: Separate `State` and `Actions` interfaces, use discriminated unions for complex state (see `dialogStore.ts`)

### Error Handling
- **Dialog errors**: Use `DialogErrorBanner` for inline error display in dialogs
- **Try/catch at boundaries**: Catch errors at the operation level, not deep in utilities
- **User-friendly messages**: Transform technical errors into actionable messages
- **Fail fast**: Validate inputs early, throw descriptive errors

### Naming Conventions
- **Files**: `PascalCase.tsx` for components, `camelCase.ts` for utilities, `camelCaseStore.ts` for stores
- **Components**: PascalCase (`DataGrid`, `RadixDialog`)
- **Hooks**: `use` prefix (`usePipeline`, `useDialogStore`)
- **Types**: PascalCase, suffix with purpose (`DialogState`, `ButtonVariant`, `PipelineNode`)
- **Constants**: SCREAMING_SNAKE_CASE for true constants, camelCase for config objects

### Abstractions & Reuse
- **Don't abstract prematurely**: Wait for 3 similar implementations before extracting
- **Thin wrappers**: Keep abstractions minimal (see `RadixDialog` wrapping `@radix-ui/react-dialog`)
- **Expose escape hatches**: Allow `className` prop, spread `...props` to underlying elements
- **Avoid leaky abstractions**: If users need to know internals, the abstraction is wrong

### Testing
- **Test behavior, not implementation**: Test what users see and do
- **Bug = test**: Every bug fix needs a regression test
- **Integration over unit**: Prefer tests that exercise real component interactions
- **Minimal mocking**: Only mock external boundaries (DuckDB, file system)

### Styling & Design
- **CSS variables**: Use `var(--color-*)` for all colors (defined in theme)
- **Tailwind utilities**: Prefer utility classes over custom CSS
- **Existing components**: Use `Button`, `RadixDialog`, `Select`, `Checkbox`, `Tooltip`, `Label` from `ui/`
- **Form inputs**: Use `FormInput`, `FormTextarea` from `ui/form/` for consistent styling
- **Lucide icons**: Import from `lucide-react` for consistent iconography
- **Size/variant maps**: Use `Record<Variant, string>` pattern for variant styles (see `Button.tsx`)
