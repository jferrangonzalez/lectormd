import type {
  ApiResponse,
  Documento,
  DocumentoConContenido,
  Estado,
  Marcador,
  MarcadorColor,
  Proyecto,
  ResultadoBusqueda,
} from '../types'

const BASE = '/api'
const STORAGE_KEY = 'lectormd-auth'

let _onAuthError: (() => void) | null = null

export function setApiAuthErrorHandler(fn: () => void) { _onAuthError = fn }

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem(STORAGE_KEY)
  return token ? { Authorization: `Basic ${token}` } : {}
}

async function req<T>(params: Record<string, string | number>): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString()
  const res = await fetch(`${BASE}/?${qs}`, { headers: authHeaders() })
  if (res.status === 401) { _onAuthError?.(); throw new Error('No autorizado') }
  const json: ApiResponse<T> = await res.json()
  if (!json.ok) throw new Error(json.error ?? 'Error desconocido')
  return json.data as T
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (res.status === 401) { _onAuthError?.(); throw new Error('No autorizado') }
  const json: ApiResponse<T> = await res.json()
  if (!json.ok) throw new Error(json.error ?? 'Error desconocido')
  return json.data as T
}

export const api = {
  proyectos: () => req<Proyecto[]>({ a: 'proyectos' }),

  documentos: (proyecto?: string, estado?: Estado) =>
    req<Documento[]>({
      a: 'documentos',
      ...(proyecto ? { proyecto } : {}),
      ...(estado ? { estado } : {}),
    }),

  documento: (id: number) => req<DocumentoConContenido>({ a: 'documento', id }),

  setEstado: (id: number, estado: Estado) =>
    post<{ id: number; estado: Estado }>({ a: 'estado', id, estado }),

  buscar: (q: string) => req<ResultadoBusqueda[]>({ a: 'buscar', q }),

  marcadores: (documento_id: number) =>
    req<Marcador[]>({ a: 'marcadores', documento_id }),

  todosLosMarcadores: () => req<Marcador[]>({ a: 'marcadores_all' }),

  addMarcador: (
    documento_id: number,
    fragmento: string,
    posicion: number,
    color: MarcadorColor = 'yellow',
    comentario?: string,
  ) =>
    post<{ id: number }>({
      a: 'marcador_add',
      documento_id,
      fragmento,
      posicion,
      color,
      ...(comentario ? { comentario } : {}),
    }),

  updateMarcador: (
    id: number,
    patch: { color?: MarcadorColor; comentario?: string | null },
  ) =>
    post<{ id: number }>({ a: 'marcador_update', id, ...patch }),

  delMarcador: (id: number) =>
    post<{ deleted: number }>({ a: 'marcador_del', id }),

  scrollSave: (id: number, anchor: string) =>
    post<{ id: number }>({ a: 'scroll_save', id, anchor }),

  exportMarcadores: (target: { documento_id: number } | { proyecto_slug: string }) =>
    post<{ filename: string; markdown: string }>({ a: 'marcadores_export', ...target }),

  scan: () => req<unknown>({ a: 'scan' }),

  proyectoCrear: (slug: string, nombre: string) =>
    post<{ id: number; slug: string; nombre: string }>({ a: 'proyecto_crear', slug, nombre }),

  proyectoDel: (id: number) =>
    post<{ deleted: number }>({ a: 'proyecto_del', id }),

  proyectoRename: (id: number, nombre: string) =>
    post<{ id: number; nombre: string }>({ a: 'proyecto_rename', id, nombre }),

  documentoDel: (id: number) =>
    post<{ deleted: number }>({ a: 'documento_del', id }),

  moverDocumento: (id: number, proyecto_slug: string) =>
    post<{ id: number; nueva_ruta?: string }>({ a: 'mover', id, proyecto_slug }),

  ordenSwap: (id_a: number, id_b: number) =>
    post<{ ok: boolean }>({ a: 'orden_swap', id_a, id_b }),
}
