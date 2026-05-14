import { useState } from 'react'
import type { Documento, Estado } from '../types'
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
  loading: boolean
  onSelect: (doc: Documento) => void
  onEstadoChange: () => void
}

export function ListaDocumentos({ documentos, loading, onSelect, onEstadoChange }: Props) {
  const { t } = useTheme()
  const [filtro, setFiltro] = useState<Estado | ''>('')

  const filtrados = filtro ? documentos.filter(d => d.estado === filtro) : documentos

  const ciclarEstado = async (doc: Documento) => {
    const orden: Estado[] = ['pendiente', 'leyendo', 'leido']
    const siguiente = orden[(orden.indexOf(doc.estado) + 1) % 3]
    await api.setEstado(doc.id, siguiente)
    onEstadoChange()
  }

  return (
    <div style={{
      width: 300,
      minWidth: 300,
      background: t.bg,
      borderRight: `1px solid ${t.border}`,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${t.border}`,
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        background: t.bgSidebar,
      }}>
        {ESTADOS.map(e => (
          <button
            key={e.value}
            onClick={() => setFiltro(e.value)}
            style={{
              padding: '3px 10px',
              borderRadius: 12,
              border: 'none',
              fontSize: 11,
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
        {filtrados.map(doc => (
          <div
            key={doc.id}
            onClick={() => onSelect(doc)}
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${t.border}`,
              cursor: 'pointer',
              color: t.text,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = t.bgCard)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.4 }}>
              {doc.nombre}
            </div>
            <span onClick={e => { e.stopPropagation(); ciclarEstado(doc) }}>
              <EstadoBadge estado={doc.estado} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
