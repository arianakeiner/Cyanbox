#!/usr/bin/env node
/**
 * CYANBOX · Arranque del servicio cliente (aplicación web).
 *
 * Uso:
 *   node iniciar.mjs              → usa el modo guardado en .env (la primera vez lo pregunta)
 *   node iniciar.mjs prueba       → todo en este equipo: consume la API de http://127.0.0.1:8000/api
 *   node iniciar.mjs produccion   → consume la API indicada en PROD_API_URL del .env
 *   node iniciar.mjs ... --sin-verificar   → no comprueba que el servicio de persistencia esté encendido
 *
 * El servicio de persistencia debe iniciarse ANTES que este.
 */
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { networkInterfaces } from 'node:os'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const RAIZ = dirname(fileURLToPath(import.meta.url))
const ENV = join(RAIZ, '.env')
const esWindows = process.platform === 'win32'
const npm = esWindows ? 'npm.cmd' : 'npm'

const decir = (t = '') => console.log(t)
const salirConError = (t) => {
  console.error(`\n  ✖ ${t}\n`)
  process.exit(1)
}

export function normalizarModo(valor) {
  const v = String(valor ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (['prueba', 'pruebas', 'test', 'testing', 'p', 'local', 'demo'].includes(v)) return 'prueba'
  if (['produccion', 'prod', 'production'].includes(v)) return 'produccion'
  return null
}

export function leerEnv(texto) {
  const datos = {}
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) datos[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return datos
}

function guardarEnEnv(clave, valor) {
  let texto = readFileSync(ENV, 'utf8')
  const re = new RegExp(`^${clave}=.*$`, 'm')
  texto = re.test(texto) ? texto.replace(re, `${clave}=${valor}`) : `${texto.trimEnd()}\n${clave}=${valor}\n`
  writeFileSync(ENV, texto)
}

/** Configuración efectiva según el modo. En prueba no se lee ninguna variable: todo apunta a este equipo. */
export function resolverConfig(modo, vars) {
  if (modo === 'prueba') {
    // "auto": la app usa la API del mismo equipo que la publica (sirve en esta computadora y en una tablet de la red).
    return { modo, apiUrl: 'auto', host: '0.0.0.0', puerto: 5173 }
  }
  const faltan = ['PROD_API_URL'].filter((k) => !vars[k])
  if (faltan.length) {
    throw new Error(`Faltan datos de producción en .env: ${faltan.join(', ')}.`)
  }
  return {
    modo,
    apiUrl: vars.PROD_API_URL.replace(/\/+$/, ''),
    host: vars.PROD_CLIENTE_HOST || '0.0.0.0',
    puerto: Number(vars.PROD_CLIENTE_PUERTO || 5173),
  }
}

/** Direcciones IPv4 de este equipo en la red local (para abrir la app desde una tablet). */
function direccionesRed() {
  return Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address)
}

async function verificarServidor(apiUrl) {
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await fetch(`${apiUrl}/estado`, { signal: AbortSignal.timeout(4000) })
      const datos = await r.json()
      if (r.ok) return datos
      return { error: `respondió con estado ${r.status} (base de datos: ${datos?.base_de_datos?.estado ?? 'desconocida'})` }
    } catch {
      if (intento < 3) await new Promise((ok) => setTimeout(ok, 1500))
    }
  }
  return { error: 'no responde' }
}

async function main() {
  decir()
  decir('  ┌──────────────────────────────────────────────┐')
  decir('  │  CYANBOX · Servicio cliente (aplicación web)  │')
  decir('  └──────────────────────────────────────────────┘')

  const [mayor] = process.versions.node.split('.').map(Number)
  if (mayor < 20) salirConError(`Se necesita Node.js 20 o superior (versión actual: ${process.versions.node}).`)

  if (!existsSync(join(RAIZ, 'node_modules'))) {
    decir('  • Instalando dependencias (npm install)... sólo la primera vez.')
    const r = spawnSync(npm, ['install', '--no-audit', '--no-fund'], { cwd: RAIZ, stdio: 'inherit', shell: esWindows })
    if (r.status !== 0) salirConError('No se pudieron instalar las dependencias. Verificá la conexión a Internet.')
  }

  if (!existsSync(ENV)) {
    copyFileSync(join(RAIZ, '.env.example'), ENV)
    decir('  • Se creó el archivo .env a partir de .env.example')
  }

  const args = process.argv.slice(2)
  const sinVerificar = args.includes('--sin-verificar')
  const modoArg = args.find((a) => !a.startsWith('--'))
  if (modoArg && !normalizarModo(modoArg)) salirConError(`Modo "${modoArg}" no reconocido. Usá "prueba" o "produccion".`)

  let modo = normalizarModo(modoArg) ?? normalizarModo(leerEnv(readFileSync(ENV, 'utf8')).CYANBOX_MODO)
  if (!modo) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    while (!modo) {
      decir()
      decir('  ¿En qué modo querés iniciar?')
      decir('    prueba      → usa el servicio de persistencia de este equipo. No hay que configurar nada.')
      decir('    produccion  → usa el servicio remoto indicado en PROD_API_URL del archivo .env')
      modo = normalizarModo((await rl.question('  Modo [prueba]: ')) || 'prueba')
    }
    rl.close()
  }
  guardarEnEnv('CYANBOX_MODO', modo)
  decir(`  • Modo: ${modo.toUpperCase()} (guardado en .env)`)

  let config
  try {
    // Las variables de entorno del sistema (por ejemplo, las de Docker) tienen prioridad sobre el .env
    config = resolverConfig(modo, { ...leerEnv(readFileSync(ENV, 'utf8')), ...Object.fromEntries(Object.entries(process.env).filter(([k, v]) => k.startsWith('PROD_') && v)) })
  } catch (e) {
    salirConError(`${e.message}\n    Completalos y volvé a ejecutar, o iniciá en modo prueba: node iniciar.mjs prueba`)
  }

  // La aplicación lee esta configuración al abrirse (no hace falta recompilar al cambiar de servidor).
  writeFileSync(join(RAIZ, 'public', 'config.json'), JSON.stringify({ modo: config.modo, apiUrl: config.apiUrl }, null, 2))

  if (!sinVerificar) {
    const apiLocal = config.apiUrl === 'auto' ? 'http://127.0.0.1:8000/api' : config.apiUrl
    decir(`  • Verificando el servicio de persistencia en ${apiLocal} ...`)
    const estado = await verificarServidor(apiLocal)
    if (estado.error) {
      salirConError(
        `El servicio de persistencia ${estado.error}.\n` +
          (modo === 'prueba'
            ? '    Inicialo primero en otra ventana:  cd servidor  y  php iniciar.php prueba'
            : '    Revisá PROD_API_URL en .env, que el servidor esté encendido y que la red permita la conexión.'),
      )
    }
    if (estado.modo !== modo) {
      decir(`  ! Atención: el servicio de persistencia está en modo ${estado.modo?.toUpperCase()} y este cliente en ${modo.toUpperCase()}.`)
    }
    decir(`  • Conectado (base de datos ${estado.base_de_datos?.motor}: ${estado.base_de_datos?.estado}).`)
  }

  let comando
  if (modo === 'prueba') {
    comando = ['exec', '--', 'vite', '--host', config.host, '--port', String(config.puerto), '--strictPort']
  } else {
    decir('  • Compilando la aplicación para producción...')
    const r = spawnSync(npm, ['run', 'build'], { cwd: RAIZ, stdio: 'inherit', shell: esWindows })
    if (r.status !== 0) salirConError('La compilación falló.')
    comando = ['exec', '--', 'vite', 'preview', '--host', config.host, '--port', String(config.puerto), '--strictPort']
  }

  decir()
  if (config.host === '0.0.0.0') {
    decir(`  ✔ Aplicación web disponible en http://localhost:${config.puerto}`)
    const ips = direccionesRed()
    if (ips.length) {
      decir(`    Desde una tablet o celular en la misma red Wi-Fi: ${ips.map((ip) => `http://${ip}:${config.puerto}`).join('  ·  ')}`)
      if (modo === 'prueba') decir(`    En la app Android (APK), como servidor escribí: ${ips[0]}`)
    }
  } else {
    decir(`  ✔ Aplicación web disponible en http://${config.host}:${config.puerto}`)
  }
  decir('    Para detener: Ctrl + C')
  decir()
  const hijo = spawn(npm, comando, { cwd: RAIZ, stdio: 'inherit', shell: esWindows })
  hijo.on('exit', (codigo) => process.exit(codigo ?? 0))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
