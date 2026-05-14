export interface Proyecto {
  id: number
  slug: string
  nombre: string
  total: number
  pendientes: number
  leyendo: number
  leidos: number
}

export interface Documento {
  id: number
  nombre: string
  ruta: string
  estado: Estado
  created_at: string
  updated_at: string
  proyecto_slug: string
  proyecto_nombre: string
}

export interface DocumentoConContenido extends Documento {
  contenido: string
}

export interface Marcador {
  id: number
  documento_id: number
  fragmento: string
  comentario: string | null
  posicion: number
  created_at: string
  doc_nombre?: string
  doc_ruta?: string
  proyecto_slug?: string
}

export interface ResultadoBusqueda {
  documento_id: number
  nombre: string
  ruta: string
  fragmento: string
  estado: Estado
  proyecto_slug: string
  proyecto_nombre: string
}

export type Estado = 'pendiente' | 'leyendo' | 'leido'

export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}
