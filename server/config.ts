import { config as loadDotenv } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// .env vive en la raíz del proyecto (un nivel arriba de server/)
const envPath = resolve(__dirname, '..', '.env')
loadDotenv({ path: envPath })

export interface Config {
  DOCS_PATH: string
  DB_PATH: string
  AUTH_USER: string
  AUTH_PASS: string
}

let _config: Config | null = null

export function getConfig(): Config {
  if (_config !== null) return _config

  const { DOCS_PATH, DB_PATH, AUTH_USER, AUTH_PASS } = process.env

  const missing: string[] = []
  if (!DOCS_PATH) missing.push('DOCS_PATH')
  if (!DB_PATH) missing.push('DB_PATH')
  if (!AUTH_USER) missing.push('AUTH_USER')
  if (!AUTH_PASS) missing.push('AUTH_PASS')

  if (missing.length > 0) {
    console.error(
      `[lectormd] Variables faltantes en .env: ${missing.join(', ')}\n` +
      `Copiá .env.example como .env en la raíz del proyecto y completá los valores.`
    )
    process.exit(1)
  }

  _config = {
    DOCS_PATH: DOCS_PATH!.replace(/[/\\]+$/, ''),
    DB_PATH: DB_PATH!,
    AUTH_USER: AUTH_USER!,
    AUTH_PASS: AUTH_PASS!,
  }

  return _config
}
