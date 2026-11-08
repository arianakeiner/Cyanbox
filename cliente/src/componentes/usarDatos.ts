import { useCallback, useEffect, useRef, useState } from 'react'
import { get, mensajeDeError } from '../lib/api'

/**
 * Carga datos de la API y, opcionalmente, los refresca cada `cadaMs` milisegundos
 * para que salón, cocina y caja vean los cambios que hacen los demás equipos.
 */
export function usarDatos<T>(ruta: string | null, cadaMs = 0) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const rutaActual = useRef(ruta)
  rutaActual.current = ruta

  const recargar = useCallback(async () => {
    if (!rutaActual.current) return
    try {
      const r = await get<T>(rutaActual.current)
      setDatos(r)
      setError(null)
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    setCargando(true)
    recargar()
    if (!cadaMs) return
    const id = setInterval(recargar, cadaMs)
    return () => clearInterval(id)
  }, [ruta, cadaMs, recargar])

  return { datos, error, cargando, recargar }
}
