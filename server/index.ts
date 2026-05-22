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

  // Merge: query string + body. Body gana si hay clash.
  // Permite `?a=upload` con payload grande en JSON body (evita 414 Request-URI Too Large).
  const query = c.req.query() as Record<string, unknown>
  let body: Record<string, unknown> = {}

  if (method === 'POST') {
    const raw = await c.req.text()
    if (raw.length > 0) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          body = parsed as Record<string, unknown>
        }
      } catch {
        return c.json({ ok: false, error: 'Body JSON inválido' }, 400)
      }
    }
  }

  const params: Record<string, unknown> = { ...query, ...body }
  const action = String(params.a ?? '')

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
const PORT = Number(process.env.PORT) || 8080

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[lectormd] server → http://localhost:${info.port}`)
})
