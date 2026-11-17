# Lancer le projet en une commande (Docker)

Tout le projet tourne dans Docker : rien d'autre à installer (ni PHP, ni MySQL, ni Node).

| Service | Adresse | Rôle |
|---|---|---|
| web | http://localhost:5173 | Application React (build Vite servi par nginx) |
| api | http://localhost:8000 | API Laravel |
| mailpit | http://localhost:8025 | Boîte de réception des e-mails de test (vérification, mot de passe oublié) |
| db | — | MySQL 8.4, données conservées entre deux démarrages |

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
| Voir les journaux de l'API | `docker compose -f deploy/docker-compose.yml logs -f api` |
| Lancer une commande Artisan | `docker compose -f deploy/docker-compose.yml exec api php artisan migrate:status` |

Le code est **copié** dans les images (pas de dossier partagé) : relancez `./deploy/start.sh` après chaque modification.
Pour développer au quotidien avec rechargement à chaud, suivez plutôt l'installation classique du [README principal](../README.md).

## Réglages

Copiez `deploy/.env.example` en `deploy/.env` pour changer les ports, les adresses ou les mots de passe.
Si vous changez un port, changez aussi `WEB_URL` / `API_URL`, puis relancez `./deploy/start.sh`.

## Sur un serveur

Mettez l'adresse du serveur dans `WEB_URL` et `API_URL` (`deploy/.env`), changez les mots de passe MySQL et passez
`APP_ENV=production`, `APP_DEBUG=false`. L'API utilise `php artisan serve` : suffisant pour une démo ou une recette,
mais pas pour une mise en production publique (prévoir alors nginx + PHP-FPM et HTTPS, ticket SCRUM-129).
