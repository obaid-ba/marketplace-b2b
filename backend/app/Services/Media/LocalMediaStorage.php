<?php

namespace App\Services\Media;

use App\Contracts\MediaStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Stockage sur les disques Laravel (développement local et tests).
 *
 * Les images vont sur le disque "public" (servi par /storage), les documents
 * privés sur le disque "local" (storage/app/private).
 */
class LocalMediaStorage implements MediaStorage
{
    public function store(UploadedFile $file, string $folder, bool $private = false): string
    {
        return $file->store($folder, $private ? 'local' : 'public');
    }

    public function delete(?string $key, bool $private = false): void
    {
        if (! $key) {
            return;
        }

        Storage::disk($private ? 'local' : 'public')->delete($key);
    }

    public function url(?string $key): ?string
    {
        if (! $key) {
            return null;
        }

        // Les données de démonstration peuvent déjà contenir une URL complète.
        if (Str::startsWith($key, ['http://', 'https://'])) {
            return $key;
        }

        return Storage::disk('public')->url($key);
    }

    public function download(string $key, string $filename): Response
    {
        $disk = Storage::disk('local');

        abort_unless($disk->exists($key), 404, 'Fichier introuvable.');

        return $disk->download($key, $filename);
    }
}
