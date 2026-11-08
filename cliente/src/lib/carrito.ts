import type { Producto } from './tipos'

/** Pedido en curso (todavía no enviado): lógica pura para poder probarla por separado. */
export interface ItemCarrito { id_producto: number; cantidad: number; observaciones?: string }

export function agregar(carrito: ItemCarrito[], producto: Producto): ItemCarrito[] {
  if (!producto.disponible) throw new Error(`${producto.nombre} no está disponible.`) // RN-03
  const existe = carrito.find((i) => i.id_producto === producto.id)
  return existe
    ? carrito.map((i) => (i.id_producto === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i))
    : [...carrito, { id_producto: producto.id, cantidad: 1 }]
}

export function cambiarCantidad(carrito: ItemCarrito[], idProducto: number, delta: number): ItemCarrito[] {
  return carrito
    .map((i) => (i.id_producto === idProducto ? { ...i, cantidad: i.cantidad + delta } : i))
    .filter((i) => i.cantidad > 0)
}

export function totales(carrito: ItemCarrito[], productos: Producto[]) {
  return carrito.reduce(
    (acc, i) => {
      const p = productos.find((x) => x.id === i.id_producto)
      return { cantidad: acc.cantidad + i.cantidad, importe: acc.importe + (p ? p.precio * i.cantidad : 0) }
    },
    { cantidad: 0, importe: 0 },
  )
}
