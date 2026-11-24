<?php

namespace App\Services\Ai;

use RuntimeException;

/**
 * Fournisseur d'IA indisponible : le message est affiché tel quel à l'utilisateur.
 */
class AiUnavailableException extends RuntimeException {}
