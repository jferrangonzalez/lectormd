import { createContext, useContext, useEffect, useState } from 'react'

export type ThemeMode = 'dark' | 'light'

export interface ThemeTokens {
  mode: ThemeMode
  bg: string
  bgSidebar: string
  bgCard: string
  bgCardHover: string
  bgModal: string
  text: string
  textMuted: string
  textAccent: string
  border: string
  accent: string
  h1: string
  h2: string
  h3: string
  link: string
  blockquoteBorder: string
  blockquoteText: string
  codeBg: string
  btnBg: string
  btnText: string
  markBg: string
  markText: string
  scrollbar: string
}

const DARK: ThemeTokens = {
  mode: 'dark',
  bg: '#11111b',
  bgSidebar: '#1e1e2e',
  bgCard: '#313244',
  bgCardHover: '#3d3f55',
  bgModal: '#1e1e2e',
  text: '#cdd6f4',
  textMuted: '#6c7086',
  textAccent: '#cba6f7',
  border: '#313244',
  accent: '#cba6f7',
  h1: '#cba6f7',
  h2: '#89b4fa',
  h3: '#a6e3a1',
  link: '#89b4fa',
  blockquoteBorder: '#cba6f7',
  blockquoteText: '#a6adc8',
  codeBg: '#313244',
  btnBg: '#313244',
  btnText: '#cdd6f4',
  markBg: '#f9e2af',
  markText: '#1e1e2e',
  scrollbar: '#45475a',
}

const LIGHT: ThemeTokens = {
  mode: 'light',
  bg: '#F3E8D0',
  bgSidebar: '#E5D4B0',
  bgCard: '#D9C49A',
  bgCardHover: '#CDB888',
  bgModal: '#EDE0C4',
  text: '#2E1F0E',
  textMuted: '#7A6040',
  textAccent: '#7B4F1A',
  border: '#C8B090',
  accent: '#8B6320',
  h1: '#4A2E10',
  h2: '#5C3A1A',
  h3: '#6B4826',
  link: '#3E5FA3',
  blockquoteBorder: '#8B6320',
  blockquoteText: '#5A4020',
  codeBg: '#D9C49A',
  btnBg: '#D0BA94',
  btnText: '#2E1F0E',
  markBg: '#F0D060',
  markText: '#2E1F0E',
  scrollbar: '#C0A870',
}

interface ThemeCtx {
  t: ThemeTokens
  toggle: () => void
  fontSize: number
  setFontSize: (n: number) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() =>
    (localStorage.getItem('lectormd-theme') as ThemeMode) ?? 'dark'
  )
  const [fontSize, setFontSizeState] = useState<number>(() =>
    Number(localStorage.getItem('lectormd-fontsize') ?? 16)
  )

  const toggle = () => {
    setMode(m => {
      const next = m === 'dark' ? 'light' : 'dark'
      localStorage.setItem('lectormd-theme', next)
      return next
    })
  }

  const setFontSize = (n: number) => {
    const clamped = Math.min(24, Math.max(12, n))
    setFontSizeState(clamped)
    localStorage.setItem('lectormd-fontsize', String(clamped))
  }

  const t = mode === 'dark' ? DARK : LIGHT

  useEffect(() => {
    document.body.style.background = t.bg
    document.body.style.color = t.text
  }, [t])

  return <Ctx.Provider value={{ t, toggle, fontSize, setFontSize }}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme fuera de ThemeProvider')
  return ctx
}
