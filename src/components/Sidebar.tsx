import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import type { Proyecto } from '../types'

interface Props {
  proyectos: Proyecto[]
  loading: boolean
  proyectoActivo: string | null
  isMobile?: boolean
  onSelect: (slug: string) => void
  onScan: () => void
  onBuscar: () => void
  onMarcadores: () => void
  onProyectoCrear: (slug: string, nombre: string) => Promise<void>
  onProyectoDel: (id: number, nombre: string) => Promise<void>
}

export function Sidebar({
  proyectos, loading, proyectoActivo, isMobile,
  onSelect, onScan, onBuscar, onMarcadores,
  onProyectoCrear, onProyectoDel,
}: Props) {
  const { t, toggle } = useTheme()
  const [creando, setCreando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)

  const confirmarCrear = async () => {
    const nombre = nuevoNombre.trim()
    if (!nombre) return
    const slug = nombre.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    await onProyectoCrear(slug, nombre)
    setNuevoNombre('')
    setCreando(false)
  }

  return (
    <aside style={{
      width: isMobile ? '100%' : 240,
      minWidth: isMobile ? 0 : 240,
      flex: isMobile ? 1 : undefined,
      minHeight: 0,
      background: t.bgSidebar,
      color: t.text,
      display: 'flex',
      flexDirection: 'column',
      borderRight: isMobile ? 'none' : `1px solid ${t.border}`,
      overflow: 'hidden',
    }}>
      <div style={{ padding: isMobile ? '14px 16px 10px' : '16px 12px 8px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: isMobile ? 17 : 15, color: t.textAccent, flex: 1 }}>
            📚 Lecturas
          </div>
          <button
            onClick={toggle}
            title={t.mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: isMobile ? 20 : 16,
              lineHeight: 1,
              padding: isMobile ? 8 : 4,
              borderRadius: 6,
              color: t.textMuted,
            }}
          >
            {t.mode === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <ActionBtn onClick={onBuscar}    icon="🔍" label="Buscar"     isMobile={isMobile} />
          <ActionBtn onClick={onMarcadores} icon="🔖" label="Marcadores" isMobile={isMobile} />
          <ActionBtn onClick={onScan}      icon="🔄" label="Escanear"   isMobile={isMobile} />
          <ActionBtn onClick={() => { setCreando(true); setNuevoNombre('') }} icon="➕" label="Carpeta" isMobile={isMobile} />
        </div>

        {creando && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            <input
              autoFocus
              value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmarCrear()
                if (e.key === 'Escape') setCreando(false)
              }}
              placeholder="Nombre de carpeta"
              style={{
                flex: 1,
                background: t.bgCard,
                border: `1px solid ${t.border}`,
                borderRadius: 6,
                color: t.text,
                padding: isMobile ? '8px 10px' : '4px 8px',
                fontSize: isMobile ? 14 : 12,
                outline: 'none',
              }}
            />
            <button
              onClick={confirmarCrear}
              style={{
                background: t.accent,
                border: 'none',
                borderRadius: 6,
                color: t.mode === 'dark' ? '#1e1e2e' : '#fff',
                padding: isMobile ? '8px 12px' : '4px 8px',
                fontSize: isMobile ? 14 : 12,
                cursor: 'pointer',
              }}
            >✓</button>
            <button
              onClick={() => setCreando(false)}
              style={{
                background: t.btnBg,
                border: 'none',
                borderRadius: 6,
                color: t.btnText,
                padding: isMobile ? '8px 12px' : '4px 8px',
                fontSize: isMobile ? 14 : 12,
                cursor: 'pointer',
              }}
            >✕</button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '8px 0' }}>
        {loading && <div style={{ padding: '12px 16px', opacity: 0.5, fontSize: 13 }}>Cargando...</div>}
        {proyectos.map(p => (
          <ProyectoItem
            key={p.slug}
            proyecto={p}
            activo={p.slug === proyectoActivo}
            hovered={hoveredSlug === p.slug}
            isMobile={isMobile}
            onClick={() => onSelect(p.slug)}
            onMouseEnter={() => setHoveredSlug(p.slug)}
            onMouseLeave={() => setHoveredSlug(null)}
            onDel={() => onProyectoDel(p.id, p.nombre)}
          />
        ))}
      </div>
    </aside>
  )
}

function ActionBtn({ onClick, icon, label, isMobile }: { onClick: () => void; icon: string; label: string; isMobile?: boolean }) {
  const { t } = useTheme()
  return (
    <button
      onClick={onClick}
      style={{
        background: t.btnBg,
        border: 'none',
        borderRadius: 6,
        color: t.btnText,
        padding: isMobile ? '8px 12px' : '4px 8px',
        fontSize: isMobile ? 13 : 11,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {icon} {label}
    </button>
  )
}

function ProyectoItem({
  proyecto, activo, hovered, isMobile,
  onClick, onMouseEnter, onMouseLeave, onDel,
}: {
  proyecto: Proyecto
  activo: boolean
  hovered: boolean
  isMobile?: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  onDel: () => void
}) {
  const { t } = useTheme()
  const mostrarDel = isMobile || hovered
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        padding: isMobile ? '14px 16px' : '10px 16px',
        cursor: 'pointer',
        background: activo ? t.bgCard : hovered ? t.bgCardHover + '55' : 'transparent',
        borderLeft: activo ? `3px solid ${t.accent}` : '3px solid transparent',
        transition: 'background 0.15s',
        color: t.text,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: isMobile ? 15 : 13, fontWeight: activo ? 600 : 400, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {proyecto.nombre || proyecto.slug}
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: isMobile ? 12 : 11, opacity: 0.6 }}>
          {proyecto.leyendo > 0   && <span>📖 {proyecto.leyendo}</span>}
          {proyecto.pendientes > 0 && <span>📄 {proyecto.pendientes}</span>}
          {proyecto.leidos > 0    && <span>✅ {proyecto.leidos}</span>}
        </div>
      </div>
      {mostrarDel && (
        <button
          onClick={e => { e.stopPropagation(); onDel() }}
          title="Eliminar carpeta"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#f38ba8',
            fontSize: isMobile ? 16 : 13,
            padding: isMobile ? '6px 8px' : '2px 4px',
            borderRadius: 4,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >🗑</button>
      )}
    </div>
  )
}
