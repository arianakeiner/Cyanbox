import { useState } from 'react'
import { Modal, useApp, Vacio } from '../componentes/Contexto'
import { usarDatos } from '../componentes/usarDatos'
import { borrar, ErrorApi, mensajeDeError, post, put } from '../lib/api'
import { diaISO, duracion, etiquetaReserva, hora, minutosDesde } from '../lib/formato'
import type { Espera, Mesa, Reserva } from '../lib/tipos'

interface FormReserva { id?: number; nombre: string; telefono: string; fecha: string; hora: string; cantidad: string; id_mesa: string; estado: string; observaciones: string }
const VACIA: FormReserva = { nombre: '', telefono: '', fecha: diaISO(), hora: '21:00', cantidad: '2', id_mesa: '', estado: 'pendiente', observaciones: '' }

/** Validación en el cliente antes de enviar (el servidor vuelve a validar todo). */
export function validarReserva(f: FormReserva, mesas: Mesa[]): Record<string, string> {
  const e: Record<string, string> = {}
  if (!f.nombre.trim()) e.nombre = 'Ingresá el nombre del cliente.'
  if (!f.fecha) e.fecha = 'Elegí la fecha.'
  if (!f.hora) e.hora = 'Elegí la hora.'
  const n = Number(f.cantidad)
  if (!Number.isInteger(n) || n < 1) e.cantidad = 'Ingresá la cantidad de personas.'
  const mesa = mesas.find((m) => String(m.id) === f.id_mesa)
  if (mesa && n > mesa.capacidad) e.id_mesa = `${mesa.nombre} tiene lugar para ${mesa.capacidad}.`
  if (!f.id && f.fecha && f.hora && new Date(`${f.fecha}T${f.hora}`).getTime() < Date.now() - 5 * 60000) e.hora = 'La fecha y hora ya pasaron.'
  return e
}

export function Reservas() {
  const { puede, avisar, confirmar } = useApp()
  const [dia, setDia] = useState(diaISO())
  const reservas = usarDatos<Reserva[]>(`/reservas?desde=${diaISO()}&hasta=${diaISO(6)}`, 30000)
  const espera = usarDatos<Espera[]>('/lista-espera', 20000)
  const mesas = usarDatos<Mesa[]>('/mesas', 30000)
  const [form, setForm] = useState<FormReserva | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [nuevaEspera, setNuevaEspera] = useState<{ nombre: string; cantidad: string; telefono: string } | null>(null)
  const [asignando, setAsignando] = useState<Espera | null>(null)
  const editar = puede('recepcion')

  const todas = reservas.datos ?? []
  const delDia = todas.filter((r) => r.fecha_hora.startsWith(dia))
  const listaMesas = mesas.datos ?? []

  const recargar = () => { reservas.recargar(); mesas.recargar(); espera.recargar() }
  const ejecutar = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); avisar(ok, '', 'success'); recargar() } catch (e) { avisar('No se pudo completar', mensajeDeError(e), 'danger') }
  }

  const abrirForm = (r?: Reserva) => {
    setErrores({}); setErrorGeneral(null)
    setForm(r ? {
      id: r.id, nombre: r.cliente.nombre, telefono: r.cliente.telefono ?? '', fecha: r.fecha_hora.slice(0, 10), hora: r.fecha_hora.slice(11, 16),
      cantidad: String(r.cantidad), id_mesa: r.mesa ? String(r.mesa.id) : '', estado: r.estado, observaciones: r.observaciones ?? '',
    } : { ...VACIA, fecha: dia })
  }

  const guardar = async () => {
    if (!form) return
    const e = validarReserva(form, listaMesas)
    setErrores(e)
    if (Object.keys(e).length) return
    const datos = {
      nombre: form.nombre.trim(), telefono: form.telefono || null, fecha_hora: `${form.fecha} ${form.hora}`,
      cantidad: Number(form.cantidad), id_mesa: form.id_mesa ? Number(form.id_mesa) : null, estado: form.estado, observaciones: form.observaciones || null,
    }
    try {
      if (form.id) await put(`/reservas/${form.id}`, datos); else await post('/reservas', datos)
      avisar(form.id ? 'Reserva actualizada' : 'Reserva registrada', `${datos.nombre} · ${form.hora}`, 'success')
      setForm(null); setDia(form.fecha); recargar()
    } catch (err) {
      if (err instanceof ErrorApi && Object.keys(err.errores).length) setErrores(Object.fromEntries(Object.entries(err.errores).map(([k, v]) => [k === 'fecha_hora' ? 'hora' : k, v[0]])))
      setErrorGeneral(mensajeDeError(err))
    }
  }

  const eliminar = async (r: Reserva) => {
    if (await confirmar('Eliminar reserva', `Se eliminará la reserva de ${r.cliente.nombre} (${hora(r.fecha_hora)}). Esta acción no se puede deshacer.`, 'Eliminar', true))
      ejecutar(() => borrar(`/reservas/${r.id}`), 'Reserva eliminada')
  }
  const cancelar = async (r: Reserva) => {
    if (await confirmar('Cancelar reserva', `¿Cancelar la reserva de ${r.cliente.nombre}? Si tenía la mesa apartada, vuelve a quedar disponible.`, 'Cancelar reserva', true))
      ejecutar(() => post(`/reservas/${r.id}/cancelar`), 'Reserva cancelada')
  }

  const guardarEspera = async () => {
    if (!nuevaEspera?.nombre.trim() || Number(nuevaEspera.cantidad) < 1) { avisar('Faltan datos', 'Completá nombre y cantidad de personas.', 'warning'); return }
    await ejecutar(() => post('/lista-espera', { nombre: nuevaEspera.nombre.trim(), cantidad: Number(nuevaEspera.cantidad), telefono: nuevaEspera.telefono || null }), 'Agregado a la lista de espera')
    setNuevaEspera(null)
  }

  const campo = (k: keyof FormReserva, etiqueta: string, props: Record<string, unknown> = {}) => (
    <div className="field"><label htmlFor={`r-${k}`}>{etiqueta}</label>
      <input id={`r-${k}`} value={form![k] ?? ''} onChange={(e) => setForm({ ...form!, [k]: e.target.value })} {...props} />
      {errores[k] && <span className="campo-error">{errores[k]}</span>}
    </div>
  )

  return (
    <>
      <div className="section-head">
        <div><h2>Reservas y lista de espera</h2><p>Consulta de disponibilidad y organización de ingresos al salón.</p></div>
        <div className="section-actions">{editar && <button className="primary-btn" onClick={() => abrirForm()}>＋ Nueva reserva</button>}</div>
      </div>
      {reservas.error && <div className="error-box">{reservas.error}</div>}
      <div className="res-layout">
        <div className="card calendar-card">
          <div className="date-strip">
            {Array.from({ length: 7 }, (_, i) => {
              const iso = diaISO(i), d = new Date(`${iso}T12:00`), n = todas.filter((r) => r.fecha_hora.startsWith(iso) && r.estado !== 'cancelada').length
              return <button key={iso} className={`date-card ${iso === dia ? 'active' : ''}`} onClick={() => setDia(iso)}>
                <div className="dow">{d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}</div><div className="day">{d.getDate()}</div><div className="n">{n} {n === 1 ? 'reserva' : 'reservas'}</div>
              </button>
            })}
          </div>
          <div className="panel-head"><h3>{dia === diaISO() ? 'Reservas de hoy' : `Reservas del ${new Date(`${dia}T12:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })}`}</h3><span className="badge info">{delDia.length} {delDia.length === 1 ? 'reserva' : 'reservas'}</span></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Hora</th><th>Cliente</th><th>Personas</th><th>Mesa</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {delDia.map((r) => {
                const vigente = ['pendiente', 'confirmada'].includes(r.estado)
                return (
                  <tr key={r.id}>
                    <td><strong>{hora(r.fecha_hora)}</strong></td>
                    <td>{r.cliente.nombre}<div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{r.cliente.telefono}</div></td>
                    <td>{r.cantidad}</td><td>{r.mesa?.nombre ?? 'Sin asignar'}</td>
                    <td><span className={`badge ${r.estado === 'confirmada' ? 'success' : r.estado === 'pendiente' ? 'warning' : r.estado === 'cumplida' ? 'info' : 'neutral'}`}>{etiquetaReserva[r.estado]}</span></td>
                    <td><div className="fila-acciones">
                      {vigente && dia === diaISO() && r.mesa?.estado === 'disponible' && editar && <button className="secondary-btn small" title="Apartar la mesa para este grupo" onClick={() => ejecutar(() => post(`/reservas/${r.id}/reservar-mesa`), `${r.mesa!.nombre} reservada`)}>Apartar mesa</button>}
                      {vigente && dia === diaISO() && r.mesa && puede('recepcion', 'mozo') && <button className="primary-btn small" onClick={() => ejecutar(() => post(`/reservas/${r.id}/llegada`), `${r.cliente.nombre} ubicado en ${r.mesa!.nombre}`)}>Llegó</button>}
                      {vigente && editar && <button className="ghost-btn small" onClick={() => abrirForm(r)}>Editar</button>}
                      {vigente && editar && <button className="ghost-btn small" onClick={() => cancelar(r)}>Cancelar</button>}
                      {r.estado !== 'cumplida' && editar && <button className="danger-btn small" onClick={() => eliminar(r)}>Eliminar</button>}
                    </div></td>
                  </tr>
                )
              })}
              {!delDia.length && <tr><td colSpan={6}><Vacio icono="📅" titulo="Sin reservas para este día" texto={editar ? 'Usá "Nueva reserva" para registrar una.' : undefined} /></td></tr>}
            </tbody>
          </table></div>
        </div>
        <div className="card waitlist-card">
          <div className="panel-head"><h3>Lista de espera</h3>{editar && <button onClick={() => setNuevaEspera({ nombre: '', cantidad: '2', telefono: '' })}>＋ Agregar</button>}</div>
          {(espera.datos ?? []).map((w, i) => (
            <div className="wait-person" key={w.id}>
              <div className="wait-num">{i + 1}</div>
              <div><div className="wait-name">{w.nombre}</div><div className="wait-meta">{w.cantidad} personas · espera {duracion(minutosDesde(w.created_at))}</div></div>
              <div className="fila-acciones" style={{ marginLeft: 'auto' }}>
                {puede('recepcion', 'mozo') && <button className="secondary-btn small" onClick={() => setAsignando(w)}>Asignar</button>}
                {editar && <button className="ghost-btn small" aria-label="Quitar" onClick={async () => { if (await confirmar('Quitar de la lista', `¿Quitar a ${w.nombre} de la lista de espera?`, 'Quitar', true)) ejecutar(() => borrar(`/lista-espera/${w.id}`), 'Quitado de la lista') }}>✕</button>}
              </div>
            </div>
          ))}
          {!(espera.datos ?? []).length && <Vacio titulo="Lista vacía" texto="No hay grupos esperando." />}
        </div>
      </div>

      {form && (
        <Modal titulo={form.id ? 'Editar reserva' : 'Nueva reserva'} alCerrar={() => setForm(null)} pie={<>
          <button className="secondary-btn" onClick={() => setForm(null)}>Cancelar</button><button className="primary-btn" onClick={guardar}>Guardar</button>
        </>}>
          {errorGeneral && <div className="error-box" role="alert">{errorGeneral}</div>}
          <div className="form-grid">
            {campo('nombre', 'Nombre *', { placeholder: 'Nombre y apellido', maxLength: 80 })}
            {campo('telefono', 'Teléfono', { placeholder: '343 555-0000', maxLength: 30 })}
            {campo('fecha', 'Fecha *', { type: 'date', min: form.id ? undefined : diaISO() })}
            {campo('hora', 'Hora *', { type: 'time' })}
            {campo('cantidad', 'Personas *', { type: 'number', min: 1, max: 30 })}
            <div className="field"><label htmlFor="r-mesa">Mesa</label>
              <select id="r-mesa" value={form.id_mesa} onChange={(e) => setForm({ ...form, id_mesa: e.target.value })}>
                <option value="">Sin asignar</option>
                {listaMesas.filter((m) => m.capacidad >= Number(form.cantidad || 1)).map((m) => <option key={m.id} value={m.id}>{m.nombre} ({m.capacidad} lugares)</option>)}
              </select>{errores.id_mesa && <span className="campo-error">{errores.id_mesa}</span>}
            </div>
            <div className="field"><label htmlFor="r-estado">Estado</label>
              <select id="r-estado" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}><option value="pendiente">Pendiente</option><option value="confirmada">Confirmada</option></select>
            </div>
            <div className="field full-span"><label htmlFor="r-obs">Observaciones</label><textarea id="r-obs" maxLength={200} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
          </div>
        </Modal>
      )}

      {nuevaEspera && (
        <Modal titulo="Agregar a la lista de espera" alCerrar={() => setNuevaEspera(null)} pie={<><button className="secondary-btn" onClick={() => setNuevaEspera(null)}>Cancelar</button><button className="primary-btn" onClick={guardarEspera}>Agregar</button></>}>
          <div className="form-grid">
            <div className="field"><label htmlFor="e-n">Nombre *</label><input id="e-n" value={nuevaEspera.nombre} onChange={(e) => setNuevaEspera({ ...nuevaEspera, nombre: e.target.value })} /></div>
            <div className="field"><label htmlFor="e-c">Personas *</label><input id="e-c" type="number" min={1} value={nuevaEspera.cantidad} onChange={(e) => setNuevaEspera({ ...nuevaEspera, cantidad: e.target.value })} /></div>
            <div className="field full-span"><label htmlFor="e-t">Teléfono</label><input id="e-t" value={nuevaEspera.telefono} onChange={(e) => setNuevaEspera({ ...nuevaEspera, telefono: e.target.value })} /></div>
          </div>
        </Modal>
      )}

      {asignando && (
        <Modal titulo={`Ubicar a ${asignando.nombre} (${asignando.cantidad} pers.)`} alCerrar={() => setAsignando(null)}>
          <p className="texto-suave" style={{ marginBottom: 10 }}>Mesas disponibles con lugar suficiente:</p>
          <div className="disponibilidad-lista">
            {listaMesas.filter((m) => m.estado === 'disponible' && m.capacidad >= asignando.cantidad).map((m) => (
              <label key={m.id}><span>{m.nombre} · {m.capacidad} lugares</span>
                <button className="primary-btn small" onClick={async () => { await ejecutar(() => post(`/lista-espera/${asignando.id}/asignar`, { id_mesa: m.id }), `${asignando.nombre} ubicado en ${m.nombre}`); setAsignando(null) }}>Ubicar</button>
              </label>
            ))}
          </div>
          {!listaMesas.some((m) => m.estado === 'disponible' && m.capacidad >= asignando.cantidad) && <Vacio icono="🪑" titulo="No hay mesas libres para este grupo" />}
        </Modal>
      )}
    </>
  )
}
