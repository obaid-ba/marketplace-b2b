<?php

namespace App\Contracts;

use Illuminate\Http\UploadedFile;
use Symfony\Component\HttpFoundation\Response;

/**
 * Stockage des fichiers envoyés par les utilisateurs.
 *
 * Deux implémentations : disques Laravel (local, tests) et Cloudinary (production).
 * La clé renvoyée par store() est ce qui est enregistré en base (colonne path,
 * file_path ou logo) ; elle est opaque pour le reste de l'application.
 */
interface MediaStorage
{
    /**
     * Enregistre un fichier et renvoie la clé à stocker en base.
     *
     * @param  bool  $private  true pour un document non public (accès par URL signée)
     */
    public function store(UploadedFile $file, string $folder, bool $private = false): string;

    /**
     * Supprime un fichier. Sans effet si la clé est vide.
     */
    public function delete(?string $key, bool $private = false): void;

    /**
     * URL publique d'un fichier (images, logos). Null si la clé est vide.
     */
    public function url(?string $key): ?string;

    /**
     * Réponse HTTP qui sert un fichier privé (flux local ou redirection signée).
     */
    public function download(string $key, string $filename): Response;
}
