import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ListaDocumentos } from './components/ListaDocumentos'
import { Reader } from './components/Reader'
import { Buscador } from './components/Buscador'
import { PanelMarcadores } from './components/PanelMarcadores'
import { LoginForm } from './components/LoginForm'
import { useProyectos } from './hooks/useProyectos'
import { useDocumentos } from './hooks/useDocumentos'
import { useIsMobile } from './hooks/useIsMobile'
import { api, setApiAuthErrorHandler } from './api/client'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import type { Documento, DocumentoConContenido } from './types'

type Modal = 'buscar' | 'marcadores' | null
type VistaMovil = 'sidebar' | 'lista' | 'reader'

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

  useEffect(() => {
    setApiAuthErrorHandler(logout)
  }, [logout])

  if (!token) return <LoginForm />

  return <AppShell t={t} />
}

function AppShell({ t }: { t: ReturnType<typeof useTheme>['t'] }) {
  const { proyectos, loading: loadingProyectos, recargar: recargarProyectos } = useProyectos()
  const [proyectoActivo, setProyectoActivo] = useState<string | null>(null)
  const [documentoActivo, setDocumentoActivo] = useState<DocumentoConContenido | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [recarga, setRecarga] = useState(0)
  const [recargaDocs, setRecargaDocs] = useState(0)
  const [vistaMovil, setVistaMovil] = useState<VistaMovil>('sidebar')
  const isMobile = useIsMobile()

  const { documentos, loading: loadingDocs } = useDocumentos(proyectoActivo ?? undefined, undefined, recargaDocs)

  const recargarTodo = () => {
    setRecargaDocs(r => r + 1)
    recargarProyectos()
  }

  const abrirDocumento = async (doc: Documento) => {
    const data = await api.documento(doc.id)
    setDocumentoActivo(data)
    if (isMobile) setVistaMovil('reader')
  }

  const handleEstadoChange = () => {
    setRecarga(r => r + 1)
    recargarProyectos()
  }

  const escanear = async () => {
    await api.scan()
    recargarTodo()
  }

  const abrirDesdeModal = async (doc: Documento) => {
    if (!proyectoActivo || proyectoActivo !== doc.proyecto_slug) {
      setProyectoActivo(doc.proyecto_slug)
    }
    await abrirDocumento(doc)
    setModal(null)
  }

  const handleProyectoCrear = async (slug: string, nombre: string) => {
    await api.proyectoCrear(slug, nombre)
    recargarProyectos()
  }

  const handleProyectoDel = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar la carpeta "${nombre}" y TODOS sus documentos? Esta acción no se puede deshacer.`)) return
    await api.proyectoDel(id)
    if (proyectos.find(p => p.id === id)?.slug === proyectoActivo) {
      setProyectoActivo(null)
      setDocumentoActivo(null)
      if (isMobile) setVistaMovil('sidebar')
    }
    recargarTodo()
  }

  const sharedListaProps = {
    documentos,
    proyectos,
    loading: loadingDocs,
    onSelect: abrirDocumento,
    onEstadoChange: handleEstadoChange,
    onListaChange: recargarTodo,
  }

  const modals = (
    <>
      {modal === 'buscar' && (
        <Buscador onSelect={abrirDesdeModal} onClose={() => setModal(null)} />
      )}
      {modal === 'marcadores' && (
        <PanelMarcadores onSelect={abrirDesdeModal} onClose={() => setModal(null)} />
      )}
    </>
  )

  if (isMobile) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        minHeight: 0,
        overflow: 'hidden',
        background: t.bg,
        color: t.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {vistaMovil === 'sidebar' && (
          <Sidebar
            proyectos={proyectos}
            loading={loadingProyectos}
            proyectoActivo={proyectoActivo}
            isMobile
            onSelect={slug => {
              setProyectoActivo(slug)
              setDocumentoActivo(null)
              setVistaMovil('lista')
            }}
            onScan={escanear}
            onBuscar={() => setModal('buscar')}
            onMarcadores={() => setModal('marcadores')}
            onProyectoCrear={handleProyectoCrear}
            onProyectoDel={handleProyectoDel}
          />
        )}
        {vistaMovil === 'lista' && (
          <ListaDocumentos
            {...sharedListaProps}
            isMobile
            onBack={() => setVistaMovil('sidebar')}
          />
        )}
        {vistaMovil === 'reader' && documentoActivo && (
          <Reader
            key={`${documentoActivo.id}-${recarga}`}
            documento={documentoActivo}
            onClose={() => { setDocumentoActivo(null); setVistaMovil('lista') }}
            onEstadoChange={handleEstadoChange}
          />
        )}
        {modals}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      height: '100dvh',
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
        onProyectoCrear={handleProyectoCrear}
        onProyectoDel={handleProyectoDel}
      />

      {!documentoActivo ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          {proyectoActivo ? (
            <>
              <ListaDocumentos {...sharedListaProps} />
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

      {modals}
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
