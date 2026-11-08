import { Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from './componentes/Contexto'
import { Layout, MENU } from './componentes/Layout'
import { Administracion } from './paginas/Administracion'
import { Cocina } from './paginas/Cocina'
import { Inicio } from './paginas/Inicio'
import { Login } from './paginas/Login'
import { Pedido } from './paginas/Pedido'
import { Reportes } from './paginas/Reportes'
import { Reservas } from './paginas/Reservas'
import { Salon } from './paginas/Salon'
import { Stock } from './paginas/Stock'

const PAGINAS: Record<string, () => React.JSX.Element> = {
  '/': Inicio, '/salon': Salon, '/pedido': Pedido, '/cocina': Cocina, '/reservas': Reservas,
  '/stock': Stock, '/reportes': Reportes, '/administracion': Administracion,
}

export default function App() {
  const { usuario, puede } = useApp()
  if (!usuario) return <Login />

  return (
    <Layout>
      <Routes>
        {MENU.filter((m) => puede(...m.roles)).map((m) => {
          const Pagina = PAGINAS[m.ruta]
          return <Route key={m.ruta} path={m.ruta} element={<Pagina />} />
        })}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
