import { autocompletion } from '@codemirror/autocomplete'
import { python } from '@codemirror/lang-python'
import { Prec } from '@codemirror/state'
import { type KeyBinding, keymap } from '@codemirror/view'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { useThemeStore } from '@/stores/themeStore'
import { getEffectiveColorScheme } from '@/themes'

interface PythonEditorProps {
  value: string
  onChange: (value: string) => void
  onExecute: () => void
  className?: string
}

export interface PythonEditorRef {
  focus: () => void
}

export const PythonEditor = forwardRef<PythonEditorRef, PythonEditorProps>(function PythonEditor(
  { value, onChange, onExecute, className = '' },
  ref
) {
  const theme = useThemeStore((s) => s.theme)
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const executeRef = useRef(onExecute)

  // Keep executeRef updated
  executeRef.current = onExecute

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.view?.focus(),
  }))

  const extensions = useMemo(() => {
    const runKeyBinding: KeyBinding = {
      key: 'Mod-Enter',
      run: () => {
        executeRef.current()
        return true
      },
    }

    return [
      python(),
      Prec.highest(keymap.of([runKeyBinding])),
      autocompletion({
        activateOnTyping: true,
      }),
    ]
  }, [])

  return (
    <CodeMirror
      ref={editorRef}
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={getEffectiveColorScheme(theme)}
      className={`h-full text-[12px] ${className}`}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        bracketMatching: true,
        autocompletion: true,
      }}
    />
  )
})
