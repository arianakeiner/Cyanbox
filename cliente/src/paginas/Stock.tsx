import { useState } from 'react'
import { Modal, useApp } from '../componentes/Contexto'
import { usarDatos } from '../componentes/usarDatos'
import { mensajeDeError, post, put } from '../lib/api'
import type { Ingrediente } from '../lib/tipos'

interface Receta { id: number; producto: string; ingredientes: { nombre: string; cantidad: number; unidad: string }[] }

export function Stock() {
  const { avisar } = useApp()
  const ingredientes = usarDatos<Ingrediente[]>('/ingredientes')
  const recetas = usarDatos<Receta[]>('/recetas')
  const [form, setForm] = useState<Partial<Ingrediente> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const alertas = (ingredientes.datos ?? []).filter((i) => i.bajo_minimo).length

  const guardar = async () => {
    if (!form?.nombre?.trim() || !form.unidad?.trim() || form.stock_actual === undefined || form.stock_minimo === undefined) { setError('Completá todos los campos.'); return }
    const datos = { nombre: form.nombre.trim(), unidad: form.unidad.trim(), stock_actual: Number(form.stock_actual), stock_minimo: Number(form.stock_minimo) }
    try {
      if (form.id) await put(`/ingredientes/${form.id}`, datos); else await post('/ingredientes', datos)
      avisar('Stock actualizado', datos.nombre, 'success'); setForm(null); ingredientes.recargar()
    } catch (e) { setError(mensajeDeError(e)) }
  }

  return (
    <>
      <div className="section-head">
        <div><h2>Stock, disponibilidad y recetas</h2><p>Existencias de insumos y alertas. El descuento automático por receta sigue pendiente de validación con el cliente.</p></div>
        <div className="section-actions"><button className="secondary-btn" onClick={() => { setError(null); setForm({ unidad: 'kg', stock_actual: 0, stock_minimo: 0 }) }}>＋ Insumo</button></div>
      </div>
      {ingredientes.error && <div className="error-box">{ingredientes.error}</div>}
      <div className="inventory-layout">
        <div className="card stock-card">
          <div className="panel-head"><h3>Insumos</h3><span className={`badge ${alertas ? 'warning' : 'success'}`}>{alertas} {alertas === 1 ? 'alerta' : 'alertas'}</span></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Insumo</th><th>Existencia</th><th>Mínimo</th><th>Nivel</th><th>Estado</th><th></th></tr></thead>
            <tbody>{(ingredientes.datos ?? []).map((i) => {
              const nivel = Math.min(100, i.stock_minimo ? (i.stock_actual / (i.stock_minimo * 2)) * 100 : 100)
              return <tr key={i.id}>
                <td><strong>{i.nombre}</strong></td><td>{i.stock_actual} {i.unidad}</td><td>{i.stock_minimo} {i.unidad}</td>
                <td style={{ minWidth: 90 }}><div className="barra"><i style={{ width: `${nivel}%` }} /></div></td>
                <td><span className={`badge ${i.bajo_minimo ? 'danger' : 'success'}`}>{i.bajo_minimo ? 'Reponer' : 'Correcto'}</span></td>
                <td><button className="ghost-btn small" onClick={() => { setError(null); setForm({ ...i }) }}>Editar</button></td>
              </tr>
            })}</tbody>
          </table></div>
        </div>
        <div className="card recipe-card">
          <div className="panel-head"><h3>Recetas</h3></div>
          <div className="alert-box">La relación receta → descuento automático de stock se muestra como concepto, pero no es una regla definitiva hasta validarla con los interesados.</div>
          <div className="recipe-list">{(recetas.datos ?? []).map((r) => (
            <div className="recipe" key={r.id}><strong>{r.producto}</strong><span>{r.ingredientes.map((i) => `${i.nombre} ${i.cantidad} ${i.unidad}`).join(' · ')}</span></div>
          ))}</div>
        </div>
      </div>
      {form && (
        <Modal titulo={form.id ? `Editar ${form.nombre}` : 'Nuevo insumo'} alCerrar={() => setForm(null)} pie={<><button className="secondary-btn" onClick={() => setForm(null)}>Cancelar</button><button className="primary-btn" onClick={guardar}>Guardar</button></>}>
          {error && <div className="error-box" role="alert">{error}</div>}
          <div className="form-grid">
            <div className="field"><label htmlFor="i-n">Nombre *</label><input id="i-n" value={form.nombre ?? ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
            <div className="field"><label htmlFor="i-u">Unidad *</label><input id="i-u" value={form.unidad ?? ''} onChange={(e) => setForm({ ...form, unidad: e.target.value })} /></div>
            <div className="field"><label htmlFor="i-a">Existencia *</label><input id="i-a" type="number" min={0} step="0.1" value={form.stock_actual ?? ''} onChange={(e) => setForm({ ...form, stock_actual: e.target.value as unknown as number })} /></div>
            <div className="field"><label htmlFor="i-m">Mínimo *</label><input id="i-m" type="number" min={0} step="0.1" value={form.stock_minimo ?? ''} onChange={(e) => setForm({ ...form, stock_minimo: e.target.value as unknown as number })} /></div>
          </div>
        </Modal>
      )}
    </>
  )
}
