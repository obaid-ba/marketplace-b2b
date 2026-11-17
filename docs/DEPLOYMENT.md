# Déploiement — Neon, Render, Resend, Cloudinary

Branche de référence : `feature/SCRUM-129-deploiement` (ticket **SCRUM-129 / F35**).
Objectif : une mise en production reproductible sans disque local persistant pour les fichiers utilisateurs.

## Architecture cible

| Composant | Rôle |
|---|---|
| **Neon** (PostgreSQL 17) | Base de données managée, `sslmode=require` |
| **Render Web Service** (`marketplace-api`) | API Laravel en Docker : nginx + PHP-FPM + supervisor, healthcheck `/up` |
| **Render Background Worker** (`marketplace-worker`) | `php artisan queue:work` (diffusion des demandes, e-mails, jobs) |
| **Render Cron** (`marketplace-scheduler`) | `php artisan schedule:run` chaque minute |
| **Render Static Site** (`marketplace-web`) | Build Vite du frontend (`frontend/dist`), réécriture SPA vers `index.html` |
| **Resend** | Envoi des e-mails transactionnels via SMTP |
| **Cloudinary** | Stockage des fichiers : images/logos publics, documents privés servis par URL signée |

Le dépôt fournit l’infrastructure dans [`deploy/`](../deploy/) et le blueprint Render [`render.yaml`](../render.yaml).

## 1. Base de données (Neon)

1. Créer un projet Neon (région proche de Render, ex. Frankfurt) et une base `marketplace_b2b`.
2. Récupérer l’URL de connexion PostgreSQL, au format :
   `postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
3. La fournir à Render via `DB_URL`. Le backend lit `DB_CONNECTION=pgsql` et `DB_URL` en priorité (voir `backend/config/database.php`).

Notes :
- Les tests CI tournent sur SQLite (rapide) **et** sur PostgreSQL 17 pour détecter les écarts.
- Les migrations sont portables (PostgreSQL inclus). Une correction dédiée supprime la contrainte CHECK résiduelle sur `supplier_documents.type` après passage de l’enum en chaîne.

## 2. E-mails (Resend)

1. Créer un compte Resend, ajouter et vérifier le domaine d’envoi (enregistrements DNS **SPF, DKIM** et le MX/Return-Path demandé par Resend).
2. Créer une clé API.
3. Variables côté API :

| Variable | Valeur |
|---|---|
| `MAIL_MAILER` | `smtp` |
| `MAIL_HOST` | `smtp.resend.com` |
| `MAIL_PORT` | `587` |
| `MAIL_USERNAME` | `resend` |
| `MAIL_PASSWORD` | clé API Resend (`re_...`) |
| `MAIL_FROM_ADDRESS` | adresse sur le domaine vérifié (ex. `no-reply@votredomaine.tld`) |
| `MAIL_FROM_NAME` | `Marketplace B2B` |

Sans domaine vérifié, Resend n’autorise l’envoi que depuis `onboarding@resend.dev` vers l’adresse du compte (limite de test, inutilisable en démo publique).

## 3. Fichiers (Cloudinary)

Les fichiers utilisateurs ne sont **pas** stockés sur le disque du conteneur (éphémère sur Render). Le pilote est sélectionné par `MEDIA_DRIVER` :

- `local` : disques Laravel (`storage/app/public` et `storage/app/private`) — développement et tests.
- `cloudinary` : production.

Configuration :
1. Créer un compte Cloudinary et récupérer `CLOUDINARY_URL` (`cloudinary://api_key:api_secret@cloud_name`).
2. Dans **Settings → Security** :
   - activer **Allow delivery of PDF and ZIP files** (les justificatifs et pièces jointes sont des PDF/DOC/images),
   - s’assurer que les assets `authenticated` sont autorisés (le backend signe les URLs).
3. Variable : `MEDIA_DRIVER=cloudinary`, `CLOUDINARY_URL=...`.

Comportement :
- **Images et logos** : ressource `image`, type `upload` (URL publique CDN).
- **Documents privés** (justificatifs fournisseurs, etc.) : ressource `raw`, type `authenticated`, servis par l’API via une **URL signée** (pas d’accès public direct).
- Les clés stockées en base sont préfixées (`image:...`, `raw:...`).

## 4. Render

### Déploiement via Blueprint

1. Pousser la branche, puis **Render Dashboard → Blueprints → New Blueprint Instance** en pointant sur le dépôt (fichier `render.yaml`).
2. Créer le groupe d’environnement `marketplace-api-env` et renseigner les secrets marqués `sync: false` :

| Variable | Note |
|---|---|
| `APP_KEY` | `php artisan key:generate --show` (format `base64:...`) |
| `APP_URL` | URL publique de l’API Render (ex. `https://marketplace-api.onrender.com`) |
| `FRONTEND_URL` / `FRONTEND_URLS` | URL du site statique (CORS et liens e-mail) |
| `DB_URL` | URL Neon complète (`...?sslmode=require`) |
| `CLOUDINARY_URL` | `cloudinary://...` |
| `MAIL_PASSWORD` | clé API Resend |
| `MAIL_FROM_ADDRESS` | adresse expéditrice vérifiée |

3. Pour le site statique `marketplace-web`, définir `VITE_API_URL` vers l’API publique (`https://.../api`).
4. Premier déploiement : les migrations s’exécutent via `preDeployCommand: php artisan migrate --force`. Laisser `SEED_DEMO_DATA=false` en production réelle.

### Détails runtime

- L’image API (`deploy/api/Dockerfile`) embarque nginx + PHP-FPM derrière supervisor et écoute sur `$PORT` (exigence Render).
- Healthcheck : `GET /up`.
- Le proxy TLS est pris en compte (`TrustProxies`), les URLs sont forcées en HTTPS en production.
- Le worker (`/usr/local/bin/worker.sh`) traite la file `database` (`QUEUE_CONNECTION=database`).
- Le planificateur exécute `php artisan schedule:run` (cron Render, chaque minute).

## 5. Développement local (parité PostgreSQL)

La stack locale reproduit la prod (PostgreSQL 17, worker, Mailpit) :

```bash
./deploy/start.sh            # build + démarrage (web :5173, api :8000, mailpit :8025)
./deploy/stop.sh             # arrêt (données conservées)
./deploy/stop.sh --reset     # remise à zéro (volumes supprimés)
```

Copier `deploy/.env.example` vers `deploy/.env` pour ajuster les ports, le mot de passe DB, `MEDIA_DRIVER=cloudinary` + `CLOUDINARY_URL`, ou basculer l’envoi d’e-mails sur Resend.

Comptes de démonstration (mot de passe `password`) créés au premier démarrage sur base vide :
`admin@marketplace.test`, `buyer1@marketplace.test` …, `supplier1@marketplace.test` …

## 6. Opérations

- **Migrations** : automatiques au pre-deploy Render (`migrate --force`). En manuel : `php artisan migrate --force`.
- **Caches** : l’entrypoint régénère `config:cache` (et tente `route:cache` / `view:cache`) au démarrage.
- **Rollback applicatif** : redéployer le commit précédent depuis Render. Les migrations ne sont pas annulées automatiquement ; prévoir une migration corrective plutôt qu’un `migrate:rollback` en production.
- **Vérification rapide** : `GET /up` (200), connexion, consultation catalogue, téléchargement d’un justificatif (URL signée), réception d’un e-mail de test.

## 7. Limites et points d’attention

- **Domaine Resend obligatoire** pour un envoi réel multi-destinataires.
- **Cloudinary (gratuit)** : activer la livraison PDF/ZIP ; les quotas API admin sont évités car les URLs signées sont générées côté application.
- **Coût Render** : les services web/worker/cron « starter » et le site statique ont des paliers de facturation propres ; Neon dispose d’un palier gratuit adapté au développement/démo.
- **Pièces jointes des appels d’offres (S3)** : le flux d’upload/téléchargement des demandes est livré sur la branche/PR S3 ; le raccordement à `MediaStorage` doit être finalisé après fusion de la PR #18 pour éviter les conflits.
