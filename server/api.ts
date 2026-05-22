import fs from 'fs'
import path from 'path'
import { getDb } from './db.js'
import { getConfig } from './config.js'
import { scan as scanFs } from './scanner.js'

// ── Tipos de fila ─────────────────────────────────────────────────────────────

interface ProyectoRow {
  id: number
  slug: string
  nombre: string
  total: number
  pendientes: number
  leyendo: number
  leidos: number
}

interface DocumentoRow {
  id: number
  nombre: string
  ruta: string
  estado: string
  orden: number
  created_at: string
  updated_at: string
  proyecto_slug: string
  proyecto_nombre: string
  proyecto_id?: number
  contenido?: string
  scroll_anchor?: string | null
}

type MarcadorColor = 'yellow' | 'green' | 'blue' | 'pink'
const COLORES: readonly MarcadorColor[] = ['yellow', 'green', 'blue', 'pink']

interface MarcadorRow {
  id: number
  documento_id: number
  fragmento: string
  comentario: string | null
  posicion: number
  color: MarcadorColor
  created_at: string
}

interface MarcadorAllRow extends MarcadorRow {
  doc_nombre: string
  doc_ruta: string
  proyecto_slug: string
}

interface BusquedaRow {
  documento_id: number
  nombre: string
  ruta: string
  fragmento: string
  estado: string
  proyecto_slug: string
  proyecto_nombre: string
}

// ── Acciones ──────────────────────────────────────────────────────────────────

export function actionScan(): { added: number } {
  return scanFs()
}

export function actionProyectos(): ProyectoRow[] {
  const db = getDb()
  return db.prepare(`
    SELECT p.id, p.slug, p.nombre,
      COUNT(d.id) AS total,
      SUM(CASE WHEN d.estado='pendiente' THEN 1 ELSE 0 END) AS pendientes,
      SUM(CASE WHEN d.estado='leyendo'   THEN 1 ELSE 0 END) AS leyendo,
      SUM(CASE WHEN d.estado='leido'     THEN 1 ELSE 0 END) AS leidos
    FROM proyectos p
    LEFT JOIN documentos d ON d.proyecto_id = p.id
    GROUP BY p.id
    ORDER BY p.nombre
  `).all() as ProyectoRow[]
}

export function actionDocumentos(params: Record<string, string>): DocumentoRow[] {
  const db = getDb()
  const conditions: string[] = ['1=1']
  const args: unknown[] = []
  const porProyecto = Boolean(params.proyecto)

  if (params.proyecto) {
    conditions.push('p.slug = ?')
    args.push(params.proyecto)
  }
  if (params.estado) {
    conditions.push('d.estado = ?')
    args.push(params.estado)
  }

  const order = porProyecto ? 'd.orden ASC, d.id ASC' : 'd.updated_at DESC'
  const where = conditions.join(' AND ')

  return db.prepare(`
    SELECT d.id, d.nombre, d.ruta, d.estado, d.orden, d.created_at, d.updated_at,
           p.slug AS proyecto_slug, p.nombre AS proyecto_nombre
    FROM documentos d
    JOIN proyectos p ON p.id = d.proyecto_id
    WHERE ${where}
    ORDER BY ${order}
  `).all(...args) as DocumentoRow[]
}

export function actionDocumento(params: Record<string, string>): DocumentoRow {
  const { DOCS_PATH } = getConfig()
  const db = getDb()
  const id = Number(params.id) || 0

  const row = db.prepare(`
    SELECT d.*, p.slug AS proyecto_slug
    FROM documentos d
    JOIN proyectos p ON p.id = d.proyecto_id
    WHERE d.id = ?
  `).get(id) as DocumentoRow | undefined

  if (!row) throw new Error('Documento no encontrado')

  const filePath = path.join(DOCS_PATH, row.ruta)
  row.contenido = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : ''
  return row
}

export function actionEstado(params: Record<string, string>): { id: number; estado: string } {
  const db = getDb()
  const id = Number(params.id) || 0
  const estado = params.estado ?? ''

  if (!['pendiente', 'leyendo', 'leido'].includes(estado)) {
    throw new Error('Estado inválido')
  }

  db.prepare(
    "UPDATE documentos SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(estado, id)

  return { id, estado }
}

export function actionBuscar(params: Record<string, string>): BusquedaRow[] {
  const db = getDb()
  const q = (params.q ?? '').trim()
  if (q.length < 2) return []

  const qFts = '"' + q.replace(/"/g, '') + '"*'

  return db.prepare(`
    SELECT f.documento_id, f.nombre, f.ruta,
           snippet(busqueda_fts, 0, '<mark>', '</mark>', '...', 32) AS fragmento,
           d.estado, p.slug AS proyecto_slug, p.nombre AS proyecto_nombre
    FROM busqueda_fts f
    JOIN documentos d ON d.id = f.documento_id
    JOIN proyectos p ON p.id = d.proyecto_id
    WHERE busqueda_fts MATCH ?
    ORDER BY rank
    LIMIT 30
  `).all(qFts) as BusquedaRow[]
}

export function actionMarcadores(params: Record<string, string>): MarcadorRow[] {
  const db = getDb()
  const docId = Number(params.documento_id) || 0
  return db.prepare(
    'SELECT * FROM marcadores WHERE documento_id = ? ORDER BY posicion'
  ).all(docId) as MarcadorRow[]
}

export function actionMarcadorAdd(
  params: Record<string, unknown>
): { id: number } {
  const db = getDb()
  const docId = Number(params.documento_id) || 0
  const fragmento = (params.fragmento as string | undefined) ?? ''
  const comentario = (params.comentario as string | undefined) ?? null
  const posicion = Number(params.posicion) || 0
  const colorRaw = (params.color as string | undefined) ?? 'yellow'
  const color = (COLORES as readonly string[]).includes(colorRaw)
    ? (colorRaw as MarcadorColor)
    : 'yellow'

  if (!fragmento) throw new Error('Fragmento vacío')

  const result = db.prepare(
    'INSERT INTO marcadores (documento_id, fragmento, comentario, posicion, color) VALUES (?, ?, ?, ?, ?)'
  ).run(docId, fragmento, comentario, posicion, color)

  return { id: Number(result.lastInsertRowid) }
}

export function actionMarcadorUpdate(params: Record<string, unknown>): { id: number } {
  const db = getDb()
  const id = Number(params.id) || 0
  if (!id) throw new Error('id requerido')

  const sets: string[] = []
  const args: unknown[] = []

  if (typeof params.color === 'string') {
    if (!(COLORES as readonly string[]).includes(params.color)) {
      throw new Error('Color inválido')
    }
    sets.push('color = ?')
    args.push(params.color)
  }
  if (typeof params.comentario === 'string') {
    sets.push('comentario = ?')
    args.push(params.comentario)
  } else if (params.comentario === null) {
    sets.push('comentario = NULL')
  }

  if (sets.length === 0) throw new Error('Sin campos a actualizar')

  args.push(id)
  db.prepare(`UPDATE marcadores SET ${sets.join(', ')} WHERE id = ?`).run(...args)
  return { id }
}

export function actionMarcadorDel(params: Record<string, string>): { deleted: number } {
  const db = getDb()
  const id = Number(params.id) || 0
  db.prepare('DELETE FROM marcadores WHERE id = ?').run(id)
  return { deleted: id }
}

export function actionScrollSave(params: Record<string, unknown>): { id: number } {
  const db = getDb()
  const id = Number(params.id) || 0
  const anchor = (params.anchor as string | undefined) ?? ''
  if (!id) throw new Error('id requerido')

  db.prepare('UPDATE documentos SET scroll_anchor = ? WHERE id = ?')
    .run(anchor || null, id)
  return { id }
}

export function actionMarcadoresExport(
  params: Record<string, unknown>
): { filename: string; markdown: string } {
  const db = getDb()
  const docId = params.documento_id ? Number(params.documento_id) : null
  const proyectoSlug = (params.proyecto_slug as string | undefined) ?? null

  let rows: Array<MarcadorRow & {
    doc_nombre: string
    doc_ruta: string
    proyecto_slug: string
    proyecto_nombre: string
  }>

  if (docId) {
    rows = db.prepare(`
      SELECT m.*, d.nombre AS doc_nombre, d.ruta AS doc_ruta,
             p.slug AS proyecto_slug, p.nombre AS proyecto_nombre
      FROM marcadores m
      JOIN documentos d ON d.id = m.documento_id
      JOIN proyectos p ON p.id = d.proyecto_id
      WHERE m.documento_id = ?
      ORDER BY m.created_at
    `).all(docId) as typeof rows
  } else if (proyectoSlug) {
    rows = db.prepare(`
      SELECT m.*, d.nombre AS doc_nombre, d.ruta AS doc_ruta,
             p.slug AS proyecto_slug, p.nombre AS proyecto_nombre
      FROM marcadores m
      JOIN documentos d ON d.id = m.documento_id
      JOIN proyectos p ON p.id = d.proyecto_id
      WHERE p.slug = ?
      ORDER BY d.orden, m.created_at
    `).all(proyectoSlug) as typeof rows
  } else {
    throw new Error('Se requiere documento_id o proyecto_slug')
  }

  if (rows.length === 0) {
    return { filename: 'subrayados.md', markdown: '_(Sin subrayados)_\n' }
  }

  // Agrupar por documento (mantiene orden de la query)
  const byDoc = new Map<number, typeof rows>()
  for (const r of rows) {
    if (!byDoc.has(r.documento_id)) byDoc.set(r.documento_id, [])
    byDoc.get(r.documento_id)!.push(r)
  }

  const titulo = docId
    ? `Subrayados — ${rows[0].doc_nombre}`
    : `Subrayados — ${rows[0].proyecto_nombre}`
  const filename = (docId
    ? `subrayados-${rows[0].doc_ruta.replace(/[\\/]/g, '__').replace(/\.md$/, '')}`
    : `subrayados-${proyectoSlug}`) + '.md'

  let md = `# ${titulo}\n\n`
  md += `_Exportado: ${new Date().toISOString().slice(0, 10)}_\n\n`

  for (const [, items] of byDoc) {
    if (!docId) md += `## ${items[0].doc_nombre}\n\n`
    for (const m of items) {
      const tag = colorEmoji(m.color)
      md += `> ${tag} ${m.fragmento.trim().replace(/\n+/g, ' ')}\n`
      if (m.comentario && m.comentario.trim()) {
        md += `>\n> _${m.comentario.trim()}_\n`
      }
      md += '\n'
    }
  }

  return { filename, markdown: md }
}

function colorEmoji(c: MarcadorColor): string {
  switch (c) {
    case 'yellow': return '🟡'
    case 'green':  return '🟢'
    case 'blue':   return '🔵'
    case 'pink':   return '🔴'
  }
}

export function actionMarcadoresAll(): MarcadorAllRow[] {
  const db = getDb()
  return db.prepare(`
    SELECT m.*, d.nombre AS doc_nombre, d.ruta AS doc_ruta, p.slug AS proyecto_slug
    FROM marcadores m
    JOIN documentos d ON d.id = m.documento_id
    JOIN proyectos p ON p.id = d.proyecto_id
    ORDER BY m.created_at DESC
  `).all() as MarcadorAllRow[]
}

export function actionProyectoRename(
  params: Record<string, string>
): { id: number; nombre: string } {
  const db = getDb()
  const id = Number(params.id) || 0
  const nombre = (params.nombre ?? '').trim()
  if (!nombre) throw new Error('Nombre vacío')

  db.prepare('UPDATE proyectos SET nombre = ? WHERE id = ?').run(nombre, id)
  return { id, nombre }
}

export function actionProyectoDel(params: Record<string, string>): { deleted: number } {
  const { DOCS_PATH } = getConfig()
  const db = getDb()
  const id = Number(params.id) || 0

  const proyecto = db
    .prepare('SELECT slug FROM proyectos WHERE id = ?')
    .get(id) as { slug: string } | undefined

  if (proyecto) {
    db.prepare(
      'DELETE FROM busqueda_fts WHERE documento_id IN (SELECT id FROM documentos WHERE proyecto_id = ?)'
    ).run(id)

    const dirPath = path.join(DOCS_PATH, proyecto.slug)
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      for (const file of fs.readdirSync(dirPath)) {
        if (file.endsWith('.md')) {
          fs.unlinkSync(path.join(dirPath, file))
        }
      }
      fs.rmdirSync(dirPath)
    }
  }

  db.prepare('DELETE FROM proyectos WHERE id = ?').run(id)
  return { deleted: id }
}

export function actionProyectoCrear(
  params: Record<string, string>
): { id: number; slug: string; nombre: string; exists?: boolean } {
  const { DOCS_PATH } = getConfig()
  const db = getDb()

  let slug = (params.slug ?? '').trim()
  let nombre = (params.nombre ?? '').trim()

  if (!slug) throw new Error('slug requerido')

  slug = slug
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!slug) throw new Error('slug inválido')
  if (!nombre) {
    nombre = slug
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const dirPath = path.join(DOCS_PATH, slug)
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  const existing = db
    .prepare('SELECT id FROM proyectos WHERE slug = ?')
    .get(slug) as { id: number } | undefined

  if (existing) {
    return { id: existing.id, slug, nombre, exists: true }
  }

  const result = db
    .prepare('INSERT INTO proyectos (slug, nombre) VALUES (?, ?)')
    .run(slug, nombre)

  return { id: Number(result.lastInsertRowid), slug, nombre }
}

export function actionMover(
  params: Record<string, string>
): { id: number; nueva_ruta: string } {
  const { DOCS_PATH } = getConfig()
  const db = getDb()
  const docId = Number(params.id) || 0
  const destSlug = (params.proyecto_slug ?? '').trim()

  if (!destSlug) throw new Error('proyecto_slug requerido')

  const doc = db.prepare(`
    SELECT d.ruta, d.nombre, p.slug AS proyecto_slug
    FROM documentos d
    JOIN proyectos p ON p.id = d.proyecto_id
    WHERE d.id = ?
  `).get(docId) as { ruta: string; nombre: string; proyecto_slug: string } | undefined

  if (!doc) throw new Error('Documento no encontrado')
  if (doc.proyecto_slug === destSlug) return { id: docId, nueva_ruta: doc.ruta }

  const destProyecto = db
    .prepare('SELECT id FROM proyectos WHERE slug = ?')
    .get(destSlug) as { id: number } | undefined

  if (!destProyecto) throw new Error('Proyecto destino no encontrado')

  const oldPath = path.join(DOCS_PATH, doc.ruta)
  const newRuta = destSlug + '/' + path.basename(doc.ruta)
  const newPath = path.join(DOCS_PATH, newRuta)

  fs.renameSync(oldPath, newPath)

  const maxRow = db
    .prepare('SELECT COALESCE(MAX(orden), -1) AS maxOrden FROM documentos WHERE proyecto_id = ?')
    .get(destProyecto.id) as { maxOrden: number }

  db.prepare(
    'UPDATE documentos SET proyecto_id = ?, ruta = ?, orden = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(destProyecto.id, newRuta, maxRow.maxOrden + 1, docId)

  db.prepare('UPDATE busqueda_fts SET ruta = ? WHERE documento_id = ?').run(newRuta, docId)

  return { id: docId, nueva_ruta: newRuta }
}

export function actionDocumentoDel(params: Record<string, string>): { deleted: number } {
  const { DOCS_PATH } = getConfig()
  const db = getDb()
  const id = Number(params.id) || 0

  const doc = db
    .prepare('SELECT ruta FROM documentos WHERE id = ?')
    .get(id) as { ruta: string } | undefined

  if (!doc) throw new Error('Documento no encontrado')

  const filePath = path.join(DOCS_PATH, doc.ruta)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

  db.prepare('DELETE FROM busqueda_fts WHERE documento_id = ?').run(id)
  db.prepare('DELETE FROM documentos WHERE id = ?').run(id)

  return { deleted: id }
}

export function actionOrdenSwap(
  params: Record<string, string>
): { ok: boolean } {
  const db = getDb()
  const idA = Number(params.id_a) || 0
  const idB = Number(params.id_b) || 0
  if (!idA || !idB) throw new Error('id_a e id_b requeridos')

  const rowA = db
    .prepare('SELECT orden FROM documentos WHERE id = ?')
    .get(idA) as { orden: number } | undefined
  const rowB = db
    .prepare('SELECT orden FROM documentos WHERE id = ?')
    .get(idB) as { orden: number } | undefined

  if (!rowA || !rowB) throw new Error('Documento no encontrado')

  db.prepare('UPDATE documentos SET orden = ? WHERE id = ?').run(rowB.orden, idA)
  db.prepare('UPDATE documentos SET orden = ? WHERE id = ?').run(rowA.orden, idB)

  return { ok: true }
}

export function actionUpload(params: Record<string, unknown>): DocumentoRow | { ruta: string; proyecto: string; nombre: string } {
  const { DOCS_PATH } = getConfig()
  const db = getDb()

  let proyecto = ((params.proyecto as string | undefined) ?? '').trim()
  let nombre = ((params.nombre as string | undefined) ?? '').trim()
  let contenido = (params.contenido as string | undefined) ?? null

  if (!proyecto || !nombre || contenido === null || contenido === '') {
    throw new Error('Se requieren proyecto, nombre y contenido')
  }

  // Detectar base64: sin saltos de línea, solo chars base64 (ignorando padding)
  const trimmed = contenido.replace(/[=\r\n]+$/, '')
  if (!contenido.includes('\n') && /^[A-Za-z0-9+/]+$/.test(trimmed)) {
    const buf = Buffer.from(contenido, 'base64')
    if (Buffer.isBuffer(buf) && isUtf8Buffer(buf)) {
      contenido = buf.toString('utf-8')
    }
  }

  proyecto = proyecto
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/^-+|-+$/g, '')
  nombre = nombre
    .replace(/\.md$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!proyecto || !nombre) throw new Error('proyecto o nombre inválidos')

  const proyectoPath = path.join(DOCS_PATH, proyecto)
  if (!fs.existsSync(proyectoPath)) {
    fs.mkdirSync(proyectoPath, { recursive: true })
  }

  fs.writeFileSync(path.join(proyectoPath, nombre + '.md'), contenido, 'utf-8')
  scanFs()

  const ruta = proyecto + '/' + nombre + '.md'
  const row = db.prepare(`
    SELECT d.*, p.slug AS proyecto_slug
    FROM documentos d
    JOIN proyectos p ON p.id = d.proyecto_id
    WHERE d.ruta = ?
  `).get(ruta) as DocumentoRow | undefined

  return row ?? { ruta, proyecto, nombre }
}

// Verifica si un Buffer contiene UTF-8 válido (Node >=18.14 tiene Buffer.isUtf8)
function isUtf8Buffer(buf: Buffer): boolean {
  if (typeof (Buffer as unknown as { isUtf8?: (b: Buffer) => boolean }).isUtf8 === 'function') {
    return (Buffer as unknown as { isUtf8: (b: Buffer) => boolean }).isUtf8(buf)
  }
  // Fallback: intentar decodificar y re-encodear
  try {
    return Buffer.from(buf.toString('utf-8'), 'utf-8').equals(buf)
  } catch {
    return false
  }
}
