import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Modal, useApp, Vacio } from '../componentes/Contexto'
import { usarDatos } from '../componentes/usarDatos'
import { mensajeDeError, post } from '../lib/api'
import { agregar, cambiarCantidad, totales, type ItemCarrito } from '../lib/carrito'
import { dinero, duracion, minutosDesde } from '../lib/formato'
import type { Mesa, Producto } from '../lib/tipos'

export function Pedido() {
  const { avisar } = useApp()
  const [params] = useSearchParams()
  const productos = usarDatos<Producto[]>('/productos', 20000)
  const mesas = usarDatos<Mesa[]>('/mesas', 15000)
  const [categoria, setCategoria] = useState('Todos')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [idAtencion, setIdAtencion] = useState<number | ''>(Number(params.get('atencion')) || '')
  const [notas, setNotas] = useState('')
  const [comensal, setComensal] = useState(false)
  const [revisando, setRevisando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lista = productos.datos ?? []
  // Sólo se puede pedir para mesas con atención activa que no hayan pedido la cuenta (RN-04).
  const atendidas = (mesas.datos ?? []).filter((m) => m.estado === 'ocupada' && m.atencion)
  const mesaElegida = atendidas.find((m) => m.atencion!.id === idAtencion)
  useEffect(() => {
    if (!idAtencion && atendidas.length === 1) setIdAtencion(atendidas[0].atencion!.id)
  }, [atendidas.length])

  const categorias = useMemo(() => ['Todos', ...new Set(lista.map((p) => p.categoria))], [lista])
  const visibles = lista.filter((p) => categoria === 'Todos' || p.categoria === categoria)
  const { cantidad, importe } = totales(carrito, lista)

  const sumar = (p: Producto) => {
    try { setCarrito((c) => agregar(c, p)); avisar('Producto agregado', p.nombre, 'success') } catch (e) { avisar('No disponible', mensajeDeError(e), 'warning') }
  }

  const revisar = () => {
    setError(null)
    if (!carrito.length) { avisar('No hay productos', 'Agregá al menos un producto antes de enviar.', 'warning'); return }
    if (!mesaElegida) { avisar('Elegí la mesa', 'Abrí una mesa desde el salón o elegila en la lista del pedido.', 'warning'); return }
    setRevisando(true)
  }

  const enviar = async () => {
    setEnviando(true); setError(null)
    try {
      const c = await post<{ codigo: string }>('/comandas', { id_atencion: idAtencion, items: carrito, observaciones: notas || null })
      avisar('Comanda enviada a cocina', `${c.codigo} · ${mesaElegida?.nombre}`, 'success')
      setCarrito([]); setNotas(''); setRevisando(false)
      productos.recargar(); mesas.recargar()
    } catch (e) {
      setError(mensajeDeError(e))
      productos.recargar() // por si cambió la disponibilidad mientras se tomaba el pedido
    } finally { setEnviando(false) }
  }

  return (
    <>
      <div className="section-head">
        <div><h2>Tomar pedido</h2><p>Interfaz pensada para tablet. La disponibilidad se refleja directamente en la carta.</p></div>
        <div className="section-actions">
          <button className="secondary-btn" onClick={() => setComensal(!comensal)}>{comensal ? 'Volver a modo mozo' : 'Modo comensal'}</button>
          <Link className="secondary-btn" to="/salon">Volver al salón</Link>
        </div>
      </div>
      {(productos.error || mesas.error) && <div className="error-box">{productos.error || mesas.error}</div>}
      <div className="order-layout">
        <div className="card order-main">
          {comensal && <div className="mode-banner"><div className="mi">👤</div><div><strong>Tablet entregada temporalmente al comensal</strong><span>Puede consultar la carta y elegir productos. El mozo revisa y confirma el envío.</span></div><button className="secondary-btn small" style={{ marginLeft: 'auto' }} onClick={() => setComensal(false)}>Devolver al mozo</button></div>}
          <div className="category-tabs">{categorias.map((c) => <button key={c} className={`category-tab ${categoria === c ? 'active' : ''}`} onClick={() => setCategoria(c)}>{c}</button>)}</div>
          <div className="menu-grid">
            {visibles.map((p) => (
              <div key={p.id} className={`product-card ${p.disponible ? '' : 'unavailable'}`}>
                {p.plato_del_dia && <span className="daily-tag">PLATO DEL DÍA</span>}
                <div className="product-top"><div className="product-emoji">{p.emoji ?? '🍽️'}</div><div className="product-price">{dinero(p.precio)}</div></div>
                <div className="product-name">{p.nombre}</div><div className="product-desc">{p.descripcion}</div>
                <div className="product-bottom">
                  <span className={`badge ${p.disponible ? 'success' : 'danger'}`}>{p.disponible ? 'Disponible' : 'Agotado'}</span>
                  <button className="add-btn" disabled={!p.disponible} onClick={() => sumar(p)} aria-label={`Agregar ${p.nombre}`}>＋</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card cart">
          <div className="cart-head">
            <h3>Pedido actual</h3>
            <select className="table-select" aria-label="Mesa del pedido" value={idAtencion} onChange={(e) => setIdAtencion(Number(e.target.value) || '')} disabled={comensal}>
              <option value="">Elegir mesa…</option>
              {atendidas.map((m) => <option key={m.id} value={m.atencion!.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div className="cart-meta">
            {mesaElegida ? <><span>{mesaElegida.atencion!.comensales} personas</span><span>·</span><span>{duracion(minutosDesde(mesaElegida.atencion!.inicio))}</span><span>·</span><span>Consumido {dinero(mesaElegida.atencion!.total)}</span></>
              : <span>{atendidas.length ? 'Elegí una mesa con atención activa.' : 'No hay mesas con atención activa. Abrí una desde el salón.'}</span>}
          </div>
          <div className="cart-list">
            {!carrito.length && <Vacio icono="🧾" titulo="Pedido vacío" texto="Seleccioná productos de la carta." />}
            {carrito.map((i) => {
              const p = lista.find((x) => x.id === i.id_producto)
              if (!p) return null
              return (
                <div className="cart-item" key={i.id_producto}>
                  <div><div className="cart-item-name">{p.nombre}</div><div className="cart-item-note">{p.categoria}</div></div>
                  <div className="cart-item-right"><div className="cart-item-price">{dinero(p.precio * i.cantidad)}</div>
                    <div className="qty-control"><button onClick={() => setCarrito((c) => cambiarCantidad(c, p.id, -1))} aria-label="Quitar uno">−</button><span>{i.cantidad}</span><button onClick={() => setCarrito((c) => cambiarCantidad(c, p.id, 1))} aria-label="Agregar uno">＋</button></div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="cart-summary"><div className="summary-row"><span>Productos</span><strong>{cantidad}</strong></div><div className="summary-row total"><span>Total estimado</span><strong>{dinero(importe)}</strong></div></div>
          <div style={{ display: 'grid', gap: 8, marginTop: 13 }}>
            {!comensal && <button className="primary-btn full" onClick={revisar}>Revisar y enviar a cocina</button>}
            <button className="ghost-btn full" onClick={() => setCarrito([])}>Vaciar pedido</button>
          </div>
        </div>
      </div>

      {revisando && (
        <Modal titulo={`Revisar comanda · ${mesaElegida?.nombre}`} alCerrar={() => setRevisando(false)} pie={<>
          <button className="secondary-btn" onClick={() => setRevisando(false)}>Seguir editando</button>
          <button className="primary-btn" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar a cocina'}</button>
        </>}>
          {error && <div className="error-box" role="alert">{error}</div>}
          <div className="info-block">
            {carrito.map((i) => { const p = lista.find((x) => x.id === i.id_producto)!; return <div className="info-row" key={i.id_producto}><span>{i.cantidad} × {p.nombre}</span><strong>{dinero(p.precio * i.cantidad)}</strong></div> })}
            <div className="info-row"><span>Total</span><strong>{dinero(importe)}</strong></div>
          </div>
          <div className="field" style={{ marginTop: 12 }}><label htmlFor="notas">Observaciones para cocina</label><textarea id="notas" maxLength={200} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej.: sin cebolla, punto de cocción, etc." /></div>
        </Modal>
      )}
    </>
  )
}
