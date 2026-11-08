import { useState, type FormEvent } from 'react'
import { SERVIDOR_LOCAL, consultarServidor, guardarServidor, normalizarServidor, servidorGuardado } from '../lib/config'

/**
 * Primera pantalla de la app instalada en la tablet: elige dónde está el servicio de persistencia.
 * - Modo prueba: el servicio funciona dentro de la misma tablet, con datos de ejemplo y sin red.
 * - Producción: se conecta al servidor del restaurante.
 * La elección se guarda en la tablet y se puede cambiar después desde la pantalla de ingreso.
 */
export function ElegirServidor() {
  const guardado = servidorGuardado()
  const anterior = guardado === SERVIDOR_LOCAL ? null : guardado
  const [texto, setTexto] = useState(anterior ? anterior.replace(/^http:\/\//, '').replace(/:8000\/api$/, '').replace(/\/api$/, '') : '')
  const [error, setError] = useState<string | null>(null)
  const [probando, setProbando] = useState(false)

  const conectar = async (e: FormEvent) => {
    e.preventDefault()
    const apiUrl = normalizarServidor(texto)
    if (!apiUrl) {
      setError('Escribí la dirección del servidor, por ejemplo 192.168.0.10.')
      return
    }
    setProbando(true)
    setError(null)
    try {
      await consultarServidor(apiUrl)
      guardarServidor(apiUrl)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith('La dirección')
        ? err.message
        : `No se pudo conectar con ${apiUrl}. Verificá que la tablet esté en la misma red Wi-Fi que la computadora y que el servidor esté iniciado.`)
    } finally {
      setProbando(false)
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
          <div className="hero-chip">● Configuración de la tablet</div>
          <h1>Elegí cómo usar Cyanbox en esta tablet.</h1>
          <p>Se hace una sola vez. Después la app recuerda la elección.</p>
        </div>
      </div>
      <div className="login-panel-wrap">
        <form className="login-panel" onSubmit={conectar} noValidate>
          <h2>Modo prueba</h2>
          <p>Todo funciona en esta tablet, con los datos de ejemplo y sin conexión a otro equipo.</p>
          <button type="button" className="primary-btn full" onClick={() => { guardarServidor(SERVIDOR_LOCAL); window.location.reload() }}>Probar en esta tablet</button>
          <hr style={{ margin: '22px 0', border: 0, borderTop: '1px solid var(--line, #e5e7eb)' }} />
          <h2>Producción</h2>
          <p>Conectá la tablet con el servidor del restaurante. El lanzador del servidor muestra la dirección para tablets (por ejemplo, 192.168.0.10).</p>
          {error && <div className="error-box" role="alert">{error}</div>}
          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="servidor">Dirección del servidor</label>
            <input id="servidor" inputMode="url" autoCapitalize="off" autoCorrect="off" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="192.168.0.10" />
          </div>
          <button className="ghost-btn full" disabled={probando}>{probando ? 'Conectando…' : 'Conectar con el servidor'}</button>
        </form>
      </div>
    </section>
  )
}
