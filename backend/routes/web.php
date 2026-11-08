<?php

use Illuminate\Support\Facades\Route;

// Le backend est une API pure : l'interface est servie par l'application React (frontend/).
Route::get('/', fn () => response()->json([
    'name' => config('app.name'),
    'api' => url('/api'),
]));
