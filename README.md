# Marketplace B2B

Plateforme de gestion des achats et des ventes entre **fournisseurs** et **porteurs de projet** — projet d'intégration, ISET Djerba.

Le porteur de projet publie un besoin ou commande un produit, les fournisseurs répondent par des devis, la commande est payée puis suivie jusqu'à la facture, et l'administrateur supervise la plateforme. L'IA aide à décider sans jamais décider à la place de l'utilisateur.

| Dossier | Contenu | Stack |
|---|---|---|
| `backend/` | API REST | Laravel 12, PHP 8.2+, MySQL, Sanctum (jetons Bearer) |
| `frontend/` | Application web (et base de l'application mobile) | React 19, Vite, React Router, Zustand, Axios, Tailwind CSS 4 |
| `docs/` | Décisions de l'équipe et conventions | Markdown |

Backlog et sprints : Jira, projet **SCRUM**.

## Prérequis

- PHP 8.2 ou plus, Composer 2
- MySQL 8 (ou MariaDB 10.6+)
- Node.js 20 ou plus, npm

## Installation

### 1. API (backend)

```bash
cd backend
composer install
cp .env.example .env          # puis renseigner DB_DATABASE, DB_USERNAME, DB_PASSWORD
php artisan key:generate
php artisan migrate --seed    # crée les tables et les comptes de démonstration
php artisan serve             # http://localhost:8000
```

Créez d'abord la base vide : `CREATE DATABASE marketplace_b2b CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`

### 2. Application web (frontend)

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000/api
npm run dev                   # http://localhost:5173
```

### Comptes de démonstration

Mot de passe : `password`

| Rôle | E-mail |
|---|---|
| Administrateur | admin@marketplace.test |
| Fournisseur | fournisseur@marketplace.test |
| Porteur de projet | porteur@marketplace.test |

## Tests

```bash
cd backend && php artisan test     # tests PHPUnit (base SQLite en mémoire)
cd frontend && npm test            # tests Vitest + Testing Library
```

Les deux suites tournent automatiquement sur chaque pull request (GitHub Actions).

## Architecture en bref

- **Authentification** : `POST /api/auth/login` renvoie un jeton Sanctum, envoyé ensuite dans l'en-tête `Authorization: Bearer …`. Le même mécanisme sert au web et au mobile.
- **Vérification de l'e-mail** : à l'inscription, l'événement `Registered` envoie un lien signé (valable 60 min, `AUTH_VERIFICATION_EXPIRE`, un seul usage) qui ouvre la page React `/email/verifier` (`FRONTEND_URL`). Tant que l'adresse n'est pas vérifiée, l'utilisateur peut se connecter et redemander un lien (`POST /api/auth/email/resend`, 1 par minute), mais le middleware `verified` lui ferme les espaces métier. En local (`MAIL_MAILER=log`), le lien se trouve dans `storage/logs/laravel.log`.
- **Connexion et mot de passe** : « Se souvenir de moi » donne un jeton de 7 jours (sinon 12 h, `AUTH_SESSION_HOURS`). « Mot de passe oublié » (`POST /api/auth/forgot-password` puis `/reset-password`) envoie un lien valable 60 min et à usage unique vers la page React `/mot-de-passe/nouveau` ; changer son mot de passe ferme toutes les sessions ouvertes.
- **Rôles** : `supplier` (fournisseur), `buyer` (porteur de projet), `admin`. Côté API, chaque groupe de routes est protégé par le middleware `role:` ; côté React, chaque espace est protégé par un `loader` de garde (`router/routes.jsx`, règles dans `router/guard.js`).
- **Organisation du backend** : `Controllers/Api` (minces) → `Http/Requests` (validation) → `Services` (règles métier) → `Models`, réponses via `Http/Resources`.
- **Organisation du frontend** : `api/http.js` (client unique, gestion des erreurs 401/403), `stores/` (Zustand), `router/` (adresses, routes et gardes par rôle), `layouts/`, `components/`, `views/<espace>/`.

## Travailler ensemble

Voir [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) : branches, commits liés à Jira, pull requests. Les décisions d'équipe sont notées dans [`docs/decisions.md`](docs/decisions.md).
# marketplace-b2b
