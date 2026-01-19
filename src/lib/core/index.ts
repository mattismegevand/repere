/**
 * Core Engine
 *
 * Pure, side-effect-free logic for pipeline operations.
 * See README.md for architecture details.
 */

// Adapters
export { EffectExecutor } from './adapters'
// Engine
export { PipelineEngine } from './engine/PipelineEngine'
// Types
export type { PipelineCommand, PipelineState } from './engine/types'
