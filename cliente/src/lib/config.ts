export interface ConfigCliente {
  modo: 'prueba' | 'produccion'
  apiUrl: string
  /** true cuando la app corre instalada en la tablet (APK), donde la dirección del servidor la elige el usuario. */
  nativa: boolean
}

const CLAVE_SERVIDOR = 'cyanbox.servidor'
const PUERTO_API = 8000

/** Valor usado si no existe public/config.json (por ejemplo, al abrir con "npm run dev" sin el script de inicio). */
export const CONFIG_POR_DEFECTO: ConfigCliente = { modo: 'prueba', apiUrl: 'http://127.0.0.1:8000/api', nativa: false }

export function esAppNativa(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return !!cap?.isNativePlatform?.()
}

/**
 * Convierte lo que escribe el usuario en la dirección completa de la API.
 *   192.168.0.10            → http://192.168.0.10:8000/api
 *   192.168.0.10:9000       → http://192.168.0.10:9000/api
 *   https://api.local.com   → https://api.local.com/api
 */
export function normalizarServidor(texto: string): string | null {
  let t = texto.trim().replace(/\/+$/, '')
  if (!t) return null
  if (!/^https?:\/\//i.test(t)) t = `http://${t}`
  let url: URL
  try {
    url = new URL(t)
  } catch {
    return null
  }
  if (!url.hostname) return null
  const conPuerto = !url.port && url.protocol === 'http:' && !url.pathname.replace(/\/+$/, '') ? `${url.protocol}//${url.hostname}:${PUERTO_API}` : `${url.protocol}//${url.host}`
  const ruta = url.pathname.replace(/\/+$/, '')
  return `${conPuerto}${ruta.endsWith('/api') ? ruta : `${ruta}/api`}`
}

/** En modo prueba la API está en el mismo equipo que publica la app, así funciona también desde una tablet en la red. */
export function apiDelMismoEquipo(ubicacion: { protocol: string; hostname: string }): string {
  return `${ubicacion.protocol}//${ubicacion.hostname}:${PUERTO_API}/api`
}

export function servidorGuardado(): string | null {
  try { return localStorage.getItem(CLAVE_SERVIDOR) } catch { return null }
}
export function guardarServidor(apiUrl: string | null) {
  try {
    if (apiUrl) localStorage.setItem(CLAVE_SERVIDOR, apiUrl)
    else localStorage.removeItem(CLAVE_SERVIDOR)
  } catch { /* sin almacenamiento disponible */ }
}

/** Valor guardado cuando la tablet usa su propio servicio de persistencia (modo prueba sin red). */
export const SERVIDOR_LOCAL = 'local'

/** Consulta /estado para saber si el servidor responde y en qué modo está. */
export async function consultarServidor(apiUrl: string): Promise<{ modo: 'prueba' | 'produccion' }> {
  const r = await fetch(`${apiUrl}/estado`, { signal: AbortSignal.timeout(6000) })
  if (!r.ok) throw new Error(`El servidor respondió con error ${r.status}.`)
  const datos = await r.json()
  if (datos?.servicio !== 'cyanbox-persistencia') throw new Error('La dirección responde, pero no es un servidor de Cyanbox.')
  return { modo: datos.modo === 'produccion' ? 'produccion' : 'prueba' }
}

/**
 * Configuración al abrir la app:
 * - En la APK se usa lo que eligió el usuario: el servicio local de la tablet (modo prueba) o el servidor
 *   del restaurante (producción). Si todavía no eligió, apiUrl queda vacío y se muestra la pantalla de elección.
 * - En el navegador se lee /config.json, que escribe iniciar.mjs según el modo.
 */
export async function cargarConfig(): Promise<ConfigCliente> {
  if (esAppNativa()) {
    const apiUrl = servidorGuardado() ?? ''
    let modo: ConfigCliente['modo'] = 'prueba'
    if (apiUrl && apiUrl !== SERVIDOR_LOCAL) {
      try { modo = (await consultarServidor(apiUrl)).modo } catch { /* se informa al intentar ingresar */ }
    }
    return { modo, apiUrl, nativa: true }
  }
  try {
    const r = await fetch('/config.json', { cache: 'no-store' })
    if (!r.ok) return CONFIG_POR_DEFECTO
    const datos = (await r.json()) as { modo?: string; apiUrl?: string }
    const apiUrl = !datos.apiUrl || datos.apiUrl === 'auto' ? apiDelMismoEquipo(window.location) : datos.apiUrl
    return { modo: datos.modo === 'produccion' ? 'produccion' : 'prueba', apiUrl: apiUrl.replace(/\/+$/, ''), nativa: false }
  } catch {
    return CONFIG_POR_DEFECTO
  }
}
