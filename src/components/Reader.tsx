import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SyntaxHighlighter } from './SyntaxHighlighter'
import type { DocumentoConContenido, Estado, Marcador } from '../types'
import { api } from '../api/client'
import { EstadoBadge } from './EstadoBadge'
import { useTheme } from '../context/ThemeContext'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
  documento: DocumentoConContenido
  onClose: () => void
  onEstadoChange: () => void
}

export function Reader({ documento, onClose, onEstadoChange }: Props) {
  const { t, fontSize, setFontSize } = useTheme()
  const isMobile = useIsMobile()
  const [estado, setEstado] = useState<Estado>(documento.estado)
  const [marcadores, setMarcadores] = useState<Marcador[]>([])
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    setEstado(documento.estado)
    api.marcadores(documento.id).then(setMarcadores)

    if (documento.estado === 'pendiente') {
      api.setEstado(documento.id, 'leyendo').then(() => {
        setEstado('leyendo')
        onEstadoChange()
      })
    }
  }, [documento.id])

  const ciclarEstado = async () => {
    const orden: Estado[] = ['pendiente', 'leyendo', 'leido']
    const siguiente = orden[(orden.indexOf(estado) + 1) % 3]
    await api.setEstado(documento.id, siguiente)
    setEstado(siguiente)
    onEstadoChange()
  }

  const handleSeleccion = () => {
    const sel = window.getSelection()?.toString().trim()
    setSeleccion(sel && sel.length > 5 ? sel : null)
  }

  const guardarMarcador = async () => {
    if (!seleccion) return
    await api.addMarcador(documento.id, seleccion, 0)
    const updated = await api.marcadores(documento.id)
    setMarcadores(updated)
    setSeleccion(null)
  }

  const borrarMarcador = async (id: number) => {
    await api.delMarcador(id)
    setMarcadores(m => m.filter(x => x.id !== id))
  }

  return (
    <div style={{
      flex: 1,
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
          <button
            onClick={() => setFontSize(fontSize - 1)}
            style={{ ...btn, padding: isMobile ? '6px 10px' : '4px 8px', fontWeight: 700, fontSize: isMobile ? 15 : 14 }}
            title="Reducir texto"
          >A−</button>
          {!isMobile && (
            <span style={{ fontSize: 11, color: t.textMuted, minWidth: 28, textAlign: 'center' }}>{fontSize}px</span>
          )}
          <button
            onClick={() => setFontSize(fontSize + 1)}
            style={{ ...btn, padding: isMobile ? '6px 10px' : '4px 8px', fontWeight: 700, fontSize: isMobile ? 15 : 14 }}
            title="Aumentar texto"
          >A+</button>
        </div>

        <EstadoBadge estado={estado} onClick={ciclarEstado} />
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Contenido */}
        <div
          ref={contentRef}
          onMouseUp={handleSeleccion}
          onTouchEnd={handleSeleccion}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isMobile ? '16px' : '32px 48px',
            color: t.text,
            fontSize,
            lineHeight: 1.75,
          }}
        >
          {seleccion && (
            <div style={{
              position: 'sticky',
              top: 0,
              background: t.bgCard,
              border: `1px solid ${t.accent}`,
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              zIndex: 10,
              flexWrap: 'wrap',
            }}>
              <span style={{ flex: 1, minWidth: 100, opacity: 0.8 }}>"{seleccion.slice(0, 60)}{seleccion.length > 60 ? '...' : ''}"</span>
              <button onClick={guardarMarcador} style={{ ...btn, background: t.accent, color: t.mode === 'dark' ? '#1e1e2e' : '#fff' }}>
                🔖 Guardar
              </button>
              <button onClick={() => setSeleccion(null)} style={btn}>✕</button>
            </div>
          )}

          <div style={{ maxWidth: isMobile ? '100%' : 720, margin: '0 auto' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
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
                h1: ({ children }) => <h1 style={{ color: t.h1, borderBottom: `1px solid ${t.border}`, paddingBottom: 8, lineHeight: 1.3 }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ color: t.h2, marginTop: 32, lineHeight: 1.3 }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ color: t.h3, marginTop: 24, lineHeight: 1.3 }}>{children}</h3>,
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
                  <a href={href} target="_blank" rel="noreferrer" style={{ color: t.link }}>
                    {children}
                  </a>
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
              Marcadores
            </div>
            {marcadores.map(m => (
              <div key={m.id} style={{
                background: t.bgCard,
                borderRadius: 8,
                padding: '8px 10px',
                marginBottom: 8,
                fontSize: 12,
                color: t.text,
                position: 'relative',
              }}>
                <div style={{ opacity: 0.8, lineHeight: 1.5 }}>"{m.fragmento.slice(0, 80)}"</div>
                <button
                  onClick={() => borrarMarcador(m.id)}
                  style={{ ...btn, position: 'absolute', top: 4, right: 4, padding: '1px 5px', fontSize: 10 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
