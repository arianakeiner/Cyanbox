import { useState } from 'react'
import { Modal, useApp, Vacio } from '../componentes/Contexto'
import { usarDatos } from '../componentes/usarDatos'
import { borrar, ErrorApi, mensajeDeError, patch, post, put } from '../lib/api'
import { dinero } from '../lib/formato'
import type { Categoria, Mesa, Producto } from '../lib/tipos'

type Pestaña = 'productos' | 'categorias' | 'mesas'
type Campo = { k: string; etiqueta: string; tipo?: 'text' | 'number' | 'select' | 'check'; opciones?: { v: string; t: string }[]; requerido?: boolean; ancho?: boolean }

const CAMPOS: Record<Pestaña, Campo[]> = {
  productos: [
    { k: 'nombre', etiqueta: 'Nombre', requerido: true }, { k: 'id_categoria', etiqueta: 'Categoría', tipo: 'select', requerido: true },
    { k: 'precio', etiqueta: 'Precio', tipo: 'number', requerido: true }, { k: 'emoji', etiqueta: 'Ícono (emoji)' },
    { k: 'descripcion', etiqueta: 'Descripción', ancho: true },
    { k: 'disponible', etiqueta: 'Disponible', tipo: 'check' }, { k: 'plato_del_dia', etiqueta: 'Plato del día', tipo: 'check' },
  ],
  categorias: [{ k: 'nombre', etiqueta: 'Nombre', requerido: true }, { k: 'orden', etiqueta: 'Orden en la carta', tipo: 'number' }],
  mesas: [
    { k: 'numero', etiqueta: 'Número', tipo: 'number', requerido: true }, { k: 'nombre', etiqueta: 'Nombre', requerido: true },
    { k: 'capacidad', etiqueta: 'Capacidad', tipo: 'number', requerido: true },
    { k: 'forma', etiqueta: 'Forma', tipo: 'select', opciones: [{ v: 'round', t: 'Redonda' }, { v: 'rect', t: 'Rectangular' }] },
    { k: 'pos_x', etiqueta: 'Posición horizontal (0-100)', tipo: 'number' }, { k: 'pos_y', etiqueta: 'Posición vertical (0-100)', tipo: 'number' },
  ],
}
const NOMBRE: Record<Pestaña, string> = { productos: 'producto', categorias: 'categoría', mesas: 'mesa' }
const NUEVO: Record<Pestaña, Record<string, unknown>> = {
  productos: { nombre: '', id_categoria: '', precio: '', emoji: '', descripcion: '', disponible: true, plato_del_dia: false },
  categorias: { nombre: '', orden: 0 },
  mesas: { numero: '', nombre: '', capacidad: 4, forma: 'round', pos_x: 50, pos_y: 50 },
}

export function Administracion() {
  const { avisar, confirmar } = useApp()
  const [pestaña, setPestaña] = useState<Pestaña>('productos')
  const productos = usarDatos<Producto[]>('/productos')
  const categorias = usarDatos<Categoria[]>('/categorias')
  const mesas = usarDatos<Mesa[]>('/mesas')
  const [form, setForm] = useState<Record<string, unknown> | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const recargar = () => { productos.recargar(); categorias.recargar(); mesas.recargar() }
  const abrir = (registro?: Record<string, unknown>) => { setErrores({}); setError(null); setForm(registro ? { ...registro } : { ...NUEVO[pestaña] }) }

  const guardar = async () => {
    if (!form) return
    const faltan = Object.fromEntries(CAMPOS[pestaña].filter((c) => c.requerido && (form[c.k] === '' || form[c.k] == null)).map((c) => [c.k, `${c.etiqueta} es obligatorio.`]))
    setErrores(faltan)
    if (Object.keys(faltan).length) return
    const datos = Object.fromEntries(CAMPOS[pestaña].map((c) => [c.k, c.tipo === 'number' || c.k === 'id_categoria' ? (form[c.k] === '' ? null : Number(form[c.k])) : form[c.k] === '' ? null : form[c.k]]))
    try {
      if (form.id) await put(`/${pestaña}/${form.id}`, datos); else await post(`/${pestaña}`, datos)
      avisar(form.id ? 'Cambios guardados' : `${NOMBRE[pestaña][0].toUpperCase()}${NOMBRE[pestaña].slice(1)} creada/o`, String(datos.nombre ?? ''), 'success')
      setForm(null); recargar()
    } catch (e) {
      if (e instanceof ErrorApi) setErrores(Object.fromEntries(Object.entries(e.errores).map(([k, v]) => [k, v[0]])))
      setError(mensajeDeError(e))
    }
  }

  const eliminar = async (id: number, nombre: string) => {
    if (!(await confirmar(`Eliminar ${NOMBRE[pestaña]}`, `Se eliminará "${nombre}". Esta acción no se puede deshacer.`, 'Eliminar', true))) return
    try { await borrar(`/${pestaña}/${id}`); avisar('Eliminado', nombre, 'success'); recargar() } catch (e) { avisar('No se pudo eliminar', mensajeDeError(e), 'danger') }
  }

  const alternar = async (p: Producto) => {
    try { await patch(`/productos/${p.id}/disponibilidad`, { disponible: !p.disponible }); productos.recargar() } catch (e) { avisar('Error', mensajeDeError(e), 'danger') }
  }

  const opcionesCategoria = (categorias.datos ?? []).map((c) => ({ v: String(c.id), t: c.nombre }))
  const errorCarga = productos.error || categorias.error || mesas.error

  return (
    <>
      <div className="section-head">
        <div><h2>Administración</h2><p>Carta, categorías y mesas del salón. Los cambios se ven al instante en todos los equipos.</p></div>
        <div className="section-actions"><button className="primary-btn" onClick={() => abrir()}>＋ Nueva {NOMBRE[pestaña]}</button></div>
      </div>
      {errorCarga && <div className="error-box">{errorCarga}</div>}
      <div className="tabs-admin">
        {(['productos', 'categorias', 'mesas'] as Pestaña[]).map((p) => <button key={p} className={`category-tab ${pestaña === p ? 'active' : ''}`} onClick={() => setPestaña(p)}>{p === 'productos' ? 'Carta' : p === 'categorias' ? 'Categorías' : 'Mesas'}</button>)}
      </div>
      <div className="card card-pad"><div className="table-wrap"><table>
        {pestaña === 'productos' && <>
          <thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{(productos.datos ?? []).map((p) => (
            <tr key={p.id}>
              <td>{p.emoji} <strong>{p.nombre}</strong>{p.plato_del_dia && <span className="badge violet" style={{ marginLeft: 6 }}>Plato del día</span>}</td>
              <td>{p.categoria}</td><td>{dinero(p.precio)}</td>
              <td><button className={`badge ${p.disponible ? 'success' : 'danger'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => alternar(p)} title="Cambiar disponibilidad">{p.disponible ? 'Disponible' : 'Agotado'}</button></td>
              <td><div className="fila-acciones"><button className="ghost-btn small" onClick={() => abrir({ ...p, id_categoria: String(p.id_categoria) })}>Editar</button><button className="danger-btn small" onClick={() => eliminar(p.id, p.nombre)}>Eliminar</button></div></td>
            </tr>))}</tbody>
        </>}
        {pestaña === 'categorias' && <>
          <thead><tr><th>Categoría</th><th>Orden</th><th>Productos</th><th>Acciones</th></tr></thead>
          <tbody>{(categorias.datos ?? []).map((c) => (
            <tr key={c.id}><td><strong>{c.nombre}</strong></td><td>{c.orden}</td><td>{c.productos_count}</td>
              <td><div className="fila-acciones"><button className="ghost-btn small" onClick={() => abrir({ ...c })}>Editar</button><button className="danger-btn small" onClick={() => eliminar(c.id, c.nombre)}>Eliminar</button></div></td></tr>))}</tbody>
        </>}
        {pestaña === 'mesas' && <>
          <thead><tr><th>N.º</th><th>Mesa</th><th>Capacidad</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{(mesas.datos ?? []).map((m) => (
            <tr key={m.id}><td>{m.numero}</td><td><strong>{m.nombre}</strong></td><td>{m.capacidad} lugares</td><td>{m.estado_etiqueta}</td>
              <td><div className="fila-acciones"><button className="ghost-btn small" onClick={() => abrir({ ...m })}>Editar</button><button className="danger-btn small" onClick={() => eliminar(m.id, m.nombre)}>Eliminar</button></div></td></tr>))}</tbody>
        </>}
      </table></div>
        {pestaña === 'productos' && !(productos.datos ?? []).length && <Vacio titulo="Sin productos" />}
      </div>

      {form && (
        <Modal titulo={`${form.id ? 'Editar' : 'Nueva'} ${NOMBRE[pestaña]}`} alCerrar={() => setForm(null)} pie={<><button className="secondary-btn" onClick={() => setForm(null)}>Cancelar</button><button className="primary-btn" onClick={guardar}>Guardar</button></>}>
          {error && <div className="error-box" role="alert">{error}</div>}
          <div className="form-grid">
            {CAMPOS[pestaña].map((c) => (
              <div key={c.k} className={`field${c.ancho ? ' full-span' : ''}`}>
                {c.tipo === 'check'
                  ? <label className="check"><input type="checkbox" checked={!!form[c.k]} onChange={(e) => setForm({ ...form, [c.k]: e.target.checked })} />{c.etiqueta}</label>
                  : <label htmlFor={`a-${c.k}`}>{c.etiqueta}{c.requerido ? ' *' : ''}</label>}
                {c.tipo === 'select' && <select id={`a-${c.k}`} value={String(form[c.k] ?? '')} onChange={(e) => setForm({ ...form, [c.k]: e.target.value })}>
                  {c.k === 'id_categoria' && <option value="">Elegir…</option>}
                  {(c.opciones ?? opcionesCategoria).map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                </select>}
                {(!c.tipo || c.tipo === 'text' || c.tipo === 'number') && <input id={`a-${c.k}`} type={c.tipo ?? 'text'} value={String(form[c.k] ?? '')} onChange={(e) => setForm({ ...form, [c.k]: e.target.value })} />}
                {errores[c.k] && <span className="campo-error">{errores[c.k]}</span>}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}
