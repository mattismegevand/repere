# AI Agent Improvement Plan (Repere)

This plan targets the current agent loop in `src/lib/ai/agent.ts`, prompt in `src/lib/ai/prompts.ts`, context builder in `src/lib/ai/context.ts`, and tool execution via `src/lib/ai/tools.ts` + `src/lib/operations/plugins/*`.

## Goals
- Increase tool accuracy and reduce invalid tool calls.
- Improve context relevance and freshness across iterations.
- Reduce latency and token usage without losing key signals.
- Improve user trust via transparent progress, error handling, and controllability.
- Create measurable evaluation harnesses for regressions and improvements.

## Phase 0 — Baseline + Diagnostics (1–2 days)
1. **Instrument failures**
   - Add structured logging for tool-call failures (name, args, validation errors, nodeId, model).
   - Track: tool-call count, success rate, retries, iterations per task, final success rate.
   - Store locally (in-memory) and optionally in analytics hook (if available).

2. **Trace prompt + context size**
   - Log token estimates for system prompt + context + user + tool results.
   - Track context fields included each iteration.

3. **Add a “debug mode” flag**
   - Expose a toggle in settings to show:
     - current system prompt
     - context payload
     - tool call JSON
     - tool result messages

Deliverable: lightweight telemetry for model behavior and prompt sizes.

## Phase 1 — Context Quality + Refresh (3–5 days)
1. **Refresh context after each tool result**
   - In `agent.ts`, rebuild `AgentContext` each loop instead of using initial context only.
   - Include updated column stats when schema changes (or defer to fast path if unchanged).

2. **Tiered context + compression**
   - Replace full `allNodes` listing with:
     - current node details
     - last N nodes in lineage
     - “candidate nodes” when user mentions joins/union
   - Summarize column stats (min/max/mean/outliers) only for numeric columns referenced in the user goal or in recent steps.
   - Include top-k distincts for string columns only if sample data is sparse or user asks about categories.

3. **Operation-aware context hints**
   - Add structured hints to the prompt:
     - “These columns are safe to use for join keys” (e.g., high uniqueness).
     - “Columns renamed recently” from operation history.

4. **Context cache**
   - Memoize `profileDataset` results by tableName + schema hash to avoid recomputation.

Deliverable: iterative context that stays correct while being smaller and more relevant.

## Phase 2 — Prompt and Tooling Improvements (3–5 days)
1. **Rewrite system prompt**
   - Add explicit tool-call JSON schemas and examples for tricky ops (join, pivot, filter groups).
   - Add “don’t guess column names” rule (ask if unclear).
   - Add explicit “validate before calling join/union” rule.

2. **Tool-use constraints**
   - Enforce a single tool call per assistant turn (already asked in prompt; ensure response handling checks and re-prompts on multiple tool calls).
   - Add maximum argument length to prevent huge filters or column lists.

3. **Dynamic “instruction prefix”**
   - Inject a short dynamic prefix based on task class (e.g., cleaning, aggregation, visualization).
   - Create a classifier or heuristics in `agent.ts` (simple keyword routing) for selecting a prompt variant.

4. **Error recovery prompts**
   - If tool fails, send a terse “diagnostic hint” back to model (e.g., unknown column, invalid join ID).
   - Provide “allowed columns” list and “closest matches” (string similarity) when errors occur.

Deliverable: prompt variants and tooling guardrails that reduce invalid tool calls.

## Phase 3 — Validation & Safety (4–6 days)
1. **Pre-validate tool calls**
   - Before execution, route tool args through each plugin’s `validate()` (already exists but unused in agent path).
   - If invalid, return structured error to LLM and request correction.

2. **Join/Union safety**
   - Verify `rightSourceId` exists.
   - Require explicit join keys unless `joinType=cross`.
   - Add a join “row explosion” warning if both sides large and join keys are low-cardinality.

3. **Filter safety**
   - Enforce type compatibility: `contains` only on string, `gt/lt` only numeric/date.
   - Allow model to ask a clarification question if type mismatch is detected.

4. **Undoable agent steps**
   - Attach a “rollback” action to each agent step (hook to pipeline snapshot if feasible).

Deliverable: safe, validated tool execution with graceful recovery.

## Phase 4 — UX + Control (2–4 days)
1. **Plan preview mode**
   - Introduce a “plan-first” mode that proposes steps before execution (reusing `AgentPlan` types).
   - Allow user to edit/reorder/remove steps before running.

2. **Granular control**
   - Add “Run next step” button in AI panel.
   - Add “Auto-run all” toggle for power users.

3. **Better step summaries**
   - Include row-count delta and column changes in step results.
   - Show warnings when schema changes (e.g., column rename or removal).

Deliverable: transparent and controllable agent UX.

## Phase 5 — Evaluation & Regression Testing (ongoing)
1. **Golden tasks suite**
   - Curate a small dataset set (CSV fixtures) and 20–30 user prompts.
   - Store expected sequences or end-state checks (columns present, row counts, chart created).

2. **Tool-call unit tests**
   - For each plugin, add tests that validate LLM-style args using `validate()`.
   - Add edge-case tests for filter groups, pivot/unpivot, join mismatched columns.

3. **Prompt A/B testing**
   - Run identical tasks with old vs new prompt, measure success rate and iteration count.

Deliverable: repeatable evaluation to avoid regressions.

## Implementation Notes / Suggested Order
1. **Use plugin validation in the agent loop** (Phase 3, task 1) — biggest win for tool correctness.
2. **Rebuild context each loop** + **context caching** (Phase 1, tasks 1 & 4).
3. **Prompt rewrite with clearer constraints** (Phase 2, task 1).
4. **Plan preview mode** (Phase 4, task 1) if you want user‑approved execution.
5. **Golden tasks suite** to track improvements (Phase 5).

## Files to Touch (expected)
- `src/lib/ai/agent.ts` — loop, validation, error recovery, context refresh.
- `src/lib/ai/context.ts` — context filtering, caching, smarter stats.
- `src/lib/ai/prompts.ts` — prompt variants.
- `src/lib/ai/tools.ts` — tool constraints metadata if needed.
- `src/lib/operations/registry.ts` + `src/lib/operations/plugins/*` — validation wiring.
- `src/components/ai-chat/AIChat.tsx` — UX for plan/step controls and debug mode.

---
If you want, I can turn this plan into concrete tasks or start implementing Phase 1.
