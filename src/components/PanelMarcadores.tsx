import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Documento, Marcador } from '../types'
import { useTheme } from '../context/ThemeContext'

interface Props {
  onSelect: (doc: Documento) => void
  onClose: () => void
}

export function PanelMarcadores({ onSelect, onClose }: Props) {
  const { t } = useTheme()
  const [marcadores, setMarcadores] = useState<Marcador[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.todosLosMarcadores()
      .then(setMarcadores)
      .finally(() => setLoading(false))
  }, [])

  const borrar = async (id: number) => {
    await api.delMarcador(id)
    setMarcadores(m => m.filter(x => x.id !== id))
  }

  const abrir = (m: Marcador) => {
    onSelect({
      id: m.documento_id,
      nombre: m.doc_nombre ?? '',
      ruta: m.doc_ruta ?? '',
      estado: 'leyendo',
      orden: 0,
      created_at: '',
      updated_at: '',
      proyecto_slug: m.proyecto_slug ?? '',
      proyecto_nombre: '',
    })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: 80,
      zIndex: 100,
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: t.bgModal,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          width: 600,
          maxWidth: '90vw',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: t.textAccent, fontWeight: 700, fontSize: 14 }}>🔖 Todos los marcadores</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ padding: 24, color: t.textMuted, fontSize: 13, textAlign: 'center' }}>Cargando...</div>}
          {!loading && marcadores.length === 0 && (
            <div style={{ padding: 24, color: t.textMuted, fontSize: 13, textAlign: 'center' }}>Sin marcadores guardados</div>
          )}
          {marcadores.map(m => (
            <div key={m.id} style={{
              padding: '12px 18px',
              borderBottom: `1px solid ${t.border}`,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => abrir(m)}>
                <div style={{ fontSize: 11, color: t.textAccent, marginBottom: 4 }}>
                  {m.proyecto_slug} / {m.doc_nombre}
                </div>
                <div style={{ fontSize: 13, color: t.textMuted, fontStyle: 'italic', lineHeight: 1.5 }}>
                  "{m.fragmento.slice(0, 120)}{m.fragmento.length > 120 ? '...' : ''}"
                </div>
                {m.comentario && (
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>{m.comentario}</div>
                )}
              </div>
              <button
                onClick={() => borrar(m.id)}
                style={{
                  background: t.btnBg,
                  border: 'none',
                  borderRadius: 6,
                  color: '#f38ba8',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  fontSize: 11,
                  flexShrink: 0,
                }}
              >
                Borrar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
