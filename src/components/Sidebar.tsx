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
}

export function Sidebar({ proyectos, loading, proyectoActivo, onSelect, onScan, onBuscar, onMarcadores }: Props) {
  const { t, toggle } = useTheme()

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
          <ActionBtn onClick={onBuscar} icon="🔍" label="Buscar" />
          <ActionBtn onClick={onMarcadores} icon="🔖" label="Marcadores" />
          <ActionBtn onClick={onScan} icon="🔄" label="Escanear" />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && <div style={{ padding: '12px 16px', opacity: 0.5, fontSize: 13 }}>Cargando...</div>}
        {proyectos.map(p => (
          <ProyectoItem
            key={p.slug}
            proyecto={p}
            activo={p.slug === proyectoActivo}
            onClick={() => onSelect(p.slug)}
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

function ProyectoItem({ proyecto, activo, onClick }: { proyecto: Proyecto; activo: boolean; onClick: () => void }) {
  const { t } = useTheme()
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 16px',
        cursor: 'pointer',
        background: activo ? t.bgCard : 'transparent',
        borderLeft: activo ? `3px solid ${t.accent}` : '3px solid transparent',
        transition: 'background 0.15s',
        color: t.text,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: activo ? 600 : 400, marginBottom: 4 }}>
        {proyecto.nombre || proyecto.slug}
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 11, opacity: 0.6 }}>
        {proyecto.leyendo > 0 && <span>📖 {proyecto.leyendo}</span>}
        {proyecto.pendientes > 0 && <span>📄 {proyecto.pendientes}</span>}
        {proyecto.leidos > 0 && <span>✅ {proyecto.leidos}</span>}
      </div>
    </div>
  )
}
