import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getConfig } from './config.js'
import {
  actionScan,
  actionProyectos,
  actionDocumentos,
  actionDocumento,
  actionEstado,
  actionBuscar,
  actionMarcadores,
  actionMarcadorAdd,
  actionMarcadorDel,
  actionMarcadoresAll,
  actionProyectoRename,
  actionProyectoDel,
  actionProyectoCrear,
  actionMover,
  actionDocumentoDel,
  actionOrdenSwap,
  actionUpload,
} from './api.js'

// Carga config y falla rápido si falta .env
const { AUTH_USER, AUTH_PASS } = getConfig()

const app = new Hono()

// ── CORS (antes del auth para que OPTIONS preflight pase) ─────────────────────
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
)

// ── Auth Basic (sin WWW-Authenticate para no disparar diálogo nativo) ─────────
app.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization') ?? ''
  const match = authHeader.match(/^Basic\s+(.+)$/i)

  if (!match) {
    return c.json({ ok: false, error: 'No autorizado' }, 401)
  }

  const decoded = Buffer.from(match[1], 'base64').toString('utf-8')
  const colon = decoded.indexOf(':')
  const user = colon >= 0 ? decoded.slice(0, colon) : decoded
  const pass = colon >= 0 ? decoded.slice(colon + 1) : ''

  if (user !== AUTH_USER || pass !== AUTH_PASS) {
    return c.json({ ok: false, error: 'No autorizado' }, 401)
  }

  await next()
})

// ── Dispatcher ────────────────────────────────────────────────────────────────
app.all('*', async (c) => {
  const method = c.req.method

  let params: Record<string, unknown>
  let action: string

  if (method === 'POST') {
    try {
      params = (await c.req.json()) as Record<string, unknown>
    } catch {
      return c.json({ ok: false, error: 'Body JSON inválido' }, 400)
    }
    action = String(params.a ?? '')
  } else {
    // GET, HEAD, etc.
    const query = c.req.query()
    params = query as Record<string, unknown>
    action = String(query.a ?? '')
  }

  // Dispatch — las acciones lanzan Error en caso de falla
  try {
    let data: unknown

    const strParams = params as Record<string, string>

    switch (action) {
      case 'scan':
        data = actionScan()
        break
      case 'proyectos':
        data = actionProyectos()
        break
      case 'documentos':
        data = actionDocumentos(strParams)
        break
      case 'documento':
        data = actionDocumento(strParams)
        break
      case 'estado':
        data = actionEstado(strParams)
        break
      case 'buscar':
        data = actionBuscar(strParams)
        break
      case 'marcadores':
        data = actionMarcadores(strParams)
        break
      case 'marcador_add':
        data = actionMarcadorAdd(params)
        break
      case 'marcador_del':
        data = actionMarcadorDel(strParams)
        break
      case 'marcadores_all':
        data = actionMarcadoresAll()
        break
      case 'proyecto_rename':
        data = actionProyectoRename(strParams)
        break
      case 'proyecto_del':
        data = actionProyectoDel(strParams)
        break
      case 'proyecto_crear':
        data = actionProyectoCrear(strParams)
        break
      case 'mover':
        data = actionMover(strParams)
        break
      case 'documento_del':
        data = actionDocumentoDel(strParams)
        break
      case 'orden_swap':
        data = actionOrdenSwap(strParams)
        break
      case 'upload':
        data = actionUpload(params)
        break
      default:
        return c.json({ ok: false, error: `Acción desconocida: ${action}` }, 400)
    }

    return c.json({ ok: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ ok: false, error: message }, 400)
  }
})

// ── Arranque ──────────────────────────────────────────────────────────────────
const PORT = 8080

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[lectormd] server → http://localhost:${info.port}`)
})
