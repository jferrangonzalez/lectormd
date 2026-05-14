import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import type { Proyecto } from '../types'

interface Props {
  proyectos: Proyecto[]
  loading: boolean
  proyectoActivo: string | null
  onSelect: (slug: string) => void
  onScan: () => void
  onBuscar: () => void
  onMarcadores: () => void
  onProyectoCrear: (slug: string, nombre: string) => Promise<void>
  onProyectoDel: (id: number, nombre: string) => Promise<void>
}

export function Sidebar({
  proyectos, loading, proyectoActivo,
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
      width: 240,
      minWidth: 240,
      background: t.bgSidebar,
      color: t.text,
      display: 'flex',
      flexDirection: 'column',
      borderRight: `1px solid ${t.border}`,
    }}>
      <div style={{ padding: '16px 12px 8px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: t.textAccent, flex: 1 }}>
            📚 Lecturas
          </div>
          <button
            onClick={toggle}
            title={t.mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: 4,
              borderRadius: 6,
              color: t.textMuted,
            }}
          >
            {t.mode === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <ActionBtn onClick={onBuscar}  icon="🔍" label="Buscar" />
          <ActionBtn onClick={onMarcadores} icon="🔖" label="Marcadores" />
          <ActionBtn onClick={onScan}    icon="🔄" label="Escanear" />
          <ActionBtn onClick={() => { setCreando(true); setNuevoNombre('') }} icon="➕" label="Carpeta" />
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
                padding: '4px 8px',
                fontSize: 12,
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
                padding: '4px 8px',
                fontSize: 12,
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
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >✕</button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && <div style={{ padding: '12px 16px', opacity: 0.5, fontSize: 13 }}>Cargando...</div>}
        {proyectos.map(p => (
          <ProyectoItem
            key={p.slug}
            proyecto={p}
            activo={p.slug === proyectoActivo}
            hovered={hoveredSlug === p.slug}
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

function ActionBtn({ onClick, icon, label }: { onClick: () => void; icon: string; label: string }) {
  const { t } = useTheme()
  return (
    <button
      onClick={onClick}
      style={{
        background: t.btnBg,
        border: 'none',
        borderRadius: 6,
        color: t.btnText,
        padding: '4px 8px',
        fontSize: 11,
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
  proyecto, activo, hovered,
  onClick, onMouseEnter, onMouseLeave, onDel,
}: {
  proyecto: Proyecto
  activo: boolean
  hovered: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  onDel: () => void
}) {
  const { t } = useTheme()
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        padding: '10px 16px',
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
        <div style={{ fontSize: 13, fontWeight: activo ? 600 : 400, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {proyecto.nombre || proyecto.slug}
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 11, opacity: 0.6 }}>
          {proyecto.leyendo > 0   && <span>📖 {proyecto.leyendo}</span>}
          {proyecto.pendientes > 0 && <span>📄 {proyecto.pendientes}</span>}
          {proyecto.leidos > 0    && <span>✅ {proyecto.leidos}</span>}
        </div>
      </div>
      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDel() }}
          title="Eliminar carpeta"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#f38ba8',
            fontSize: 13,
            padding: '2px 4px',
            borderRadius: 4,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >🗑</button>
      )}
    </div>
  )
}
