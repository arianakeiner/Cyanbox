import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Panel, useApp, Vacio } from '../componentes/Contexto'
import { usarDatos } from '../componentes/usarDatos'
import { get, mensajeDeError, post } from '../lib/api'
import { claseMesa, diaISO, dinero, duracion, hora, minutosDesde } from '../lib/formato'
import type { Atencion, Espera, MedioPago, Mesa, Reserva } from '../lib/tipos'

const INSIGNIA = { free: '✓', busy: '●', reserved: '◷', account: '$' }

function Sillas({ mesa }: { mesa: Mesa }) {
  if (mesa.forma === 'round') {
    return <>{Array.from({ length: mesa.capacidad }, (_, i) => <i key={i} className="chair" style={{ ['--a' as string]: `${Math.round((360 / mesa.capacidad) * i)}deg` }} />)}</>
  }
  const arriba = Math.ceil(mesa.capacidad / 2)
  const fila = (n: number, pos: string) => Array.from({ length: n }, (_, i) => <i key={pos + i} className={`chair ${pos}`} style={{ left: `calc(${(((i + 1) / (n + 1)) * 100).toFixed(1)}% - 14px)` }} />)
  return <>{fila(arriba, 'top')}{fila(mesa.capacidad - arriba, 'bottom')}</>
}

export function Salon() {
  const mesas = usarDatos<Mesa[]>('/mesas', 10000)
  const reservas = usarDatos<Reserva[]>(`/reservas?fecha=${diaISO()}`, 30000)
  const espera = usarDatos<Espera[]>('/lista-espera', 30000)
  const [seleccion, setSeleccion] = useState<number | null>(null)
  const [, forzar] = useState(0)
  useEffect(() => { const id = setInterval(() => forzar((n) => n + 1), 30000); return () => clearInterval(id) }, [])

  const mesa = mesas.datos?.find((m) => m.id === seleccion) ?? null
  const vigentes = (reservas.datos ?? []).filter((r) => ['pendiente', 'confirmada'].includes(r.estado))

  return (
    <>
      <div className="section-head">
        <div><h2>Mapa del salón</h2><p>Tocá una mesa para consultar o gestionar su atención. Se actualiza automáticamente.</p></div>
        <div className="section-actions"><Link className="secondary-btn" to="/reservas">＋ Reserva</Link><Link className="primary-btn" to="/pedido">＋ Nuevo pedido</Link></div>
      </div>
      {mesas.error && <div className="error-box">{mesas.error}</div>}
      <div className="salon-shell">
        <div className="card">
          <div className="floor-toolbar"><div className="legend">
            <div className="legend-item"><span className="legend-dot dot-free" />Disponible</div>
            <div className="legend-item"><span className="legend-dot dot-busy" />Ocupada</div>
            <div className="legend-item"><span className="legend-dot dot-reserved" />Reservada</div>
            <div className="legend-item"><span className="legend-dot dot-account" />Cuenta / cobro</div>
          </div></div>
          <div className="floor-scroll"><div className="floor">
            <div className="zone-label" style={{ left: 30, top: 16 }}>Salón principal</div>
            <div className="zone-divider" style={{ top: '60%' }} />
            <div className="zone-label z-classic" style={{ left: 30, top: '62%' }}>Sector tranquilo / ejecutiva</div>
            <div className="rug" /><div className="doormat">Bienvenidos</div>
            {(mesas.datos ?? []).map((m) => {
              const c = claseMesa(m.estado)
              const tiempo = m.atencion ? duracion(minutosDesde(m.atencion.inicio)) : m.estado === 'reservada' ? 'Reservada' : 'Disponible'
              return (
                <button type="button" key={m.id} onClick={() => setSeleccion(m.id)}
                  className={`table-node ${m.forma}${m.capacidad >= 6 ? ' wide' : ''} ${c}`}
                  style={{ ['--x' as string]: m.pos_x, ['--y' as string]: m.pos_y }}
                  aria-label={`${m.nombre}, ${m.capacidad} lugares, ${m.estado_etiqueta}`}>
                  <Sillas mesa={m} />
                  <span className="tstatus" /><span className="tbadge" aria-hidden="true">{INSIGNIA[c]}</span>
                  <span className="tname">{m.nombre}</span><span className="tmeta">{m.capacidad} lugares</span><span className="ttime">{tiempo}</span>
                </button>
              )
            })}
          </div></div>
        </div>
        <div className="card side-panel">
          <h3>Próximos ingresos</h3><p>Reservas de hoy y lista de espera.</p>
          {vigentes.slice(0, 3).map((r) => (
            <div className="reservation-mini" key={r.id}>
              <div className="reservation-mini-head"><strong>{hora(r.fecha_hora)} · {r.cliente.nombre}</strong><span>{r.cantidad} pers.</span></div>
              <div className="reservation-mini-meta"><span>{r.mesa?.nombre ?? 'Sin mesa'}</span><span>·</span><span>{r.estado}</span></div>
            </div>
          ))}
          {(espera.datos ?? []).slice(0, 3).map((w, i) => (
            <div className="reservation-mini" key={`e${w.id}`}>
              <div className="reservation-mini-head"><strong>Espera #{i + 1} · {w.nombre}</strong><span>{w.cantidad} pers.</span></div>
              <div className="reservation-mini-meta"><span>{duracion(minutosDesde(w.created_at))}</span><span>·</span><span>Sin mesa asignada</span></div>
            </div>
          ))}
          {!vigentes.length && !(espera.datos ?? []).length && <p className="texto-suave">Sin ingresos pendientes.</p>}
          <Link className="secondary-btn full" to="/reservas" style={{ marginTop: 8 }}>Abrir gestión de reservas</Link>
        </div>
      </div>
      {mesa && <PanelMesa mesa={mesa} reservas={vigentes} alCerrar={() => setSeleccion(null)} alCambiar={() => { mesas.recargar(); reservas.recargar() }} />}
    </>
  )
}

function PanelMesa({ mesa, reservas, alCerrar, alCambiar }: { mesa: Mesa; reservas: Reserva[]; alCerrar: () => void; alCambiar: () => void }) {
  const { puede, avisar, confirmar } = useApp()
  const navegar = useNavigate()
  const [atencion, setAtencion] = useState<Atencion | null>(null)
  const [medios, setMedios] = useState<MedioPago[]>([])
  const [comensales, setComensales] = useState(Math.min(2, mesa.capacidad))
  const [medio, setMedio] = useState<number | ''>('')
  const [monto, setMonto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const reserva = reservas.find((r) => r.mesa?.id === mesa.id)

  useEffect(() => {
    setError(null)
    if (mesa.atencion) {
      get<Atencion>(`/atenciones/${mesa.atencion.id}`).then((a) => { setAtencion(a); setMonto(String(a.total)) }).catch((e) => setError(mensajeDeError(e)))
    } else setAtencion(null)
  }, [mesa.atencion?.id, mesa.estado])
  useEffect(() => { if (mesa.estado === 'pendiente_pago') get<MedioPago[]>('/medios-pago').then(setMedios).catch(() => {}) }, [mesa.estado])

  const accion = async (fn: () => Promise<unknown>, ok: string, texto?: string) => {
    setOcupado(true); setError(null)
    try { await fn(); avisar(ok, texto, 'success'); alCambiar() } catch (e) { setError(mensajeDeError(e)) } finally { setOcupado(false) }
  }

  const abrir = () => {
    if (comensales < 1 || comensales > mesa.capacidad) { setError(`Ingresá entre 1 y ${mesa.capacidad} personas.`); return }
    accion(() => post('/atenciones', { id_mesa: mesa.id, comensales }), 'Atención iniciada', `${mesa.nombre} ahora figura como ocupada.`)
  }
  const recibir = () => accion(
    () => reserva ? post(`/reservas/${reserva.id}/llegada`) : post('/atenciones', { id_mesa: mesa.id, comensales: Math.min(2, mesa.capacidad) }),
    'Mesa recibida', `${mesa.nombre} pasó a ocupada.`)
  const pedirCuenta = async () => {
    if (await confirmar('Solicitar la cuenta', `${mesa.nombre} no podrá recibir pedidos nuevos. ¿Continuar?`, 'Solicitar cuenta'))
      accion(() => post(`/atenciones/${atencion!.id}/solicitar-cuenta`), 'Cuenta solicitada', 'Caja ya puede cobrar la mesa.')
  }
  const pagar = async () => {
    if (!medio) { setError('Elegí el medio de pago.'); return }
    if (!monto || Number(monto) < (atencion?.total ?? 0)) { setError(`El monto debe cubrir el total (${dinero(atencion?.total ?? 0)}).`); return }
    const nombreMedio = medios.find((m) => m.id === medio)?.nombre
    if (await confirmar('Confirmar pago', `Se registrará el pago de ${dinero(atencion!.total)} con ${nombreMedio} y ${mesa.nombre} quedará libre.`, 'Confirmar pago'))
      accion(() => post(`/atenciones/${atencion!.id}/pago`, { id_medio_pago: medio, monto: Number(monto) }), 'Pago registrado', `${mesa.nombre} vuelve a estar disponible.`)
  }

  const pendientesCocina = atencion?.comandas.filter((c) => ['pendiente_cocina', 'en_preparacion', 'lista'].includes(c.estado)).length ?? 0

  let cuerpo, pie
  if (mesa.estado === 'disponible') {
    cuerpo = <>
      <div className="info-block"><div className="info-row"><span>Estado</span><strong>Disponible</strong></div><div className="info-row"><span>Capacidad</span><strong>{mesa.capacidad} personas</strong></div></div>
      {puede('mozo', 'recepcion') && <div className="field" style={{ marginTop: 14 }}><label htmlFor="comensales">Comensales</label><input id="comensales" type="number" min={1} max={mesa.capacidad} value={comensales} onChange={(e) => setComensales(Number(e.target.value))} /></div>}
    </>
    pie = puede('mozo', 'recepcion') && <button className="primary-btn" disabled={ocupado} onClick={abrir}>Iniciar atención</button>
  } else if (mesa.estado === 'reservada') {
    cuerpo = <div className="info-block">
      <div className="info-row"><span>Reserva</span><strong>{reserva ? `${hora(reserva.fecha_hora)} · ${reserva.cliente.nombre}` : 'Asignada'}</strong></div>
      {reserva && <div className="info-row"><span>Personas</span><strong>{reserva.cantidad}</strong></div>}
      <div className="info-row"><span>Capacidad</span><strong>{mesa.capacidad} personas</strong></div>
    </div>
    pie = puede('mozo', 'recepcion') && <button className="primary-btn" disabled={ocupado} onClick={recibir}>Recibir al cliente</button>
  } else if (atencion) {
    cuerpo = <>
      <div className="info-block">
        <div className="info-row"><span>Estado</span><strong>{mesa.estado_etiqueta}</strong></div>
        <div className="info-row"><span>Tiempo de ocupación</span><strong>{duracion(minutosDesde(atencion.inicio))}</strong></div>
        <div className="info-row"><span>Comensales</span><strong>{atencion.comensales}</strong></div>
        <div className="info-row"><span>Atiende</span><strong>{atencion.mozo ?? '—'}</strong></div>
        {atencion.reserva && <div className="info-row"><span>Reserva</span><strong>{atencion.reserva.cliente}</strong></div>}
        <div className="info-row"><span>Total consumido</span><strong>{dinero(atencion.total)}</strong></div>
      </div>
      <div className="lista-comandas">
        {atencion.comandas.map((c) => (
          <div className="ticket" key={c.id}>
            <div className="ticket-head"><div><div className="ticket-title">{c.codigo}</div><div className="ticket-meta"><span>{hora(c.fecha_hora)}</span></div></div><span className={`badge ${c.estado === 'entregada' ? 'success' : c.estado === 'cancelada' ? 'neutral' : 'warning'}`}>{c.estado_etiqueta}</span></div>
            <div className="ticket-items">{c.items.map((i) => <div className="ticket-item" key={i.id_producto}><strong>{i.cantidad}×</strong><span>{i.producto}</span></div>)}</div>
          </div>
        ))}
        {!atencion.comandas.length && <Vacio icono="🧾" titulo="Sin pedidos" texto="Todavía no se tomó ningún pedido." />}
      </div>
      {pendientesCocina > 0 && mesa.estado !== 'ocupada' && <div className="alert-box">Hay {pendientesCocina} comanda(s) que todavía no se entregaron.</div>}
      {mesa.estado === 'pendiente_pago' && puede('caja') && (
        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="field"><label htmlFor="medio">Medio de pago</label><select id="medio" value={medio} onChange={(e) => setMedio(Number(e.target.value) || '')}><option value="">Elegir…</option>{medios.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
          <div className="field"><label htmlFor="monto">Monto recibido</label><input id="monto" type="number" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
        </div>
      )}
    </>
    pie = <>
      {mesa.estado === 'ocupada' && puede('mozo') && <button className="secondary-btn" onClick={() => navegar(`/pedido?atencion=${atencion.id}`)}>Agregar pedido</button>}
      {mesa.estado === 'ocupada' && puede('mozo') && <button className="primary-btn" disabled={ocupado || !atencion.total} onClick={pedirCuenta}>Solicitar cuenta</button>}
      {mesa.estado === 'solicita_cuenta' && puede('caja') && <button className="primary-btn" disabled={ocupado} onClick={() => accion(() => post(`/atenciones/${atencion.id}/iniciar-cobro`), 'Cobro iniciado')}>Iniciar cobro</button>}
      {mesa.estado === 'pendiente_pago' && puede('caja') && <button className="success-btn" disabled={ocupado} onClick={pagar}>Confirmar pago</button>}
    </>
  } else {
    cuerpo = <div className="cargando">Cargando atención…</div>
  }

  return (
    <Panel titulo={mesa.nombre} subtitulo={`${mesa.capacidad} lugares · ${mesa.estado_etiqueta}`} alCerrar={alCerrar}
      pie={<><button className="secondary-btn" onClick={alCerrar}>Cerrar</button>{pie}</>}>
      {error && <div className="error-box" role="alert">{error}</div>}
      {cuerpo}
    </Panel>
  )
}
