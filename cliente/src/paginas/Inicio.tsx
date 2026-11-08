import { Link } from 'react-router-dom'
import { useApp } from '../componentes/Contexto'
import { usarDatos } from '../componentes/usarDatos'
import { diaISO, hora } from '../lib/formato'
import type { Comanda, Mesa, Reserva } from '../lib/tipos'

export function Inicio() {
  const { usuario, puede } = useApp()
  const mesas = usarDatos<Mesa[]>('/mesas', 15000)
  const comandas = usarDatos<Comanda[]>('/comandas', 15000)
  const reservas = usarDatos<Reserva[]>(`/reservas?fecha=${diaISO()}`, 30000)

  const lista = mesas.datos ?? []
  const ocupadas = lista.filter((m) => ['ocupada', 'solicita_cuenta', 'pendiente_pago'].includes(m.estado)).length
  const libres = lista.filter((m) => m.estado === 'disponible').length
  const reservadas = lista.filter((m) => m.estado === 'reservada').length
  const cuenta = lista.filter((m) => ['solicita_cuenta', 'pendiente_pago'].includes(m.estado)).length
  const activas = comandas.datos ?? []
  const vigentes = (reservas.datos ?? []).filter((r) => ['pendiente', 'confirmada'].includes(r.estado))
  const saludo = new Date().getHours() < 13 ? 'Buenos días' : new Date().getHours() < 20 ? 'Buenas tardes' : 'Buenas noches'
  const error = mesas.error || comandas.error

  return (
    <>
      <div className="section-head">
        <div><h2>{saludo}, {usuario?.nombre.split(' ')[0]}</h2><p>Estado general del restaurante en este momento.</p></div>
        <div className="section-actions">
          {puede('recepcion', 'mozo') && <Link className="secondary-btn" to="/reservas">Ver reservas</Link>}
          {puede('mozo', 'caja', 'recepcion') && <Link className="primary-btn" to="/salon">Ir al salón</Link>}
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="grid grid-4">
        <div className="card kpi success"><div className="kpi-row"><div><div className="label">Mesas ocupadas</div><div className="value">{ocupadas}</div><div className="hint">de {lista.length} configuradas</div></div><div className="kpi-icon">🪑</div></div></div>
        <div className="card kpi"><div className="kpi-row"><div><div className="label">Comandas activas</div><div className="value">{activas.length}</div><div className="hint">{activas.filter((c) => c.estado === 'pendiente_cocina').length} nuevas en cocina</div></div><div className="kpi-icon">🧾</div></div></div>
        <div className="card kpi violet"><div className="kpi-row"><div><div className="label">Reservas de hoy</div><div className="value">{vigentes.length}</div><div className="hint">{reservadas} mesas reservadas</div></div><div className="kpi-icon">📅</div></div></div>
        <div className="card kpi warning"><div className="kpi-row"><div><div className="label">Piden la cuenta</div><div className="value">{cuenta}</div><div className="hint">esperando cobro</div></div><div className="kpi-icon">💳</div></div></div>
      </div>
      <div className="dashboard-layout">
        <div className="card panel-section">
          <div className="panel-head"><h3>Acciones rápidas</h3></div>
          <div className="quick-actions">
            {puede('mozo', 'caja', 'recepcion') && <Link className="quick-action" to="/salon"><div className="qicon">🪑</div><strong>Abrir mesa</strong><span>Consultar estado y comenzar una atención.</span></Link>}
            {puede('mozo') && <Link className="quick-action" to="/pedido"><div className="qicon">🧾</div><strong>Tomar pedido</strong><span>Usar la carta táctil y enviar a cocina.</span></Link>}
            {puede('recepcion', 'mozo') && <Link className="quick-action" to="/reservas"><div className="qicon">📅</div><strong>Nueva reserva</strong><span>Registrar una reserva o consultar disponibilidad.</span></Link>}
            {puede('cocina', 'mozo') && <Link className="quick-action" to="/cocina"><div className="qicon">👨‍🍳</div><strong>Ver cocina</strong><span>Seguir el avance de las comandas.</span></Link>}
          </div>
        </div>
        <div className="card panel-section">
          <div className="panel-head"><h3>Ocupación del salón</h3></div>
          {[['Ocupadas', ocupadas], ['Disponibles', libres], ['Reservadas', reservadas]].map(([t, n]) => (
            <div key={t as string} style={{ marginBottom: 10 }}>
              <div className="reporte-fila" style={{ border: 0, padding: 0 }}><span>{t}</span><strong>{n}</strong></div>
              <div className="barra"><i style={{ width: `${lista.length ? (Number(n) / lista.length) * 100 : 0}%` }} /></div>
            </div>
          ))}
          <div className="panel-head" style={{ marginTop: 22 }}><h3>Próximas reservas</h3></div>
          {vigentes.slice(0, 4).map((r) => (
            <div className="reservation-mini" key={r.id}>
              <div className="reservation-mini-head"><strong>{hora(r.fecha_hora)} · {r.cliente.nombre}</strong><span>{r.cantidad} pers.</span></div>
              <div className="reservation-mini-meta"><span>{r.mesa?.nombre ?? 'Sin mesa asignada'}</span></div>
            </div>
          ))}
          {!vigentes.length && <p className="texto-suave">No hay más reservas para hoy.</p>}
        </div>
      </div>
    </>
  )
}
