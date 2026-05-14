import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ListaDocumentos } from './components/ListaDocumentos'
import { Reader } from './components/Reader'
import { Buscador } from './components/Buscador'
import { PanelMarcadores } from './components/PanelMarcadores'
import { LoginForm } from './components/LoginForm'
import { useProyectos } from './hooks/useProyectos'
import { useDocumentos } from './hooks/useDocumentos'
import { api, setApiAuthErrorHandler } from './api/client'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import type { Documento, DocumentoConContenido } from './types'

type Modal = 'buscar' | 'marcadores' | null

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ThemeProvider>
  )
}

function AppInner() {
  const { token, logout } = useAuth()
  const { t } = useTheme()

  // Registrar el handler de error 401 una sola vez
  useEffect(() => {
    setApiAuthErrorHandler(logout)
  }, [logout])

  if (!token) return <LoginForm />

  return <AppShell t={t} />
}

function AppShell({ t }: { t: ReturnType<typeof useTheme>['t'] }) {
  const { proyectos, loading: loadingProyectos, recargar } = useProyectos()
  const [proyectoActivo, setProyectoActivo] = useState<string | null>(null)
  const [documentoActivo, setDocumentoActivo] = useState<DocumentoConContenido | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [recarga, setRecarga] = useState(0)

  const { documentos, loading: loadingDocs } = useDocumentos(proyectoActivo ?? undefined)

  const abrirDocumento = async (doc: Documento) => {
    const data = await api.documento(doc.id)
    setDocumentoActivo(data)
  }

  const handleEstadoChange = () => {
    setRecarga(r => r + 1)
    recargar()
  }

  const escanear = async () => {
    await api.scan()
    recargar()
  }

  const abrirDesdeModal = async (doc: Documento) => {
    if (!proyectoActivo || proyectoActivo !== doc.proyecto_slug) {
      setProyectoActivo(doc.proyecto_slug)
    }
    await abrirDocumento(doc)
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: t.bg,
      color: t.text,
    }}>
      <Sidebar
        proyectos={proyectos}
        loading={loadingProyectos}
        proyectoActivo={proyectoActivo}
        onSelect={slug => { setProyectoActivo(slug); setDocumentoActivo(null) }}
        onScan={escanear}
        onBuscar={() => setModal('buscar')}
        onMarcadores={() => setModal('marcadores')}
      />

      {!documentoActivo ? (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {proyectoActivo ? (
            <>
              <ListaDocumentos
                documentos={documentos}
                loading={loadingDocs}
                onSelect={abrirDocumento}
                onEstadoChange={handleEstadoChange}
              />
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: t.textMuted,
                fontSize: 14,
              }}>
                Seleccioná un documento para leer
              </div>
            </>
          ) : (
            <Bienvenida />
          )}
        </div>
      ) : (
        <Reader
          key={`${documentoActivo.id}-${recarga}`}
          documento={documentoActivo}
          onClose={() => setDocumentoActivo(null)}
          onEstadoChange={handleEstadoChange}
        />
      )}

      {modal === 'buscar' && (
        <Buscador
          onSelect={abrirDesdeModal}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'marcadores' && (
        <PanelMarcadores
          onSelect={abrirDesdeModal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function Bienvenida() {
  const { t } = useTheme()
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: t.textMuted,
      gap: 12,
    }}>
      <div style={{ fontSize: 48 }}>📚</div>
      <div style={{ fontSize: 16, color: t.text }}>Lecturas</div>
      <div style={{ fontSize: 13 }}>Seleccioná un proyecto del panel izquierdo</div>
    </div>
  )
}
