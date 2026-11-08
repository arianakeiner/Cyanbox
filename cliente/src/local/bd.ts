/**
 * Base de datos local de la app instalada en la tablet (modo prueba sin servidor).
 * Guarda las mismas tablas del DER en el almacenamiento del dispositivo.
 */

export type Fila = Record<string, unknown> & { id: number }

export interface Tablas {
  roles: Fila[]
  usuarios: Fila[]
  categorias: Fila[]
  productos: Fila[]
  mesas: Fila[]
  clientes: Fila[]
  reservas: Fila[]
  lista_espera: Fila[]
  atenciones_mesa: Fila[]
  comandas: Fila[]
  detalles_comanda: Fila[]
  medios_pago: Fila[]
  pagos: Fila[]
  ingredientes: Fila[]
  recetas: Fila[]
  receta_ingrediente: (Record<string, unknown> & { id_receta: number; id_ingrediente: number })[]
  proveedores: Fila[]
  movimientos_stock: Fila[]
}

export interface Datos { version: number; ultimoId: Record<string, number>; tablas: Tablas }

const CLAVE = 'cyanbox.bd-local'
const VERSION = 1

export class BaseLocal {
  datos: Datos
  private almacen: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  private ahora: () => Date

  constructor(almacen: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null, ahora: () => Date = () => new Date()) {
    this.almacen = almacen
    this.ahora = ahora
    this.datos = this.leer() ?? this.crearConDatosDeEjemplo()
  }

  private leer(): Datos | null {
    try {
      const texto = this.almacen?.getItem(CLAVE)
      const datos = texto ? (JSON.parse(texto) as Datos) : null
      return datos?.version === VERSION ? datos : null
    } catch {
      return null
    }
  }

  guardar() {
    try { this.almacen?.setItem(CLAVE, JSON.stringify(this.datos)) } catch { /* almacenamiento lleno o no disponible */ }
  }

  reiniciar() {
    this.datos = this.crearConDatosDeEjemplo()
  }

  get t(): Tablas { return this.datos.tablas }

  insertar<T extends keyof Tablas>(tabla: T, fila: Record<string, unknown>): Fila {
    const id = (this.datos.ultimoId[tabla] ?? 0) + 1
    this.datos.ultimoId[tabla] = id
    const ahora = this.ahora().toISOString()
    const nueva = { id, created_at: ahora, updated_at: ahora, ...fila } as Fila
    ;(this.t[tabla] as Fila[]).push(nueva)
    return nueva
  }

  buscar<T extends keyof Tablas>(tabla: T, id: number): Fila | undefined {
    return (this.t[tabla] as Fila[]).find((f) => f.id === id)
  }

  actualizar(fila: Fila, cambios: Record<string, unknown>) {
    Object.assign(fila, cambios, { updated_at: this.ahora().toISOString() })
  }

  eliminar<T extends keyof Tablas>(tabla: T, id: number) {
    ;(this.t as unknown as Record<string, Fila[]>)[tabla] = (this.t[tabla] as Fila[]).filter((f) => f.id !== id)
  }

  /** Mismos datos de ejemplo que el servidor en modo prueba (DemoSeeder). */
  private crearConDatosDeEjemplo(): Datos {
    const vacia: Tablas = {
      roles: [], usuarios: [], categorias: [], productos: [], mesas: [], clientes: [], reservas: [], lista_espera: [],
      atenciones_mesa: [], comandas: [], detalles_comanda: [], medios_pago: [], pagos: [], ingredientes: [], recetas: [],
      receta_ingrediente: [], proveedores: [], movimientos_stock: [],
    }
    this.datos = { version: VERSION, ultimoId: {}, tablas: vacia }
    const ahora = this.ahora()
    const hace = (min: number) => new Date(ahora.getTime() - min * 60000).toISOString()

    const roles: Record<string, number> = {}
    for (const [nombre, descripcion] of [
      ['admin', 'Gestión general, carta, mesas, stock y reportes'], ['mozo', 'Mesas, carta y pedidos'], ['cocina', 'Comandas y preparación'],
      ['caja', 'Cuenta, pago y cierre de mesa'], ['recepcion', 'Reservas y lista de espera'],
    ]) roles[nombre] = this.insertar('roles', { nombre, descripcion }).id
    for (const nombre of ['Efectivo', 'Débito', 'Crédito', 'Transferencia / QR']) this.insertar('medios_pago', { nombre })

    const usuarios: Record<string, number> = {}
    for (const [nombre, email, rol] of [
      ['Administrador', 'admin@cyanbox.local', 'admin'], ['Joel Alvarez', 'mozo@cyanbox.local', 'mozo'], ['Ariana Keiner', 'mozo2@cyanbox.local', 'mozo'],
      ['Cocina', 'cocina@cyanbox.local', 'cocina'], ['Caja', 'caja@cyanbox.local', 'caja'], ['Recepción', 'recepcion@cyanbox.local', 'recepcion'],
    ]) usuarios[email] = this.insertar('usuarios', { nombre, email, password: CLAVE_DEMO, id_rol: roles[rol], activo: true, api_token: null, token_expira: null }).id
    const joel = usuarios['mozo@cyanbox.local'], ariana = usuarios['mozo2@cyanbox.local']

    const cats: Record<string, number> = {}
    ;['Entrada fría', 'Entrada caliente', 'Principal', 'Postre', 'Bebidas'].forEach((nombre, i) => { cats[nombre] = this.insertar('categorias', { nombre, orden: i + 1 }).id })
    const prod: Record<string, Fila> = {}
    for (const [nombre, cat, precio, emoji, descripcion, disponible, plato_del_dia] of [
      ['Bruschettas', 'Entrada fría', 5200, '🥖', 'Tomate, albahaca y aceite de oliva', true, false],
      ['Tabla de quesos', 'Entrada fría', 7900, '🧀', 'Selección de quesos y acompañamientos', true, false],
      ['Empanadas', 'Entrada caliente', 2300, '🥟', 'Carne cortada a cuchillo', true, false],
      ['Rabas', 'Entrada caliente', 9800, '🍤', 'Con limón y alioli', true, false],
      ['Bife a la criolla', 'Principal', 14200, '🥩', 'Con papas españolas y salsa criolla', false, false],
      ['Milanesa napolitana', 'Principal', 12600, '🍽️', 'Con papas fritas', true, true],
      ['Risotto de hongos', 'Principal', 11900, '🍚', 'Arroz cremoso, hongos y parmesano', true, false],
      ['Pasta casera', 'Principal', 10800, '🍝', 'Salsa a elección', true, false],
      ['Flan casero', 'Postre', 4200, '🍮', 'Con dulce de leche o crema', true, false],
      ['Brownie con helado', 'Postre', 5100, '🍫', 'Chocolate, nueces y helado', true, false],
      ['Agua mineral', 'Bebidas', 2200, '💧', 'Con o sin gas', true, false],
      ['Limonada', 'Bebidas', 3600, '🍋', 'Menta y jengibre opcional', true, false],
      ['Gaseosa', 'Bebidas', 2800, '🥤', 'Línea regular o sin azúcar', true, false],
    ] as const) prod[nombre] = this.insertar('productos', { nombre, id_categoria: cats[cat], precio, emoji, descripcion, disponible, plato_del_dia })

    const mesa: Record<number, Fila> = {}
    for (const [numero, nombre, capacidad, forma, pos_x, pos_y] of [
      [1, 'Mesa 1', 4, 'round', 6, 16], [2, 'Mesa 2', 4, 'round', 27, 14], [3, 'Mesa 3', 4, 'round', 47, 15], [4, 'Mesa 4', 4, 'round', 68, 15],
      [5, 'Mesa 5', 4, 'round', 15, 46], [6, 'Mesa 6', 4, 'round', 38, 45], [7, 'Mesa 7', 4, 'round', 61, 46], [8, 'Mesa 8', 2, 'rect', 84, 45],
      [9, 'Mesa 9', 2, 'rect', 12, 73], [10, 'Mesa 10', 2, 'rect', 43, 73], [11, 'Ejecutiva', 6, 'rect', 72, 73],
    ] as const) mesa[numero] = this.insertar('mesas', { numero, nombre, capacidad, forma, pos_x, pos_y, estado: 'disponible' })

    const hoy = new Date(ahora); hoy.setHours(0, 0, 0, 0)
    for (const [dia, hora, nombre, telefono, cantidad, nro, estado] of [
      [0, '20:30', 'Lucía Gómez', '11 5555-8821', 4, 2, 'confirmada'], [0, '21:15', 'Martín Díaz', '11 5555-4310', 2, 10, 'confirmada'],
      [0, '21:45', 'Carla Benítez', '11 5555-3109', 6, 11, 'pendiente'], [1, '20:00', 'Familia Romero', '11 5555-7720', 5, null, 'confirmada'],
      [1, '21:30', 'Paula Ríos', '11 5555-2054', 2, 9, 'confirmada'], [2, '13:30', 'Equipo Delta (almuerzo)', '11 5555-9012', 6, 11, 'pendiente'],
      [3, '21:00', 'Sofía Luna', '11 5555-6643', 4, null, 'confirmada'],
    ] as const) {
      const [h, m] = hora.split(':').map(Number)
      const f = new Date(hoy); f.setDate(f.getDate() + dia); f.setHours(h, m, 0, 0)
      const cliente = this.insertar('clientes', { nombre, telefono })
      this.insertar('reservas', { id_cliente: cliente.id, id_mesa: nro ? mesa[nro].id : null, fecha_hora: f.toISOString(), cantidad, estado, observaciones: null })
    }
    mesa[2].estado = 'reservada'
    mesa[10].estado = 'reservada'
    this.insertar('lista_espera', { nombre: 'Familia Suárez', telefono: null, cantidad: 5, estado: 'esperando', created_at: hace(12) })
    this.insertar('lista_espera', { nombre: 'Nicolás R.', telefono: null, cantidad: 2, estado: 'esperando', created_at: hace(7) })

    const abrir = (nro: number, minutos: number, comensales: number, mozo: number, estado: string) => {
      mesa[nro].estado = estado
      return this.insertar('atenciones_mesa', { id_mesa: mesa[nro].id, id_usuario: mozo, id_reserva: null, comensales, inicio: hace(minutos), fin: null, estado: 'activa' })
    }
    const comanda = (a: Fila, mozo: number, haceMin: number, estado: string, items: [number, string][], observaciones: string | null = null) => {
      const c = this.insertar('comandas', { id_atencion: a.id, id_usuario: mozo, fecha_hora: hace(haceMin), estado, observaciones })
      for (const [cantidad, nombre] of items) this.insertar('detalles_comanda', { id_comanda: c.id, id_producto: prod[nombre].id, cantidad, precio_unitario: prod[nombre].precio, observaciones: null })
      return c
    }
    comanda(abrir(3, 38, 3, joel, 'ocupada'), joel, 30, 'en_preparacion', [[2, 'Empanadas'], [1, 'Milanesa napolitana']], 'Empanadas bien calientes')
    comanda(abrir(4, 71, 4, ariana, 'solicita_cuenta'), ariana, 60, 'entregada', [[1, 'Tabla de quesos'], [2, 'Pasta casera'], [2, 'Limonada']])
    comanda(abrir(6, 22, 2, joel, 'ocupada'), joel, 4, 'pendiente_cocina', [[1, 'Risotto de hongos'], [2, 'Limonada']], '1 risotto sin cebolla')
    comanda(abrir(8, 54, 2, ariana, 'ocupada'), ariana, 20, 'lista', [[1, 'Milanesa napolitana'], [1, 'Pasta casera']])

    const historial: [string, number][][] = [
      [['Milanesa napolitana', 2], ['Gaseosa', 2]], [['Pasta casera', 1], ['Agua mineral', 1]], [['Empanadas', 6], ['Limonada', 3]],
      [['Risotto de hongos', 2], ['Flan casero', 2]], [['Milanesa napolitana', 1], ['Brownie con helado', 1]],
      [['Rabas', 1], ['Bruschettas', 1], ['Gaseosa', 2]], [['Milanesa napolitana', 3], ['Agua mineral', 2]], [['Tabla de quesos', 1], ['Limonada', 2]],
    ]
    historial.forEach((items, i) => {
      const inicio = new Date(ahora); inicio.setDate(inicio.getDate() - (i + 1)); inicio.setHours(20, (10 * i) % 60, 0, 0)
      const fin = new Date(inicio.getTime() + (55 + i * 4) * 60000)
      const mozo = i % 2 ? ariana : joel
      const a = this.insertar('atenciones_mesa', { id_mesa: mesa[(i % 9) + 1].id, id_usuario: mozo, id_reserva: null, comensales: 2, inicio: inicio.toISOString(), fin: fin.toISOString(), estado: 'cerrada' })
      const c = this.insertar('comandas', { id_atencion: a.id, id_usuario: mozo, fecha_hora: new Date(inicio.getTime() + 5 * 60000).toISOString(), estado: 'entregada', observaciones: null })
      let total = 0
      for (const [nombre, cantidad] of items) {
        this.insertar('detalles_comanda', { id_comanda: c.id, id_producto: prod[nombre].id, cantidad, precio_unitario: prod[nombre].precio, observaciones: null })
        total += cantidad * (prod[nombre].precio as number)
      }
      this.insertar('pagos', { id_atencion: a.id, id_medio_pago: (i % 4) + 1, monto: total, estado: 'confirmado', created_at: fin.toISOString(), updated_at: fin.toISOString() })
    })

    const ing: Record<string, number> = {}
    for (const [nombre, unidad, stock_actual, stock_minimo] of [
      ['Carne vacuna', 'kg', 4, 6], ['Papas', 'kg', 14, 8], ['Tomate', 'kg', 3, 4], ['Queso mozzarella', 'kg', 5, 3],
      ['Harina', 'kg', 9, 5], ['Champiñones', 'kg', 1.2, 2], ['Gaseosa cola', 'u.', 28, 12], ['Limón', 'u.', 18, 10],
    ] as const) ing[nombre] = this.insertar('ingredientes', { nombre, unidad, stock_actual, stock_minimo }).id
    for (const [producto, lista] of Object.entries({
      'Milanesa napolitana': [['Carne vacuna', 0.25], ['Tomate', 0.05], ['Queso mozzarella', 0.08], ['Papas', 0.3]],
      'Risotto de hongos': [['Champiñones', 0.12]],
      Limonada: [['Limón', 2]],
    } as Record<string, [string, number][]>)) {
      const r = this.insertar('recetas', { id_producto: prod[producto].id })
      for (const [nombre, cantidad] of lista) this.datos.tablas.receta_ingrediente.push({ id_receta: r.id, id_ingrediente: ing[nombre], cantidad })
    }
    this.insertar('proveedores', { nombre: 'Frigorífico Crespo', telefono: '343 555-1020' })
    this.insertar('proveedores', { nombre: 'Verdulería Central', telefono: '343 555-3344' })
    return this.datos
  }
}

export const CLAVE_DEMO = 'cyanbox123'
