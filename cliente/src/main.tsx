import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ProveedorApp } from './componentes/Contexto'
import { cargarConfig } from './lib/config'
import './estilos/prototipo.css'
import './estilos/extra.css'

// La configuración (modo y dirección de la API) se lee al abrir la app desde /config.json.
cargarConfig().then((config) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <ProveedorApp config={config}><App /></ProveedorApp>
      </BrowserRouter>
    </StrictMode>,
  )
})
