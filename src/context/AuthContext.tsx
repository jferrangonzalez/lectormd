import { createContext, useContext, useState } from 'react'

interface AuthCtx {
  token: string | null
  login: (user: string, pass: string) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

const STORAGE_KEY = 'lectormd-auth'

function encode(user: string, pass: string) {
  return btoa(`${user}:${pass}`)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(STORAGE_KEY)
  )

  const login = (user: string, pass: string) => {
    const t = encode(user, pass)
    sessionStorage.setItem(STORAGE_KEY, t)
    setToken(t)
  }

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setToken(null)
  }

  return <Ctx.Provider value={{ token, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}
