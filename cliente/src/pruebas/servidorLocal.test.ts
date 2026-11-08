import { beforeEach, describe, expect, it } from 'vitest'
import { BaseLocal } from '../local/bd'
import { ServidorLocal } from '../local/servidor'

/**
 * PI-03 · Servicio de persistencia local de la app Android (modo prueba sin red).
 * Repite el circuito completo de PI-01 y las validaciones de PI-02 contra la base de la tablet.
 */
let srv: ServidorLocal
const memoria = new Map<string, string>()
const almacen = { getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => void memoria.set(k, v), removeItem: (k: string) => void memoria.delete(k) }

async function llamar(metodo: string, ruta: string, datos?: unknown, token: string | null = null) {
  return srv.manejar(metodo, ruta, datos, token)
}
async function entrar(email: string) {
  const r = await llamar('POST', '/login', { email, password: 'cyanbox123' })
  expect(r.estado).toBe(200)
  return (r.cuerpo as { token: string }).token
}
type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

beforeEach(() => {
  memoria.clear()
  srv = new ServidorLocal(new BaseLocal(almacen))
})

describe('servicio de persistencia local (tablet)', () => {
  it('recorre el circuito completo: reserva, mesa, pedido, cocina, cobro y cierre', async () => {
    const [recepcion, mozo, cocina, caja] = await Promise.all(['recepcion', 'mozo', 'cocina', 'caja'].map((r) => entrar(`${r}@cyanbox.local`)))
    const mesa7 = ((await llamar('GET', '/mesas', undefined, mozo)).cuerpo as Json[]).find((m) => m.nombre === 'Mesa 7')!
    const manana = new Date(Date.now() + 86400000); manana.setHours(12, 0, 0, 0)
    const fecha = `${manana.getFullYear()}-${String(manana.getMonth() + 1).padStart(2, '0')}-${String(manana.getDate()).padStart(2, '0')}T12:00`

    const reserva = await llamar('POST', '/reservas', { nombre: 'Prueba Tablet', fecha_hora: fecha, cantidad: 3, id_mesa: mesa7.id }, recepcion)
    expect(reserva.estado).toBe(201)
    const idReserva = (reserva.cuerpo as Json).id
    expect(((await llamar('POST', `/reservas/${idReserva}/reservar-mesa`, {}, recepcion)).cuerpo as Json).mesa.estado).toBe('reservada')

    const atencion = (await llamar('POST', `/reservas/${idReserva}/llegada`, {}, mozo)).cuerpo as Json
    expect(atencion.mesa.estado).toBe('ocupada')

    const productos = (await llamar('GET', '/productos', undefined, mozo)).cuerpo as Json[]
    const mila = productos.find((p) => p.nombre === 'Milanesa napolitana')!
    const agua = productos.find((p) => p.nombre === 'Agua mineral')!
    const comanda = await llamar('POST', '/comandas', { id_atencion: atencion.id, items: [{ id_producto: mila.id, cantidad: 2 }, { id_producto: agua.id, cantidad: 1 }] }, mozo)
    expect(comanda.estado).toBe(201)
    const idComanda = (comanda.cuerpo as Json).id
    expect((comanda.cuerpo as Json).estado).toBe('pendiente_cocina')
    expect(((await llamar('GET', '/comandas', undefined, cocina)).cuerpo as Json[]).some((c) => c.id === idComanda && c.mesa === 'Mesa 7')).toBe(true)

    for (const [quien, estado] of [[cocina, 'en_preparacion'], [cocina, 'lista'], [mozo, 'entregada']] as const) {
      expect(((await llamar('POST', `/comandas/${idComanda}/avanzar`, {}, quien)).cuerpo as Json).estado).toBe(estado)
    }

    expect(((await llamar('POST', `/atenciones/${atencion.id}/solicitar-cuenta`, {}, mozo)).cuerpo as Json).mesa.estado).toBe('solicita_cuenta')
    const cobro = (await llamar('POST', `/atenciones/${atencion.id}/iniciar-cobro`, {}, caja)).cuerpo as Json
    expect(cobro.mesa.estado).toBe('pendiente_pago')
    expect(cobro.total).toBe(2 * 12600 + 2200)

    const menor = await llamar('POST', `/atenciones/${atencion.id}/pago`, { id_medio_pago: 2, monto: 100 }, caja)
    expect(menor.estado).toBe(422)
    const pago = (await llamar('POST', `/atenciones/${atencion.id}/pago`, { id_medio_pago: 2, monto: cobro.total }, caja)).cuerpo as Json
    expect(pago.estado).toBe('cerrada')
    expect(pago.mesa.estado).toBe('disponible')
    expect(pago.pagos).toHaveLength(1)

    // Los datos quedan guardados en la tablet: una nueva instancia los recupera.
    const otra = new ServidorLocal(new BaseLocal(almacen))
    expect(otra.bd.t.atenciones_mesa.find((a) => a.id === atencion.id)?.estado).toBe('cerrada')
  })

  it('aplica las reglas de negocio, las validaciones y los permisos', async () => {
    const mozo = await entrar('mozo@cyanbox.local')
    const admin = await entrar('admin@cyanbox.local')
    const mesas = (await llamar('GET', '/mesas', undefined, mozo)).cuerpo as Json[]
    const ocupada = mesas.find((m) => m.estado === 'ocupada')!

    const rn01 = await llamar('POST', '/atenciones', { id_mesa: ocupada.id, comensales: 2 }, mozo)
    expect(rn01.estado).toBe(422)
    expect((rn01.cuerpo as Json).regla).toBe('RN-01')

    const agotado = ((await llamar('GET', '/productos', undefined, mozo)).cuerpo as Json[]).find((p) => !p.disponible)!
    const rn03 = await llamar('POST', '/comandas', { id_atencion: ocupada.atencion.id, items: [{ id_producto: agotado.id, cantidad: 1 }] }, mozo)
    expect((rn03.cuerpo as Json).regla).toBe('RN-03')

    const vacio = await llamar('POST', '/productos', { nombre: '', precio: 0 }, admin)
    expect(vacio.estado).toBe(422)
    expect(Object.keys((vacio.cuerpo as Json).errors)).toEqual(['nombre', 'id_categoria', 'precio'])
    const duplicado = await llamar('POST', '/productos', { nombre: 'empanadas', id_categoria: 1, precio: 100 }, admin)
    expect((duplicado.cuerpo as Json).errors.nombre[0]).toBe('Ya existe un registro con ese nombre.')

    const vendido = ((await llamar('GET', '/productos', undefined, admin)).cuerpo as Json[]).find((p) => p.nombre === 'Milanesa napolitana')!
    expect((await llamar('DELETE', `/productos/${vendido.id}`, undefined, admin)).estado).toBe(409)
    expect((await llamar('POST', '/productos', { nombre: 'Panqueques', id_categoria: 4, precio: 4500 }, mozo)).estado).toBe(403)
    expect((await llamar('GET', '/mesas')).estado).toBe(401)
  })
})
