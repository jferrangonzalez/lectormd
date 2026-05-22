import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SyntaxHighlighter } from './SyntaxHighlighter'
import type { DocumentoConContenido, Estado, Marcador, MarcadorColor } from '../types'
import { COLORES_MARCADOR } from '../types'
import { api } from '../api/client'
import { EstadoBadge } from './EstadoBadge'
import { useTheme } from '../context/ThemeContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { rehypeHighlights } from '../lib/rehype-highlights'

interface Props {
  documento: DocumentoConContenido
  onClose: () => void
  onEstadoChange: () => void
}

interface SeleccionState {
  texto: string
  posicion: number
  rect: DOMRect
}

interface PopoverState {
  marcador: Marcador
  rect: DOMRect
}

const COLOR_FILL: Record<MarcadorColor, string> = {
  yellow: 'rgba(255, 235, 59, 0.45)',
  green:  'rgba(76, 175, 80, 0.40)',
  blue:   'rgba(33, 150, 243, 0.40)',
  pink:   'rgba(233, 30, 99, 0.40)',
}

const COLOR_LABEL: Record<MarcadorColor, string> = {
  yellow: 'Amarillo',
  green:  'Verde',
  blue:   'Azul',
  pink:   'Rosa',
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'heading'
}

function extractText(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node && typeof node === 'object' && 'props' in (node as Record<string, unknown>)) {
    const props = (node as { props?: { children?: unknown } }).props
    if (props?.children !== undefined) return extractText(props.children)
  }
  return ''
}

export function Reader({ documento, onClose, onEstadoChange }: Props) {
  const { t, fontSize, setFontSize } = useTheme()
  const isMobile = useIsMobile()
  const [estado, setEstado] = useState<Estado>(documento.estado)
  const [marcadores, setMarcadores] = useState<Marcador[]>([])
  const [seleccion, setSeleccion] = useState<SeleccionState | null>(null)
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const [editComentario, setEditComentario] = useState<string>('')

  const contentRef = useRef<HTMLDivElement>(null)
  const autoLeyendoLanzado = useRef<number | null>(null)
  const scrollSaveTimer = useRef<number | null>(null)
  const headingIdsRef = useRef<string[]>([])

  const btn: React.CSSProperties = {
    background: t.btnBg,
    border: 'none',
    borderRadius: 6,
    color: t.btnText,
    padding: isMobile ? '8px 14px' : '5px 10px',
    fontSize: isMobile ? 13 : 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }

  // ── Carga inicial + auto-leyendo ─────────────────────────────────────────────
  useEffect(() => {
    setEstado(documento.estado)
    api.marcadores(documento.id).then(setMarcadores)

    if (documento.estado === 'pendiente' && autoLeyendoLanzado.current !== documento.id) {
      autoLeyendoLanzado.current = documento.id
      api.setEstado(documento.id, 'leyendo').then(() => {
        setEstado('leyendo')
        onEstadoChange()
      })
    }
  }, [documento.id])

  // ── Restaurar scroll anchor tras el render + estabilización del lazy syntax-highlighter ─
  useEffect(() => {
    const anchor = documento.scroll_anchor
    if (!anchor || !contentRef.current) return

    const [slug, offsetRaw] = anchor.split(':')
    const offset = Number(offsetRaw) || 0

    const tryRestore = () => {
      const target = document.getElementById(`h-${slug}`)
      if (!target || !contentRef.current) return false
      const containerTop = contentRef.current.getBoundingClientRect().top
      const headingTop = target.getBoundingClientRect().top
      contentRef.current.scrollTop += (headingTop - containerTop) + offset
      return true
    }

    // Esperar a que el DOM se estabilice (lazy load de syntax highlighter cambia heights)
    let attempts = 0
    const maxAttempts = 20
    const interval = window.setInterval(() => {
      attempts++
      if (tryRestore() || attempts >= maxAttempts) {
        window.clearInterval(interval)
      }
    }, 150)

    return () => window.clearInterval(interval)
  }, [documento.id])

  // ── Guardar scroll anchor con throttle de 1s ────────────────────────────────
  const guardarScrollAnchor = useCallback(() => {
    if (!contentRef.current) return
    const container = contentRef.current
    const containerTop = container.getBoundingClientRect().top

    // Encontrar el último heading cuyo top esté por encima del fold (más cercano arriba).
    let pickedSlug = ''
    let pickedOffset = 0
    for (const slug of headingIdsRef.current) {
      const el = document.getElementById(`h-${slug}`)
      if (!el) continue
      const top = el.getBoundingClientRect().top - containerTop
      if (top <= 0) {
        pickedSlug = slug
        pickedOffset = -top  // píxeles que ya scrolleamos pasado este heading
      } else {
        break
      }
    }

    if (!pickedSlug) return
    api.scrollSave(documento.id, `${pickedSlug}:${Math.round(pickedOffset)}`)
      .catch(() => { /* no crítico */ })
  }, [documento.id])

  const onScroll = useCallback(() => {
    if (scrollSaveTimer.current !== null) window.clearTimeout(scrollSaveTimer.current)
    scrollSaveTimer.current = window.setTimeout(guardarScrollAnchor, 1000)
  }, [guardarScrollAnchor])

  // ── Detectar selección de texto + calcular posicion (índice de ocurrencia) ──
  const handleSeleccion = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) { setSeleccion(null); return }
    const texto = sel.toString().trim()
    if (!texto || texto.length < 5) { setSeleccion(null); return }
    if (!contentRef.current) { setSeleccion(null); return }
    if (!contentRef.current.contains(sel.anchorNode)) { setSeleccion(null); return }

    // Calcular posicion: cuántas veces aparece `texto` antes de la selección.
    const range = sel.getRangeAt(0)
    const preRange = document.createRange()
    preRange.selectNodeContents(contentRef.current)
    preRange.setEnd(range.startContainer, range.startOffset)
    const textoPrevio = preRange.toString()
    let posicion = 0
    let idx = 0
    while (true) {
      const next = textoPrevio.indexOf(texto, idx)
      if (next === -1) break
      posicion++
      idx = next + texto.length
    }

    const rect = range.getBoundingClientRect()
    setSeleccion({ texto, posicion, rect })
  }, [])

  const guardarMarcador = async (color: MarcadorColor) => {
    if (!seleccion) return
    await api.addMarcador(documento.id, seleccion.texto, seleccion.posicion, color)
    const updated = await api.marcadores(documento.id)
    setMarcadores(updated)
    setSeleccion(null)
    window.getSelection()?.removeAllRanges()
  }

  const cambiarColor = async (color: MarcadorColor) => {
    if (!popover) return
    await api.updateMarcador(popover.marcador.id, { color })
    setMarcadores(ms => ms.map(m => m.id === popover.marcador.id ? { ...m, color } : m))
    setPopover(p => p ? { ...p, marcador: { ...p.marcador, color } } : null)
  }

  const guardarComentario = async () => {
    if (!popover) return
    const next = editComentario.trim() ? editComentario.trim() : null
    await api.updateMarcador(popover.marcador.id, { comentario: next })
    setMarcadores(ms => ms.map(m =>
      m.id === popover.marcador.id ? { ...m, comentario: next } : m,
    ))
    setPopover(null)
  }

  const borrarMarcador = async (id: number) => {
    await api.delMarcador(id)
    setMarcadores(ms => ms.filter(x => x.id !== id))
    setPopover(null)
  }

  const onMarkClick = useCallback((id: number, target: HTMLElement) => {
    const m = marcadores.find(x => x.id === id)
    if (!m) return
    setEditComentario(m.comentario ?? '')
    setPopover({ marcador: m, rect: target.getBoundingClientRect() })
  }, [marcadores])

  const exportar = async () => {
    const { filename, markdown } = await api.exportMarcadores({ documento_id: documento.id })
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const ciclarEstado = async () => {
    const orden: Estado[] = ['pendiente', 'leyendo', 'leido']
    const siguiente = orden[(orden.indexOf(estado) + 1) % 3]
    await api.setEstado(documento.id, siguiente)
    setEstado(siguiente)
    onEstadoChange()
  }

  // ── Listener delegado para click en <mark> ──────────────────────────────────
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const handler = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement
      const mark = target.closest('mark[data-marcador-id]') as HTMLElement | null
      if (!mark) return
      ev.stopPropagation()
      const id = Number(mark.dataset.marcadorId)
      if (id) onMarkClick(id, mark)
    }
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [onMarkClick])

  // Cerrar popover al click fuera
  useEffect(() => {
    if (!popover) return
    const closer = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement
      if (target.closest('[data-popover-marcador]')) return
      if (target.closest('mark[data-marcador-id]')) return
      setPopover(null)
    }
    document.addEventListener('mousedown', closer)
    return () => document.removeEventListener('mousedown', closer)
  }, [popover])

  // Recolectar ids de headings cada vez que cambia el contenido (lo poblamos en los componentes h1/h2/h3)
  const rehypePlugins = useMemo(
    () => [rehypeHighlights(marcadores.map(m => ({
      id: m.id, fragmento: m.fragmento, posicion: m.posicion, color: m.color,
    })))],
    [marcadores],
  )

  const headingId = (children: React.ReactNode): string => {
    const slug = slugify(extractText(children))
    if (!headingIdsRef.current.includes(slug)) headingIdsRef.current.push(slug)
    return `h-${slug}`
  }

  // Reset de la lista de headings antes de cada render del markdown
  headingIdsRef.current = []

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: t.bg,
    }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '8px 12px' : '10px 20px',
        borderBottom: `1px solid ${t.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 6 : 10,
        background: t.bgSidebar,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <button onClick={onClose} style={btn}>← Volver</button>
        <div style={{ flex: 1, minWidth: 120, fontSize: isMobile ? 13 : 14, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {documento.nombre}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setFontSize(fontSize - 1)} style={{ ...btn, padding: isMobile ? '6px 10px' : '4px 8px', fontWeight: 700, fontSize: isMobile ? 15 : 14 }} title="Reducir texto">A−</button>
          {!isMobile && (
            <span style={{ fontSize: 11, color: t.textMuted, minWidth: 28, textAlign: 'center' }}>{fontSize}px</span>
          )}
          <button onClick={() => setFontSize(fontSize + 1)} style={{ ...btn, padding: isMobile ? '6px 10px' : '4px 8px', fontWeight: 700, fontSize: isMobile ? 15 : 14 }} title="Aumentar texto">A+</button>
        </div>

        {marcadores.length > 0 && (
          <button onClick={exportar} style={btn} title="Exportar subrayados a Markdown">
            📤 Export
          </button>
        )}

        <EstadoBadge estado={estado} onClick={ciclarEstado} />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Contenido */}
        <div
          ref={contentRef}
          onMouseUp={handleSeleccion}
          onTouchEnd={handleSeleccion}
          onScroll={onScroll}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            padding: isMobile ? '16px' : '32px 48px',
            color: t.text,
            fontSize,
            lineHeight: 1.75,
          }}
        >
          <div className="md-content" style={{ maxWidth: isMobile ? '100%' : 720, margin: '0 auto' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={rehypePlugins}
              components={{
                mark({ children, ...props }) {
                  const color = (props as { 'data-color'?: string })['data-color'] as MarcadorColor | undefined
                  const id = (props as { 'data-marcador-id'?: string })['data-marcador-id']
                  return (
                    <mark
                      data-marcador-id={id}
                      data-color={color}
                      style={{
                        background: color ? COLOR_FILL[color] : COLOR_FILL.yellow,
                        color: 'inherit',
                        padding: '0 2px',
                        borderRadius: 2,
                        cursor: 'pointer',
                      }}
                    >
                      {children}
                    </mark>
                  )
                },
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  return match ? (
                    <SyntaxHighlighter language={match[1]}>
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code
                      style={{
                        background: t.codeBg,
                        color: t.text,
                        padding: '2px 5px',
                        borderRadius: 4,
                        fontSize: '0.88em',
                        fontFamily: 'ui-monospace, Consolas, monospace',
                        border: `1px solid ${t.border}`,
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  )
                },
                h1: ({ children }) => <h1 id={headingId(children)} style={{ color: t.h1, borderBottom: `1px solid ${t.border}`, paddingBottom: 8, lineHeight: 1.3 }}>{children}</h1>,
                h2: ({ children }) => <h2 id={headingId(children)} style={{ color: t.h2, marginTop: 32, lineHeight: 1.3 }}>{children}</h2>,
                h3: ({ children }) => <h3 id={headingId(children)} style={{ color: t.h3, marginTop: 24, lineHeight: 1.3 }}>{children}</h3>,
                blockquote: ({ children }) => (
                  <blockquote style={{
                    borderLeft: `3px solid ${t.blockquoteBorder}`,
                    paddingLeft: 16,
                    marginLeft: 0,
                    color: t.blockquoteText,
                    fontStyle: 'italic',
                  }}>
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noreferrer" style={{ color: t.link }}>{children}</a>
                ),
                table: ({ children }) => (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th style={{ padding: '8px 12px', borderBottom: `2px solid ${t.border}`, textAlign: 'left', color: t.h2 }}>{children}</th>
                ),
                td: ({ children }) => (
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${t.border}` }}>{children}</td>
                ),
                p: ({ children }) => (
                  <p style={{ margin: '0 0 1em' }}>{children}</p>
                ),
              }}
            >
              {documento.contenido}
            </ReactMarkdown>
          </div>
        </div>

        {/* Panel marcadores lateral — solo en desktop */}
        {!isMobile && marcadores.length > 0 && (
          <div style={{
            width: 240,
            background: t.bgSidebar,
            borderLeft: `1px solid ${t.border}`,
            overflowY: 'auto',
            padding: 16,
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 12, textTransform: 'uppercase' }}>
              Subrayados
            </div>
            {marcadores.map(m => (
              <div key={m.id} style={{
                background: t.bgCard,
                borderLeft: `3px solid ${COLOR_FILL[m.color].replace('0.40', '0.95').replace('0.45', '0.95')}`,
                borderRadius: 4,
                padding: '8px 10px',
                marginBottom: 8,
                fontSize: 12,
                color: t.text,
                position: 'relative',
              }}>
                <div style={{ opacity: 0.85, lineHeight: 1.4 }}>"{m.fragmento.slice(0, 90)}{m.fragmento.length > 90 ? '...' : ''}"</div>
                {m.comentario && (
                  <div style={{ marginTop: 4, fontSize: 11, fontStyle: 'italic', opacity: 0.75 }}>
                    {m.comentario}
                  </div>
                )}
                <button
                  onClick={() => borrarMarcador(m.id)}
                  style={{ ...btn, position: 'absolute', top: 4, right: 4, padding: '1px 5px', fontSize: 10 }}
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Mini-toolbar al seleccionar texto */}
        {seleccion && (
          <div
            style={{
              position: 'fixed',
              top: Math.max(8, seleccion.rect.top - 48),
              left: Math.max(8, Math.min(seleccion.rect.left, window.innerWidth - 240)),
              background: t.bgCard,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: 6,
              display: 'flex',
              gap: 4,
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
              zIndex: 100,
            }}
          >
            {COLORES_MARCADOR.map(c => (
              <button
                key={c}
                onClick={() => guardarMarcador(c)}
                title={`Subrayar (${COLOR_LABEL[c]})`}
                style={{
                  width: 28, height: 28, borderRadius: 4, border: `1px solid ${t.border}`,
                  background: COLOR_FILL[c], cursor: 'pointer',
                }}
              />
            ))}
            <button onClick={() => setSeleccion(null)} style={{ ...btn, padding: '4px 8px' }}>✕</button>
          </div>
        )}

        {/* Popover editar marcador */}
        {popover && (
          <div
            data-popover-marcador
            style={{
              position: 'fixed',
              top: Math.min(popover.rect.bottom + 8, window.innerHeight - 260),
              left: Math.max(8, Math.min(popover.rect.left, window.innerWidth - 320)),
              width: 300,
              background: t.bgCard,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: 12,
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
              zIndex: 100,
            }}
          >
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
              Editar subrayado
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              {COLORES_MARCADOR.map(c => (
                <button
                  key={c}
                  onClick={() => cambiarColor(c)}
                  title={COLOR_LABEL[c]}
                  style={{
                    flex: 1, height: 28, borderRadius: 4,
                    border: popover.marcador.color === c ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
                    background: COLOR_FILL[c],
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
            <textarea
              value={editComentario}
              onChange={(e) => setEditComentario(e.target.value)}
              placeholder="Comentario (opcional)…"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', padding: 6,
                background: t.bg, color: t.text, border: `1px solid ${t.border}`,
                borderRadius: 4, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <button onClick={() => borrarMarcador(popover.marcador.id)} style={{ ...btn, background: '#c62828', color: '#fff' }}>
                🗑 Borrar
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setPopover(null)} style={btn}>Cancelar</button>
                <button onClick={guardarComentario} style={{ ...btn, background: t.accent, color: t.mode === 'dark' ? '#1e1e2e' : '#fff' }}>
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
