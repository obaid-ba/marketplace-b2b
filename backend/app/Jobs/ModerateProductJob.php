<?php

namespace App\Jobs;

use App\Exceptions\AiUnavailableException;
use App\Models\Product;
use App\Services\ProductModerationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Contrôle IA d'une annonce publiée (SCRUM-84), en file de tâches pour ne pas ralentir l'enregistrement.
 */
class ModerateProductJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct(public int $productId) {}

    public function handle(ProductModerationService $moderation): void
    {
        $product = Product::query()->find($this->productId);

        if (! $product) {
            return;
        }

        try {
            $moderation->analyze($product);
        } catch (AiUnavailableException) {
            // Déjà journalisé : l'annonce reste publiée, l'administrateur la voit sans indice IA.
        }
    }
}
