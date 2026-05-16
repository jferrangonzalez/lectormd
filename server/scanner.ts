import fs from 'fs'
import path from 'path'
import { getDb } from './db.js'
import { getConfig } from './config.js'

export function scan(): { added: number } {
  const { DOCS_PATH } = getConfig()
  const db = getDb()
  let added = 0

  const proyectos = getDirectories(DOCS_PATH)

  for (const proyectoSlug of proyectos) {
    const proyectoPath = path.join(DOCS_PATH, proyectoSlug)
    const proyectoId = upsertProyecto(proyectoSlug)

    const mdFiles = fs
      .readdirSync(proyectoPath)
      .filter((f) => f.endsWith('.md'))

    for (const file of mdFiles) {
      const ruta = proyectoSlug + '/' + file
      const existing = db
        .prepare('SELECT id FROM documentos WHERE ruta = ?')
        .get(ruta) as { id: number } | undefined

      if (!existing) {
        const nombre = file.replace(/\.md$/i, '')
        const maxRow = db
          .prepare('SELECT COALESCE(MAX(orden), -1) AS maxOrden FROM documentos WHERE proyecto_id = ?')
          .get(proyectoId) as { maxOrden: number }
        const orden = maxRow.maxOrden + 1

        const insert = db.prepare(
          'INSERT INTO documentos (proyecto_id, nombre, ruta, orden) VALUES (?, ?, ?, ?)'
        )
        const result = insert.run(proyectoId, nombre, ruta, orden)
        const docId = Number(result.lastInsertRowid)

        const contenido = fs.readFileSync(path.join(DOCS_PATH, ruta), 'utf-8')
        indexarDocumento(docId, nombre, ruta, contenido)
        added++
      }
    }
  }

  limpiarHuerfanos(DOCS_PATH)
  return { added }
}

function indexarDocumento(
  docId: number,
  nombre: string,
  ruta: string,
  contenido: string
): void {
  const db = getDb()
  const existing = db
    .prepare('SELECT rowid FROM busqueda_fts WHERE documento_id = ?')
    .get(docId)

  if (existing) {
    db.prepare(
      'UPDATE busqueda_fts SET contenido = ?, nombre = ? WHERE documento_id = ?'
    ).run(contenido, nombre, docId)
  } else {
    db.prepare(
      'INSERT INTO busqueda_fts (contenido, nombre, ruta, documento_id) VALUES (?, ?, ?, ?)'
    ).run(contenido, nombre, ruta, docId)
  }
}

function upsertProyecto(slug: string): number {
  const db = getDb()
  const existing = db
    .prepare('SELECT id FROM proyectos WHERE slug = ?')
    .get(slug) as { id: number } | undefined

  if (existing) return existing.id

  const nombre = slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  const result = db
    .prepare('INSERT INTO proyectos (slug, nombre) VALUES (?, ?)')
    .run(slug, nombre)

  return Number(result.lastInsertRowid)
}

function limpiarHuerfanos(docsPath: string): void {
  const db = getDb()
  const rows = db
    .prepare('SELECT id, ruta FROM documentos')
    .all() as { id: number; ruta: string }[]

  for (const row of rows) {
    const fullPath = path.join(docsPath, row.ruta)
    if (!fs.existsSync(fullPath)) {
      db.prepare('DELETE FROM busqueda_fts WHERE documento_id = ?').run(row.id)
      db.prepare('DELETE FROM documentos WHERE id = ?').run(row.id)
    }
  }
}

function getDirectories(dirPath: string): string[] {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return []
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}
