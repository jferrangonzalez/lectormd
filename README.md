# lectormd

Lector de Markdown personal y autoalojado. Organizá tus notas, libros y documentos en proyectos, marcá tu progreso de lectura, subrayá fragmentos con colores y comentarios, recordá la posición exacta donde dejaste cada doc y buscá en todo el texto completo.

![screenshot](docs/screenshot.png)

## Características

- **Proyectos** — carpetas de documentos `.md` organizadas en proyectos
- **Estados de lectura** — pendiente, leyendo, leído (auto-cambia al abrir un doc)
- **Subrayados de colores** — seleccioná texto → mini-toolbar con 4 colores (🟡🟢🔵🔴). Click en un subrayado existente → popover para cambiar color, editar comentario o borrar
- **Posición de lectura** — cada doc recuerda dónde quedaste leyendo (anclado por heading + offset, sobrevive cambios de fontSize y al lazy load del syntax highlighter)
- **Export markdown** — descargá un `.md` con todas tus citas + comentarios + emoji por color, agrupado por documento
- **Búsqueda FTS** — texto completo con SQLite FTS5, resultados con snippet resaltado
- **Tema claro / oscuro** — persiste en localStorage
- **Tamaño de texto ajustable** — botones A− / A+ persistentes
- **Responsive** — navegación adaptada a móvil con stack panel
- **Upload por API** — subí `.md` vía POST + body JSON (soporta payloads grandes, sin límite de URL)
- **Orden manual** — reorganizá documentos dentro de un proyecto

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node.js 18+ + Hono + better-sqlite3 |
| Base de datos | SQLite3 + FTS5 (nativo, sin servidor) |
| Render MD | react-markdown + remark-gfm + Prism (lazy) |
| Highlights | rehype plugin custom + `unist-util-visit` (envuelve text nodes con `<mark>` en el render virtual, no DOM walking) |

## Requisitos

- **Node.js 18+** y npm

## Instalación

### 1. Cloná el repositorio

```bash
git clone https://github.com/jferrangonzalez/lectormd.git
cd lectormd
```

### 2. Instalá dependencias

```bash
npm install
```

### 3. Configurá el backend

```bash
cp .env.example .env
```

Editá `.env`:

```ini
# Ruta absoluta al directorio de documentos
DOCS_PATH=/home/usuario/mis-documentos

# Ruta absoluta al archivo SQLite (se crea automáticamente)
DB_PATH=/home/usuario/mis-documentos/lectormd.db

# Credenciales Basic Auth
AUTH_USER=mi-usuario
AUTH_PASS=mi-contraseña-segura

# Puerto del servidor Node (default: 8080)
PORT=8080
```

### 4. Creá la estructura de documentos

```
mis-documentos/
├── proyecto-uno/
│   ├── documento-a.md
│   └── documento-b.md
└── proyecto-dos/
    └── notas.md
```

Los proyectos son subdirectorios. Los documentos son archivos `.md` dentro de cada subdirectorio.

### 5. Compilá y arrancá

```bash
npm run build                          # frontend Vite → dist/
npx tsc -p tsconfig.server.json        # backend TS → dist-server/
npm run server:prod                    # produccion: node dist-server/index.js
```

O en desarrollo:

```bash
npm run server                         # tsx server/index.ts
npm run dev                            # Vite en :5173 con proxy a /api
```

### 6. Sincronizá los documentos

Una vez que el servidor está corriendo, accedé a la interfaz e iniciá sesión. Hacé clic en **Escanear** o llamá `GET /api/?a=scan` para que el backend indexe todos los `.md` del `DOCS_PATH`.

## API

La API REST vive bajo `/api/`. Cada acción se identifica con `a=<nombre>`. GET para lectura simple, POST con body JSON para mutaciones (acepta también `a` en query string para compatibilidad).

| Acción | Método | Params | Descripción |
|--------|--------|--------|-------------|
| `scan` | GET | — | Indexa el filesystem en SQLite |
| `proyectos` | GET | — | Lista proyectos con contadores por estado |
| `documentos` | GET | `proyecto?`, `estado?` | Lista documentos filtrable |
| `documento` | GET | `id` | Detalle + contenido del .md |
| `estado` | POST | `id`, `estado` | Cambia estado (`pendiente`/`leyendo`/`leido`) |
| `buscar` | GET | `q` | Full-text search con snippet |
| `marcadores` | GET | `documento_id` | Subrayados de un doc |
| `marcadores_all` | GET | — | Todos los subrayados (vista global) |
| `marcador_add` | POST | `documento_id`, `fragmento`, `posicion`, `color?`, `comentario?` | Crear subrayado |
| `marcador_update` | POST | `id`, `color?`, `comentario?` | Editar |
| `marcador_del` | POST | `id` | Borrar |
| `marcadores_export` | POST | `documento_id` o `proyecto_slug` | Genera `.md` con subrayados |
| `scroll_save` | POST | `id`, `anchor` | Guarda posición (`heading-slug:offset-px`) |
| `scroll_get` | GET | `id` | Recupera la posición guardada |
| `proyecto_crear` | POST | `slug`, `nombre?` | Crear proyecto |
| `proyecto_rename` | POST | `id`, `nombre` | Renombrar |
| `proyecto_del` | POST | `id` | Borrar (cascade + filesystem) |
| `documento_del` | POST | `id` | Borrar doc |
| `mover` | POST | `id`, `proyecto_slug` | Mover doc entre proyectos |
| `orden_swap` | POST | `id_a`, `id_b` | Intercambiar orden dentro del proyecto |
| `upload` | POST | `proyecto`, `nombre`, `contenido` | Subir `.md` (texto plano o base64) |

**Auth**: Basic HTTP. Sin auth → 401 silencioso (sin `WWW-Authenticate`, no dispara diálogo nativo del browser).

### Ejemplo: subir un .md vía API

```bash
curl -u "user:pass" -X POST \
  -H "Content-Type: application/json" \
  -d '{"a":"upload","proyecto":"articulos","nombre":"mi-articulo","contenido":"# Hola\n\nContenido..."}' \
  "https://lectormd.tudominio.com/api/"
```

## Desarrollo local

Necesitás el servidor Node corriendo en local y el dev server de Vite.

**Terminal 1 — backend Node:**

```bash
npm run server
# tsx server/index.ts — escucha en localhost:8080
```

**Terminal 2 — frontend Vite:**

```bash
npm run dev
```

El frontend en `:5173` proxea las llamadas a `/api/` hacia `localhost:8080`.

Para cambiar el target del proxy:

```bash
# .env.local
VITE_API_TARGET=http://localhost:8080
```

## Estructura del proyecto

```
lectormd/
├── server/
│   ├── config.ts                  # lee .env y expone getConfig()
│   ├── db.ts                      # singleton better-sqlite3 + migraciones
│   ├── scanner.ts                 # escanea DOCS_PATH y sincroniza DB
│   ├── api.ts                     # acciones como funciones exportadas
│   └── index.ts                   # Hono app: CORS + auth + dispatcher
├── src/
│   ├── api/client.ts              # cliente HTTP tipado
│   ├── components/                # componentes React (Reader, Sidebar, etc.)
│   ├── context/                   # AuthContext, ThemeContext
│   ├── hooks/                     # useProyectos, useDocumentos, useIsMobile
│   ├── lib/
│   │   └── rehype-highlights.ts   # plugin rehype custom para subrayados
│   └── types/index.ts             # tipos compartidos
├── .env.example                   # plantilla de configuración
├── .env                           # tu configuración (NO versionar)
├── data/                          # tu directorio de documentos (NO versionar)
├── dist/                          # build del frontend (generado)
├── dist-server/                   # build del backend Node (generado)
└── public/
```

## Schema SQLite

```sql
proyectos        (id, slug UNIQUE, nombre, created_at)
documentos       (id, proyecto_id FK, nombre, ruta UNIQUE, estado, orden,
                  scroll_anchor, created_at, updated_at)
marcadores       (id, documento_id FK, fragmento, comentario, posicion,
                  color CHECK(yellow|green|blue|pink), created_at)
busqueda_fts     -- virtual table FTS5 (contenido, nombre, ruta, documento_id)
```

Migraciones incrementales: cada `ALTER TABLE` está envuelto en `try/catch` para ignorar columnas ya existentes — agregar features nuevas no requiere migraciones manuales.

## Seguridad

- Basic Auth implementada en Node/Hono. Credenciales en `.env`, **nunca versionarlo**.
- Token en `sessionStorage` (se borra al cerrar la pestaña).
- Diseñado para uso personal o de equipo pequeño en un servidor bajo tu control. No es multi-tenant.

## Issues conocidos

- `proyecto_rename` cambia el nombre visible, no el slug del directorio en el filesystem. Si querés renombrar el directorio, hacelo manual + escanear.
- No hay paginación en la lista de documentos.
- Subrayados que atraviesan formato (ej. mitad en `**bold**`, mitad en texto normal) no se resaltan visualmente. Se guardan en DB y aparecen en el panel lateral / export.

## Licencia

MIT — ver [LICENSE](LICENSE).
