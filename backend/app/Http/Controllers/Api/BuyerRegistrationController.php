<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterBuyerRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Inscription d'un porteur de projet (SCRUM-23).
 * Crée le compte et son profil, puis envoie l'e-mail de vérification.
 * Aucune validation administrateur : le compte est actif dès la vérification.
 */
class BuyerRegistrationController extends Controller
{
    public function store(RegisterBuyerRequest $request): JsonResponse
    {
        $user = DB::transaction(function () use ($request) {
            $firstName = $request->string('first_name')->toString();
            $lastName = $request->string('last_name')->toString();

            $user = User::create([
                'name' => trim("{$firstName} {$lastName}"),
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $request->string('email')->toString(),
                'phone' => $request->string('phone')->toString(),
                'password' => $request->string('password')->toString(),
                'role' => UserRole::Buyer,
                'status' => UserStatus::EMAIL_TO_VERIFY,
            ]);

            $user->buyerProfile()->create([
                'buyer_type' => $request->string('buyer_type')->toString(),
                'organization' => $request->string('organization')->toString(),
                'sector' => $request->string('sector')->toString(),
                'region_id' => $request->integer('region_id'),
                'terms_accepted_at' => now(),
            ]);

            return $user;
        });

        $user->sendEmailVerificationNotification();

        return response()->json([
            'message' => 'Votre compte a été créé. Consultez votre boîte e-mail pour le vérifier.',
            'user' => new UserResource($user->load('buyerProfile')),
        ], 201);
    }
}
