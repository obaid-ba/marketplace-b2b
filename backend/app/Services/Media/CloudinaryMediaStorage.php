<?php

namespace App\Services\Media;

use App\Contracts\MediaStorage;
use Cloudinary\Cloudinary;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Stockage Cloudinary.
 *
 * Clé enregistrée en base : "<resource_type>:<public_id>".
 *   - image:...  → photo de produit ou logo, type "upload" (CDN public)
 *   - raw:...    → document privé, type "authenticated" (URL signée obligatoire)
 *
 * Les documents sont envoyés en "raw" pour conserver l'extension d'origine
 * (nécessaire au nom du fichier téléchargé) et ne subir aucune transformation.
 */
class CloudinaryMediaStorage implements MediaStorage
{
    private ?Cloudinary $client = null;

    public function store(UploadedFile $file, string $folder, bool $private = false): string
    {
        $resourceType = $private ? 'raw' : 'image';
        $type = $private ? 'authenticated' : 'upload';

        $publicId = (string) Str::uuid();

        if ($resourceType === 'raw') {
            $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'bin');
            $publicId .= '.'.$extension;
        }

        $result = $this->client()->uploadApi()->upload($file->getRealPath(), [
            'folder' => $this->folder($folder),
            'public_id' => $publicId,
            'resource_type' => $resourceType,
            'type' => $type,
            'overwrite' => false,
        ]);

        $storedId = (string) ($result['public_id'] ?? $publicId);

        return $resourceType.':'.$storedId;
    }

    public function delete(?string $key, bool $private = false): void
    {
        if (! $key || ! $this->isCloudinaryKey($key)) {
            return;
        }

        [$resourceType, $publicId] = $this->split($key);

        try {
            $this->client()->uploadApi()->destroy($publicId, [
                'resource_type' => $resourceType,
                'type' => $private ? 'authenticated' : 'upload',
                'invalidate' => true,
            ]);
        } catch (Throwable $exception) {
            // Une suppression ratée ne doit pas casser l'action métier en cours.
            Log::warning('Suppression Cloudinary impossible', [
                'key' => $key,
                'message' => $exception->getMessage(),
            ]);
        }
    }

    public function url(?string $key): ?string
    {
        if (! $key) {
            return null;
        }

        if (Str::startsWith($key, ['http://', 'https://'])) {
            return $key;
        }

        // Anciennes données locales (développement) : on garde un repli lisible.
        if (! $this->isCloudinaryKey($key)) {
            return Storage::disk('public')->url($key);
        }

        [$resourceType, $publicId] = $this->split($key);

        return (string) $this->asset($resourceType, $publicId)->toUrl();
    }

    public function download(string $key, string $filename): Response
    {
        if (! $this->isCloudinaryKey($key)) {
            // Fichier local hérité : on le sert directement.
            $disk = Storage::disk('local');
            abort_unless($disk->exists($key), 404, 'Fichier introuvable.');

            return $disk->download($key, $filename);
        }

        [$resourceType, $publicId] = $this->split($key);

        // URL signée : l'asset "authenticated" n'est accessible qu'avec cette signature.
        $url = $this->asset($resourceType, $publicId)
            ->deliveryType('authenticated')
            ->signUrl(true)
            ->toUrl();

        return redirect()->away((string) $url);
    }

    private function client(): Cloudinary
    {
        if ($this->client instanceof Cloudinary) {
            return $this->client;
        }

        $url = (string) config('media.cloudinary_url');

        if ($url === '') {
            throw new RuntimeException('CLOUDINARY_URL est absente : renseignez la variable d’environnement.');
        }

        return $this->client = new Cloudinary($url);
    }

    private function folder(string $folder): string
    {
        return trim((string) config('media.cloudinary_folder', 'marketplace').'/'.$folder, '/');
    }

    private function asset(string $resourceType, string $publicId): \Cloudinary\Asset\BaseAsset
    {
        return $resourceType === 'raw'
            ? $this->client()->raw($publicId)
            : $this->client()->image($publicId);
    }

    private function isCloudinaryKey(string $key): bool
    {
        return Str::startsWith($key, ['image:', 'raw:']);
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function split(string $key): array
    {
        [$resourceType, $publicId] = explode(':', $key, 2) + [1 => ''];

        return [$resourceType === 'raw' ? 'raw' : 'image', $publicId];
    }
}
