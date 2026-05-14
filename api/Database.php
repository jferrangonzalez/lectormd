<?php
declare(strict_types=1);

class Database {
    private static ?SQLite3 $instance = null;

    public static function getInstance(): SQLite3 {
        if (self::$instance === null) {
            $path = DB_PATH;
            self::$instance = new SQLite3($path);
            self::$instance->enableExceptions(true);
            self::$instance->exec('PRAGMA journal_mode=WAL;');
            self::$instance->exec('PRAGMA foreign_keys=ON;');
            self::migrate(self::$instance);
        }
        return self::$instance;
    }

    private static function migrate(SQLite3 $db): void {
        $db->exec('
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
                estado TEXT NOT NULL DEFAULT "pendiente" CHECK(estado IN ("pendiente","leyendo","leido")),
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
        ');
    }
}
