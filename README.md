# lectormd

Lector de Markdown personal y autoalojado. Organizá tus notas, libros y documentos en proyectos, marcá tu progreso de lectura, guardá fragmentos y buscá en todo el texto completo.

![screenshot](docs/screenshot.png)

## Características

- **Proyectos** — carpetas de documentos `.md` organizadas en proyectos
- **Estados de lectura** — pendiente, leyendo, leído
- **Marcadores** — guardá fragmentos con comentario y posición
- **Búsqueda FTS** — texto completo con SQLite5 FTS5, resultados con snippet resaltado
- **Tema claro / oscuro** — persiste en localStorage
- **Responsive** — navegación adaptada a móvil con stack panel
- **Upload** — subí archivos `.md` directamente desde la interfaz
- **Orden manual** — reorganizá documentos dentro de un proyecto por drag & drop

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node.js 18+ + Hono + better-sqlite3 |
| Base de datos | SQLite3 + FTS5 (nativo, sin servidor) |
| Render MD | react-markdown + remark-gfm + Prism (lazy) |

## Requisitos

- **Node.js 18+** y npm

## Instalación

### 1. Cloná el repositorio

```bash
git clone https://github.com/joseferran/lectormd.git
cd lectormd
```

### 2. Instalá dependencias del frontend

```bash
npm install
```

### 3. Configurá el backend

```bash
cp .env.example .env
```

Editá `.env` con tus valores:

```ini
# Ruta absoluta al directorio de documentos
DOCS_PATH=/home/usuario/mis-documentos

# Ruta absoluta a la base de datos SQLite (se crea automáticamente)
DB_PATH=/home/usuario/mis-documentos/lecturas.db

# Credenciales de acceso
AUTH_USER=mi-usuario
AUTH_PASS=mi-contraseña-segura
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

### 5. Compilá el frontend

```bash
npm run build
```

### 6. Arrancá el servidor

```bash
npm run server
```

El servidor Node escucha en `http://localhost:8080`. Para producción, compilá con `tsc -p tsconfig.server.json` y usá `npm run server:prod`.

### 7. Sincronizá los documentos

Una vez que el servidor esté corriendo, accedé a la interfaz e iniciá sesión. Hacé clic en **Escanear** para que el backend indexe todos los archivos `.md` del directorio de documentos.

## Desarrollo local

Para desarrollar necesitás el servidor Node corriendo en local y el servidor de desarrollo de Vite.

**Terminal 1 — backend Node:**

```bash
npm run server
# equivale a: tsx server/index.ts — escucha en localhost:8080
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
│   ├── config.ts        # lee .env y expone getConfig()
│   ├── db.ts            # singleton better-sqlite3 + migraciones
│   ├── scanner.ts       # escanea DOCS_PATH y sincroniza DB
│   ├── api.ts           # 16 acciones como funciones exportadas
│   └── index.ts         # Hono app: CORS + auth + dispatcher
├── api/                 # backend PHP original (referencia histórica)
├── src/
│   ├── api/client.ts    # cliente HTTP tipado
│   ├── components/      # componentes React
│   ├── context/         # AuthContext, ThemeContext
│   ├── hooks/           # useProyectos, useDocumentos, useIsMobile
│   └── types/index.ts   # tipos compartidos
├── .env.example         # plantilla de configuración
├── .env                 # tu configuración (NO versionar)
├── data/                # tu directorio de documentos (NO versionar)
├── dist/                # build del frontend (generado)
└── public/
```

## Seguridad

- La autenticación es Basic Auth implementada en Node/Hono. Las credenciales se guardan en `.env` en la raíz del proyecto, que **nunca debe versionarse**.
- El token se guarda en `sessionStorage` del navegador (se borra al cerrar la pestaña).
- lectormd está diseñado para uso personal o de equipo pequeño en un servidor bajo tu control. No es un servicio multi-tenant.

## Issues conocidos

- `proyecto_rename` cambia solo el nombre visible, no el slug del directorio en el filesystem. Si necesitás cambiar el directorio, hacelo manualmente y ejecutá **Escanear**.
- No hay paginación en la lista de documentos.

## Licencia

MIT — ver [LICENSE](LICENSE).
