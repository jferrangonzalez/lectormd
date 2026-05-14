import type { Estado } from '../types'

const CONFIG: Record<Estado, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: '#6b7280' },
  leyendo:   { label: 'Leyendo',   color: '#f59e0b' },
  leido:     { label: 'Leído',     color: '#10b981' },
}

interface Props {
  estado: Estado
  onClick?: () => void
}

export function EstadoBadge({ estado, onClick }: Props) {
  const { label, color } = CONFIG[estado]
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        color: '#fff',
        background: color,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      {label}
    </span>
  )
}
