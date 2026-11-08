import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { configurarApi, post } from '../lib/api'
import type { ConfigCliente } from '../lib/config'
import type { Rol, Usuario } from '../lib/tipos'

type TipoAviso = 'success' | 'warning' | 'danger' | ''
interface Aviso { id: number; titulo: string; texto?: string; tipo: TipoAviso }
interface Confirmacion { titulo: string; texto: string; boton: string; peligro?: boolean; resolver: (ok: boolean) => void }

interface ContextoApp {
  config: ConfigCliente
  usuario: Usuario | null
  iniciarSesion: (token: string, usuario: Usuario) => void
  cerrarSesion: () => Promise<void>
  puede: (...roles: Rol[]) => boolean
  avisar: (titulo: string, texto?: string, tipo?: TipoAviso) => void
  confirmar: (titulo: string, texto: string, boton?: string, peligro?: boolean) => Promise<boolean>
}

const Ctx = createContext<ContextoApp | null>(null)
const CLAVE_SESION = 'cyanboxSesion'

export function ProveedorApp({ config, children }: { config: ConfigCliente; children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    try {
      const guardada = JSON.parse(sessionStorage.getItem(CLAVE_SESION) ?? 'null')
      if (guardada?.token) {
        configurarApi({ token: guardada.token })
        return guardada.usuario
      }
    } catch { /* sin sesión guardada */ }
    return null
  })
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null)
  const contador = useRef(0)

  const avisar = useCallback((titulo: string, texto?: string, tipo: TipoAviso = '') => {
    const id = ++contador.current
    setAvisos((a) => [...a, { id, titulo, texto, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 4200)
  }, [])

  const salir = useCallback(() => {
    sessionStorage.removeItem(CLAVE_SESION)
    configurarApi({ token: null })
    setUsuario(null)
  }, [])

  configurarApi({
    baseUrl: config.apiUrl,
    alVencerSesion: () => {
      salir()
      avisar('Sesión vencida', 'Ingresá nuevamente.', 'warning')
    },
  })

  const valor = useMemo<ContextoApp>(() => ({
    config,
    usuario,
    iniciarSesion: (token, u) => {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ token, usuario: u }))
      configurarApi({ token })
      setUsuario(u)
    },
    cerrarSesion: async () => {
      try { await post('/logout') } catch { /* si falla, igual se cierra localmente */ }
      salir()
    },
    puede: (...roles) => !!usuario && (usuario.rol === 'admin' || roles.includes(usuario.rol)),
    avisar,
    confirmar: (titulo, texto, boton = 'Confirmar', peligro = false) =>
      new Promise<boolean>((resolver) => setConfirmacion({ titulo, texto, boton, peligro, resolver })),
  }), [config, usuario, avisar, salir])

  const responder = (ok: boolean) => {
    confirmacion?.resolver(ok)
    setConfirmacion(null)
  }

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div className="toast-area" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`toast ${a.tipo}`}><strong>{a.titulo}</strong>{a.texto && <span>{a.texto}</span>}</div>
        ))}
      </div>
      {confirmacion && (
        <Modal titulo={confirmacion.titulo} alCerrar={() => responder(false)} pie={<>
          <button className="secondary-btn" onClick={() => responder(false)}>Cancelar</button>
          <button className={confirmacion.peligro ? 'danger-btn' : 'primary-btn'} onClick={() => responder(true)} autoFocus>{confirmacion.boton}</button>
        </>}>
          <p className="texto-suave">{confirmacion.texto}</p>
        </Modal>
      )}
    </Ctx.Provider>
  )
}

export function useApp() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp debe usarse dentro de ProveedorApp')
  return c
}

export function Modal({ titulo, children, pie, alCerrar }: { titulo: string; children: ReactNode; pie?: ReactNode; alCerrar: () => void }) {
  return (
    <div className="modal-backdrop show" onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-head"><h3>{titulo}</h3><button className="close-btn" onClick={alCerrar} aria-label="Cerrar">×</button></div>
        <div className="modal-body">{children}</div>
        {pie && <div className="modal-foot">{pie}</div>}
      </div>
    </div>
  )
}

export function Panel({ titulo, subtitulo, children, pie, alCerrar }: { titulo: string; subtitulo?: string; children: ReactNode; pie?: ReactNode; alCerrar: () => void }) {
  return (
    <>
      <div className="drawer-backdrop show" onClick={alCerrar} />
      <aside className="drawer show" role="dialog" aria-label={titulo}>
        <div className="drawer-head"><div><h3>{titulo}</h3>{subtitulo && <p>{subtitulo}</p>}</div><button className="close-btn" onClick={alCerrar} aria-label="Cerrar">×</button></div>
        <div className="drawer-body">{children}</div>
        {pie && <div className="drawer-foot">{pie}</div>}
      </aside>
    </>
  )
}

export function Vacio({ icono = '✓', titulo, texto }: { icono?: string; titulo: string; texto?: string }) {
  return <div className="empty-state"><div className="empty-icon">{icono}</div><strong>{titulo}</strong>{texto && <span>{texto}</span>}</div>
}
