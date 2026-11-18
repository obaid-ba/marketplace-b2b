# Lancer le projet en une commande (Docker)

Tout le projet tourne dans Docker : rien d'autre à installer (ni PHP, ni PostgreSQL, ni Node).

| Service | Adresse | Rôle |
|---|---|---|
| web | http://localhost:5173 | Application React (build Vite servi par nginx) |
| api | http://localhost:8000 | API Laravel (nginx + PHP-FPM) |
| worker | — | File d'attente (diffusion des demandes, e-mails) |
| mailpit | http://localhost:8025 | Boîte de réception des e-mails de test |
| db | — | PostgreSQL 17, données conservées dans le volume `db-data` |

## Prérequis

[Docker Desktop](https://www.docker.com/products/docker-desktop/) (ou Docker Engine + le plugin `docker compose`).

## Démarrer

```bash
./deploy/start.sh
```

La première fois, la construction des images prend quelques minutes. Le script attend que l'API réponde puis affiche les adresses.

Sous Windows sans terminal bash : `docker compose -f deploy/docker-compose.yml up -d --build`.

**Comptes de démonstration** (créés au premier démarrage, mot de passe `password`) :
`admin@marketplace.test`, `buyer1@marketplace.test` … `buyer5@marketplace.test`, `supplier1@marketplace.test` … `supplier8@marketplace.test`
(`supplier7` est en attente de validation, `supplier8` refusé).

## Commandes utiles

| Action | Commande |
|---|---|
| Arrêter (données conservées) | `./deploy/stop.sh` |
| Tout effacer (base recréée avec les données de démo au prochain démarrage) | `./deploy/stop.sh --reset` |
| Prendre en compte un `git pull` ou une modification du code | `./deploy/start.sh` (reconstruit les images) |
| Voir les journaux de l'API/worker | `docker compose -f deploy/docker-compose.yml logs -f api worker` |
| Lancer une commande Artisan | `docker compose -f deploy/docker-compose.yml exec api php artisan migrate:status` |

Le code est **copié** dans les images (pas de dossier partagé) : relancez `./deploy/start.sh` après chaque modification.
Pour développer au quotidien avec rechargement à chaud, suivez plutôt l'installation classique du [README principal](../README.md).

## Réglages

Copiez `deploy/.env.example` en `deploy/.env` pour changer les ports, les adresses, le mot de passe PostgreSQL, le mode mail (Mailpit par défaut, Brevo SMTP pour de vrais e-mails) ou le stockage (`local` / `cloudinary`).
Si vous changez un port, changez aussi `WEB_URL` / `API_URL`, puis relancez `./deploy/start.sh`.

## Mise en production

Voir [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) pour la procédure Neon + Render + Brevo + Cloudinary et le blueprint [`render.yaml`](../render.yaml).
