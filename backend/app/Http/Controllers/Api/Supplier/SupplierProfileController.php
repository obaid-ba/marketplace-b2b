<?php

namespace App\Http\Controllers\Api\Supplier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Supplier\PublishSupplierProfileRequest;
use App\Http\Requests\Supplier\UpdateSupplierLogoRequest;
use App\Http\Requests\Supplier\UpdateSupplierProfileRequest;
use App\Http\Resources\SupplierProfileResource;
use App\Models\SupplierProfile;
use App\Services\SupplierProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Profil de l'entreprise (SCRUM-28).
 * Toutes les actions portent sur le profil de l'utilisateur connecté : aucun identifiant
 * de profil dans l'URL, un fournisseur ne peut donc pas viser le profil d'un autre.
 */
class SupplierProfileController extends Controller
{
    public function __construct(private readonly SupplierProfileService $service) {}

    public function show(Request $request): SupplierProfileResource
    {
        $profile = $this->ownProfile($request, 'view');

        return new SupplierProfileResource($this->service->load($profile));
    }

    public function update(UpdateSupplierProfileRequest $request): JsonResponse
    {
        $profile = $this->ownProfile($request, 'update');
        $profile = $this->service->update($profile, $request->validated());

        return response()->json([
            'message' => 'Le profil de votre entreprise a été enregistré.',
            'profile' => new SupplierProfileResource($profile),
        ]);
    }

    public function updateLogo(UpdateSupplierLogoRequest $request): JsonResponse
    {
        $profile = $this->ownProfile($request, 'update');
        $profile = $this->service->updateLogo($profile, $request->file('logo'));

        return response()->json([
            'message' => 'Le logo a été mis à jour.',
            'profile' => new SupplierProfileResource($profile),
        ]);
    }

    public function publish(PublishSupplierProfileRequest $request): JsonResponse
    {
        $profile = $this->ownProfile($request, 'update');
        $profile = $this->service->setPublished($profile, $request->boolean('is_published'));

        return response()->json([
            'message' => $profile->is_published
                ? 'Votre profil est publié : il est visible par les acheteurs.'
                : "Votre profil n'est plus publié.",
            'profile' => new SupplierProfileResource($profile),
        ]);
    }

    private function ownProfile(Request $request, string $ability): SupplierProfile
    {
        $profile = $request->user()->supplierProfile;
        abort_if($profile === null, 404, 'Profil fournisseur introuvable.');

        Gate::authorize($ability, $profile);

        return $profile;
    }
}
