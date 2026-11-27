# TijaraLink — Marketplace B2B

Plateforme B2B qui relie les **porteurs de projet** (acheteurs) aux **fournisseurs** tunisiens : on publie un besoin,
on reçoit des devis comparables, on commande et on suit la livraison jusqu'à la facture. Un **administrateur** valide
les fournisseurs et supervise la plateforme. L'**IA** aide à rédiger et à comparer, sans jamais décider à la place de
l'utilisateur.

Projet d'intégration — **ISET Djerba**, 2026.

| | Adresse |
|---|---|
| **Site web** (aucune installation) | <https://tijaralink-web.onrender.com> |
| **API** (état du service) | <https://tijaralink-api.onrender.com/up> |
| **Application Android** | APK fabriqué avec EAS Build, voir [Application mobile](#application-mobile) |
| **Comptes de démonstration** | mot de passe `password`, voir [Comptes de démonstration](#comptes-de-démonstration) |

**Équipe** : Aouida Basmala · Souissi Oumayma · Ben Ali Obaid-Allah · Ben Khmis Ahmed · Grolli Aziz

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Technologies et organisation du dépôt](#technologies-et-organisation-du-dépôt)
3. [Prérequis](#prérequis)
4. [Installation locale](#installation-locale)
5. [Comptes de démonstration](#comptes-de-démonstration)
6. [Intelligence artificielle](#intelligence-artificielle)
7. [Application mobile](#application-mobile)
8. [Déploiement en ligne (Render)](#déploiement-en-ligne-render)
9. [Tests](#tests)
10. [Architecture](#architecture)
11. [Dépannage](#dépannage)
12. [Méthode de travail](#méthode-de-travail)

---

## Fonctionnalités

### Visiteur
- Page d'accueil : recherche par mot-clé et région, chiffres clés, catégories, **catalogue avec photos**, produits mis
  en avant, « Comment ça marche ».
- Catalogue public avec filtres (catégorie, type, région, prix, délai, note), fiches produit et fiches fournisseur.
- Inscription porteur de projet ou fournisseur, connexion, mot de passe oublié.

### Porteur de projet
- **Tableau de bord** : dépenses, commandes, demandes publiées, devis en attente, fournisseurs favoris, courbe
  d'activité, dernières activités, période 30 jours / 3 mois / 1 an.
- **Publier une demande de devis** (avec pièces jointes) ; l'IA propose la catégorie, les mots-clés et les
  fournisseurs pertinents, qui sont notifiés.
- **Comparer les devis** côte à côte, avec un **résumé de l'IA** et une **estimation du prix du marché** ; accepter un devis.
- **Commandes** : suivi étape par étape (validée → en préparation → expédiée → livrée → clôturée), devis et facture en PDF.
- Fournisseurs favoris, **avis** vérifiés après livraison, **litiges**, **messagerie**, notifications.

### Fournisseur
- Dossier de validation (justificatifs) ; tant qu'il n'est pas validé, les pages de vente restent fermées.
- **Tableau de bord** : revenu, commandes, taux de devis acceptés, note moyenne, vues des produits, demandes à traiter.
- **Produits** : ajout, photos, mise en avant, retrait ; aide de l'IA pour rédiger la description.
- **Demandes reçues** classées par pertinence, **devis**, **commandes** à faire avancer, **avis** (réponse) et
  résumé des avis par l'IA, litiges reçus, messagerie, profil de l'entreprise.

### Administrateur
- **Tableau de bord** : utilisateurs actifs, fournisseurs validés, commandes, revenu global, demandes, files à
  traiter, alertes d'anomalie, **export** des statistiques (CSV / Excel).
- **Validation des fournisseurs**, **utilisateurs** (suspendre, réactiver, supprimer), **catégories**,
  **contrôle du catalogue** (produits signalés par l'IA), **avis signalés**, **litiges**, **journal d'audit**.

### Pour tous
- Notifications sur le site, par e-mail et (simulées) par WhatsApp ; temps réel avec Reverb.
- Paramètres du compte, préférences de notification, assistant d'aide (chatbot).
- **Application mobile** Android / iOS avec les mêmes données que le site.

---

## Technologies et organisation du dépôt

| Dossier | Contenu | Technologies |
|---|---|---|
| `backend/` | API REST | Laravel 12, PHP 8.2+, Sanctum (jetons Bearer), Reverb (temps réel), DomPDF, PostgreSQL ou MySQL |
| `frontend/` | Site web | React 19, Vite, React Router, Zustand, Axios, Tailwind CSS 4, Recharts |
| `mobile/` | Application mobile | React Native 0.88, Expo SDK 58, React Navigation, EAS Build |
| `deploy/` | Image Docker de production et stack locale | Docker, nginx + PHP-FPM + supervisor, PostgreSQL 17, Mailpit |
| `docs/` | Décisions, feuille de route, documentation de l'API | Markdown |
| `render.tijaralink.yaml` | Description de l'hébergement Render (Blueprint) | Render |

IA : API **Gemini** de Google (ou mode simulé sans clé). Suivi du projet : **Jira**, projet `SCRUM`.

---

## Prérequis

- **PHP 8.2+** et **Composer 2** (Laragon ou XAMPP sous Windows conviennent)
- **MySQL 8 / MariaDB 10.6+** ou **PostgreSQL 14+**
- **Node.js 20+** et npm
- Optionnel : **Docker Desktop** pour la stack complète (`deploy/`)
- Pour le mobile : l'application **Expo Go** sur le téléphone, et un compte gratuit sur <https://expo.dev> pour fabriquer l'APK

---

## Installation locale

### Option A — Docker (tout en une commande)

```bash
./deploy/start.sh   # API http://localhost:8000 · site http://localhost:5173 · e-mails http://localhost:8025 (Mailpit)
```

Détails : [`deploy/README.md`](deploy/README.md).

### Option B — Installation manuelle

#### 1. Backend (API)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Dans `backend/.env`, réglez la base de données. Exemple avec MySQL (Laragon) :

```bash
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=marketplace_b2b
DB_USERNAME=root
DB_PASSWORD=
SEED_DEMO_DATA=true          # crée les comptes et la démo complète
```

Créez la base (`CREATE DATABASE marketplace_b2b CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`, ou
`createdb marketplace_b2b` avec PostgreSQL), puis :

```bash
php artisan migrate --seed   # tables, 24 régions, catégories et, si SEED_DEMO_DATA=true, la démo complète
php artisan storage:link     # rend les photos des produits accessibles
php artisan serve --port=8001
```

Dans d'autres terminaux, toujours dans `backend/` :

```bash
php artisan queue:work       # envoie les notifications et e-mails (ou QUEUE_CONNECTION=sync dans .env)
php artisan reverb:start     # temps réel (facultatif : sans lui, les pages se rafraîchissent toutes les 30 s)
```

Pour repartir d'une démo propre (efface toute la base) : `php artisan demo:reset local-1`.

En local, les e-mails ne partent pas : ils sont écrits dans `storage/logs/laravel.log` (`MAIL_MAILER=log`).

#### 2. Site web (frontend)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                  # http://localhost:5173
```

Dans `frontend/.env`, `VITE_API_URL` doit viser le même port que l'API : `http://localhost:8001/api` si vous avez
lancé `php artisan serve --port=8001` (le fichier d'exemple indique le port 8000, celui de Docker).

---

## Comptes de démonstration

Les mêmes comptes servent sur le site, sur l'application mobile, en local et en ligne. Mot de passe : **`password`**.

| Rôle | E-mail | À montrer |
|---|---|---|
| Administrateur | `admin@tijaralink.test` | tableau de bord, fournisseur en attente, avis signalé, litiges, export |
| Porteur de projet | `sana@tijaralink.test` | demande avec 3 devis à comparer (résumé IA, prix du marché), commandes, messagerie |
| Porteur de projet | `karim@tijaralink.test` | litige ouvert sur une commande livrée |
| Porteur de projet | `youssef@tijaralink.test` | litige décidé, commande validée |
| Fournisseur | `atlas@tijaralink.test` | demandes reçues, devis, produits mis en avant, avis et résumé IA |
| Fournisseur | `batisud@tijaralink.test` | avis suspect signalé à l'administrateur |
| Fournisseur en attente | `fournisseur.attente@tijaralink.test` | page « dossier en attente de validation » |

**Parcours de démonstration** : accueil → catalogue → fiche produit → connexion porteur (Sana) → tableau de bord →
comparer les devis avec le résumé IA → accepter → suivre la commande ; côté fournisseur (Atlas) : demandes reçues →
déposer un devis → commandes ; côté admin : valider un fournisseur, traiter un avis signalé.

La démo contient 14 fournisseurs avec logo et 42 produits et services publiés, chacun avec une **photo réelle**
(sources dans [`backend/database/seeders/demo-images/products/CREDITS.md`](backend/database/seeders/demo-images/products/CREDITS.md)).

---

## Intelligence artificielle

Les fonctions d'IA passent toutes par le même service (`App\Services\Ai\AiService` : limite par utilisateur,
validation de la réponse, enregistrement dans `ai_interactions`) :
analyse d'une demande (catégorie, mots-clés, fournisseurs suggérés), résumé des devis, prix du marché, aide à la
rédaction, analyse et résumé des avis, modération des produits, assistant d'aide.

| `AI_PROVIDER` | Effet |
|---|---|
| `simulated` (par défaut) | réponses calculées par des règles, **sans clé et sans appel extérieur**, affichées « mode simulé » |
| `gemini` | vraie IA de Google ; clé dans `AI_API_KEY`, modèle `AI_MODEL` (par défaut `gemini-3.5-flash-lite`) |
| `disabled` | fonctions d'IA désactivées |

Exemple dans `backend/.env` :

```bash
AI_PROVIDER=gemini
AI_API_KEY=votre_cle_gemini   # ne jamais la mettre dans un fichier commité
AI_MODEL=gemini-3.5-flash-lite
```

Si `AI_PROVIDER=gemini` sans clé, l'application repasse d'elle-même en mode simulé. Clé gratuite :
<https://aistudio.google.com/apikey>. Pour brancher un autre fournisseur : une classe qui implémente
`App\Services\Ai\AiClient`, ajoutée à `drivers` dans `backend/config/ai.php`.

---

## Application mobile

Le dossier `mobile/` contient une application **React Native (Expo)** qui utilise **la même API et la même base** que le
site : tout ce qui est fait d'un côté apparaît de l'autre.

### Écrans

Chaque espace a 4 onglets et un onglet **Menu** qui reprend la barre latérale du site.

| Visiteur | Porteur de projet | Fournisseur | Administrateur |
|---|---|---|---|
| Accueil, catalogue, fiche produit, connexion | Tableau de bord, mes demandes, publier une demande, mes commandes, fournisseurs favoris, mes litiges, assistant IA, messagerie, notifications, paramètres | Tableau de bord, mes produits, demandes reçues, mes devis, mes commandes, mes avis (réponse), litiges reçus, assistant IA, messagerie, notifications, profil de l'entreprise, paramètres | Tableau de bord, validation fournisseurs, utilisateurs, catégories, contrôle du catalogue, avis signalés, litiges, journal d'audit, notifications |

Restent sur le site (lien direct depuis l'application) : inscription, mot de passe oublié, pièces jointes, dépôt d'un
devis, décision d'un litige, modification du profil et des catégories.

**Synchronisation avec le site** : rechargement à chaque retour sur un écran, toutes les 10 s dans la messagerie et
toutes les 30 s pour les badges de messages et de notifications.

### Tester avec Expo Go (développement)

1. Lancez l'API pour qu'elle écoute sur le réseau :
   ```bash
   cd backend
   php artisan serve --host=0.0.0.0 --port=8001
   ```
2. Lancez l'application :
   ```bash
   cd mobile
   npm install
   npm run start:phone      # ou : npx expo start
   ```
3. Scannez le QR code avec **Expo Go** (Android) ou l'appareil photo (iPhone). Le téléphone et le PC doivent être sur le
   **même Wi-Fi**.

`start:phone` fixe l'adresse IP du PC (`192.168.1.83`) dans `mobile/package.json` : remplacez-la par celle de votre
carte Wi-Fi (`ipconfig`). Sur un réseau qui bloque les appareils entre eux : `npm run start:tunnel`.

**Adresse de l'API** : l'application la trouve seule (IP du PC qui sert l'application, port 8001 ; émulateur Android :
`10.0.2.2` ; navigateur : `localhost`). Pour la forcer, créez `mobile/.env` (non commité) :

```bash
# API locale
EXPO_PUBLIC_API_URL=http://192.168.1.83:8001/api
EXPO_PUBLIC_WEB_URL=http://192.168.1.83:5173

# ou l'API en ligne (fonctionne partout, même en 4G)
EXPO_PUBLIC_API_URL=https://tijaralink-api.onrender.com/api
EXPO_PUBLIC_WEB_URL=https://tijaralink-web.onrender.com
```

Pour tester l'application dans le navigateur (`npx expo start --web`, port 8081), ajoutez l'origine au CORS du backend :
`FRONTEND_URLS=http://localhost:5173,http://localhost:8081`.

### Fabriquer l'APK Android (installable sans PC)

L'APK utilise l'**API en ligne** (adresses dans [`mobile/eas.json`](mobile/eas.json)) : il fonctionne sur n'importe
quel réseau, sans le PC.

```bash
npm install -g eas-cli
cd mobile
eas login
EAS_NO_VCS=1 EAS_PROJECT_ROOT="$(pwd)" eas build -p android --profile preview   # Git Bash
```

Sous **PowerShell** : `$env:EAS_NO_VCS=1; $env:EAS_PROJECT_ROOT=(Get-Location).Path; eas build -p android --profile preview`.

`EAS_NO_VCS` et `EAS_PROJECT_ROOT` font envoyer **uniquement** le dossier `mobile/` aux serveurs d'Expo (sinon EAS
envoie tout le dépôt et bute sur le lien `backend/public/storage` sous Windows). La fabrication prend 10 à 20 minutes ;
EAS donne ensuite un **lien et un QR code** pour télécharger l'APK. Sur le téléphone : télécharger avec **Chrome**,
autoriser « Installer des applications inconnues », puis installer. Android 7.0 minimum.

Version iPhone installable : compte Apple Developer nécessaire (`eas build -p ios`) ; sans compte, utiliser Expo Go
ou le site web.

### Organisation du code mobile

`App.js` (navigation par rôle) · `src/config.js` (adresses de l'API et du site) · `src/theme.js` (couleurs du site) ·
`src/api/client.js` (jeton Sanctum, erreurs en français, adresses des images) · `src/auth/` (session gardée dans le
trousseau du téléphone) · `src/sync/` (compteurs non lus) · `src/navigation/menus.js` (menus par rôle) ·
`src/components/` · `src/screens/`.

---

## Déploiement en ligne (Render)

Le site, l'API et la base sont hébergés gratuitement sur **Render**. Tout est décrit dans
[`render.tijaralink.yaml`](render.tijaralink.yaml).

```mermaid
flowchart LR
  T["Navigateur<br/>équipe · jury"] -->|"HTTPS"| WEB
  M["Application Android<br/>(APK EAS)"] -->|"HTTPS /api"| API

  subgraph Render["Render · plan gratuit · Francfort"]
    WEB["Site statique<br/>tijaralink-web.onrender.com"]
    API["API Docker<br/>tijaralink-api.onrender.com"]
    DB[("PostgreSQL<br/>tijaralink-db")]
  end

  WEB -->|"/api"| API
  API --> DB
  API -->|"IA"| G["Gemini<br/>(si AI_API_KEY)"]
```

| Élément | Rôle |
|---|---|
| `tijaralink-db` | base **PostgreSQL** créée par Render, reliée à l'API sans mot de passe à copier (`fromDatabase`) |
| `tijaralink-api` | API Laravel dans Docker ([`deploy/api/Dockerfile`](deploy/api/Dockerfile)), contrôlée par `/up` |
| `tijaralink-web` | site React construit par Vite (`npm run build`) et publié sur le CDN de Render |

### Créer le déploiement (une seule fois)

1. Compte sur <https://render.com> (connexion avec GitHub). Si le dépôt n'appartient pas à votre compte, faites un
   **Fork** sur GitHub et donnez à Render l'accès à cette copie.
2. Render → **New** → **Blueprint** → dépôt, branche **`main`**, Blueprint Path **`render.tijaralink.yaml`**.
3. Saisissez **`AI_API_KEY`** (clé Gemini) quand Render la demande — c'est le seul secret. Puis **Apply**.
4. Après 10 à 20 minutes, `tijaralink-api` et `tijaralink-web` sont **Live**.

### Ce qui se passe au démarrage de l'API

Le script [`deploy/api/entrypoint.sh`](deploy/api/entrypoint.sh) attend la base, vérifie la clé `APP_KEY` (générée
par Render), lance les migrations, puis :

- **remplit la base une seule fois** avec la démo complète (`php artisan demo:reset`, jeton `RESET_DEMO_TOKEN`) ;
  changez la valeur du jeton pour tout recréer ;
- **recopie les photos de démonstration** depuis le dépôt à chaque démarrage (le disque du plan gratuit est effacé à
  chaque mise en veille).

### Mises à jour et limites

- Un **`git push` sur `main`** redéploie automatiquement (avec un fork : bouton **Sync fork** sur GitHub).
- L'API **s'endort** après un moment sans visite : le premier appel prend 30 à 60 s. Ouvrez le site quelques minutes
  avant une démonstration.
- Pas de serveur temps réel : messages et notifications se rafraîchissent toutes les 30 s.
- Les e-mails sont écrits dans les journaux (`MAIL_MAILER=log`) ; les comptes de démo sont déjà vérifiés.
- La base gratuite est supprimée par Render **30 jours** après sa création ; refaire le Blueprint recrée tout.

Variante avec TiDB Cloud, Mailjet et Cloudinary (premier déploiement de l'équipe) :
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Tests

```bash
cd backend && php artisan test     # ~500 tests PHPUnit (SQLite en mémoire, IA forcée en mode simulé)
cd frontend && npm test            # ~310 tests Vitest + Testing Library
cd frontend && npm run test:e2e    # parcours de bout en bout (Playwright)
cd frontend && npm run test:reel   # vérification de toutes les pages sur la plateforme en ligne
cd mobile && npx expo-doctor       # contrôle de la configuration Expo
```

Les tests backend et frontend tournent automatiquement sur chaque pull request (GitHub Actions,
[`.github/workflows/ci.yml`](.github/workflows/ci.yml)), sur SQLite et PostgreSQL.

---

## Architecture

- **API** : `Controllers/Api` (minces) → `Http/Requests` (validation) → `Services` (règles métier) → `Models`,
  réponses via `Http/Resources`. Documentation des routes : [`docs/api/`](docs/api/).
- **Site** : `api/http.js` (client unique, erreurs 401/403), `stores/` (Zustand), `router/` (adresses, routes et
  gardes par rôle), `layouts/` (barre latérale et barre du haut communes), `components/`, `views/<espace>/`.
- **Rôles** : `buyer` (porteur de projet), `supplier` (fournisseur), `admin`. Côté API, chaque groupe de routes est
  protégé par le middleware `role:` ; côté React et mobile, chaque espace a sa propre navigation.
- **Authentification** : `POST /api/auth/login` renvoie un jeton Sanctum, envoyé ensuite dans
  `Authorization: Bearer …`, pour le site comme pour le mobile. « Se souvenir de moi » : jeton de 7 jours (sinon 12 h).
- **Vérification de l'e-mail** : lien signé valable 60 min, à usage unique, vers la page `/email/verifier` ; tant que
  l'adresse n'est pas vérifiée, le middleware `verified` ferme les espaces métier.
- **Mot de passe oublié** : lien valable 60 min vers `/mot-de-passe/nouveau` ; changer son mot de passe ferme les
  autres sessions.
- **Fournisseur non validé** : redirigé vers `/fournisseur/en-attente` ; les pages de vente passent par le middleware
  `supplier.validated`.
- **Temps réel** : Reverb diffuse messages, accusés de lecture et notifications ; sans Reverb, rafraîchissement régulier.
- **Litiges** : signalés par l'acheteur entre l'expédition et la livraison, pris en charge puis décidés par l'admin.
- **Audit** : toute action d'un administrateur est enregistrée par `AuditLogger` (table `audit_logs`).
- **WhatsApp** : `WHATSAPP_PROVIDER=simulated` (rien n'est envoyé) ; repli automatique sur l'e-mail.
- **Fichiers** : photos et logos sur le disque `public` (ou Cloudinary avec `MEDIA_DRIVER=cloudinary`), documents
  privés servis par l'API. Taille maximale : messages 10 Mo, litiges 5 × 5 Mo
  (`upload_max_filesize=10M`, `post_max_size=32M` dans `php.ini`).

Modèle de données : [`docs/ENTITIES.md`](docs/ENTITIES.md). Décisions : [`docs/decisions.md`](docs/decisions.md).

---

## Dépannage

**« Impossible de joindre le serveur. Vérifiez votre connexion. »**
- En ligne : l'API se réveille (30 à 60 s) ; rechargez la page.
- En local : vérifiez que `php artisan serve --port=8001` tourne et que `VITE_API_URL` utilise le même port.
  Un seul serveur doit écouter sur ce port.
- Pages très lentes en local (plusieurs secondes par requête) : activez **OPcache** dans `php.ini`
  (`zend_extension=opcache`, `opcache.enable=1`) puis relancez `php artisan serve`.

**« Impossible de charger les régions »** (formulaires d'inscription) : la base n'est pas démarrée ou est vide.
Démarrez MySQL / PostgreSQL, vérifiez `curl http://localhost:8001/api/reference/regions` (24 régions attendues), et
relancez `php artisan db:seed` si besoin.

**Photos absentes en local** : lancez `php artisan storage:link`.

**Mobile — « There was a problem running the requested app »** (Expo Go) : le téléphone ne joint pas le PC.
1. Un seul `expo start` sur le port 8081 (sinon Expo passe au 8082, souvent bloqué).
2. Pare-feu Windows : ouvrir les ports 8081 et 8001 (PowerShell en administrateur), Wi-Fi en profil **Privé** :
   ```powershell
   New-NetFirewallRule -DisplayName "Expo Metro 8081" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private
   New-NetFirewallRule -DisplayName "Laravel API 8001" -Direction Inbound -Protocol TCP -LocalPort 8001 -Action Allow -Profile Private
   ```
3. Même Wi-Fi et bonne adresse IP dans `start:phone` (ou `npm run start:tunnel`).

**Mobile — « Impossible de joindre le serveur (adresse…) »** : l'adresse affichée est celle utilisée par l'application.
En local, relancez l'API avec `--host=0.0.0.0 --port=8001` ; sinon, utilisez l'API en ligne dans `mobile/.env`.

**APK — « Problème lors de l'analyse du package »** : fichier incomplet ; supprimez-le et retéléchargez-le avec
Chrome, en Wi-Fi, puis ouvrez-le depuis le gestionnaire de fichiers.

**Build EAS — `EPERM: operation not permitted, symlink`** : lancez la commande avec `EAS_NO_VCS=1` et
`EAS_PROJECT_ROOT` (voir [Fabriquer l'APK](#fabriquer-lapk-android-installable-sans-pc)).

---

## Méthode de travail

- **Scrum** : sprint 0 de cadrage puis sept sprints de livraison (S1 à S7), backlog et tickets dans **Jira** (projet
  `SCRUM`). Feuille de route : [`docs/ROADMAP.md`](docs/ROADMAP.md) ; journal : [`docs/PROGRESS.md`](docs/PROGRESS.md).
- **Git** : une branche et une pull request par ticket, commits liés à Jira, tests automatiques sur chaque pull request.
  Règles : [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).
- **Décisions d'équipe** : [`docs/decisions.md`](docs/decisions.md) ; questions ouvertes :
  [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md) ; sécurité : [`docs/SECURITY.md`](docs/SECURITY.md).
