<?php

namespace App\Enums;

/**
 * Estados de una mesa según el diagrama de estados de Mesa (Etapa 2, Figura 9).
 *
 *   Disponible ──(asignar reserva)──▶ Reservada ──(cliente llega)──▶ Ocupada
 *   Disponible ──(sin reserva)──────────────────────────────────────▶ Ocupada
 *   Reservada  ──(cancelar)──▶ Disponible
 *   Ocupada ──(solicita cuenta)──▶ Solicita cuenta ──(iniciar cobro)──▶ Pendiente de pago
 *   Pendiente de pago ──(confirmar pago)──▶ Disponible
 */
enum EstadoMesa: string
{
    case Disponible = 'disponible';
    case Reservada = 'reservada';
    case Ocupada = 'ocupada';
    case SolicitaCuenta = 'solicita_cuenta';
    case PendientePago = 'pendiente_pago';

    /** @return list<self> */
    public function siguientes(): array
    {
        return match ($this) {
            self::Disponible => [self::Reservada, self::Ocupada],
            self::Reservada => [self::Ocupada, self::Disponible],
            self::Ocupada => [self::SolicitaCuenta],
            self::SolicitaCuenta => [self::PendientePago],
            self::PendientePago => [self::Disponible],
        };
    }

    public function puedePasarA(self $destino): bool
    {
        return in_array($destino, $this->siguientes(), true);
    }

    /** RN-01: una mesa con atención activa no figura como disponible. */
    public function tieneAtencionActiva(): bool
    {
        return in_array($this, [self::Ocupada, self::SolicitaCuenta, self::PendientePago], true);
    }

    public function etiqueta(): string
    {
        return match ($this) {
            self::Disponible => 'Disponible',
            self::Reservada => 'Reservada',
            self::Ocupada => 'Ocupada',
            self::SolicitaCuenta => 'Solicita cuenta',
            self::PendientePago => 'Pendiente de pago',
        };
    }
}
