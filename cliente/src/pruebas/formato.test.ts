import { describe, expect, it } from 'vitest'
import { claseMesa, diaISO, duracion, minutosDesde } from '../lib/formato'

/** PU-05 · Formatos de tiempo de ocupación y estados del mapa. */
describe('formato', () => {
  it('muestra el tiempo de ocupación en minutos u horas (RF-04)', () => {
    expect(duracion(38)).toBe('38 min')
    expect(duracion(71)).toBe('1 h 11 min')
    expect(duracion(-3)).toBe('0 min')
  })

  it('calcula los minutos desde la apertura de la atención (RN-02)', () => {
    const ahora = new Date('2026-11-08T21:00:00').getTime()
    expect(minutosDesde('2026-11-08T20:22:00', ahora)).toBe(38)
  })

  it('asocia cada estado de mesa con su color del prototipo', () => {
    expect(claseMesa('disponible')).toBe('free')
    expect(claseMesa('reservada')).toBe('reserved')
    expect(claseMesa('ocupada')).toBe('busy')
    expect(claseMesa('solicita_cuenta')).toBe('account')
    expect(claseMesa('pendiente_pago')).toBe('account')
  })

  it('genera fechas locales sin desfase', () => {
    expect(diaISO(1, new Date(2026, 11, 31))).toBe('2027-01-01')
  })
})
