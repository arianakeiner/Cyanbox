<?php

namespace App\Enums;

/**
 * Estados de una comanda según el diagrama de estados de Comanda (Etapa 2, Figura 10).
 *
 *   Borrador ──(confirmar)──▶ Enviada ──(recibir)──▶ Pendiente en cocina ──(iniciar)──▶ En preparación
 *   En preparación ──(finalizar)──▶ Lista ──(entregar)──▶ Entregada
 *   Borrador ──(cancelar)──▶ Cancelada
 *
 * Las reglas de cancelación o modificación de una comanda ya enviada no fueron relevadas,
 * por eso sólo se puede cancelar en Borrador.
 */
enum EstadoComanda: string
{
    case Borrador = 'borrador';
    case Enviada = 'enviada';
    case PendienteCocina = 'pendiente_cocina';
    case EnPreparacion = 'en_preparacion';
    case Lista = 'lista';
    case Entregada = 'entregada';
    case Cancelada = 'cancelada';

    public function siguiente(): ?self
    {
        return match ($this) {
            self::Borrador => self::Enviada,
            self::Enviada => self::PendienteCocina,
            self::PendienteCocina => self::EnPreparacion,
            self::EnPreparacion => self::Lista,
            self::Lista => self::Entregada,
            self::Entregada, self::Cancelada => null,
        };
    }

    public function puedePasarA(self $destino): bool
    {
        if ($destino === self::Cancelada) {
            return $this === self::Borrador;
        }

        return $this->siguiente() === $destino;
    }

    /** Comandas que cocina todavía tiene que resolver. */
    public function esActivaEnCocina(): bool
    {
        return in_array($this, [self::Enviada, self::PendienteCocina, self::EnPreparacion, self::Lista], true);
    }

    public function etiqueta(): string
    {
        return match ($this) {
            self::Borrador => 'Borrador',
            self::Enviada => 'Enviada',
            self::PendienteCocina => 'Pendiente en cocina',
            self::EnPreparacion => 'En preparación',
            self::Lista => 'Lista',
            self::Entregada => 'Entregada',
            self::Cancelada => 'Cancelada',
        };
    }
}
