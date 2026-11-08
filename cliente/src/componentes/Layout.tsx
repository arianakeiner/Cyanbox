import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { Rol } from '../lib/tipos'
import { useApp } from './Contexto'

interface ItemMenu { ruta: string; texto: string; icono: string; roles: Rol[]; seccion: 'Operación' | 'Gestión'; kicker: string }

export const MENU: ItemMenu[] = [
  { ruta: '/', texto: 'Inicio', icono: '🏠', roles: ['mozo', 'cocina', 'caja', 'recepcion'], seccion: 'Operación', kicker: 'Resumen de operación' },
  { ruta: '/salon', texto: 'Salón', icono: '🪑', roles: ['mozo', 'caja', 'recepcion'], seccion: 'Operación', kicker: 'Operación del salón' },
  { ruta: '/pedido', texto: 'Nuevo pedido', icono: '📝', roles: ['mozo'], seccion: 'Operación', kicker: 'Atención de mesa' },
  { ruta: '/cocina', texto: 'Cocina', icono: '🍳', roles: ['cocina', 'mozo'], seccion: 'Operación', kicker: 'Producción' },
  { ruta: '/reservas', texto: 'Reservas', icono: '📅', roles: ['recepcion', 'mozo'], seccion: 'Operación', kicker: 'Recepción' },
  { ruta: '/stock', texto: 'Stock y recetas', icono: '📦', roles: [], seccion: 'Gestión', kicker: 'Gestión' },
  { ruta: '/reportes', texto: 'Reportes', icono: '📊', roles: [], seccion: 'Gestión', kicker: 'Análisis' },
  { ruta: '/administracion', texto: 'Administración', icono: '🛠️', roles: [], seccion: 'Gestión', kicker: 'Configuración' },
]

const NOMBRE_ROL: Record<Rol, string> = { admin: 'Administrador', mozo: 'Mozo', cocina: 'Cocina', caja: 'Caja', recepcion: 'Recepción' }

function Apariencia() {
  const [tema, setTema] = useState(() => localStorage.getItem('cyanboxTheme') || 'light')
  const [estilo, setEstilo] = useState(() => localStorage.getItem('cyanboxStyle') || 'classic')
  useEffect(() => {
    const d = document.documentElement
    const oscuro = tema === 'dark' || (tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
    if (oscuro) d.setAttribute('data-theme', 'dark'); else d.removeAttribute('data-theme')
    d.setAttribute('data-style', estilo)
    try { localStorage.setItem('cyanboxTheme', tema); localStorage.setItem('cyanboxStyle', estilo) } catch { /* sin almacenamiento */ }
  }, [tema, estilo])
  return (
    <div className="apariencia-mini" role="group" aria-label="Apariencia">
      <button className="icon-btn" title={tema === 'dark' ? 'Modo claro' : 'Modo oscuro'} onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}>{tema === 'dark' ? '☀' : '☾'}</button>
      <button className="icon-btn" title={estilo === 'cozy' ? 'Estilo clásico' : 'Estilo acogedor'} onClick={() => setEstilo(estilo === 'cozy' ? 'classic' : 'cozy')}>{estilo === 'cozy' ? '▦' : '🍽️'}</button>
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { usuario, config, puede, cerrarSesion } = useApp()
  const { pathname } = useLocation()
  if (!usuario) return null
  const visibles = MENU.filter((m) => puede(...m.roles))
  const actual = MENU.find((m) => m.ruta === pathname) ?? MENU[0]
  const enlace = (m: ItemMenu, clase: string) => (
    <NavLink key={m.ruta} to={m.ruta} end className={({ isActive }) => `${clase}${isActive ? ' active' : ''}`}>
      <span className="ico">{m.icono}</span>{m.texto}
    </NavLink>
  )

  return (
    <section className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="logo-mark">C</div>
          <div><div className="brand-name">Cyanbox</div><div className="brand-sub">Gestión gastronómica</div></div>
        </div>
        {(['Operación', 'Gestión'] as const).map((s) => {
          const items = visibles.filter((m) => m.seccion === s)
          return items.length ? (
            <div key={s}>
              <div className="nav-section-label">{s}</div>
              <div className="nav-list">{items.map((m) => enlace(m, 'nav-item'))}</div>
            </div>
          ) : null
        })}
        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="avatar">{usuario.nombre.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div><strong>{usuario.nombre}</strong><span>{NOMBRE_ROL[usuario.rol]}</span></div>
          </div>
          <button className="nav-item" onClick={cerrarSesion}><span className="ico">⇄</span>Cerrar sesión</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left"><div><div className="page-kicker">{actual.kicker}</div><div className="page-title">{actual.texto}</div></div></div>
          <div className="topbar-actions">
            <div className={`demo-pill ${config.modo === 'produccion' ? 'modo-prod' : ''}`} title={`API: ${config.apiUrl}`}>
              {config.modo === 'produccion' ? 'PRODUCCIÓN' : 'MODO PRUEBA'}
            </div>
            <Apariencia />
            <button className="icon-btn salir-movil" onClick={cerrarSesion} title="Cerrar sesión">⎋</button>
          </div>
        </header>
        <div className="content"><section className="view active">{children}</section></div>
      </main>

      <nav className="mobile-nav">{visibles.slice(0, 5).map((m) => enlace(m, ''))}</nav>
    </section>
  )
}
