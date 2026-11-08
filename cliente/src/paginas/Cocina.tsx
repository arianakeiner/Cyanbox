import { useApp, Vacio } from '../componentes/Contexto'
import { usarDatos } from '../componentes/usarDatos'
import { mensajeDeError, patch, post } from '../lib/api'
import { duracion, hora, minutosDesde } from '../lib/formato'
import type { Comanda, Producto } from '../lib/tipos'

const COLUMNAS = [
  { estado: 'pendiente_cocina', titulo: 'Nuevas', badge: 'danger', etiqueta: 'Nueva', accion: 'Comenzar preparación' },
  { estado: 'en_preparacion', titulo: 'En preparación', badge: 'warning', etiqueta: 'Preparando', accion: 'Marcar lista' },
  { estado: 'lista', titulo: 'Listas para retirar', badge: 'success', etiqueta: 'Lista', accion: 'Entregada' },
] as const

export function Cocina() {
  const { puede, avisar } = useApp()
  const comandas = usarDatos<Comanda[]>('/comandas', 5000)
  const productos = usarDatos<Producto[]>(puede('cocina') ? '/productos' : null, 30000)

  const avanzar = async (c: Comanda) => {
    try {
      const r = await post<Comanda>(`/comandas/${c.id}/avanzar`)
      avisar('Comanda actualizada', `${c.codigo} · ${r.estado_etiqueta}`, 'success')
      comandas.recargar()
    } catch (e) { avisar('No se pudo actualizar', mensajeDeError(e), 'danger') }
  }

  const disponibilidad = async (p: Producto) => {
    try {
      await patch(`/productos/${p.id}/disponibilidad`, { disponible: !p.disponible })
      avisar(p.disponible ? 'Marcado como agotado' : 'Disponible otra vez', p.nombre, p.disponible ? 'warning' : 'success')
      productos.recargar()
    } catch (e) { avisar('No se pudo cambiar', mensajeDeError(e), 'danger') }
  }

  // Cocina avanza hasta "Lista"; el mozo (o admin) marca la entrega.
  const puedeAvanzar = (estado: string) => estado === 'lista' ? puede('mozo') : puede('cocina')

  return (
    <>
      <div className="section-head"><div><h2>Pantalla de cocina</h2><p>Las comandas llegan solas desde el salón y se ordenan por estado. Se actualiza cada 5 segundos.</p></div></div>
      {comandas.error && <div className="error-box">{comandas.error}</div>}
      <div className="kitchen-board">
        {COLUMNAS.map((col) => {
          const lista = (comandas.datos ?? []).filter((c) => c.estado === col.estado)
          return (
            <div className="kitchen-col" key={col.estado}>
              <div className="kitchen-col-head"><h3>{col.titulo}</h3><span className="kitchen-count">{lista.length}</span></div>
              {lista.map((c) => (
                <div className="ticket" key={c.id}>
                  <div className="ticket-head">
                    <div><div className="ticket-title">{c.mesa} · {c.codigo}</div><div className="ticket-meta"><span>{c.mozo}</span><span>·</span><span>{hora(c.fecha_hora)}</span><span>·</span><span>hace {duracion(minutosDesde(c.fecha_hora))}</span></div></div>
                    <span className={`badge ${col.badge}`}>{col.etiqueta}</span>
                  </div>
                  <div className="ticket-items">
                    {c.items.map((i) => <div className="ticket-item" key={i.id_producto}><strong>{i.cantidad}×</strong><span>{i.producto}{i.observaciones ? ` (${i.observaciones})` : ''}</span></div>)}
                    {c.observaciones && <div className="ticket-note">Nota: {c.observaciones}</div>}
                  </div>
                  {puedeAvanzar(c.estado) && <div className="ticket-actions"><button className={`${c.estado === 'lista' ? 'secondary-btn' : 'primary-btn'} small`} onClick={() => avanzar(c)}>{col.accion}</button></div>}
                </div>
              ))}
              {!lista.length && <Vacio titulo="Sin comandas" texto="No hay pedidos en este estado." />}
            </div>
          )
        })}
      </div>
      {puede('cocina') && productos.datos && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <div className="panel-head"><h3>Disponibilidad de platos</h3><span className="texto-suave">Marcá lo que se agotó para que no se pueda pedir</span></div>
          <div className="disponibilidad-lista">
            {productos.datos.map((p) => (
              <label key={p.id}><span>{p.emoji} {p.nombre} <small className="texto-suave">· {p.categoria}</small></span>
                <button className={`${p.disponible ? 'secondary-btn' : 'danger-btn'} small`} onClick={() => disponibilidad(p)}>{p.disponible ? 'Disponible' : 'Agotado'}</button>
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
