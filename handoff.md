# lectormd — Handoff

## Qué es esto

Lector personal de archivos Markdown, deployado en **https://lectormd.ferranserver.es/**. Stack: React 19 + TypeScript + Vite (frontend) + PHP 8 + SQLite3 con FTS5 (backend API). Los documentos son archivos `.md` reales en el servidor; la BD SQLite guarda estado, orden y marcadores.

---

## Infraestructura

| Elemento | Valor |
|---|---|
| URL producción | https://lectormd.ferranserver.es/ |
| Servidor SSH | `ferranserver` (alias en ~/.ssh/config → 57.131.47.29) |
| Root web | `/var/www/vhosts/ferranserver.es/lectormd.ferranserver.es/` |
| Archivos MD | `/var/www/vhosts/ferranserver.es/data.ferranserver.es/httpdocs/lecturas_informes/data/docs/` |
| BD SQLite | `/var/www/vhosts/ferranserver.es/data.ferranserver.es/httpdocs/lecturas_informes/data/lecturas.db` |
| Auth usuario | `joseferran` / ver `api/index.php` → `AUTH_PASS` |
| GitHub | **Sin repo** — deploy directo por scp |
| Repo local git | `C:\www\lectormd` (branch: master) |

### Deploy

```bash
npm run deploy
# = tsc -b && vite build && scp dist/. ferranserver:root/ && scp api/*.php api/.htaccess ferranserver:root/api/
```

---

## Arquitectura del proyecto

```
C:\www\lectormd\
├── api/
│   ├── index.php      # Entrada: define constantes, auth, enruta a Api
│   ├── Api.php        # Todas las acciones del backend
│   ├── Database.php   # Singleton SQLite3 + migraciones automáticas
│   └── Scanner.php    # Escanea DOCS_PATH y sincroniza BD
└── src/
    ├── App.tsx                        # Shell principal: estado global + routing mobile/desktop
    ├── api/client.ts                  # Wrapper fetch con auth Basic
    ├── types/index.ts                 # Tipos TS (Documento, Proyecto, Marcador…)
    ├── context/
    │   ├── AuthContext.tsx            # Login con Basic Auth en sessionStorage
    │   └── ThemeContext.tsx           # Dark (Catppuccin Mocha) / Light (papel) + fontSize
    ├── hooks/
    │   ├── useProyectos.ts            # Carga lista de proyectos
    │   ├── useDocumentos.ts           # Carga docs de un proyecto (acepta _recarga: number)
    │   └── useIsMobile.ts             # Breakpoint 640px, listener de resize
    └── components/
        ├── Sidebar.tsx                # Panel izquierdo — proyectos + acciones; full-screen en mobile
        ├── ListaDocumentos.tsx        # Lista docs con acciones inline; full-screen en mobile
        ├── Reader.tsx                 # Lector MD: react-markdown + GFM + syntax hl
        ├── Buscador.tsx               # Modal búsqueda full-text (FTS5)
        ├── PanelMarcadores.tsx        # Modal todos los marcadores
        ├── EstadoBadge.tsx            # Badge pendiente/leyendo/leido
        ├── SyntaxHighlighter.tsx      # Wrapper lazy (React.lazy + Suspense)
        └── SyntaxHighlighterImpl.tsx  # Implementación real (Prism) — chunk separado, lazy
```

---

## Funcionamiento general

La app es un lector personal de Markdown organizado en **proyectos (carpetas)**. Cada proyecto corresponde a un directorio físico en el servidor. Los documentos `.md` dentro de cada directorio son las lecturas.

### Flujo de uso

1. **Login** — Basic Auth. El token se guarda en `sessionStorage`. Un 401 hace logout automático.
2. **Sidebar** — lista de proyectos con contadores (📖 leyendo / 📄 pendiente / ✅ leído). Acciones: buscar, marcadores, escanear, crear carpeta.
3. **Lista de documentos** — al seleccionar un proyecto, aparece la lista con filtros por estado y acciones por ítem (ciclar estado, reordenar ↑↓, mover a otra carpeta, eliminar).
4. **Reader** — al abrir un documento, se marca automáticamente como "leyendo" si estaba "pendiente". Renderiza Markdown con GFM (tablas, listas de tareas, etc.). Permite seleccionar texto para guardar como marcador.
5. **Búsqueda** — FTS5 full-text sobre contenido + nombre. Debounce 300ms. Snippets con `<mark>`.
6. **Marcadores** — seleccionar texto en el Reader → botón flotante "Guardar". Panel global accesible desde Sidebar.

### Navegación responsive

- **Desktop (≥640px):** layout de 3 columnas: Sidebar | ListaDocumentos | Reader, todos visibles simultáneamente.
- **Mobile (<640px):** navegación tipo stack — una vista a la vez. El estado `vistaMovil` en `App.tsx` controla qué se muestra: `'sidebar' → 'lista' → 'reader'`. Cada vista tiene botón de retroceso.

---

## Esquema de BD (SQLite)

```sql
proyectos   (id, slug UNIQUE, nombre, created_at)
documentos  (id, proyecto_id FK→proyectos CASCADE, nombre, ruta UNIQUE,
             estado CHECK('pendiente'|'leyendo'|'leido'), orden INT DEFAULT 0,
             created_at, updated_at)
marcadores  (id, documento_id FK→documentos CASCADE, fragmento, comentario,
             posicion, created_at)
busqueda_fts  -- FTS5 virtual: contenido, nombre, ruta UNINDEXED, documento_id UNINDEXED
              -- NO tiene FK cascade → limpiar manualmente al borrar docs/proyectos
```

**Nota crítica:** `busqueda_fts` no participa en FK CASCADE. Toda eliminación de documentos o proyectos debe ejecutar `DELETE FROM busqueda_fts WHERE documento_id IN (...)` **antes** del DELETE en documentos/proyectos. Ya está implementado en `Api.php`.

---

## API — acciones disponibles

Todas las peticiones van a `/api/?a=<accion>` (GET) o POST con JSON `{a: "accion", ...}`.

| Acción | Método | Descripción |
|---|---|---|
| `proyectos` | GET | Lista proyectos con contadores |
| `documentos` | GET | `?proyecto=slug&estado=...` — orden por `orden ASC, id ASC` si hay proyecto |
| `documento` | GET | `?id=N` — incluye `contenido` (lee el .md del disco) |
| `estado` | POST | `{id, estado}` — cicla pendiente/leyendo/leido |
| `buscar` | GET | `?q=texto` — FTS5, mínimo 2 chars, devuelve snippet con `<mark>` |
| `marcadores` | GET | `?documento_id=N` |
| `marcadores_all` | GET | Todos los marcadores con info de doc y proyecto |
| `marcador_add` | POST | `{documento_id, fragmento, posicion, comentario?}` |
| `marcador_del` | POST | `{id}` |
| `scan` | GET | Escanea DOCS_PATH, añade nuevos, limpia huérfanos |
| `proyecto_crear` | POST | `{slug, nombre}` — crea directorio + registro DB |
| `proyecto_del` | POST | `{id}` — borra directorio, FTS, cascade docs+marcadores |
| `proyecto_rename` | POST | `{id, nombre}` — solo renombra en DB, NO mueve directorio |
| `documento_del` | POST | `{id}` — borra archivo físico + FTS + DB (cascade marcadores) |
| `mover` | POST | `{id, proyecto_slug}` — mueve archivo + actualiza ruta+proyecto_id en DB+FTS |
| `orden_swap` | POST | `{id_a, id_b}` — intercambia campo `orden` entre dos docs |
| `upload` | POST | `{proyecto, nombre, contenido}` — contenido puede ser base64 |

---

## Funcionalidades implementadas

- **Proyectos (carpetas):** crear, eliminar (con archivos), listar con contadores por estado
- **Documentos:** abrir y leer MD, ciclar estado, eliminar, mover entre carpetas, reordenar (↑↓)
- **Orden:** columna `orden INT` en `documentos`; Scanner asigna `max(orden)+1` al insertar; `orden_swap` intercambia dos; la lista respeta el orden cuando no hay filtro de estado activo
- **Marcadores:** seleccionar texto en Reader → guardar fragmento; ver panel global; borrar
- **Búsqueda:** FTS5 full-text sobre contenido+nombre; debounce 300ms; snippets con `<mark>`
- **Tema:** dark Catppuccin Mocha / light papel; toggle en sidebar; persistido en localStorage
- **Tamaño de fuente:** A+/A− en Reader, clamp 12-24px, persistido en localStorage
- **Auth:** Basic Auth vía PHP sin WWW-Authenticate (no dispara popup nativo); token en sessionStorage; logout automático en 401
- **Responsive / mobile:** navegación stack (sidebar → lista → reader), tap targets grandes, sin hover-dependencies, Buscador adaptado para teclado móvil

---

## Bundle JS

| Chunk | Tamaño minificado | Gzip | Cuándo carga |
|---|---|---|---|
| `index.js` | 375 KB | 115 KB | Siempre (al abrir la app) |
| `SyntaxHighlighterImpl.js` | 627 KB | 224 KB | Solo al renderizar un bloque de código |

El chunk de Prism es lazy (`React.lazy` + `Suspense`). El fallback muestra el código en texto plano mientras carga.

---

## Pendientes / ideas conocidas

- `proyecto_rename` solo cambia el nombre en DB, **no mueve el directorio ni actualiza las rutas** de los documentos. Si se necesita renombrar-slug, hay que hacerlo manualmente en el servidor.
- Sin GitHub repo: el historial vive solo en `C:\www\lectormd`. Crear repo en `jferrangonzalez` cuando convenga.
- No hay paginación en `documentos` — irrelevante con el volumen actual pero a tener en cuenta.
- El dropdown "Mover a carpeta" no tiene click-outside handler — se cierra volviendo a tocar el ícono 📂 o navegando.
- El chunk de Prism (627 KB) podría reducirse más usando `react-syntax-highlighter/dist/esm/prism-light` con registro manual de lenguajes específicos.
- Selección de texto para marcadores en mobile funciona vía `onTouchEnd` — en algunos navegadores iOS puede necesitar ajuste fino.

---

## Historial de sesiones

### Sesión 2026-05-14
Se implementó desde cero (el repo no tenía git):
1. `git init` + commit inicial del estado previo
2. Backend: `orden` en BD, Scanner asigna orden al insertar, `documento_del`, `proyecto_crear`, fix `proyecto_del` (borra dir), fix `mover` (mueve archivo físico), `orden_swap`
3. Frontend: `orden` en tipos, nuevas llamadas en client, `ListaDocumentos` con ↑↓/mover/eliminar, `Sidebar` con crear/eliminar carpeta, `App.tsx` wiring completo
4. Deploy exitoso

### Sesión 2026-05-16
1. **Responsive / mobile:** hook `useIsMobile`, navegación stack en `App.tsx` (`vistaMovil`), Sidebar y ListaDocumentos full-screen en mobile, Reader con padding reducido y panel lateral oculto, Buscador con paddingTop adaptado, tap targets agrandados en todos los componentes
2. **Code-splitting:** `SyntaxHighlighter.tsx` convertido a wrapper lazy (`React.lazy` + `Suspense`), implementación movida a `SyntaxHighlighterImpl.tsx`. Bundle inicial: 1.000 KB → 375 KB (gzip: 338 KB → 115 KB)
