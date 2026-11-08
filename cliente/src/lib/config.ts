export interface ConfigCliente { modo: 'prueba' | 'produccion'; apiUrl: string }

/** Valor usado si no existe public/config.json (por ejemplo, al abrir con "npm run dev" sin el script de inicio). */
export const CONFIG_POR_DEFECTO: ConfigCliente = { modo: 'prueba', apiUrl: 'http://127.0.0.1:8000/api' }

/** Lee la configuración que escribe iniciar.mjs según el modo (prueba / producción). */
export async function cargarConfig(): Promise<ConfigCliente> {
  try {
    const r = await fetch('/config.json', { cache: 'no-store' })
    if (!r.ok) return CONFIG_POR_DEFECTO
    const datos = (await r.json()) as Partial<ConfigCliente>
    return {
      modo: datos.modo === 'produccion' ? 'produccion' : 'prueba',
      apiUrl: (datos.apiUrl || CONFIG_POR_DEFECTO.apiUrl).replace(/\/+$/, ''),
    }
  } catch {
    return CONFIG_POR_DEFECTO
  }
}
