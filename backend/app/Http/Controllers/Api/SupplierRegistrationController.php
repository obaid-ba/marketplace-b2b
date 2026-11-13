<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\ValidationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterSupplierRequest;
use App\Http\Resources\UserResource;
use App\Models\SupplierDocument;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Inscription d'un fournisseur (SCRUM-22).
 * Crée le compte, le profil « en attente » et les justificatifs, puis envoie
 * l'e-mail de vérification. Le profil reste invisible tant qu'un administrateur
 * ne l'a pas validé.
 */
class SupplierRegistrationController extends Controller
{
    public function store(RegisterSupplierRequest $request): JsonResponse
    {
        $storedFiles = [];

        try {
            [$user, $profile] = DB::transaction(function () use ($request, &$storedFiles) {
                $firstName = $request->string('first_name')->toString();
                $lastName = $request->string('last_name')->toString();

                $user = User::create([
                    'name' => trim("{$firstName} {$lastName}"),
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'email' => $request->string('email')->toString(),
                    'phone' => $request->string('phone')->toString(),
                    'password' => $request->string('password')->toString(),
                    'role' => UserRole::Supplier,
                    'status' => UserStatus::EMAIL_TO_VERIFY,
                ]);

                $profile = $user->supplierProfile()->create([
                    'company_name' => $request->string('company_name')->toString(),
                    'legal_form' => $request->string('legal_form')->toString(),
                    'tax_id' => $request->string('tax_id')->toString(),
                    'rne_number' => $request->string('rne_number')->toString(),
                    'sector' => $request->string('sector')->toString(),
                    'description' => $request->string('description')->toString(),
                    'region_id' => $request->integer('region_id'),
                    'address' => $request->string('address')->toString(),
                    'city' => $request->string('city')->toString(),
                    'contact_name' => $request->string('contact_name')->toString(),
                    'contact_role' => $request->string('contact_role')->toString(),
                    'contact_phone' => $request->string('contact_phone')->toString(),
                    'contact' => $request->input('contact'),
                    'is_published' => false,
                    'validation_status' => ValidationStatus::PENDING,
                ]);

                $profile->categories()->sync($request->input('categories', []));
                $profile->coverageRegions()->sync($request->input('coverage_regions', []));

                $requiredDocuments = [
                    'commercial_register' => SupplierDocument::TYPE_COMMERCIAL_REGISTER,
                    'tax_certificate' => SupplierDocument::TYPE_TAX_CERTIFICATE,
                    'manager_id' => SupplierDocument::TYPE_MANAGER_ID,
                ];

                foreach ($requiredDocuments as $field => $type) {
                    $path = $request->file($field)->store("supplier-documents/{$profile->id}", 'local');
                    $storedFiles[] = $path;

                    $profile->documents()->create([
                        'type' => $type,
                        'file_path' => $path,
                        'status' => ValidationStatus::PENDING,
                        'submitted_at' => now(),
                    ]);
                }

                foreach ($request->file('certifications', []) as $certification) {
                    $path = $certification->store("supplier-documents/{$profile->id}", 'local');
                    $storedFiles[] = $path;

                    $profile->documents()->create([
                        'type' => SupplierDocument::TYPE_CERTIFICATION,
                        'file_path' => $path,
                        'status' => ValidationStatus::PENDING,
                        'submitted_at' => now(),
                    ]);
                }

                return [$user, $profile];
            });
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($storedFiles);

            throw $exception;
        }

        try {
            $user->sendEmailVerificationNotification();
        } catch (Throwable $exception) {
            // Le compte est créé : une erreur d'envoi ne doit pas le supprimer.
            Log::error("Échec de l'envoi de l'e-mail de vérification.", [
                'user_id' => $user->id,
                'exception' => $exception,
            ]);
        }

        return response()->json([
            'message' => 'Votre compte a été créé. Consultez votre boîte e-mail pour le vérifier.',
            'user' => new UserResource($user),
            'profile' => [
                'id' => $profile->id,
                'company_name' => $profile->company_name,
                'validation_status' => $profile->validation_status->value,
            ],
        ], 201);
    }

    /**
     * Vérifie, dès l'étape 1, qu'une adresse e-mail est encore disponible.
     */
    public function checkEmail(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
        ]);

        $email = strtolower(trim($validated['email']));
        $available = ! User::withTrashed()->where('email', $email)->exists();

        return response()->json([
            'available' => $available,
            'message' => $available
                ? 'Adresse e-mail disponible.'
                : 'Un compte existe déjà avec cette adresse e-mail.',
        ]);
    }
}
