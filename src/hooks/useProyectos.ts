import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Proyecto } from '../types'

export function useProyectos() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.proyectos()
      setProyectos(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  return { proyectos, loading, error, recargar: cargar }
}
