import { siGithub } from 'simple-icons'
import { Logo } from '@/components/ui'

export function Footer() {
  return (
    <footer className="relative pt-16 pb-12">
      {/* Top gradient fade */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />

      <div className="flex flex-col md:flex-row justify-between gap-8">
        {/* Brand */}
        <div className="max-w-xs">
          <div className="mb-3">
            <Logo size="sm" />
          </div>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Local-first data exploration. SQL-powered, privacy-focused, free forever.
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-12">
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Resources</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="https://github.com/mattismegevand/repere"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors duration-200"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/mattismegevand/repere/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors duration-200"
                >
                  Report Issue
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/mattismegevand/repere/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors duration-200"
                >
                  Discussions
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative mt-10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-[var(--color-text-muted)]">
        {/* Separator line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/mattismegevand/repere"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-[var(--color-text-primary)] transition-colors duration-200 group"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 group-hover:scale-110 transition-transform duration-200"
              role="img"
              aria-label="GitHub"
            >
              <title>GitHub</title>
              <path d={siGithub.path} />
            </svg>
            <span>Star on GitHub</span>
          </a>
        </div>
        <span>
          Made by{' '}
          <a
            href="https://mattismegevand.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:underline underline-offset-2"
          >
            Mattis Megevand
          </a>
        </span>
      </div>
    </footer>
  )
}
