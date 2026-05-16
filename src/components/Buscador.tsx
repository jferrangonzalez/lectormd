import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { Documento, ResultadoBusqueda } from '../types'
import { useTheme } from '../context/ThemeContext'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
  onSelect: (doc: Documento) => void
  onClose: () => void
}

export function Buscador({ onSelect, onClose }: Props) {
  const { t } = useTheme()
  const isMobile = useIsMobile()
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const buscar = (valor: string) => {
    setQ(valor)
    if (timer.current) clearTimeout(timer.current)
    if (valor.length < 2) { setResultados([]); return }
    timer.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const data = await api.buscar(valor)
        setResultados(data)
      } finally {
        setBuscando(false)
      }
    }, 300)
  }

  const seleccionar = (r: ResultadoBusqueda) => {
    onSelect({
      id: r.documento_id,
      nombre: r.nombre,
      ruta: r.ruta,
      estado: r.estado,
      orden: 0,
      created_at: '',
      updated_at: '',
      proyecto_slug: r.proyecto_slug,
      proyecto_nombre: r.proyecto_nombre,
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
      paddingTop: isMobile ? 20 : 80,
      zIndex: 100,
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: t.bgModal,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          width: 640,
          maxWidth: '90vw',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: t.textMuted, fontSize: 16 }}>🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={e => buscar(e.target.value)}
            placeholder="Buscar en todos los documentos..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: t.text,
              fontSize: 15,
            }}
          />
          {buscando && <span style={{ color: t.textMuted, fontSize: 12 }}>...</span>}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {resultados.length === 0 && q.length >= 2 && !buscando && (
            <div style={{ padding: 24, color: t.textMuted, textAlign: 'center', fontSize: 13 }}>
              Sin resultados para "{q}"
            </div>
          )}
          {resultados.map((r, i) => (
            <div
              key={i}
              onClick={() => seleccionar(r)}
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${t.border}`,
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = t.bgCard)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: 13, color: t.text, marginBottom: 4 }}>
                {r.nombre}
                <span style={{ marginLeft: 8, fontSize: 11, color: t.textAccent }}>{r.proyecto_nombre}</span>
              </div>
              <div
                style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{ __html: r.fragmento }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
