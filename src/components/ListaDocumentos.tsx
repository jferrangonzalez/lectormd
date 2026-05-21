import { useState } from 'react'
import type { Documento, Estado, Proyecto } from '../types'
import { EstadoBadge } from './EstadoBadge'
import { api } from '../api/client'
import { useTheme } from '../context/ThemeContext'

const ESTADOS: Array<{ value: Estado | ''; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'leyendo', label: 'Leyendo' },
  { value: 'leido', label: 'Leídos' },
]

interface Props {
  documentos: Documento[]
  proyectos: Proyecto[]
  loading: boolean
  isMobile?: boolean
  onSelect: (doc: Documento) => void
  onEstadoChange: () => void
  onListaChange: () => void
  onBack?: () => void
}

export function ListaDocumentos({ documentos, proyectos, loading, isMobile, onSelect, onEstadoChange, onListaChange, onBack }: Props) {
  const { t } = useTheme()
  const [filtro, setFiltro] = useState<Estado | ''>('')
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  const filtrados = filtro ? documentos.filter(d => d.estado === filtro) : documentos
  const puedeReordenar = filtro === ''

  const ciclarEstado = async (doc: Documento) => {
    const orden: Estado[] = ['pendiente', 'leyendo', 'leido']
    const siguiente = orden[(orden.indexOf(doc.estado) + 1) % 3]
    await api.setEstado(doc.id, siguiente)
    onEstadoChange()
  }

  const eliminar = async (doc: Documento) => {
    if (!confirm(`¿Eliminar "${doc.nombre}"? Esta acción no se puede deshacer.`)) return
    await api.documentoDel(doc.id)
    onListaChange()
  }

  const mover = async (doc: Documento, proyectoSlug: string) => {
    if (proyectoSlug === doc.proyecto_slug) return
    await api.moverDocumento(doc.id, proyectoSlug)
    // Cierra el popover programáticamente tras mover.
    document.getElementById(`mover-${doc.id}`)?.hidePopover?.()
    onListaChange()
  }

  const subirOrden = async (idx: number) => {
    if (idx === 0) return
    await api.ordenSwap(filtrados[idx].id, filtrados[idx - 1].id)
    onListaChange()
  }

  const bajarOrden = async (idx: number) => {
    if (idx === filtrados.length - 1) return
    await api.ordenSwap(filtrados[idx].id, filtrados[idx + 1].id)
    onListaChange()
  }

  const btnSm: React.CSSProperties = {
    background: t.btnBg,
    border: 'none',
    borderRadius: 4,
    color: t.btnText,
    padding: isMobile ? '6px 10px' : '2px 6px',
    fontSize: isMobile ? 13 : 11,
    cursor: 'pointer',
    lineHeight: 1.4,
    flexShrink: 0,
  }

  const btnDanger: React.CSSProperties = {
    ...btnSm,
    color: '#f38ba8',
  }

  return (
    <div style={{
      width: isMobile ? '100%' : 300,
      minWidth: isMobile ? 0 : 300,
      flex: isMobile ? 1 : undefined,
      background: t.bg,
      borderRight: isMobile ? 'none' : `1px solid ${t.border}`,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: isMobile ? '10px 16px' : '12px 16px',
        borderBottom: `1px solid ${t.border}`,
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        alignItems: 'center',
        background: t.bgSidebar,
      }}>
        {isMobile && onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: t.textAccent,
              fontSize: 14,
              cursor: 'pointer',
              padding: '4px 0',
              marginRight: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ← Proyectos
          </button>
        )}
        {ESTADOS.map(e => (
          <button
            key={e.value}
            onClick={() => setFiltro(e.value)}
            style={{
              padding: isMobile ? '6px 12px' : '3px 10px',
              borderRadius: 12,
              border: 'none',
              fontSize: isMobile ? 13 : 11,
              cursor: 'pointer',
              background: filtro === e.value ? t.accent : t.btnBg,
              color: filtro === e.value ? (t.mode === 'dark' ? '#1e1e2e' : '#fff') : t.btnText,
              fontWeight: filtro === e.value ? 700 : 400,
            }}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ padding: 16, color: t.textMuted, fontSize: 13 }}>Cargando...</div>}
        {!loading && filtrados.length === 0 && (
          <div style={{ padding: 16, color: t.textMuted, fontSize: 13 }}>Sin documentos</div>
        )}
        {filtrados.map((doc, idx) => (
          <div
            key={doc.id}
            onMouseEnter={() => !isMobile && setHoveredId(doc.id)}
            onMouseLeave={() => !isMobile && setHoveredId(null)}
            style={{
              padding: isMobile ? '12px 14px' : '10px 12px',
              borderBottom: `1px solid ${t.border}`,
              background: !isMobile && hoveredId === doc.id ? t.bgCard : 'transparent',
              transition: 'background 0.1s',
            }}
          >
            <div
              onClick={() => onSelect(doc)}
              style={{ cursor: 'pointer', marginBottom: isMobile ? 8 : 6 }}
            >
              <div style={{ fontSize: isMobile ? 15 : 13, lineHeight: 1.4, color: t.text }}>
                {doc.nombre}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 4, flexWrap: 'wrap' }}>
              <span onClick={e => { e.stopPropagation(); ciclarEstado(doc) }}>
                <EstadoBadge estado={doc.estado} />
              </span>

              <div style={{ flex: 1 }} />

              {puedeReordenar && (
                <>
                  <button
                    onClick={() => subirOrden(idx)}
                    disabled={idx === 0}
                    style={{ ...btnSm, opacity: idx === 0 ? 0.3 : 1 }}
                    title="Subir"
                  >↑</button>
                  <button
                    onClick={() => bajarOrden(idx)}
                    disabled={idx === filtrados.length - 1}
                    style={{ ...btnSm, opacity: idx === filtrados.length - 1 ? 0.3 : 1 }}
                    title="Bajar"
                  >↓</button>
                </>
              )}

              <button
                {...({ popovertarget: `mover-${doc.id}` } as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                style={btnSm}
                title="Mover a carpeta"
              >📂</button>
              <div
                id={`mover-${doc.id}`}
                {...({ popover: 'auto' } as React.HTMLAttributes<HTMLDivElement>)}
                className="mover-popover"
                style={{
                  background: t.bgModal,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  minWidth: 180,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  overflow: 'hidden',
                  color: t.text,
                }}
              >
                <div style={{ padding: '6px 10px', fontSize: 10, color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', borderBottom: `1px solid ${t.border}` }}>
                  Mover a…
                </div>
                {proyectos
                  .filter(p => p.slug !== doc.proyecto_slug)
                  .map(p => (
                    <div
                      key={p.slug}
                      onClick={() => mover(doc, p.slug)}
                      style={{
                        padding: isMobile ? '10px 12px' : '7px 10px',
                        fontSize: isMobile ? 14 : 12,
                        color: t.text,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.bgCard)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {p.nombre}
                    </div>
                  ))
                }
              </div>

              <button
                onClick={() => eliminar(doc)}
                style={btnDanger}
                title="Eliminar lectura"
              >✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
