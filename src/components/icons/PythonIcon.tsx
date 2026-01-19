import type { SVGProps } from 'react'
import { siPython } from 'simple-icons'

export function PythonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d={siPython.path} />
    </svg>
  )
}
