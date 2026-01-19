import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { type Diagnostic, linter } from '@codemirror/lint'
import { Prec } from '@codemirror/state'
import { type KeyBinding, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import CodeMirror from '@uiw/react-codemirror'
import { useCallback, useMemo } from 'react'
import { type ParseError, parseFilterText, validateFilterText } from '@/lib/filter-parser'
import { getEffectiveColorScheme } from '@/themes'
import type { Column, FilterExpression } from '@/types'

interface FilterCodeEditorProps {
  value: string
  onChange: (value: string) => void
  onApply: (expr: FilterExpression) => void
  columns: Column[]
  theme: 'light' | 'dark' | 'system'
}

// Keywords for autocomplete
const KEYWORDS = ['AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'IS', 'NULL', 'CONTAINS', 'STARTS', 'ENDS', 'TRUE', 'FALSE']

// Operators for autocomplete
const OPERATORS = ['=', '!=', '>', '<', '>=', '<=']

export function FilterCodeEditor({ value, onChange, onApply, columns, theme }: FilterCodeEditorProps) {
  // Custom linter for filter syntax
  const filterLinter = useMemo(
    () =>
      linter((view) => {
        const text = view.state.doc.toString()
        const errors = validateFilterText(text)
        return errors.map(
          (err: ParseError): Diagnostic => ({
            from: err.position,
            to: err.position + err.length,
            severity: 'error',
            message: err.message,
          })
        )
      }),
    []
  )

  // Autocomplete for columns and keywords
  const filterCompletion = useCallback(
    (context: CompletionContext): CompletionResult | null => {
      const word = context.matchBefore(/[\w]+/)
      if (!word) return null

      const options = [
        // Column names
        ...columns.map((col) => ({
          label: col.name,
          type: 'variable',
          detail: col.type,
        })),
        // Keywords
        ...KEYWORDS.map((kw) => ({
          label: kw,
          type: 'keyword',
        })),
        // Operators (less common to autocomplete)
        ...OPERATORS.map((op) => ({
          label: op,
          type: 'operator',
        })),
      ]

      return {
        from: word.from,
        options,
        validFor: /^[\w]*$/,
      }
    },
    [columns]
  )

  // Key binding for Cmd/Ctrl+Enter to apply
  const applyKeyBinding: KeyBinding = useMemo(
    () => ({
      key: 'Mod-Enter',
      run: () => {
        const result = parseFilterText(value)
        if (result.success && result.expression) {
          onApply(result.expression)
          return true
        }
        return false
      },
    }),
    [value, onApply]
  )

  // Syntax highlighting
  const highlightStyle = useMemo(
    () =>
      HighlightStyle.define([
        { tag: tags.keyword, color: 'var(--color-accent)' },
        { tag: tags.string, color: '#22c55e' },
        { tag: tags.number, color: '#f59e0b' },
        { tag: tags.operator, color: '#8b5cf6' },
        { tag: tags.variableName, color: 'var(--color-text-primary)' },
      ]),
    []
  )

  const extensions = useMemo(
    () => [
      filterLinter,
      autocompletion({ override: [filterCompletion] }),
      syntaxHighlighting(highlightStyle),
      Prec.highest(keymap.of([applyKeyBinding])),
    ],
    [filterLinter, filterCompletion, highlightStyle, applyKeyBinding]
  )

  return (
    <div className="border border-[var(--color-border)] rounded overflow-hidden">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={getEffectiveColorScheme(theme)}
        className="text-[11px]"
        placeholder='e.g. status = "active" AND priority > 3'
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          bracketMatching: true,
          closeBrackets: true,
        }}
        minHeight="60px"
        maxHeight="150px"
      />
    </div>
  )
}
