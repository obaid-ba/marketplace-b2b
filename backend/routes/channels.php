<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Canaux temps réel (Reverb)
|--------------------------------------------------------------------------
| Un seul canal privé par utilisateur : messages, accusés de lecture et notifications.
| Autorisation par le jeton Bearer, comme le reste de l'API (POST /api/broadcasting/auth).
*/

Broadcast::channel('user.{id}', fn (User $user, int $id) => $user->id === $id);
