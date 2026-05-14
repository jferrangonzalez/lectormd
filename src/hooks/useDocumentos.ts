import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Documento, Estado } from '../types'

export function useDocumentos(proyecto?: string, estado?: Estado) {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!proyecto) { setDocumentos([]); return }
    setLoading(true)
    api.documentos(proyecto, estado)
      .then(setDocumentos)
      .finally(() => setLoading(false))
  }, [proyecto, estado])

  return { documentos, loading }
}
