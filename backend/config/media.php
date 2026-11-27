<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Stockage des fichiers envoyés
    |--------------------------------------------------------------------------
    |
    | "local"      : disques Laravel (public pour les images, local/privé pour les
    |                documents). C'est le mode par défaut en développement et en test.
    | "cloudinary" : photos et logos sur le CDN, documents en type "authenticated"
    |                servis par une URL signée (aucun accès public direct).
    |
    */

    'driver' => env('MEDIA_DRIVER', 'local'),

    'cloudinary_url' => env('CLOUDINARY_URL'),

    // Préfixe des dossiers créés dans le compte Cloudinary.
    'cloudinary_folder' => env('CLOUDINARY_FOLDER', 'marketplace'),

];
