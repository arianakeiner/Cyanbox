import { useState } from 'react'
import { usarDatos } from '../componentes/usarDatos'
import { dinero, duracion } from '../lib/formato'

interface Resumen {
  dias: number; atenciones_cerradas: number; facturacion: number; ticket_promedio: number; minutos_promedio: number
  platos_mas_vendidos: { nombre: string; cantidad: number; importe: number }[]
  medios_de_pago: { nombre: string; cantidad: number; importe: number }[]
}

export function Reportes() {
  const [dias, setDias] = useState(30)
  const { datos, error } = usarDatos<Resumen>(`/reportes/resumen?dias=${dias}`)
  const maxPlato = Math.max(1, ...(datos?.platos_mas_vendidos ?? []).map((p) => Number(p.cantidad)))
  const totalMedios = (datos?.medios_de_pago ?? []).reduce((a, m) => a + Number(m.importe), 0) || 1

  return (
    <>
      <div className="section-head">
        <div><h2>Reportes básicos</h2><p>Información histórica de ventas y uso del salón.</p></div>
        <div className="section-actions"><select className="table-select" value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Período">
          <option value={1}>Hoy</option><option value={7}>Últimos 7 días</option><option value={30}>Últimos 30 días</option><option value={90}>Últimos 90 días</option>
        </select></div>
      </div>
      {error && <div className="error-box">{error}</div>}
      {datos && <>
        <div className="grid grid-4">
          <div className="card kpi success"><div className="kpi-row"><div><div className="label">Facturación</div><div className="value">{dinero(datos.facturacion)}</div><div className="hint">pagos registrados</div></div><div className="kpi-icon">💰</div></div></div>
          <div className="card kpi"><div className="kpi-row"><div><div className="label">Atenciones cerradas</div><div className="value">{datos.atenciones_cerradas}</div><div className="hint">mesas cobradas</div></div><div className="kpi-icon">🧾</div></div></div>
          <div className="card kpi violet"><div className="kpi-row"><div><div className="label">Ticket promedio</div><div className="value">{dinero(datos.ticket_promedio)}</div><div className="hint">por atención</div></div><div className="kpi-icon">💳</div></div></div>
          <div className="card kpi warning"><div className="kpi-row"><div><div className="label">Tiempo promedio</div><div className="value">{duracion(datos.minutos_promedio)}</div><div className="hint">de ocupación de mesa</div></div><div className="kpi-icon">⏱️</div></div></div>
        </div>
        <div className="report-layout" style={{ marginTop: 16 }}>
          <div className="card chart-card"><div className="panel-head"><h3>Platos más vendidos</h3></div>
            {datos.platos_mas_vendidos.map((p) => (
              <div key={p.nombre} style={{ marginBottom: 10 }}>
                <div className="reporte-fila" style={{ border: 0, padding: 0 }}><span>{p.nombre}</span><strong>{p.cantidad} u. · {dinero(Number(p.importe))}</strong></div>
                <div className="barra"><i style={{ width: `${(Number(p.cantidad) / maxPlato) * 100}%` }} /></div>
              </div>
            ))}
            {!datos.platos_mas_vendidos.length && <p className="texto-suave">Sin ventas en el período.</p>}
          </div>
          <div className="card chart-card"><div className="panel-head"><h3>Medios de pago</h3></div>
            {datos.medios_de_pago.map((m) => (
              <div className="reporte-fila" key={m.nombre}><span>{m.nombre} <small className="texto-suave">({m.cantidad})</small></span><strong>{Math.round((Number(m.importe) / totalMedios) * 100)} % · {dinero(Number(m.importe))}</strong></div>
            ))}
            {!datos.medios_de_pago.length && <p className="texto-suave">Sin pagos en el período.</p>}
          </div>
        </div>
      </>}
    </>
  )
}
