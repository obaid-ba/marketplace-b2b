<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rules\Password;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Les API Resources sont renvoyées sans l'enveloppe "data" pour un seul objet.
        JsonResource::withoutWrapping();

        // 5 tentatives de connexion par minute et par couple e-mail + IP.
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(5)->by(strtolower((string) $request->input('email')).'|'.$request->ip());
        });

        // Inscriptions : protège la création de comptes et l'envoi d'e-mails.
        RateLimiter::for('register', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        // « Renvoyer le lien » : une fois par minute et par utilisateur.
        RateLimiter::for('verification-resend', function (Request $request) {
            return Limit::perMinute(1)->by((string) $request->user()?->id);
        });

        // « Mot de passe oublié » : 3 demandes par minute et par adresse IP (SCRUM-26).
        RateLimiter::for('forgot-password', function (Request $request) {
            return Limit::perMinute(3)->by($request->ip());
        });

        // Règles de robustesse des mots de passe (réinitialisation ; mêmes règles qu'à l'inscription).
        Password::defaults(fn () => Password::min(8)->letters()->mixedCase()->numbers());

        $this->configureEmailVerification();
        $this->configurePasswordReset();

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });
    }

    /**
     * E-mail de vérification (SCRUM-24) : envoyé automatiquement par l'événement Registered
     * déclenché à l'inscription. Le lien ouvre l'application React, qui appelle ensuite l'API.
     */
    private function configureEmailVerification(): void
    {
        VerifyEmail::createUrlUsing(function (User $user) {
            $signedPath = URL::temporarySignedRoute(
                'verification.verify',
                now()->addMinutes((int) config('auth.verification.expire', 60)),
                ['id' => $user->getKey(), 'hash' => sha1($user->getEmailForVerification())],
                absolute: false,
            );

            parse_str((string) parse_url($signedPath, PHP_URL_QUERY), $query);

            return config('app.frontend_url').'/email/verifier?'.http_build_query([
                'id' => $user->getKey(),
                'hash' => sha1($user->getEmailForVerification()),
                'expires' => $query['expires'],
                'signature' => $query['signature'],
            ]);
        });

        VerifyEmail::toMailUsing(function (User $user, string $url) {
            $minutes = (int) config('auth.verification.expire', 60);

            return (new MailMessage)
                ->subject('Confirmez votre adresse e-mail')
                ->greeting("Bonjour {$user->name},")
                ->line('Merci pour votre inscription sur Marketplace B2B. Cliquez sur le bouton ci-dessous pour confirmer votre adresse e-mail.')
                ->action('Confirmer mon adresse e-mail', $url)
                ->line("Ce lien est valable {$minutes} minutes et ne peut être utilisé qu'une seule fois.")
                ->line("Si vous n'avez pas créé de compte, ignorez simplement cet e-mail.")
                ->salutation("L'équipe Marketplace B2B");
        });
    }

    /**
     * E-mail « Mot de passe oublié » (SCRUM-26) : le lien ouvre la page React « Nouveau mot de passe ».
     */
    private function configurePasswordReset(): void
    {
        ResetPassword::createUrlUsing(function (User $user, string $token) {
            return config('app.frontend_url').'/mot-de-passe/nouveau?'.http_build_query([
                'token' => $token,
                'email' => $user->getEmailForPasswordReset(),
            ]);
        });

        ResetPassword::toMailUsing(function (User $user, string $token) {
            $url = call_user_func(ResetPassword::$createUrlCallback, $user, $token);
            $minutes = (int) config('auth.passwords.users.expire', 60);

            return (new MailMessage)
                ->subject('Réinitialisation de votre mot de passe')
                ->greeting("Bonjour {$user->name},")
                ->line('Vous avez demandé à changer le mot de passe de votre compte Marketplace B2B.')
                ->action('Choisir un nouveau mot de passe', $url)
                ->line("Ce lien est valable {$minutes} minutes et ne peut être utilisé qu'une seule fois.")
                ->line("Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.")
                ->salutation("L'équipe Marketplace B2B");
        });
    }
}
