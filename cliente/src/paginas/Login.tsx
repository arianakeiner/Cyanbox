import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../componentes/Contexto'
import { mensajeDeError, post } from '../lib/api'
import { SERVIDOR_LOCAL, guardarServidor } from '../lib/config'
import type { Rol, Usuario } from '../lib/tipos'

// Pantalla inicial de cada perfil (igual que en el prototipo).
const INICIO_POR_ROL: Record<Rol, string> = { admin: '/', mozo: '/', cocina: '/cocina', caja: '/salon', recepcion: '/reservas' }

const PERFILES_PRUEBA = [
  ['🧾', 'Mozo', 'mozo@cyanbox.local'],
  ['👨‍🍳', 'Cocina', 'cocina@cyanbox.local'],
  ['💳', 'Caja', 'caja@cyanbox.local'],
  ['📅', 'Recepción', 'recepcion@cyanbox.local'],
  ['⚙️', 'Administrador', 'admin@cyanbox.local'],
] as const

export function Login() {
  const { iniciarSesion, config, confirmar } = useApp()
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const ingresar = async (e?: FormEvent, correo = email, pass = clave) => {
    e?.preventDefault()
    if (!correo.trim() || !pass) {
      setError('Completá el correo y la contraseña.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const r = await post<{ token: string; usuario: Usuario }>('/login', { email: correo.trim(), password: pass })
      iniciarSesion(r.token, r.usuario)
      navegar(INICIO_POR_ROL[r.usuario.rol] ?? '/', { replace: true })
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="login-shell">
      <div className="login-hero">
        <div className="brand-lockup">
          <div className="logo-mark">C</div>
          <div><div className="brand-name">Cyanbox</div><div className="brand-sub">Gestión gastronómica</div></div>
        </div>
        <div className="hero-copy">
          <div className="hero-chip">● {config.modo === 'produccion' ? 'Producción' : 'Modo prueba · datos de ejemplo'}</div>
          <h1>Un solo lugar para organizar salón, comandas y cocina.</h1>
          <p>Mesas, reservas, carta, pedidos, cocina y cierre de la atención conectados en un mismo sistema.</p>
        </div>
      </div>
      <div className="login-panel-wrap">
        <form className="login-panel" onSubmit={ingresar} noValidate>
          <h2>Ingresar</h2>
          <p>Usá el usuario asignado a tu puesto de trabajo.</p>
          {error && <div className="error-box" role="alert">{error}</div>}
          <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
            <div className="field"><label htmlFor="email">Correo</label><input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@restaurante.com" /></div>
            <div className="field"><label htmlFor="clave">Contraseña</label><input id="clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} /></div>
          </div>
          <button className="primary-btn full" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
          {config.modo === 'prueba' && (
            <div className="credenciales">
              Usuarios de prueba (contraseña <strong>cyanbox123</strong>). Tocá uno para entrar:<br />
              {PERFILES_PRUEBA.map(([icono, nombre, correo]) => (
                <button type="button" key={correo} onClick={() => { setEmail(correo); setClave('cyanbox123'); ingresar(undefined, correo, 'cyanbox123') }}>{icono} {nombre}</button>
              ))}
            </div>
          )}
          {config.nativa && (
            <div style={{ marginTop: 16, fontSize: 12.5, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span>{config.apiUrl === SERVIDOR_LOCAL ? 'Datos guardados en esta tablet' : `Servidor: ${config.apiUrl.replace(/^https?:\/\//, '').replace(/\/api$/, '')}`}</span>
              <button type="button" className="ghost-btn small" onClick={() => { guardarServidor(null); window.location.reload() }}>Cambiar</button>
              {config.apiUrl === SERVIDOR_LOCAL && (
                <button type="button" className="ghost-btn small" onClick={async () => {
                  if (!(await confirmar('Restablecer datos de ejemplo', 'Se borran los cambios hechos en esta tablet y se vuelven a cargar los datos de ejemplo.', 'Restablecer', true))) return
                  const { servidorLocal } = await import('../local/servidor')
                  servidorLocal().bd.reiniciar(); servidorLocal().bd.guardar(); window.location.reload()
                }}>Restablecer datos</button>
              )}
            </div>
          )}
        </form>
      </div>
    </section>
  )
}
