import { describe, expect, it } from 'vitest'
import { agregar, cambiarCantidad, totales } from '../lib/carrito'
import type { Producto } from '../lib/tipos'

const p = (id: number, precio: number, disponible = true): Producto => ({
  id, nombre: `Producto ${id}`, descripcion: null, precio, disponible, plato_del_dia: false, emoji: null, id_categoria: 1, categoria: 'Principal',
})

/** PU-04 · Lógica del pedido en la tablet. */
describe('carrito de pedido', () => {
  it('suma cantidades del mismo producto y calcula el total', () => {
    let c = agregar([], p(1, 12600))
    c = agregar(c, p(1, 12600))
    c = agregar(c, p(2, 3600))
    expect(c).toEqual([{ id_producto: 1, cantidad: 2 }, { id_producto: 2, cantidad: 1 }])
    expect(totales(c, [p(1, 12600), p(2, 3600)])).toEqual({ cantidad: 3, importe: 28800 })
  })

  it('RN-03: no permite agregar un producto agotado', () => {
    expect(() => agregar([], p(5, 14200, false))).toThrow('no está disponible')
  })

  it('quita el producto cuando la cantidad llega a cero', () => {
    const c = cambiarCantidad([{ id_producto: 1, cantidad: 1 }], 1, -1)
    expect(c).toEqual([])
  })
})
