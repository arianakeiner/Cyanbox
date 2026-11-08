export type Rol = 'admin' | 'mozo' | 'cocina' | 'caja' | 'recepcion'

export interface Usuario { id: number; nombre: string; email: string; rol: Rol; activo: boolean }

export type EstadoMesa = 'disponible' | 'reservada' | 'ocupada' | 'solicita_cuenta' | 'pendiente_pago'
export type EstadoComanda = 'borrador' | 'enviada' | 'pendiente_cocina' | 'en_preparacion' | 'lista' | 'entregada' | 'cancelada'

export interface Mesa {
  id: number; numero: number; nombre: string; capacidad: number; forma: 'round' | 'rect'
  pos_x: number; pos_y: number; estado: EstadoMesa; estado_etiqueta: string
  atencion: { id: number; inicio: string; minutos: number; comensales: number; mozo: string | null; total: number } | null
}

export interface Categoria { id: number; nombre: string; orden: number; productos_count?: number }

export interface Producto {
  id: number; nombre: string; descripcion: string | null; precio: number; disponible: boolean
  plato_del_dia: boolean; emoji: string | null; id_categoria: number; categoria: string
}

export interface ItemComanda { id_producto: number; producto: string; cantidad: number; precio_unitario: number; subtotal: number; observaciones: string | null }

export interface Comanda {
  id: number; codigo: string; estado: EstadoComanda; estado_etiqueta: string; fecha_hora: string
  observaciones: string | null; mozo: string | null; total: number; id_atencion: number; items: ItemComanda[]; mesa?: string
}

export interface Atencion {
  id: number; estado: 'activa' | 'cerrada'; comensales: number; inicio: string; fin: string | null
  minutos: number; total: number; mozo: string | null
  mesa: { id: number; nombre: string; estado: EstadoMesa; capacidad: number }
  reserva: { id: number; cliente: string } | null
  comandas: Comanda[]; pagos: { id: number; monto: number; medio: string; fecha: string }[]
}

export interface Reserva {
  id: number; fecha_hora: string; cantidad: number; estado: 'pendiente' | 'confirmada' | 'cumplida' | 'cancelada'
  observaciones: string | null
  cliente: { id: number; nombre: string; telefono: string | null }
  mesa: { id: number; nombre: string; estado: EstadoMesa } | null
}

export interface Espera { id: number; nombre: string; telefono: string | null; cantidad: number; estado: string; created_at: string }
export interface MedioPago { id: number; nombre: string }
export interface Ingrediente { id: number; nombre: string; unidad: string; stock_actual: number; stock_minimo: number; bajo_minimo: boolean }
