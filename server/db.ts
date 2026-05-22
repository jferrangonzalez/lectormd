import Database from 'better-sqlite3'
import { getConfig } from './config.js'

let instance: Database.Database | null = null

export function getDb(): Database.Database {
  if (instance === null) {
    const { DB_PATH } = getConfig()
    instance = new Database(DB_PATH)
    instance.pragma('journal_mode = WAL')
    instance.pragma('foreign_keys = ON')
    migrate(instance)
  }
  return instance
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS proyectos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      ruta TEXT NOT NULL UNIQUE,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','leyendo','leido')),
      orden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS marcadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      documento_id INTEGER NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
      fragmento TEXT NOT NULL,
      comentario TEXT,
      posicion INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS busqueda_fts
      USING fts5(
        contenido,
        nombre,
        ruta UNINDEXED,
        documento_id UNINDEXED,
        tokenize="unicode61"
      );
  `)

  // Migraciones incrementales: cada bloque ignora "duplicate column" cuando ya existe
  for (const stmt of [
    'ALTER TABLE documentos ADD COLUMN orden INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE documentos ADD COLUMN scroll_anchor TEXT",
    "ALTER TABLE marcadores ADD COLUMN color TEXT NOT NULL DEFAULT 'yellow' CHECK(color IN ('yellow','green','blue','pink'))",
  ]) {
    try { db.exec(stmt) } catch { /* columna ya existe */ }
  }
}
