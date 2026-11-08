/**
 * Servicio de persistencia local para la app instalada en la tablet (modo prueba sin red).
 *
 * Responde las mismas rutas, con el mismo formato JSON, códigos HTTP, mensajes y reglas de negocio
 * que la API de Laravel (servidor/), para que la interfaz funcione igual con uno u otro.
 * En producción la tablet usa siempre el servidor real.
 */
import { BaseLocal, type Fila } from './bd'

export interface Respuesta { estado: number; cuerpo: unknown }

class ErrorHttp extends Error {
  estado: number
  extra: Record<string, unknown>
  constructor(estado: number, mensaje: string, extra: Record<string, unknown> = {}) {
    super(mensaje)
    this.estado = estado
    this.extra = extra
  }
}
const regla = (mensaje: string, codigo: string | null = null) => new ErrorHttp(422, mensaje, { regla: codigo })
const noExiste = () => new ErrorHttp(404, 'El registro solicitado no existe o fue eliminado.')

// ---------------------------------------------------------------- estados (diagramas de la Etapa 2)
const MESA_ETIQUETA: Record<string, string> = { disponible: 'Disponible', reservada: 'Reservada', ocupada: 'Ocupada', solicita_cuenta: 'Solicita cuenta', pendiente_pago: 'Pendiente de pago' }
const MESA_SIGUIENTES: Record<string, string[]> = {
  disponible: ['reservada', 'ocupada'], reservada: ['ocupada', 'disponible'], ocupada: ['solicita_cuenta'], solicita_cuenta: ['pendiente_pago'], pendiente_pago: ['disponible'],
}
const MESA_CON_ATENCION = ['ocupada', 'solicita_cuenta', 'pendiente_pago']
const COMANDA_ETIQUETA: Record<string, string> = {
  borrador: 'Borrador', enviada: 'Enviada', pendiente_cocina: 'Pendiente en cocina', en_preparacion: 'En preparación', lista: 'Lista', entregada: 'Entregada', cancelada: 'Cancelada',
}
const COMANDA_SIGUIENTE: Record<string, string | null> = {
  borrador: 'enviada', enviada: 'pendiente_cocina', pendiente_cocina: 'en_preparacion', en_preparacion: 'lista', lista: 'entregada', entregada: null, cancelada: null,
}
const VIGENTES = ['pendiente', 'confirmada']
const DURACION_RESERVA_MIN = 120
const HORAS_TOKEN = 12

// ---------------------------------------------------------------- validación (mismos mensajes que lang/es/validation.php)
const ATRIBUTOS: Record<string, string> = {
  nombre: 'nombre', email: 'correo', password: 'contraseña', precio: 'precio', id_categoria: 'categoría', id_mesa: 'mesa', id_atencion: 'atención',
  id_medio_pago: 'medio de pago', numero: 'número', capacidad: 'capacidad', cantidad: 'cantidad de personas', comensales: 'comensales',
  fecha_hora: 'fecha y hora', telefono: 'teléfono', monto: 'monto', items: 'productos', stock_actual: 'existencia', stock_minimo: 'stock mínimo',
  id_rol: 'rol', unidad: 'unidad', descripcion: 'descripción', observaciones: 'observaciones', orden: 'orden', forma: 'forma',
}
const vacio = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
const esNumero = (v: unknown) => v !== '' && v !== null && typeof v !== 'boolean' && !Number.isNaN(Number(v))

type Datos = Record<string, unknown>

export class ServidorLocal {
  bd: BaseLocal
  private ahora: () => Date

  constructor(bd: BaseLocal, ahora: () => Date = () => new Date()) {
    this.bd = bd
    this.ahora = ahora
  }

  // ============================================================ punto de entrada
  async manejar(metodo: string, rutaCompleta: string, cuerpo: unknown, token: string | null): Promise<Respuesta> {
    const [ruta, query = ''] = rutaCompleta.replace(/^\/+/, '').split('?')
    const q = Object.fromEntries(new URLSearchParams(query))
    const datos = (cuerpo ?? {}) as Datos
    try {
      const r = this.enrutar(metodo.toUpperCase(), ruta.replace(/\/+$/, ''), q, datos, token)
      if (metodo.toUpperCase() !== 'GET') this.bd.guardar()
      return r
    } catch (e) {
      if (e instanceof ErrorHttp) return { estado: e.estado, cuerpo: { message: e.message, ...e.extra } }
      return { estado: 500, cuerpo: { message: 'Ocurrió un error inesperado en el servicio local.' } }
    }
  }

  private enrutar(m: string, ruta: string, q: Record<string, string>, d: Datos, token: string | null): Respuesta {
    const ok = (cuerpo: unknown, estado = 200): Respuesta => ({ estado, cuerpo })
    if (m === 'GET' && ruta === 'estado') {
      return ok({ servicio: 'cyanbox-persistencia', version: '1.0.0', modo: 'prueba', base_de_datos: { motor: 'local (tablet)', estado: 'ok' }, hora_servidor: this.iso(this.ahora()) })
    }
    if (m === 'POST' && ruta === 'login') return ok(this.login(d))

    const yo = this.autenticar(token)
    const permitir = (...roles: string[]) => {
      const rol = this.rolDe(yo)
      if (rol !== 'admin' && !roles.includes(rol)) throw new ErrorHttp(403, `Tu perfil (${rol}) no tiene permiso para realizar esta acción.`)
    }
    const p = ruta.split('/')
    const id = (i: number) => Number(p[i])
    const es = (metodo: string, patron: string) => {
      if (metodo !== m) return false
      const partes = patron.split('/')
      return partes.length === p.length && partes.every((x, i) => (x === '#' ? /^\d+$/.test(p[i]) : x === p[i]))
    }

    if (es('GET', 'yo')) return ok(this.jsonUsuario(yo))
    if (es('POST', 'logout')) { this.bd.actualizar(yo, { api_token: null, token_expira: null }); return ok({ message: 'Sesión cerrada.' }) }

    // ---- lectura
    if (es('GET', 'mesas')) return ok([...this.bd.t.mesas].sort((a, b) => (a.numero as number) - (b.numero as number)).map((x) => this.jsonMesa(x)))
    if (es('GET', 'mesas/#')) return ok(this.jsonMesa(this.existe('mesas', id(1))))
    if (es('GET', 'categorias')) return ok(this.categorias())
    if (es('GET', 'productos')) return ok(this.productos(q))
    if (es('GET', 'productos/#')) return ok(this.jsonProducto(this.existe('productos', id(1))))
    if (es('GET', 'medios-pago')) return ok(this.bd.t.medios_pago.map(({ id, nombre }) => ({ id, nombre })))
    if (es('GET', 'atenciones')) return ok(this.bd.t.atenciones_mesa.filter((a) => !q.estado || a.estado === q.estado).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio))).slice(0, 100).map((a) => this.jsonAtencion(a)))
    if (es('GET', 'atenciones/#')) return ok(this.jsonAtencion(this.existe('atenciones_mesa', id(1))))
    if (es('GET', 'comandas')) return ok(this.comandas(q))
    if (es('GET', 'comandas/#')) return ok(this.jsonComanda(this.existe('comandas', id(1))))
    if (es('GET', 'reservas')) return ok(this.reservas(q))
    if (es('GET', 'reservas/#')) return ok(this.jsonReserva(this.existe('reservas', id(1))))
    if (es('GET', 'lista-espera')) return ok(this.bd.t.lista_espera.filter((e) => e.estado === 'esperando').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))))

    // ---- salón y pedidos
    if (es('POST', 'atenciones')) {
      permitir('mozo', 'recepcion')
      const v = this.validar(d, { id_mesa: 'required|integer|exists:mesas', comensales: 'required|integer|min:1' })
      return ok(this.jsonAtencion(this.abrirAtencion(this.existe('mesas', v.id_mesa as number), v.comensales as number, yo)), 201)
    }
    if (es('POST', 'comandas')) { permitir('mozo'); return ok(this.jsonComanda(this.crearComanda(d, yo)), 201) }
    if (es('POST', 'comandas/#/confirmar')) { permitir('mozo'); const c = this.existe('comandas', id(1)); this.pasarComanda(c, 'enviada'); this.pasarComanda(c, 'pendiente_cocina'); return ok(this.jsonComanda(c)) }
    if (es('POST', 'comandas/#/cancelar')) { permitir('mozo'); const c = this.existe('comandas', id(1)); this.pasarComanda(c, 'cancelada'); return ok(this.jsonComanda(c)) }
    if (es('POST', 'comandas/#/avanzar')) { permitir('cocina', 'mozo'); return ok(this.jsonComanda(this.avanzarComanda(this.existe('comandas', id(1))))) }
    if (es('POST', 'atenciones/#/solicitar-cuenta')) { permitir('mozo'); const a = this.activa(id(1)); this.pasarMesa(this.mesaDe(a), 'solicita_cuenta'); return ok(this.jsonAtencion(a)) }
    if (es('PATCH', 'productos/#/disponibilidad')) {
      permitir('cocina')
      const pr = this.existe('productos', id(1))
      this.bd.actualizar(pr, this.validar(d, { disponible: 'required|boolean' }))
      return ok(this.jsonProducto(pr))
    }

    // ---- caja
    if (es('POST', 'atenciones/#/iniciar-cobro')) { permitir('caja'); const a = this.activa(id(1)); this.pasarMesa(this.mesaDe(a), 'pendiente_pago'); return ok(this.jsonAtencion(a)) }
    if (es('POST', 'atenciones/#/pago')) { permitir('caja'); return ok(this.jsonAtencion(this.pagar(this.existe('atenciones_mesa', id(1)), d))) }

    // ---- reservas y lista de espera
    if (es('POST', 'reservas')) { permitir('recepcion'); return ok(this.jsonReserva(this.crearReserva(this.validarReserva(d, false))), 201) }
    if (es('PUT', 'reservas/#')) { permitir('recepcion'); return ok(this.jsonReserva(this.actualizarReserva(this.existe('reservas', id(1)), this.validarReserva(d, true)))) }
    if (es('DELETE', 'reservas/#')) {
      permitir('recepcion')
      const r = this.existe('reservas', id(1))
      if (r.estado === 'cumplida') throw regla('Una reserva cumplida forma parte del historial y no se puede eliminar.')
      this.liberarMesaReservada(r)
      this.bd.eliminar('reservas', r.id)
      return ok({ message: 'Reserva eliminada.' })
    }
    if (es('POST', 'reservas/#/cancelar')) {
      permitir('recepcion')
      const r = this.existe('reservas', id(1))
      if (!VIGENTES.includes(r.estado as string)) throw regla('La reserva ya no está vigente.')
      this.liberarMesaReservada(r)
      this.bd.actualizar(r, { estado: 'cancelada' })
      return ok(this.jsonReserva(r))
    }
    if (es('POST', 'reservas/#/reservar-mesa')) {
      permitir('recepcion')
      const r = this.existe('reservas', id(1))
      const mesa = r.id_mesa ? this.bd.buscar('mesas', r.id_mesa as number) : undefined
      if (!VIGENTES.includes(r.estado as string) || !mesa) throw regla('La reserva debe estar vigente y tener una mesa asignada.')
      this.pasarMesa(mesa, 'reservada')
      if (r.estado === 'pendiente') this.bd.actualizar(r, { estado: 'confirmada' })
      return ok(this.jsonReserva(r))
    }
    if (es('POST', 'reservas/#/llegada')) {
      permitir('recepcion', 'mozo')
      const v = this.validar(d, { id_mesa: 'nullable|integer|exists:mesas' })
      return ok(this.jsonAtencion(this.registrarLlegada(this.existe('reservas', id(1)), yo, v.id_mesa as number | null)), 201)
    }
    if (es('POST', 'lista-espera')) {
      permitir('recepcion')
      return ok(this.bd.insertar('lista_espera', { ...this.validar(d, REGLAS_ESPERA), estado: 'esperando' }), 201)
    }
    if (es('PUT', 'lista-espera/#')) { permitir('recepcion'); const e = this.existe('lista_espera', id(1)); this.bd.actualizar(e, this.validar(d, REGLAS_ESPERA)); return ok(e) }
    if (es('DELETE', 'lista-espera/#')) { permitir('recepcion'); this.bd.actualizar(this.existe('lista_espera', id(1)), { estado: 'retirado' }); return ok({ message: 'Grupo retirado de la lista de espera.' }) }
    if (es('POST', 'lista-espera/#/asignar')) {
      permitir('recepcion', 'mozo')
      const e = this.existe('lista_espera', id(1))
      const v = this.validar(d, { id_mesa: 'required|integer|exists:mesas' })
      const mesa = this.existe('mesas', v.id_mesa as number)
      const a = this.abrirAtencion(mesa, Math.min(e.cantidad as number, mesa.capacidad as number), yo)
      this.bd.actualizar(e, { estado: 'asignado' })
      return ok(this.jsonAtencion(a), 201)
    }

    // ---- administración
    if (p[0] === 'categorias' || p[0] === 'productos' || p[0] === 'mesas' || p[0] === 'ingredientes' || p[0] === 'recetas' || p[0] === 'reportes' || p[0] === 'usuarios' || p[0] === 'roles') {
      permitir()
      if (es('POST', 'categorias')) return ok(this.guardarCategoria(d), 201)
      if (es('PUT', 'categorias/#')) return ok(this.guardarCategoria(d, this.existe('categorias', id(1))))
      if (es('DELETE', 'categorias/#')) {
        const c = this.existe('categorias', id(1))
        if (this.bd.t.productos.some((x) => x.id_categoria === c.id)) throw new ErrorHttp(409, `No se puede eliminar "${c.nombre}" porque tiene productos. Movelos a otra categoría primero.`)
        this.bd.eliminar('categorias', c.id)
        return ok({ message: 'Categoría eliminada.' })
      }
      if (es('POST', 'productos')) return ok(this.jsonProducto(this.guardarProducto(d)), 201)
      if (es('PUT', 'productos/#')) return ok(this.jsonProducto(this.guardarProducto(d, this.existe('productos', id(1)))))
      if (es('DELETE', 'productos/#')) {
        const pr = this.existe('productos', id(1))
        if (this.bd.t.detalles_comanda.some((x) => x.id_producto === pr.id)) throw new ErrorHttp(409, `"${pr.nombre}" figura en comandas anteriores y no se puede eliminar para no perder el historial. Podés marcarlo como no disponible.`)
        this.bd.eliminar('productos', pr.id)
        return ok({ message: 'Producto eliminado.' })
      }
      if (es('POST', 'mesas')) return ok(this.jsonMesa(this.guardarMesa(d)), 201)
      if (es('PUT', 'mesas/#')) return ok(this.jsonMesa(this.guardarMesa(d, this.existe('mesas', id(1)))))
      if (es('DELETE', 'mesas/#')) {
        const me = this.existe('mesas', id(1))
        if (MESA_CON_ATENCION.includes(me.estado as string)) throw new ErrorHttp(409, `${me.nombre} tiene una atención activa y no se puede eliminar.`)
        if (this.bd.t.atenciones_mesa.some((a) => a.id_mesa === me.id)) throw new ErrorHttp(409, `${me.nombre} tiene atenciones en el historial y no se puede eliminar.`)
        this.bd.eliminar('mesas', me.id)
        return ok({ message: 'Mesa eliminada.' })
      }
      if (es('GET', 'ingredientes')) return ok([...this.bd.t.ingredientes].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))).map((i) => this.jsonIngrediente(i)))
      if (es('POST', 'ingredientes')) return ok(this.guardarIngrediente(d), 201)
      if (es('PUT', 'ingredientes/#')) return ok(this.guardarIngrediente(d, this.existe('ingredientes', id(1))))
      if (es('GET', 'recetas')) return ok(this.recetas())
      if (es('GET', 'reportes/resumen')) return ok(this.reporte(q))
      if (es('GET', 'usuarios')) return ok([...this.bd.t.usuarios].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))).map((u) => this.jsonUsuario(u)))
      if (es('GET', 'roles')) return ok(this.bd.t.roles)
      if (es('POST', 'usuarios')) return ok(this.jsonUsuario(this.guardarUsuario(d, yo)), 201)
      if (es('PUT', 'usuarios/#')) return ok(this.jsonUsuario(this.guardarUsuario(d, yo, this.existe('usuarios', id(1)))))
      if (es('DELETE', 'usuarios/#')) {
        const u = this.existe('usuarios', id(1))
        if (u.id === yo.id) throw new ErrorHttp(422, 'No podés eliminar tu propio usuario.')
        if (this.bd.t.atenciones_mesa.some((a) => a.id_usuario === u.id) || this.bd.t.comandas.some((c) => c.id_usuario === u.id)) {
          throw new ErrorHttp(409, `${u.nombre} tiene atenciones o comandas en el historial. En lugar de eliminarlo, desactivalo.`)
        }
        this.bd.eliminar('usuarios', u.id)
        return ok({ message: 'Usuario eliminado.' })
      }
    }
    throw new ErrorHttp(404, 'La ruta solicitada no existe.')
  }

  // ============================================================ autenticación
  private login(d: Datos) {
    this.validar(d, { email: 'required|email', password: 'required|string' })
    const u = this.bd.t.usuarios.find((x) => x.email === String(d.email).trim().toLowerCase())
    if (!u || u.password !== d.password) throw new ErrorHttp(422, 'El correo o la contraseña no son correctos.')
    if (!u.activo) throw new ErrorHttp(403, 'El usuario está desactivado. Consultá con el administrador.')
    const token = Array.from(crypto.getRandomValues(new Uint8Array(30)), (b) => b.toString(16).padStart(2, '0')).join('')
    this.bd.actualizar(u, { api_token: token, token_expira: new Date(this.ahora().getTime() + HORAS_TOKEN * 3600000).toISOString() })
    return { token, usuario: this.jsonUsuario(u) }
  }

  private autenticar(token: string | null): Fila {
    const u = token ? this.bd.t.usuarios.find((x) => x.api_token === token) : undefined
    if (!u || !u.activo || (u.token_expira && new Date(u.token_expira as string) < this.ahora())) {
      throw new ErrorHttp(401, 'La sesión no es válida o venció. Ingresá nuevamente.')
    }
    return u
  }

  private rolDe(u: Fila) { return String(this.bd.buscar('roles', u.id_rol as number)?.nombre ?? 'sin perfil') }

  // ============================================================ utilidades
  private existe(tabla: Parameters<BaseLocal['buscar']>[0], id: number): Fila {
    const f = this.bd.buscar(tabla, id)
    if (!f) throw noExiste()
    return f
  }

  /** Fecha ISO 8601 con la zona horaria del dispositivo (igual que toIso8601String de Laravel). */
  private iso(fecha: Date | string | null | undefined): string | null {
    if (!fecha) return null
    const f = new Date(fecha)
    const off = -f.getTimezoneOffset()
    const dos = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0')
    return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}T${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}${off >= 0 ? '+' : '-'}${dos(off / 60)}:${dos(off % 60)}`
  }

  private validar(d: Datos, reglas: Record<string, string>, ignorar?: number): Datos {
    const errores: Record<string, string[]> = {}
    const salida: Datos = {}
    for (const [campo, def] of Object.entries(reglas)) {
      const lista = def.split('|')
      const attr = ATRIBUTOS[campo] ?? campo
      let v = d[campo]
      const err = (msg: string) => { (errores[campo] ??= []).push(msg) }
      if (vacio(v)) {
        if (lista.includes('required')) err(`El campo ${attr} es obligatorio.`)
        else if (campo in d) salida[campo] = null
        continue
      }
      const numerico = lista.some((r) => ['integer', 'numeric'].includes(r))
      for (const r of lista) {
        const [nombre, arg] = r.split(':')
        if (nombre === 'integer' && !(esNumero(v) && Number.isInteger(Number(v)))) err(`El campo ${attr} debe ser un número entero.`)
        if (nombre === 'numeric' && !esNumero(v)) err(`El campo ${attr} debe ser un número.`)
        if (nombre === 'boolean' && ![true, false, 0, 1, '0', '1'].includes(v as never)) err(`El campo ${attr} debe ser verdadero o falso.`)
        if (nombre === 'string' && typeof v !== 'string') err(`El campo ${attr} debe ser un texto.`)
        if (nombre === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) err(`El campo ${attr} debe ser un correo electrónico válido.`)
        if (nombre === 'date' && Number.isNaN(new Date(String(v)).getTime())) err(`El campo ${attr} no es una fecha válida.`)
        if (nombre === 'in' && !arg.split(',').includes(String(v))) err(`El valor seleccionado en ${attr} no es válido.`)
        if (nombre === 'min') {
          if (numerico ? Number(v) < Number(arg) : String(v).length < Number(arg)) err(numerico ? `El campo ${attr} debe ser al menos ${arg}.` : `El campo ${attr} debe tener al menos ${arg} caracteres.`)
        }
        if (nombre === 'max') {
          if (numerico ? Number(v) > Number(arg) : String(v).length > Number(arg)) err(numerico ? `El campo ${attr} no puede ser mayor que ${arg}.` : `El campo ${attr} no puede tener más de ${arg} caracteres.`)
        }
        if (nombre === 'gt' && !(Number(v) > Number(arg))) err(`El campo ${attr} debe ser mayor que ${arg}.`)
        if (nombre === 'exists' && !this.bd.buscar(arg as never, Number(v))) err(`El valor seleccionado en ${attr} no existe.`)
        if (nombre === 'unique') {
          const valor = String(v).trim().toLowerCase()
          if ((this.bd.t[arg as 'productos'] as Fila[]).some((f) => f.id !== ignorar && String(f[campo]).trim().toLowerCase() === valor)) err(`Ya existe un registro con ese ${attr}.`)
        }
      }
      if (numerico) v = Number(v)
      if (lista.includes('boolean')) v = v === true || v === 1 || v === '1'
      if (typeof v === 'string') v = v.trim()
      salida[campo] = v
    }
    const campos = Object.keys(errores)
    if (campos.length) {
      const total = Object.values(errores).flat().length
      const primero = errores[campos[0]][0]
      const resto = total - 1
      throw new ErrorHttp(422, resto ? `${primero} (y ${resto} ${resto === 1 ? 'error' : 'errores'} más)` : primero, { errors: errores })
    }
    return salida
  }

  // ============================================================ formato JSON (igual a App\Http\Presentadores\Json)
  private jsonUsuario(u: Fila) {
    return { id: u.id, nombre: u.nombre, email: u.email, rol: this.rolDe(u), id_rol: u.id_rol, activo: !!u.activo }
  }

  private jsonProducto(p: Fila) {
    return {
      id: p.id, nombre: p.nombre, descripcion: p.descripcion ?? null, precio: p.precio, disponible: !!p.disponible, plato_del_dia: !!p.plato_del_dia,
      emoji: p.emoji ?? null, id_categoria: p.id_categoria, categoria: this.bd.buscar('categorias', p.id_categoria as number)?.nombre ?? null,
    }
  }

  private minutos(a: Fila) {
    const fin = a.fin ? new Date(a.fin as string) : this.ahora()
    return Math.max(0, Math.floor((fin.getTime() - new Date(a.inicio as string).getTime()) / 60000))
  }
  private detallesDe(c: Fila) { return this.bd.t.detalles_comanda.filter((d) => d.id_comanda === c.id) }
  private totalComanda(c: Fila) { return Math.round(this.detallesDe(c).reduce((s, d) => s + (d.cantidad as number) * (d.precio_unitario as number), 0) * 100) / 100 }
  private comandasDe(a: Fila) { return this.bd.t.comandas.filter((c) => c.id_atencion === a.id).sort((x, y) => x.id - y.id) }
  private totalAtencion(a: Fila) { return Math.round(this.comandasDe(a).filter((c) => c.estado !== 'cancelada').reduce((s, c) => s + this.totalComanda(c), 0) * 100) / 100 }
  private atencionActiva(mesa: Fila) { return this.bd.t.atenciones_mesa.find((a) => a.id_mesa === mesa.id && a.estado === 'activa') }
  private mesaDe(a: Fila) { return this.existe('mesas', a.id_mesa as number) }
  private nombreUsuario(id: unknown) { return id ? (this.bd.buscar('usuarios', id as number)?.nombre as string) ?? null : null }

  private jsonMesa(m: Fila) {
    const a = this.atencionActiva(m)
    return {
      id: m.id, numero: m.numero, nombre: m.nombre, capacidad: m.capacidad, forma: m.forma, pos_x: m.pos_x, pos_y: m.pos_y,
      estado: m.estado, estado_etiqueta: MESA_ETIQUETA[m.estado as string],
      atencion: a ? { id: a.id, inicio: this.iso(a.inicio as string), minutos: this.minutos(a), comensales: a.comensales, mozo: this.nombreUsuario(a.id_usuario), total: this.totalAtencion(a) } : null,
    }
  }

  private jsonAtencion(a: Fila) {
    const mesa = this.mesaDe(a)
    const reserva = a.id_reserva ? this.bd.buscar('reservas', a.id_reserva as number) : undefined
    return {
      id: a.id, estado: a.estado, comensales: a.comensales, inicio: this.iso(a.inicio as string), fin: this.iso(a.fin as string | null),
      minutos: this.minutos(a), total: this.totalAtencion(a),
      mesa: { id: mesa.id, nombre: mesa.nombre, estado: mesa.estado, capacidad: mesa.capacidad },
      mozo: this.nombreUsuario(a.id_usuario),
      reserva: reserva ? { id: reserva.id, cliente: this.bd.buscar('clientes', reserva.id_cliente as number)?.nombre ?? null } : null,
      comandas: this.comandasDe(a).map((c) => this.jsonComanda(c, false)),
      pagos: this.bd.t.pagos.filter((p) => p.id_atencion === a.id).map((p) => ({ id: p.id, monto: p.monto, medio: this.bd.buscar('medios_pago', p.id_medio_pago as number)?.nombre ?? null, fecha: this.iso(p.created_at as string) })),
    }
  }

  private jsonComanda(c: Fila, conMesa = true) {
    const datos: Record<string, unknown> = {
      id: c.id, codigo: `C-${String(c.id).padStart(3, '0')}`, estado: c.estado, estado_etiqueta: COMANDA_ETIQUETA[c.estado as string],
      fecha_hora: this.iso(c.fecha_hora as string), observaciones: c.observaciones ?? null, mozo: this.nombreUsuario(c.id_usuario),
      total: this.totalComanda(c), id_atencion: c.id_atencion,
      items: this.detallesDe(c).map((d) => ({
        id_producto: d.id_producto, producto: this.bd.buscar('productos', d.id_producto as number)?.nombre ?? null, cantidad: d.cantidad,
        precio_unitario: d.precio_unitario, subtotal: Math.round((d.cantidad as number) * (d.precio_unitario as number) * 100) / 100, observaciones: d.observaciones ?? null,
      })),
    }
    if (conMesa) {
      const a = this.bd.buscar('atenciones_mesa', c.id_atencion as number)
      datos.mesa = a ? this.bd.buscar('mesas', a.id_mesa as number)?.nombre ?? null : null
    }
    return datos
  }

  private jsonReserva(r: Fila) {
    const cliente = this.bd.buscar('clientes', r.id_cliente as number)!
    const mesa = r.id_mesa ? this.bd.buscar('mesas', r.id_mesa as number) : undefined
    return {
      id: r.id, fecha_hora: (this.iso(r.fecha_hora as string) ?? '').slice(0, 16), cantidad: r.cantidad, estado: r.estado, observaciones: r.observaciones ?? null,
      cliente: { id: cliente.id, nombre: cliente.nombre, telefono: cliente.telefono ?? null },
      mesa: mesa ? { id: mesa.id, nombre: mesa.nombre, estado: mesa.estado } : null,
    }
  }

  private jsonIngrediente(i: Fila) { return { ...i, bajo_minimo: (i.stock_actual as number) <= (i.stock_minimo as number) } }

  // ============================================================ consultas
  private categorias() {
    return [...this.bd.t.categorias]
      .sort((a, b) => (a.orden as number) - (b.orden as number) || String(a.nombre).localeCompare(String(b.nombre)))
      .map((c) => ({ ...c, productos_count: this.bd.t.productos.filter((p) => p.id_categoria === c.id).length }))
  }

  private productos(q: Record<string, string>) {
    return this.bd.t.productos
      .filter((p) => !['1', 'true'].includes(q.solo_disponibles ?? '') || p.disponible)
      .sort((a, b) => (a.id_categoria as number) - (b.id_categoria as number) || String(a.nombre).localeCompare(String(b.nombre)))
      .map((p) => this.jsonProducto(p))
  }

  private comandas(q: Record<string, string>) {
    const estados = q.estados ? q.estados.split(',') : ['pendiente_cocina', 'en_preparacion', 'lista']
    return this.bd.t.comandas.filter((c) => estados.includes(c.estado as string)).sort((a, b) => String(a.fecha_hora).localeCompare(String(b.fecha_hora))).map((c) => this.jsonComanda(c))
  }

  private reservas(q: Record<string, string>) {
    const dia = (f: string) => (this.iso(f) ?? '').slice(0, 10)
    return this.bd.t.reservas
      .filter((r) => !q.fecha || dia(r.fecha_hora as string) === q.fecha.slice(0, 10))
      .filter((r) => !q.desde || dia(r.fecha_hora as string) >= q.desde.slice(0, 10))
      .filter((r) => !q.hasta || dia(r.fecha_hora as string) <= q.hasta.slice(0, 10))
      .sort((a, b) => String(a.fecha_hora).localeCompare(String(b.fecha_hora)))
      .map((r) => this.jsonReserva(r))
  }

  private recetas() {
    return this.bd.t.recetas.map((r) => ({
      id: r.id, producto: this.bd.buscar('productos', r.id_producto as number)?.nombre,
      ingredientes: this.bd.t.receta_ingrediente.filter((x) => x.id_receta === r.id).map((x) => {
        const i = this.bd.buscar('ingredientes', x.id_ingrediente)!
        return { nombre: i.nombre, cantidad: x.cantidad, unidad: i.unidad }
      }),
    }))
  }

  private reporte(q: Record<string, string>) {
    const dias = Math.max(1, Math.min(365, Number(q.dias ?? 30) || 30))
    const desde = new Date(this.ahora()); desde.setDate(desde.getDate() - dias); desde.setHours(0, 0, 0, 0)
    const enRango = (f: unknown) => !!f && new Date(f as string) >= desde
    const platos = new Map<number, { nombre: string; cantidad: number; importe: number }>()
    for (const c of this.bd.t.comandas.filter((c) => !['cancelada', 'borrador'].includes(c.estado as string) && enRango(c.fecha_hora))) {
      for (const d of this.detallesDe(c)) {
        const p = this.bd.buscar('productos', d.id_producto as number)
        const fila = platos.get(d.id_producto as number) ?? { nombre: String(p?.nombre ?? ''), cantidad: 0, importe: 0 }
        fila.cantidad += d.cantidad as number
        fila.importe += (d.cantidad as number) * (d.precio_unitario as number)
        platos.set(d.id_producto as number, fila)
      }
    }
    const pagos = this.bd.t.pagos.filter((p) => enRango(p.created_at))
    const medios = new Map<string, { nombre: string; cantidad: number; importe: number }>()
    for (const p of pagos) {
      const nombre = String(this.bd.buscar('medios_pago', p.id_medio_pago as number)?.nombre ?? '')
      const fila = medios.get(nombre) ?? { nombre, cantidad: 0, importe: 0 }
      fila.cantidad += 1
      fila.importe += p.monto as number
      medios.set(nombre, fila)
    }
    const cerradas = this.bd.t.atenciones_mesa.filter((a) => a.estado === 'cerrada' && enRango(a.fin))
    const facturacion = pagos.reduce((s, p) => s + (p.monto as number), 0)
    return {
      dias,
      atenciones_cerradas: cerradas.length,
      facturacion: Math.round(facturacion * 100) / 100,
      ticket_promedio: cerradas.length && pagos.length ? Math.round((facturacion / pagos.length) * 100) / 100 : 0,
      minutos_promedio: cerradas.length ? Math.round(cerradas.reduce((s, a) => s + this.minutos(a), 0) / cerradas.length) : 0,
      platos_mas_vendidos: [...platos.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 8),
      medios_de_pago: [...medios.values()],
    }
  }

  // ============================================================ reglas de negocio (AtencionService / ComandaService / ReservaService)
  private pasarMesa(mesa: Fila, destino: string) {
    if (!MESA_SIGUIENTES[mesa.estado as string]?.includes(destino)) {
      throw regla(`${mesa.nombre} está ${MESA_ETIQUETA[mesa.estado as string]} y no puede pasar a ${MESA_ETIQUETA[destino]}.`, 'estado-mesa')
    }
    this.bd.actualizar(mesa, { estado: destino })
  }

  private pasarComanda(c: Fila, destino: string) {
    const valido = destino === 'cancelada' ? c.estado === 'borrador' : COMANDA_SIGUIENTE[c.estado as string] === destino
    if (!valido) throw regla(`La comanda C-${String(c.id).padStart(3, '0')} está ${COMANDA_ETIQUETA[c.estado as string]} y no puede pasar a ${COMANDA_ETIQUETA[destino]}.`, 'estado-comanda')
    this.bd.actualizar(c, { estado: destino })
  }

  private avanzarComanda(c: Fila) {
    const siguiente = COMANDA_SIGUIENTE[c.estado as string]
    if (!siguiente || c.estado === 'borrador' || c.estado === 'enviada') {
      throw regla(`La comanda C-${String(c.id).padStart(3, '0')} no puede avanzar desde ${COMANDA_ETIQUETA[c.estado as string]}.`, 'estado-comanda')
    }
    this.pasarComanda(c, siguiente)
    return c
  }

  private activa(idAtencion: number) {
    const a = this.existe('atenciones_mesa', idAtencion)
    if (a.estado !== 'activa') throw regla('La atención ya fue cerrada.')
    return a
  }

  /** RN-01 y RN-02: abre la atención y ocupa la mesa. */
  private abrirAtencion(mesa: Fila, comensales: number, mozo: Fila | null, reserva?: Fila) {
    if (MESA_CON_ATENCION.includes(mesa.estado as string)) throw regla(`${mesa.nombre} ya tiene una atención activa.`, 'RN-01')
    if (comensales < 1 || comensales > (mesa.capacidad as number)) throw regla(`${mesa.nombre} admite entre 1 y ${mesa.capacidad} personas.`)
    if (!reserva && mesa.estado === 'reservada') {
      reserva = this.bd.t.reservas.filter((r) => r.id_mesa === mesa.id && VIGENTES.includes(r.estado as string)).sort((a, b) => String(a.fecha_hora).localeCompare(String(b.fecha_hora)))[0]
    }
    this.pasarMesa(mesa, 'ocupada')
    const a = this.bd.insertar('atenciones_mesa', { id_mesa: mesa.id, id_usuario: mozo?.id ?? null, id_reserva: reserva?.id ?? null, comensales, inicio: this.ahora().toISOString(), fin: null, estado: 'activa' })
    if (reserva) this.bd.actualizar(reserva, { estado: 'cumplida', id_mesa: mesa.id })
    return a
  }

  /** RN-03, RN-04 y RN-05. */
  private crearComanda(d: Datos, mozo: Fila) {
    const v = this.validar(d, { id_atencion: 'required|integer|exists:atenciones_mesa', items: 'required', observaciones: 'nullable|string|max:200' })
    const items = Array.isArray(d.items) ? (d.items as Datos[]) : []
    const errores: Record<string, string[]> = {}
    items.forEach((it, i) => {
      if (!this.bd.buscar('productos', Number(it.id_producto))) errores[`items.${i}.id_producto`] = ['El valor seleccionado en producto no existe.']
      const n = Number(it.cantidad)
      if (!Number.isInteger(n) || n < 1 || n > 99) errores[`items.${i}.cantidad`] = ['El campo cantidad debe ser al menos 1.']
    })
    if (Object.keys(errores).length) throw new ErrorHttp(422, Object.values(errores)[0][0], { errors: errores })
    const a = this.existe('atenciones_mesa', v.id_atencion as number)
    const mesa = this.mesaDe(a)
    if (a.estado !== 'activa') throw regla('No se puede tomar un pedido en una atención cerrada.', 'RN-04')
    if (mesa.estado !== 'ocupada') throw regla(`${mesa.nombre} ya solicitó la cuenta; no admite pedidos nuevos.`)
    if (!items.length) throw regla('El pedido no tiene productos.')
    for (const it of items) {
      const p = this.bd.buscar('productos', Number(it.id_producto))!
      if (!p.disponible) throw regla(`${p.nombre} no está disponible y no puede agregarse al pedido.`, 'RN-03')
    }
    const c = this.bd.insertar('comandas', { id_atencion: a.id, id_usuario: mozo.id, fecha_hora: this.ahora().toISOString(), estado: 'borrador', observaciones: v.observaciones ?? null })
    for (const it of items) {
      const p = this.bd.buscar('productos', Number(it.id_producto))!
      this.bd.insertar('detalles_comanda', { id_comanda: c.id, id_producto: p.id, cantidad: Number(it.cantidad), precio_unitario: p.precio, observaciones: it.observaciones ?? null })
    }
    if (d.enviar !== false) { this.pasarComanda(c, 'enviada'); this.pasarComanda(c, 'pendiente_cocina') }
    return c
  }

  /** RN-08: registra el pago, cierra la atención y libera la mesa. */
  private pagar(a: Fila, d: Datos) {
    const v = this.validar(d, { id_medio_pago: 'required|integer|exists:medios_pago', monto: 'required|numeric|gt:0' })
    if (a.estado !== 'activa') throw regla('La atención ya fue cerrada.')
    const total = this.totalAtencion(a)
    if (total <= 0) throw regla('La atención no tiene consumos para cobrar.')
    if (Math.round((v.monto as number) * 100) / 100 < total) {
      throw regla(`El monto ingresado es menor al total de la cuenta ($ ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`)
    }
    this.pasarMesa(this.mesaDe(a), 'disponible')
    this.bd.insertar('pagos', { id_atencion: a.id, id_medio_pago: v.id_medio_pago, monto: total, estado: 'confirmado' })
    this.bd.actualizar(a, { estado: 'cerrada', fin: this.ahora().toISOString() })
    return a
  }

  private validarReserva(d: Datos, edicion: boolean) {
    return this.validar(d, {
      nombre: 'required|string|max:80', telefono: 'nullable|string|max:30', fecha_hora: 'required|date', cantidad: 'required|integer|min:1|max:30',
      id_mesa: 'nullable|integer|exists:mesas', estado: `nullable|in:${edicion ? 'pendiente,confirmada,cumplida,cancelada' : 'pendiente,confirmada'}`, observaciones: 'nullable|string|max:200',
    })
  }

  private reglasReserva(d: Datos, actual?: Fila) {
    const fecha = new Date(String(d.fecha_hora))
    if (!actual && fecha.getTime() < this.ahora().getTime() - 5 * 60000) throw regla('No se puede registrar una reserva en una fecha u hora pasada.')
    if (d.id_mesa) {
      const mesa = this.existe('mesas', d.id_mesa as number)
      if ((d.cantidad as number) > (mesa.capacidad as number)) throw regla(`${mesa.nombre} tiene capacidad para ${mesa.capacidad} personas.`)
      const margen = (DURACION_RESERVA_MIN - 1) * 60000
      const choca = this.bd.t.reservas.find((r) => r.id_mesa === mesa.id && VIGENTES.includes(r.estado as string) && r.id !== actual?.id
        && Math.abs(new Date(r.fecha_hora as string).getTime() - fecha.getTime()) <= margen)
      if (choca) {
        const hora = (this.iso(choca.fecha_hora as string) ?? '').slice(11, 16)
        throw regla(`${mesa.nombre} ya está reservada a las ${hora} (${this.bd.buscar('clientes', choca.id_cliente as number)?.nombre}).`)
      }
    }
    const nombre = String(d.nombre).trim().toLowerCase()
    const duplicada = this.bd.t.reservas.some((r) => VIGENTES.includes(r.estado as string) && r.id !== actual?.id
      && new Date(r.fecha_hora as string).getTime() === fecha.getTime()
      && String(this.bd.buscar('clientes', r.id_cliente as number)?.nombre ?? '').toLowerCase() === nombre)
    if (duplicada) throw regla(`Ya existe una reserva a nombre de ${d.nombre} para ese día y horario.`)
  }

  private crearReserva(d: Datos) {
    this.reglasReserva(d)
    const nombre = String(d.nombre).trim()
    const telefono = (d.telefono as string | null) ?? null
    const cliente = this.bd.t.clientes.find((c) => c.nombre === nombre && (c.telefono ?? null) === telefono) ?? this.bd.insertar('clientes', { nombre, telefono })
    return this.bd.insertar('reservas', {
      id_cliente: cliente.id, id_mesa: d.id_mesa ?? null, fecha_hora: new Date(String(d.fecha_hora)).toISOString(), cantidad: d.cantidad,
      estado: d.estado ?? 'pendiente', observaciones: d.observaciones ?? null,
    })
  }

  private actualizarReserva(r: Fila, d: Datos) {
    if (!VIGENTES.includes(r.estado as string)) throw regla('Sólo se pueden modificar reservas pendientes o confirmadas.')
    const cliente = this.existe('clientes', r.id_cliente as number)
    if (vacio(d.nombre)) d.nombre = cliente.nombre
    this.reglasReserva(d, r)
    this.bd.actualizar(cliente, { nombre: String(d.nombre).trim(), telefono: d.telefono ?? cliente.telefono })
    const nuevoEstado = (d.estado as string | null) ?? r.estado
    if ((d.id_mesa ?? null) !== (r.id_mesa ?? null) || nuevoEstado === 'cancelada') this.liberarMesaReservada(r)
    this.bd.actualizar(r, {
      id_mesa: d.id_mesa ?? null, fecha_hora: new Date(String(d.fecha_hora)).toISOString(), cantidad: d.cantidad, estado: nuevoEstado, observaciones: d.observaciones ?? r.observaciones,
    })
    return r
  }

  private registrarLlegada(r: Fila, usuario: Fila, idMesa: number | null) {
    if (!VIGENTES.includes(r.estado as string)) throw regla('La reserva no está vigente.')
    const mesa = idMesa ? this.existe('mesas', idMesa) : r.id_mesa ? this.bd.buscar('mesas', r.id_mesa as number) : undefined
    if (!mesa) throw regla('Indicá en qué mesa se ubica el grupo.')
    if (r.id_mesa && r.id_mesa !== mesa.id) this.liberarMesaReservada(r)
    return this.abrirAtencion(mesa, Math.min(r.cantidad as number, mesa.capacidad as number), usuario, r)
  }

  private liberarMesaReservada(r: Fila) {
    const mesa = r.id_mesa ? this.bd.buscar('mesas', r.id_mesa as number) : undefined
    if (mesa && mesa.estado === 'reservada' && VIGENTES.includes(r.estado as string)) this.pasarMesa(mesa, 'disponible')
  }

  // ============================================================ administración
  private guardarCategoria(d: Datos, c?: Fila) {
    const v = this.validar(d, { nombre: 'required|string|max:60|unique:categorias', orden: 'nullable|integer|min:0' }, c?.id)
    if (c) { this.bd.actualizar(c, { nombre: v.nombre, orden: v.orden ?? c.orden }); return c }
    return this.bd.insertar('categorias', { nombre: v.nombre, orden: v.orden ?? 0 })
  }

  private guardarProducto(d: Datos, p?: Fila) {
    const v = this.validar(d, {
      nombre: 'required|string|max:80|unique:productos', id_categoria: 'required|integer|exists:categorias', descripcion: 'nullable|string|max:200',
      precio: 'required|numeric|gt:0|max:99999999', disponible: 'boolean', plato_del_dia: 'boolean', emoji: 'nullable|string|max:8',
    }, p?.id)
    if (p) { this.bd.actualizar(p, v); return p }
    return this.bd.insertar('productos', { descripcion: null, emoji: null, disponible: true, plato_del_dia: false, ...v })
  }

  private guardarMesa(d: Datos, m?: Fila) {
    const v = this.validar(d, {
      numero: 'required|integer|min:1|unique:mesas', nombre: 'required|string|max:40', capacidad: 'required|integer|min:1|max:30',
      forma: 'nullable|in:round,rect', pos_x: 'nullable|integer|min:0|max:100', pos_y: 'nullable|integer|min:0|max:100',
    }, m?.id)
    const datos = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null))
    if (m) {
      const a = this.atencionActiva(m)
      if (a && (datos.capacidad as number) < (a.comensales as number)) throw new ErrorHttp(422, 'La mesa está ocupada por más personas que la nueva capacidad.')
      this.bd.actualizar(m, datos)
      return m
    }
    return this.bd.insertar('mesas', { forma: 'round', pos_x: 10, pos_y: 10, ...datos, estado: 'disponible' })
  }

  private guardarIngrediente(d: Datos, i?: Fila) {
    const v = this.validar(d, { nombre: 'required|string|max:80|unique:ingredientes', unidad: 'required|string|max:15', stock_actual: 'required|numeric|min:0', stock_minimo: 'required|numeric|min:0' }, i?.id)
    const anterior = (i?.stock_actual as number) ?? 0
    if (i) this.bd.actualizar(i, v)
    else i = this.bd.insertar('ingredientes', v)
    if ((v.stock_actual as number) !== anterior) {
      this.bd.insertar('movimientos_stock', { id_ingrediente: i.id, tipo: 'ajuste', cantidad: (v.stock_actual as number) - anterior, fecha_hora: this.ahora().toISOString() })
    }
    return this.jsonIngrediente(i)
  }

  private guardarUsuario(d: Datos, yo: Fila, u?: Fila) {
    const v = this.validar({ ...d, email: String(d.email ?? '').trim().toLowerCase() }, {
      nombre: 'required|string|max:80', email: 'required|email|max:120|unique:usuarios', id_rol: 'required|integer|exists:roles',
      password: `${u ? 'nullable' : 'required'}|string|min:8|max:72`, activo: 'boolean',
    }, u?.id)
    if (u) {
      if (u.id === yo.id && (v.activo === false || v.id_rol !== u.id_rol)) throw new ErrorHttp(422, 'No podés desactivarte ni cambiar tu propio rol.')
      if (vacio(v.password)) delete v.password
      this.bd.actualizar(u, v)
      if (!u.activo) this.bd.actualizar(u, { api_token: null, token_expira: null })
      return u
    }
    return this.bd.insertar('usuarios', { activo: true, api_token: null, token_expira: null, ...v, ...(v.activo === undefined ? { activo: true } : {}) })
  }
}

const REGLAS_ESPERA = { nombre: 'required|string|max:80', telefono: 'nullable|string|max:30', cantidad: 'required|integer|min:1|max:30' }

let instancia: ServidorLocal | null = null
/** Servicio local único de la app (se crea al primer uso con los datos guardados en la tablet). */
export function servidorLocal(): ServidorLocal {
  if (!instancia) {
    let almacen: Storage | null = null
    try { almacen = window.localStorage } catch { /* sin almacenamiento */ }
    instancia = new ServidorLocal(new BaseLocal(almacen))
  }
  return instancia
}
