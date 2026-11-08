import { describe, expect, it } from 'vitest'
import { validarReserva } from '../paginas/Reservas'
import type { Mesa } from '../lib/tipos'

const mesa: Mesa = { id: 9, numero: 9, nombre: 'Mesa 9', capacidad: 2, forma: 'rect', pos_x: 0, pos_y: 0, estado: 'disponible', estado_etiqueta: 'Disponible', atencion: null }
const base = { nombre: 'Ana', telefono: '', fecha: '2099-01-01', hora: '21:00', cantidad: '2', id_mesa: '', estado: 'pendiente', observaciones: '' }

/** PU-06 · Validaciones del formulario de reservas antes de enviar al servidor. */
describe('validarReserva', () => {
  it('acepta una reserva completa', () => {
    expect(validarReserva(base, [mesa])).toEqual({})
  })
  it('exige los campos obligatorios', () => {
    const e = validarReserva({ ...base, nombre: ' ', cantidad: '0', hora: '' }, [mesa])
    expect(Object.keys(e).sort()).toEqual(['cantidad', 'hora', 'nombre'])
  })
  it('no permite más personas que la capacidad de la mesa', () => {
    expect(validarReserva({ ...base, cantidad: '4', id_mesa: '9' }, [mesa]).id_mesa).toMatch('lugar para 2')
  })
})
