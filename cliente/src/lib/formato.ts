import type { EstadoMesa } from './tipos'

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export const dinero = (valor: number) => pesos.format(valor).replace(/ /g, ' ')

/** 38 → "38 min", 71 → "1 h 11 min" (RF-04: tiempo de ocupación). */
export function duracion(minutos: number): string {
  const m = Math.max(0, Math.floor(minutos))
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`
}

export const minutosDesde = (iso: string, ahora = Date.now()) => Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000))

export const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

/** Fecha local en formato AAAA-MM-DD (sin desfase por zona horaria). */
export function diaISO(desplazamiento = 0, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + desplazamiento)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Clase CSS del prototipo para dibujar cada estado de mesa. */
export function claseMesa(estado: EstadoMesa): 'free' | 'busy' | 'reserved' | 'account' {
  switch (estado) {
    case 'disponible': return 'free'
    case 'ocupada': return 'busy'
    case 'reservada': return 'reserved'
    default: return 'account'
  }
}

export const etiquetaReserva: Record<string, string> = { pendiente: 'Pendiente', confirmada: 'Confirmada', cumplida: 'Cumplida', cancelada: 'Cancelada' }
