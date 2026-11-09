# Cyanbox · Sistema de Gestión Gastronómica

Práctica Profesional, IFTS N.º 29. Etapa 3: desarrollo completo.
Equipo Cyanbox: Joel Carlos Alvarez y Ariana Agostina Keiner.

El sistema son **dos servicios independientes**:

| Servicio | Carpeta | Tecnología | Qué hace |
|---|---|---|---|
| **Persistencia** | `servidor/` | Laravel 13 (PHP 8.3) + SQLite / PostgreSQL | API REST, reglas de negocio y base de datos. En producción corre en un equipo del restaurante o en un servidor web. |
| **Cliente** | `cliente/` | React 19 + TypeScript (Vite) | Aplicación web para tablets y computadoras (mozo, cocina, caja, recepción, administración). Guarda y consulta todo en el servicio de persistencia. |

```
 Tablet / PC (navegador) ──HTTP──▶ Servicio cliente (React)  ──API REST──▶ Servicio de persistencia (Laravel) ──▶ Base de datos
 Tablet Android (APK)    ──────────────────────────────────────API REST──▶ Servicio de persistencia (Laravel)   (producción)
 Tablet Android (APK)    ──▶ servicio de persistencia local dentro de la app ──▶ base local de la tablet      (modo prueba)
```

## Cómo probarlo

**En una tablet Android (sin instalar nada más):**
1. Desde la tablet, descargar [Cyanbox.apk](https://github.com/arianakeiner/Cyanbox/releases/download/apk/Cyanbox.apk) e instalarla.
2. Abrir la app y tocar **Probar en esta tablet**.
3. Tocar el botón **Mozo** (o cualquier otro perfil) para ingresar. Contraseña de todos los usuarios: `cyanbox123`.

**En una computadora (Mac, Windows o Linux)**, con PHP 8.3, Composer y Node.js instalados:
1. En una terminal: `cd servidor` y `php iniciar.php prueba`.
2. En otra terminal: `cd cliente` y `node iniciar.mjs prueba`.
3. Abrir http://localhost:5173 e ingresar con el botón de cualquier perfil.

Recorrido sugerido para ver el circuito completo: **Reservas** (nueva reserva) → **Salón** (ocupar la mesa) → **Pedido** (agregar productos y enviar) → ingresar como **Cocina** y avanzar la comanda → volver como **Mozo**, pedir la cuenta → ingresar como **Caja** y cobrar. Las pruebas automáticas se ejecutan con `php artisan test` (en `servidor`) y `npm test` (en `cliente`).

El detalle de cada paso está en la sección 1 (computadora) y 1.1 (tablet), y en el documento PDF de la entrega.

---

## 1. Puesta en marcha rápida (modo **prueba**)

En modo prueba **los dos servicios corren en el mismo equipo y no hay que configurar nada**: todo apunta a `localhost` y la base de datos es un archivo SQLite que se crea solo, con los datos de ejemplo del prototipo.

### Requisitos

| Programa | Versión | Para qué |
|---|---|---|
| PHP | 8.3 o superior, con las extensiones `pdo_sqlite`, `mbstring`, `openssl` (y `pdo_pgsql` para producción) | Servicio de persistencia |
| Composer | 2.x | Dependencias de PHP |
| Node.js | 20 o superior (incluye npm) | Servicio cliente |

> En Windows, la forma más simple de tener PHP + Composer es instalar [Laravel Herd](https://herd.laravel.com) o XAMPP + Composer. Node.js se descarga de [nodejs.org](https://nodejs.org).

### Pasos

1. **Iniciar primero el servicio de persistencia.** En una terminal:
   ```bash
   cd servidor
   php iniciar.php
   ```
   (En Windows también se puede hacer doble clic en `servidor/iniciar.bat`).
   La primera vez pregunta el modo: escribir **`prueba`** (o Enter). Instala las dependencias, crea la base y queda escuchando en `http://127.0.0.1:8000`.

2. **Después, iniciar el servicio cliente.** En otra terminal:
   ```bash
   cd cliente
   node iniciar.mjs
   ```
   (En Windows: doble clic en `cliente/iniciar.bat`). Escribir **`prueba`**. Verifica que el servicio de persistencia responda y publica la aplicación en `http://localhost:5173`.

3. Abrir **http://localhost:5173** en el navegador y entrar con un usuario de prueba.

La elección del modo queda guardada en el `.env` de cada servicio, así que las próximas veces sólo hay que ejecutar los mismos comandos.
Para cambiar de modo: `php iniciar.php produccion` / `node iniciar.mjs produccion` (o `prueba`).
Para volver a los datos de ejemplo originales: `php iniciar.php prueba --reiniciar-datos`.

### Usuarios de prueba

Contraseña de todos: **`cyanbox123`**. En la pantalla de ingreso del modo prueba también hay botones para entrar directo con cada perfil.

| Perfil | Correo | Qué puede hacer |
|---|---|---|
| Administrador | `admin@cyanbox.local` | Todo, más carta, categorías, mesas, stock y reportes |
| Mozo | `mozo@cyanbox.local` (Joel) · `mozo2@cyanbox.local` (Ariana) | Abrir mesas, tomar pedidos, entregar comandas, pedir la cuenta |
| Cocina | `cocina@cyanbox.local` | Ver comandas, avanzar la preparación, marcar platos agotados |
| Caja | `caja@cyanbox.local` | Iniciar el cobro, registrar el pago y liberar la mesa |
| Recepción | `recepcion@cyanbox.local` | Reservas (alta, edición, cancelación, baja), lista de espera, recibir clientes |

---

### 1.1 App para tablets Android (APK)

La app de Android empaqueta el mismo servicio cliente con [Capacitor](https://capacitorjs.com).

1. Descargar **Cyanbox.apk** desde la sección *Releases* del repositorio (https://github.com/arianakeiner/Cyanbox/releases). GitHub la compila automáticamente en cada actualización de `main` (ver `.github/workflows/apk.yml`).
2. Instalarla en la tablet (Android 7 o superior). Si Android lo pide, permitir instalar apps de origen desconocido.
3. Al abrirla por primera vez se elige:
   - **Probar en esta tablet (modo prueba):** la app trae su propio servicio de persistencia con la misma API, las mismas tablas, reglas de negocio y datos de ejemplo que el servidor en modo prueba. Los datos se guardan en la tablet. No necesita red ni otra computadora. Se ingresa con los mismos usuarios de prueba y se puede volver a los datos originales con **Restablecer datos**.
   - **Producción:** se escribe la dirección del servidor del restaurante (por ejemplo `192.168.0.10`). El lanzador del servidor muestra esa dirección al iniciar.
4. La elección se puede cambiar desde la pantalla de ingreso (**Cambiar**).

Para compilar la APK en una computadora propia hace falta Android Studio (o el SDK de Android y JDK 21):
```bash
cd cliente
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug      # genera app/build/outputs/apk/debug/app-debug.apk
```

> En modo prueba, la versión web también puede abrirse desde una tablet o celular conectado a la misma red Wi-Fi que la computadora: el lanzador del cliente muestra la dirección (por ejemplo `http://192.168.0.10:5173`). En macOS, la primera vez puede aparecer un aviso del firewall para permitir conexiones entrantes a PHP y Node.

## 2. Modo **producción**

En producción cada servicio lee del archivo `.env` las direcciones reales. Ambos `.env` se crean solos la primera vez a partir de `.env.example`, que explica cada variable.

### Servicio de persistencia (`servidor/.env`)

| Variable | Ejemplo | Descripción |
|---|---|---|
| `CYANBOX_MODO` | `produccion` | Lo escribe el script al elegir el modo |
| `PROD_SERVIDOR_HOST` | `0.0.0.0` | Dirección donde escucha la API (`0.0.0.0` = acepta conexiones de la red) |
| `PROD_SERVIDOR_PUERTO` | `8000` | Puerto de la API |
| `PROD_APP_URL` | `http://192.168.0.10:8000` | Cómo ven la API los clientes |
| `PROD_CLIENTES_PERMITIDOS` | `http://192.168.0.10:5173` | Direcciones de los clientes web autorizados (separadas por coma, `*` = cualquiera) |
| `PROD_DB_CONNECTION` | `pgsql` | Motor de base de datos |
| `PROD_DB_HOST` / `PROD_DB_PORT` | `127.0.0.1` / `5432` | Servidor PostgreSQL (local o remoto) |
| `PROD_DB_DATABASE` | `cyanbox` | Nombre de la base (debe existir) |
| `PROD_DB_USERNAME` / `PROD_DB_PASSWORD` | | Usuario de PostgreSQL con permisos sobre la base |
| `PROD_ADMIN_EMAIL` / `PROD_ADMIN_PASSWORD` | | Administrador inicial que se crea la primera vez |

Crear la base en PostgreSQL (una sola vez):
```sql
CREATE USER cyanbox PASSWORD 'una_clave_segura';
CREATE DATABASE cyanbox OWNER cyanbox;
```
Al iniciar, `php iniciar.php produccion` valida que estén todos los datos, prueba la conexión, crea o actualiza las tablas (migraciones) y carga los datos base (roles y medios de pago). En producción **no** se cargan los datos de ejemplo.

### Servicio cliente (`cliente/.env`)

| Variable | Ejemplo | Descripción |
|---|---|---|
| `CYANBOX_MODO` | `produccion` | Lo escribe el script al elegir el modo |
| `PROD_API_URL` | `http://192.168.0.10:8000/api` | Dirección del servicio de persistencia (con `/api`) |
| `PROD_CLIENTE_HOST` | `0.0.0.0` | Dirección donde se publica la app |
| `PROD_CLIENTE_PUERTO` | `5173` | Puerto de la app |

En producción, `node iniciar.mjs produccion` compila la aplicación optimizada y la publica. Las tablets se conectan desde su navegador a `http://<IP-del-equipo-cliente>:<puerto>`.
La dirección de la API se guarda en `public/config.json` al iniciar, así que cambiar de servidor no requiere tocar el código.

> Para un despliegue en Internet se recomienda poner ambos servicios detrás de un servidor web con HTTPS (Nginx o Apache). Los scripts usan los servidores integrados de PHP y Vite, suficientes para el restaurante en red local y para la evaluación.

---

### 2.1 Entorno estandarizado con Docker (opcional)

Tal como se definió en la Etapa 2, el proyecto incluye un `docker-compose.yml` que levanta el mismo entorno en cualquier equipo: base PostgreSQL 16, servicio de persistencia y servicio cliente, ambos en modo producción.

```bash
docker compose up --build
```

Luego abrir **http://localhost:5173** e ingresar con `admin@cyanbox.local` / `cyanbox123` (conviene cambiar la clave desde *Administración → Usuarios y roles*). Las variables `PROD_*` del archivo compose reemplazan a las del `.env`. Para detenerlo: `docker compose down` (agregar `-v` para borrar también la base).

## 3. Pruebas automatizadas

```bash
cd servidor && php artisan test     # 25 pruebas: unitarias (estados, cálculos) e integración (API + BD)
cd cliente  && npm test             # 16 pruebas: unitarias y el servicio local de la app Android
```
Las pruebas del servidor usan una base SQLite en memoria. También se pueden correr contra PostgreSQL:
```bash
CYANBOX_MODO=produccion PROD_DB_HOST=127.0.0.1 PROD_DB_DATABASE=cyanbox_test PROD_DB_USERNAME=... PROD_DB_PASSWORD=... php artisan test
```

| ID | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| PU-01 | Unitaria | `servidor/tests/Unit/EstadoMesaTest.php` | Transiciones válidas e inválidas del diagrama de estados de Mesa; RN-01 |
| PU-02 | Unitaria | `servidor/tests/Unit/EstadoComandaTest.php` | Recorrido Borrador → Entregada, sin saltear estados; cancelación sólo en Borrador |
| PU-03 | Unitaria | `servidor/tests/Unit/CalculosTest.php` | Subtotal con el precio guardado; alerta de stock bajo mínimo |
| PU-04 | Unitaria | `cliente/src/pruebas/carrito.test.ts` | Pedido en la tablet: cantidades, total y RN-03 (producto agotado) |
| PU-05 | Unitaria | `cliente/src/pruebas/formato.test.ts` | Tiempo de ocupación (RF-04 / RN-02) y colores del mapa |
| PU-06 | Unitaria | `cliente/src/pruebas/reservas.test.ts` | Validación del formulario de reservas |
| PI-01 | Integración | `servidor/tests/Feature/CircuitoAtencionTest.php` | Recorrido completo: reserva → mesa → pedido → cocina → entrega → pedido adicional → cuenta → cobro → mesa libre; reglas RN-01 y RN-03 |
| PI-02 | Integración | `servidor/tests/Feature/CrudTest.php` | CRUD de productos, reservas, mesas, categorías y usuarios con validaciones (duplicados, obligatorios, superposición, eliminaciones protegidas) y permisos por rol |
| PU-07 | Unitaria | `cliente/src/pruebas/config.test.ts` | Dirección del servidor escrita en la tablet y API del mismo equipo en modo prueba |
| PI-03 | Integración | `cliente/src/pruebas/servidorLocal.test.ts` | Servicio local de la app Android: circuito completo, reglas RN-01/RN-03, validaciones, permisos y datos guardados en la tablet |

---

## 4. Estructura del proyecto

```
cyanbox/
├── servidor/                       Servicio de persistencia (Laravel)
│   ├── iniciar.php                 Arranque con modo prueba / producción
│   ├── .env.example                Variables de configuración documentadas
│   ├── app/
│   │   ├── Enums/                  EstadoMesa, EstadoComanda (diagramas de estados)
│   │   ├── Exceptions/             ReglaNegocioException (→ HTTP 422)
│   │   ├── Models/                 Entidades del DER (Mesa, AtencionMesa, Comanda, ...)
│   │   ├── Services/               Lógica de negocio: AtencionService, ComandaService, ReservaService
│   │   └── Http/
│   │       ├── Controllers/Api/    Controladores REST
│   │       ├── Middleware/         AutenticarToken (RNF-04), VerificarRol (RNF-05)
│   │       └── Presentadores/      Formato JSON de cada entidad
│   ├── config/cyanbox.php          Configuración propia según el modo
│   ├── database/migrations/        Tablas (DER de la Etapa 2 con correcciones)
│   ├── database/seeders/           BaseSeeder (roles, medios de pago) y DemoSeeder (datos del prototipo)
│   ├── database/scripts/           cyanbox_postgresql.sql (script de creación de la base, alternativa a las migraciones)
│   ├── routes/api.php              Endpoints y permisos por rol
│   └── tests/                      Pruebas unitarias e integración
└── cliente/                        Servicio cliente (React + TypeScript)
    ├── iniciar.mjs                 Arranque con modo prueba / producción
    ├── .env.example
    ├── capacitor.config.ts         Configuración de la app Android
    ├── android/                    Proyecto Android (Capacitor) que genera Cyanbox.apk
    └── src/
        ├── lib/                    api.ts (HTTP + errores), config.ts, carrito.ts, formato.ts, tipos.ts
        ├── local/                  Servicio de persistencia local de la app Android (bd.ts + servidor.ts)
        ├── componentes/            Contexto (sesión, avisos, confirmaciones), Layout, usarDatos
        ├── paginas/                Login, ElegirServidor, Inicio, Salón, Pedido, Cocina, Reservas, Administración, Stock, Reportes
        ├── estilos/                prototipo.css (identidad visual del prototipo) + extra.css
        └── pruebas/                Pruebas unitarias e integración (Vitest)
```

## 5. Correspondencia con la Etapa 2

**Modelo de datos.** Se implementó el DER preliminar (Figura 3) con estas correcciones: `detalles_comanda.id_comanda`, `productos.id_categoria` y `pagos.id_medio_pago` (las tres claves foráneas faltaban), y `movimientos_stock.id_ingrediente` (figuraba "a definir"). Se agregaron, como decisión de diseño, `lista_espera` (RF-03), y en `atenciones_mesa` el mozo, la reserva de origen y la cantidad de comensales.

**Reglas de negocio.**

| Regla | Dónde se aplica |
|---|---|
| RN-01 Mesa con atención activa no figura disponible | `AtencionService::abrir`, `EstadoMesa::tieneAtencionActiva` |
| RN-02 Tiempo de ocupación desde la apertura | `AtencionMesa::minutosTranscurridos`, mapa del salón |
| RN-03 Producto no disponible no se puede pedir | `ComandaService::crear` y carta (botón deshabilitado) |
| RN-04 Comanda asociada a una atención | FK `comandas.id_atencion` + validación de atención activa |
| RN-05 Varias comandas por atención | Pedidos adicionales sobre la misma atención |
| RN-06 / RN-07 Tablet del mozo / modo comensal | Pantalla de pedido con "Modo comensal" (el mozo confirma el envío) |
| RN-08 Al cerrar, la mesa queda disponible | `AtencionService::confirmarPago` |

**Estados.** Mesa: Disponible → Reservada → Ocupada → Solicita cuenta → Pendiente de pago → Disponible (Figura 9). Comanda: Borrador → Enviada → Pendiente en cocina → En preparación → Lista → Entregada, o Cancelada desde Borrador (Figura 10). Cualquier transición fuera del diagrama devuelve un error claro.

**Pendientes que siguen sin definir** (se mantienen como en la Etapa 2): descuento automático de stock por receta (RF-19), cancelación o modificación de comandas ya enviadas, división de cuentas e integración con pasarelas de pago (RF-22).

**Excluido de esta versión por decisión del equipo:** la función "llamar al mozo" (RF-23). Su forma de aviso no se había definido con el cliente y se quitó del alcance de la versión funcional.
