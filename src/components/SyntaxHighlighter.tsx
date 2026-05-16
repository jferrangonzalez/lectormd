import { lazy, Suspense } from 'react'
import { useTheme } from '../context/ThemeContext'

const Impl = lazy(() => import('./SyntaxHighlighterImpl'))

interface Props {
  language: string
  children: string
}

export function SyntaxHighlighter({ language, children }: Props) {
  const { t } = useTheme()
  return (
    <Suspense fallback={
      <div style={{
        background: t.codeBg,
        borderRadius: 8,
        padding: '16px',
        margin: '16px 0',
        fontSize: 13,
        fontFamily: 'ui-monospace, Consolas, monospace',
        color: t.text,
        whiteSpace: 'pre-wrap',
        overflowX: 'auto',
      }}>
        {children}
      </div>
    }>
      <Impl language={language}>{children}</Impl>
    </Suspense>
  )
}
