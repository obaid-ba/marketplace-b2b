<?php

namespace App\Services\WhatsApp;

/**
 * Contrat d'un fournisseur WhatsApp. Un pilote réel respecte config('whatsapp.timeout') et lève une exception
 * pour tout envoi refusé : le repli sur l'e-mail est géré par WhatsAppChannel.
 */
interface WhatsAppClient
{
    /**
     * @throws \Throwable si le message n'a pas été accepté
     */
    public function send(WhatsAppMessage $message): WhatsAppResult;
}
