<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Se lanza cuando una operación viola una regla de negocio (RN-xx) o una transición de estado.
 * La API la devuelve como HTTP 422 con un mensaje claro para mostrar al usuario.
 */
class ReglaNegocioException extends RuntimeException
{
    public function __construct(string $mensaje, public readonly ?string $regla = null)
    {
        parent::__construct($mensaje);
    }
}
