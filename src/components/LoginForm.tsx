import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function LoginForm() {
  const { login } = useAuth()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !pass) return
    setLoading(true)
    setError(null)
    try {
      const token = btoa(`${user}:${pass}`)
      const res = await fetch('/api/?a=proyectos', {
        headers: { Authorization: `Basic ${token}` },
      })
      if (res.status === 401) {
        setError('Usuario o contraseña incorrectos')
        return
      }
      login(user, pass)
    } catch {
      setError('No se pudo conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#11111b',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        width: 340,
        background: '#1e1e2e',
        border: '1px solid #313244',
        borderRadius: 16,
        padding: '36px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📚</div>
          <div style={{ color: '#cdd6f4', fontWeight: 700, fontSize: 18 }}>Lecturas</div>
          <div style={{ color: '#6c7086', fontSize: 13, marginTop: 4 }}>Acceso privado</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: '#a6adc8', fontSize: 12, fontWeight: 600 }}>Usuario</label>
            <input
              type="text"
              value={user}
              onChange={e => setUser(e.target.value)}
              autoFocus
              autoComplete="username"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: '#a6adc8', fontSize: 12, fontWeight: 600 }}>Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              autoComplete="current-password"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(243, 139, 168, 0.15)',
              border: '1px solid rgba(243, 139, 168, 0.4)',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#f38ba8',
              fontSize: 13,
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#cba6f7',
              border: 'none',
              borderRadius: 8,
              color: '#1e1e2e',
              padding: '10px 0',
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginTop: 4,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#313244',
  border: '1px solid #45475a',
  borderRadius: 8,
  color: '#cdd6f4',
  padding: '9px 12px',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}
