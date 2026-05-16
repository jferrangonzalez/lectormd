# Changelog

## [1.0.0] — 2026-05-16

Primera versión pública open source.

### Cambios desde la versión privada

- Rutas y credenciales extraídas a `api/.env` (ya no están hardcodeadas en `index.php`)
- Añadido `api/config.php` que lee `.env` con errores claros si falta configuración
- Añadido `api/.env.example` con documentación de cada variable
- Proxy de Vite en `vite.config.ts` cambiado de producción hardcodeada a `localhost:8080` configurable via `VITE_API_TARGET`
- Script `deploy` eliminado de `package.json` (era específico del servidor original)
- Añadido script `php` en `package.json` (`php -S localhost:8080 -t api/`) para desarrollo local
- `package.json`: eliminado `private: true`, añadida descripción y licencia MIT
- Añadido `LICENSE` (MIT)
- README reescrito con instrucciones de instalación completas
- `.gitignore` actualizado: excluye `api/.env`, `*.db`, `data/`
- Corregido `renameProyecto`: el nombre devuelto en la respuesta ya no contiene los caracteres de escape de SQLite

### Funcionalidades (heredadas de la versión privada)

- Proyectos con documentos `.md` organizados en subdirectorios
- Estados de lectura: pendiente / leyendo / leído
- Marcadores con fragmento, posición y comentario opcional
- Búsqueda FTS5 con snippet resaltado
- Subida de archivos `.md` desde la interfaz
- Orden manual de documentos con swap
- Tema claro / oscuro persistente
- Interfaz responsive con navegación mobile adaptada
- Lazy loading del resaltado de sintaxis (Prism)
