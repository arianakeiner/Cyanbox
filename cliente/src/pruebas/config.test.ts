import { describe, expect, it } from 'vitest'
import { apiDelMismoEquipo, normalizarServidor } from '../lib/config'

// PU-07 · Dirección del servidor que se escribe en la tablet (app Android) y API en modo prueba.
describe('dirección del servidor', () => {
  it('completa protocolo, puerto y /api a partir de la IP', () => {
    expect(normalizarServidor('192.168.0.10')).toBe('http://192.168.0.10:8000/api')
    expect(normalizarServidor(' 192.168.0.10:9000/ ')).toBe('http://192.168.0.10:9000/api')
  })

  it('respeta una dirección web completa', () => {
    expect(normalizarServidor('https://api.mirestaurante.com')).toBe('https://api.mirestaurante.com/api')
    expect(normalizarServidor('http://10.0.0.5:8000/api')).toBe('http://10.0.0.5:8000/api')
  })

  it('rechaza una dirección vacía o inválida', () => {
    expect(normalizarServidor('')).toBeNull()
    expect(normalizarServidor('mi servidor')).toBeNull()
  })

  it('en modo prueba usa la API del mismo equipo que publica la app', () => {
    expect(apiDelMismoEquipo({ protocol: 'http:', hostname: '192.168.0.10' })).toBe('http://192.168.0.10:8000/api')
    expect(apiDelMismoEquipo({ protocol: 'http:', hostname: 'localhost' })).toBe('http://localhost:8000/api')
  })
})
