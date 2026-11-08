/**
 * Cliente HTTP del servicio de persistencia.
 * Traduce los errores de red y de la API a mensajes claros para el usuario.
 */
export class ErrorApi extends Error {
  estado: number
  errores: Record<string, string[]>
  constructor(mensaje: string, estado: number, errores: Record<string, string[]> = {}) {
    super(mensaje)
    this.estado = estado
    this.errores = errores
  }
}

let baseUrl = 'http://127.0.0.1:8000/api'
let token: string | null = null
let alVencerSesion: () => void = () => {}

export function configurarApi(opciones: { baseUrl?: string; token?: string | null; alVencerSesion?: () => void }) {
  if (opciones.baseUrl !== undefined) baseUrl = opciones.baseUrl
  if (opciones.token !== undefined) token = opciones.token
  if (opciones.alVencerSesion) alVencerSesion = opciones.alVencerSesion
}

export function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorApi) {
    const primero = Object.values(e.errores)[0]?.[0]
    return primero && e.estado === 422 && Object.keys(e.errores).length === 1 ? primero : e.message
  }
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado.'
}

export async function api<T = unknown>(ruta: string, opciones: { metodo?: string; datos?: unknown } = {}): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(`${baseUrl}${ruta}`, {
      method: opciones.metodo ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(opciones.datos !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opciones.datos !== undefined ? JSON.stringify(opciones.datos) : undefined,
    })
  } catch {
    throw new ErrorApi(`No se pudo conectar con el servicio de persistencia (${baseUrl}). Verificá que esté encendido y que haya conexión de red.`, 0)
  }

  const cuerpo = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) alVencerSesion()
    throw new ErrorApi(cuerpo.message ?? `Error ${respuesta.status}`, respuesta.status, cuerpo.errors ?? {})
  }

  return cuerpo as T
}

export const get = <T>(ruta: string) => api<T>(ruta)
export const post = <T>(ruta: string, datos: unknown = {}) => api<T>(ruta, { metodo: 'POST', datos })
export const put = <T>(ruta: string, datos: unknown) => api<T>(ruta, { metodo: 'PUT', datos })
export const patch = <T>(ruta: string, datos: unknown) => api<T>(ruta, { metodo: 'PATCH', datos })
export const borrar = <T>(ruta: string) => api<T>(ruta, { metodo: 'DELETE' })
