# TijaraLink (Marketplace B2B) — explication complète de l'application

> Document rédigé à partir du code du dépôt (branche `main`, 27/11/2026).
> Parties 1 à 13 : explications rédigées. Parties 14 et 15 : arborescence complète et fiche de **chaque fichier**
> (contenu, rôle, fonctions), générées à partir du code et de ses commentaires.

## Sommaire

1. [Vue d'ensemble : que fait l'application ?](#1-vue-densemble--que-fait-lapplication-)
2. [Architecture générale](#2-architecture-générale)
3. [« Microservices » : ce qu'est vraiment l'architecture](#3-microservices--ce-quest-vraiment-larchitecture)
4. [Le backend (API Laravel)](#4-le-backend-api-laravel)
5. [La base de données](#5-la-base-de-données)
6. [Le frontend web (React)](#6-le-frontend-web-react)
7. [L'application mobile (Expo / React Native)](#7-lapplication-mobile-expo--react-native)
8. [La connexion front ↔ back ↔ base : le parcours d'une requête](#8-la-connexion-front--back--base--le-parcours-dune-requête)
9. [Les rôles et la sécurité](#9-les-rôles-et-la-sécurité)
10. [Les routes (API et pages React)](#10-les-routes-api-et-pages-react)
11. [Fonctionnalité de chaque service](#11-fonctionnalité-de-chaque-service)
12. [Déploiement, hébergement et flux](#12-déploiement-hébergement-et-flux)
13. [Pourquoi ces choix ? Avantages et inconvénients](#13-pourquoi-ces-choix--avantages-et-inconvénients)
14. [Arborescence complète des dossiers](#14-arborescence-complète-des-dossiers)
15. [Fiche de chaque fichier](#15-fiche-de-chaque-fichier)

---

## 1. Vue d'ensemble : que fait l'application ?

**TijaraLink** (« Tijara » = commerce en arabe) est une **place de marché B2B tunisienne** qui met en relation :

- des **porteurs de projet** (acheteurs : entreprises, startups, associations…) ;
- des **fournisseurs** (entreprises qui vendent produits et services) ;
- sous la supervision d'un **administrateur**.

Le cycle métier complet :

```
Fournisseur s'inscrit ──► Admin valide son dossier ──► Fournisseur publie son profil et ses produits
                                                                   │
Porteur s'inscrit ──► cherche dans le catalogue ──► commande directe ┐
                 └──► publie une DEMANDE (appel d'offres)            │
                         │ diffusion automatique aux fournisseurs    │
                         ▼ pertinents (score)                        │
                   Fournisseurs envoient des DEVIS                   │
                         ▼                                           │
                   Porteur compare (aidé par l'IA) et accepte ───────┤
                                                                     ▼
                         COMMANDE : validée → en préparation → expédiée → en livraison → livrée → clôturée
                         (PDF devis + facture, messagerie, litige possible)
                                                                     ▼
                                       AVIS du porteur → note du fournisseur → modération admin
```

Autour de ce cœur : messagerie temps réel, notifications (site, e-mail, WhatsApp), tableaux de bord avec
graphiques, exports CSV/XLSX, journal d'audit, détection d'anomalies et **assistants IA** (rédaction,
analyse des demandes, résumé des devis, prix du marché, analyse des avis, modération, chatbot).
Principe affiché partout dans le code : **« l'IA aide à décider, elle ne décide jamais »**.

---

## 2. Architecture générale

Le dépôt est un **monorepo** (décision D4) qui contient trois applications et leur infrastructure :

| Dossier | Rôle | Technologies |
|---|---|---|
| `backend/` | **API REST** (toute la logique, la sécurité, l'accès aux données) | Laravel 12, PHP 8.3, Sanctum, Reverb, Eloquent |
| `frontend/` | **Site web** (SPA) + PWA installable | React 19, Vite, React Router, Zustand, Axios, Tailwind 4, Recharts |
| `mobile/` | **Application mobile** Android/iOS (et web) | Expo 58, React Native 0.88, React Navigation |
| `deploy/` | Images Docker et stack locale | Docker, nginx, PHP-FPM, supervisor, PostgreSQL 17, Mailpit |
| `render.tijaralink.yaml` | Description de l'hébergement (Infrastructure as Code) | Render Blueprints |
| `docs/` | Décisions, entités, sécurité, déploiement, doc d'API | Markdown, OpenAPI, Postman |
| `.github/` | Intégration continue (tests automatiques à chaque PR) | GitHub Actions |

Schéma des composants :

```
               ┌──────────────────────┐     ┌──────────────────────┐
               │  Navigateur (React)  │     │ Téléphone (Expo/RN)  │
               │  frontend/  (SPA)    │     │  mobile/             │
               └──────────┬───────────┘     └──────────┬───────────┘
                          │ HTTPS + JSON, en-tête Authorization: Bearer <jeton Sanctum>
                          ▼                            ▼
              ┌───────────────────────────────────────────────────────┐
              │               API Laravel  (backend/)                  │
              │ nginx → PHP-FPM → routes/api.php → middlewares         │
              │   → Controllers → Requests → Services → Models          │
              │   → Resources (JSON)                                   │
              │ + Jobs (file d'attente)  + Notifications  + Events      │
              └───┬───────────┬───────────┬───────────┬───────────┬────┘
                  │           │           │           │           │
            PostgreSQL     SMTP e-mail  Cloudinary   Gemini     Reverb (WebSocket,
            (TiDB / Render) (Mailjet /   (photos,     (IA)       optionnel) → push
                            Mailpit)     documents)              vers les clients
```

Points-clés :

- **Le backend est une API pure** (`routes/web.php` ne renvoie qu'un petit JSON) : aucune page HTML n'est produite par Laravel, sauf les PDF (devis/facture) et la page Swagger `/api/docs`.
- **Le web et le mobile sont deux clients indépendants** de la même API, avec le même mécanisme d'authentification (jeton Bearer).
- **Les services externes sont interchangeables** grâce à des interfaces (« contrats ») : `MediaStorage` (local ou Cloudinary), `AiClient` (simulé ou Gemini), `WhatsAppClient` (simulé), et le mailer Laravel (log, Mailpit, Mailjet).

---

## 3. « Microservices » : ce qu'est vraiment l'architecture

Il est important de le dire clairement (un jury posera la question) : **TijaraLink n'est pas une architecture
microservices.** C'est un **monolithe modulaire côté serveur** (une seule API Laravel, une seule base) avec
**des clients séparés** (web, mobile) et **des services externes managés**. On parle d'architecture
**client-serveur en couches** / **« API-first »**.

| Critère | Microservices | TijaraLink |
|---|---|---|
| Nombre de serveurs applicatifs | Un par domaine (commande, catalogue, paiement…) | **Un seul** : l'API Laravel |
| Bases de données | Une par service | **Une seule** base PostgreSQL |
| Communication entre services | HTTP/gRPC/bus de messages | Appels de méthodes PHP entre classes `Services/` |
| Déploiement | Indépendant par service | API et site déployés séparément, mais l'API est un bloc |

Ce qui **ressemble** à des services séparés :

1. **Front web**, **mobile** et **API** sont déployés indépendamment (3 artefacts : site statique, APK, conteneur Docker).
2. Le **worker de file d'attente** (`deploy/api/worker.sh`) : même code que l'API, mais processus séparé qui exécute les `Jobs` (diffusion des demandes, e-mails, exports, analyses IA). En local il tourne dans son propre conteneur ; sur Render gratuit il est remplacé par `QUEUE_CONNECTION=sync`.
3. **Reverb** (serveur WebSocket) : processus séparé, optionnel.
4. Les **services externes** : base managée, Cloudinary, Mailjet, Gemini.
5. À l'intérieur de l'API, le dossier `app/Services/` découpe le métier en **services par domaine** (`TenderService`, `QuoteService`, `OrderService`, `DisputeService`, `AiService`…). Ce sont des « services » au sens **couche service** (classes), pas des microservices réseau.

**Pourquoi pas des microservices ?** Équipe étudiante, délais de sprint, hébergement gratuit (un seul
conteneur API), besoin de transactions fortes (accepter un devis = créer la commande + refuser les autres devis +
clôturer la demande, en **une seule transaction SQL**). Un monolithe bien découpé est le bon choix à cette
échelle ; il pourrait être scindé plus tard (par ex. sortir l'IA ou les notifications) car les frontières sont
déjà nettes (services + contrats).

---

## 4. Le backend (API Laravel)

### 4.1 Organisation en couches

Le README le résume : **`Controllers/Api` (minces) → `Http/Requests` (validation) → `Services` (règles métier) → `Models`, réponses via `Http/Resources`.**

| Couche | Dossier | Responsabilité | Exemple |
|---|---|---|---|
| Routes | `routes/api.php` | Associe URL + verbe HTTP → contrôleur, applique les middlewares (auth, rôle, limite de débit) | `POST /api/buyer/tenders` |
| Middlewares | `app/Http/Middleware/` | Filtres avant le contrôleur : rôle, e-mail vérifié, fournisseur validé, en-têtes de sécurité | `role:buyer` |
| Contrôleurs | `app/Http/Controllers/Api/` | Reçoivent la requête, appellent un service, renvoient une ressource. Pas de logique métier | `TenderController@store` |
| Form Requests | `app/Http/Requests/` | Valident et normalisent les données entrantes, messages d'erreur en français | `StoreTenderRequest` |
| Policies | `app/Policies/` | « Cet utilisateur a-t-il le droit sur CET objet ? » | `TenderPolicy::view` |
| Services | `app/Services/` | Règles métier, transactions, notifications | `TenderService::publish` |
| Modèles | `app/Models/` | Tables (Eloquent ORM), relations, scopes, casts | `Tender`, `Quote` |
| Enums | `app/Enums/` | Valeurs fixes (statuts, rôles), une seule source de vérité | `OrderStatus` |
| Resources | `app/Http/Resources/` | Transforment un modèle en JSON public (filtrent les champs) | `TenderResource` |
| Jobs | `app/Jobs/` | Tâches lourdes en arrière-plan | `DiffuseTenderJob` |
| Notifications | `app/Notifications/` | Messages multi-canaux (base, e-mail, WhatsApp) | `NewQuoteNotification` |
| Events | `app/Events/` | Événements diffusés en temps réel (Reverb) | `MessageSent` |
| Contrats | `app/Contracts/`, `Services/Ai/AiClient`, `Services/WhatsApp/WhatsAppClient` | Interfaces pour brancher des fournisseurs externes | `MediaStorage` |
| Commandes | `app/Console/Commands/`, `routes/console.php` | Commandes artisan (doc API, reset démo, détection d'anomalies planifiée) | `api:docs` |
| Config | `config/*.php` | Réglages lus depuis les variables d'environnement | `config/ai.php` |

### 4.2 Le démarrage : `bootstrap/app.php`

C'est le « cerveau » de configuration de Laravel 12 :

- **`withRouting`** : charge `routes/web.php`, `routes/api.php` (préfixe automatique `/api`), `routes/console.php` et crée la route de santé **`/up`** (utilisée par Render et Docker pour savoir si l'API est vivante).
- **`withBroadcasting`** : route `POST /api/broadcasting/auth` pour autoriser les canaux WebSocket privés avec le même jeton Bearer.
- **`withMiddleware`** : `trustProxies('*')` (Render est un proxy : sans ça, toutes les IP seraient celle du proxy et les limites de débit deviendraient globales), ajout de `SecurityHeaders` à toutes les réponses API, et création des alias `role`, `verified`, `supplier.validated`.
- **`withExceptions`** : l'API répond **toujours en JSON**, avec des messages **en français** uniformes `{ message, errors? }` : 401 « Non authentifié », 422 premier message de validation, 403/404/405/429 messages par défaut, 500 sans trace technique en production.

### 4.3 Le cycle d'une requête dans Laravel

```
public/index.php  (point d'entrée unique, appelé par nginx/PHP-FPM)
  → bootstrap/app.php
  → middlewares globaux + groupe "api" (SecurityHeaders, throttle…)
  → routes/api.php trouve la route
  → middlewares de route : auth:sanctum → verified → role:buyer → supplier.validated
  → FormRequest::authorize() + rules()  (sinon 422 automatique)
  → Controller::méthode()
       → Policy (Gate::authorize)          (sinon 403)
       → Service::règleMétier()            (transaction DB, notifications, jobs)
       → Model / Eloquent → SQL → PostgreSQL
  → Resource::toArray()  → JSON
  → réponse HTTP (+ en-têtes de sécurité)
```

### 4.4 Fonctionnalités transverses

- **Authentification** (Sanctum) : `POST /api/auth/login` crée un *personal access token* (table `personal_access_tokens`) ; 12 h par défaut, 7 jours avec « se souvenir de moi ». Déconnexion = suppression du jeton.
- **Vérification e-mail** : lien signé (60 min, usage unique) qui ouvre la page React `/email/verifier`, laquelle appelle l'API.
- **Mot de passe oublié** : lien vers `/mot-de-passe/nouveau`, même réponse que l'e-mail existe ou non (pas de fuite d'information).
- **Limites de débit** (`throttle`) : connexion, inscription, messages, IA (20 générations/heure/utilisateur dans `AiService`).
- **Stockage de fichiers** : contrat `MediaStorage` → `LocalMediaStorage` (disque public pour images, disque privé pour documents) ou `CloudinaryMediaStorage` (CDN public pour images, URL signées pour documents privés).
- **Files d'attente** : jobs `DiffuseTenderJob`, `AnalyzeReviewJob`, `ModerateProductJob`, `GenerateExportJob` + notifications mises en file.
- **Temps réel** : événements `MessageSent`, `ConversationRead`, `NotificationCreated` diffusés sur le canal privé `user.{id}` (Reverb). Sans Reverb, le front rafraîchit toutes les 10–30 s.
- **Planification** : `anomalies:detect` toutes les 15 minutes (`routes/console.php`).
- **PDF** : vues Blade `resources/views/pdf/quote.blade.php` et `invoice.blade.php`, générées par `OrderDocumentService`.
- **Documentation API** : `php artisan api:docs` lit les vraies routes et produit `docs/api/openapi.json` + une collection Postman ; servie par `GET /api/docs` (Swagger UI).

---

## 5. La base de données

### 5.1 Moteurs utilisés

| Environnement | Base |
|---|---|
| Tests automatiques | SQLite en mémoire (rapide) **et** PostgreSQL 17 (job CI `backend-pgsql`, parité avec la prod) |
| Développement local | PostgreSQL 17 dans Docker (`deploy/docker-compose.yml`) — MySQL possible |
| Production (première version, retirée) | **TiDB Cloud** en protocole PostgreSQL (ancien `render.yaml`, TLS obligatoire) |
| Production « TijaraLink » | **PostgreSQL managé par Render** (`render.tijaralink.yaml`, base gratuite 1 Go) |

Le code utilise toujours `DB_CONNECTION=pgsql` : changer d'hébergeur de base ne demande aucun changement de code.
Le schéma est créé par les **migrations** (`backend/database/migrations/`), jamais à la main.

### 5.2 Les tables (regroupées par domaine, comme les fichiers de migration)

**Comptes et référentiels**

| Table | Contenu | Liens |
|---|---|---|
| `users` | nom, e-mail (unique), téléphone, mot de passe haché, **role** (`supplier`/`buyer`/`admin`), **status** (e-mail à vérifier / actif / suspendu / désactivé), `email_verified_at`, `last_login_at`, **suppression douce** (`deleted_at`) | 1–1 profil |
| `supplier_profiles` | entreprise : nom, forme juridique, matricule fiscal, RNE, logo, description, secteur, région, coordonnées, délai, conditions de paiement, `is_published`, **validation_status** (en attente/validé/refusé), motif de refus, validé par/le, `rating_avg`, `reviews_count` | `user_id` unique |
| `buyer_profiles` | organisation, type de porteur, poste, CIN, région, ville, adresse, site, description du projet, CGU acceptées | `user_id` unique |
| `supplier_documents` | justificatifs (registre de commerce, certification…), fichier privé, statut | → `supplier_profiles` |
| `supplier_category` | catégories couvertes par un fournisseur (table pivot) | N–N |
| `supplier_coverage_region` | régions (gouvernorats) desservies (pivot) | N–N |
| `regions` | 24 gouvernorats tunisiens | — |
| `categories` | arborescence sur 2 niveaux (`parent_id`), `position` | auto-référence |
| `notification_preferences` | un réglage par utilisateur × événement × canal (email/site/whatsapp) | → `users` |
| `personal_access_tokens` | jetons Sanctum | → `users` |
| `password_reset_tokens`, `sessions`, `cache`, `jobs`, `failed_jobs` | tables techniques de Laravel | — |

**Catalogue**

| Table | Contenu |
|---|---|
| `products` | fournisseur, catégorie, type (produit/service), titre, description, prix, unité, stock, délai, **status** (brouillon/publié/retiré), `featured_until` (mise en avant), `ai_flag_reason` (signalement IA), motif de retrait, suppression douce |
| `product_images` | photos ordonnées (`position` 1 = principale) |
| `product_views` | consultations (statistiques « produits les plus vus ») |
| `favorites` | fournisseurs favoris d'un porteur (unique par couple) |

**Demandes et devis**

| Table | Contenu |
|---|---|
| `tenders` | demande (appel d'offres) : titre, description, catégorie, région, budget, date limite, **status** (ouverte/en négociation/clôturée/annulée), catégorie et mots-clés proposés par l'IA |
| `tender_attachments` | pièces jointes (cahier des charges…) |
| `tender_recipients` | fournisseurs qui ont reçu la demande, **score de pertinence**, source (automatique / suggéré IA / invité), dates de notification et de lecture |
| `quotes` | devis : montant, délai, conditions, commentaire, **status** (envoyé/en négociation/accepté/refusé) — **un seul par fournisseur et par demande** |

**Commandes**

| Table | Contenu |
|---|---|
| `orders` | porteur, fournisseur, devis d'origine (unique) ou `origin = catalogue`, total, **status** (validée → en préparation → en livraison/expédiée → livrée → clôturée) |
| `order_items` | lignes : libellé et prix **figés** au moment de la commande |
| `order_status_history` | historique immuable des changements de statut (qui, quand) |
| `documents` | PDF devis/facture, numéro unique séquentiel |

**Messagerie et notifications**

| Table | Contenu |
|---|---|
| `conversations` | un porteur + un fournisseur + un **contexte** (demande, devis, commande, direct), `last_message_at` |
| `conversation_participants` | qui participe, dernier message lu (compteur de non-lus) |
| `messages` | texte + pièce jointe (nom, type MIME, taille) |
| `notifications` | table native Laravel (UUID, type, JSON `data`, `read_at`) = centre de notifications |
| `whatsapp_deliveries` | trace des envois WhatsApp (sans numéro ni contenu) |

**Avis et litiges**

| Table | Contenu |
|---|---|
| `reviews` | 1 avis par commande clôturée : note 1–5, commentaire, réponse du fournisseur, status (publié/signalé/masqué), `ai_suspicion_score`, `ai_sentiment` |
| `review_reports` | signalement d'un avis par le fournisseur, motif, décision admin |
| `disputes` | litige : commande, ouvert par, motif, description, status (ouvert/en cours/décidé), admin assigné, décision + note, `decided_at` |
| `dispute_attachments` | preuves (photos/PDF privés) |

**IA et supervision**

| Table | Contenu |
|---|---|
| `ai_interactions` | chaque sortie d'IA : utilisateur, fonctionnalité, contexte, entrée, sortie d'origine, version modifiée, acceptée ou non, fournisseur/modèle, empreinte de l'entrée |
| `anomaly_alerts` | alertes (compte ou commande), type, score 0–100, status (nouvelle/traitée/ignorée) |
| `audit_logs` | journal **immuable** des actions des admins (pas de `updated_at`, pas de route de modification) |
| `exports` | demandes d'export CSV/XLSX, indicateurs choisis, fichier produit |
| `deployment_markers` | mémorise le jeton `RESET_DEMO_TOKEN` déjà appliqué (réinitialisation de démo une seule fois) |

### 5.3 Règles d'intégrité notables

- **Clés étrangères** partout, avec un choix réfléchi : `cascadeOnDelete` (images d'un produit), `restrictOnDelete` (on ne supprime pas un acheteur qui a des commandes), `nullOnDelete` (région supprimée → champ vide).
- **Contraintes d'unicité métier** : un devis par (demande, fournisseur), un avis par commande, un favori par couple, une commande par devis.
- **Suppression douce** des utilisateurs et des produits : l'historique (commandes, factures, avis) reste cohérent.
- **Index** sur les colonnes de filtre fréquentes (statut + catégorie, statut + prix, statut + date…).
- **Enums PHP** (`app/Enums`) = valeurs autorisées des colonnes de statut ; la migration `drop_legacy_enum_checks_for_pgsql` retire les contraintes `CHECK` que TiDB ne supporte pas : la validation reste dans le code.
- **Montants** en `decimal(12,2)` (jamais de flottants) ; l'API les renvoie en chaîne `"1500.00"` et le front les formate sans conversion (`utils/money.js`).

### 5.4 Données initiales (seeders)

- `DatabaseSeeder` : insère **toujours** les 24 régions et les catégories ; les données de démo seulement si `SEED_DEMO_DATA=true`.
- `CatalogueDemoSeeder`, `SupplierProfileDemoSeeder` : données des maquettes.
- `FullDemoSeeder` : démonstration complète (14 fournisseurs, produits avec photos, demandes, devis, commandes à toutes les étapes, avis, conversations…).
- `factories/` : fabriques d'objets pour les tests.

---

## 6. Le frontend web (React)

### 6.1 Technologies

- **Vite** : serveur de développement et build (produit `dist/`, fichiers statiques).
- **React 19** : composants.
- **React Router** (mode « data router ») : pages, `loader` de garde avant affichage, chargement paresseux (`lazy`) de chaque page.
- **Zustand** : petits magasins d'état global (`stores/auth.js` = utilisateur connecté, `messaging.js` = non-lus, `adminDashboard.js`).
- **Axios** : client HTTP unique (`api/http.js`).
- **Tailwind CSS 4** : styles (`style.css`).
- **Recharts** : graphiques des tableaux de bord.
- **laravel-echo + pusher-js** : client WebSocket pour Reverb.
- **Vitest + Testing Library** (tests unitaires) et **Playwright** (tests de bout en bout dans un vrai navigateur).

### 6.2 Organisation de `frontend/src/`

| Dossier | Rôle |
|---|---|
| `main.jsx` | Point d'entrée : branche la gestion des erreurs 401/403, démarre le temps réel, enregistre le service worker (PWA), monte le routeur |
| `api/` | **Une fonction par appel d'API**, regroupées par domaine (`tenders.js`, `orders.js`…). Aucune page n'appelle axios directement |
| `router/` | `paths.js` (toutes les adresses), `routes.jsx` (arbre des pages et gardes), `guard.js` (règles d'accès testables), `index.js` (création du routeur) |
| `stores/` | État global Zustand |
| `layouts/` | Mises en page : `PublicLayout` (vitrine), `AuthLayout` (connexion/inscription), `SpaceLayout` (barre latérale + en-tête des espaces), décliné en `BuyerLayout`, `SupplierLayout`, `AdminLayout` ; `AppLayout` (pages communes) |
| `views/` | **Les pages**, rangées par espace : `auth/`, `buyer/`, `supplier/`, `admin/`, `catalog/`, `products/`, `suppliers/`, `messaging/`, `notifications/`, `orders/`, `disputes/`, `account/`, `errors/` |
| `components/` | Composants réutilisables (cartes produit, badges, modale, pagination, cloche de notifications, chatbot, suggestions IA, graphiques…) |
| `realtime/` | Connexion Reverb et diffusion interne des événements |
| `utils/` | Formatage (prix, dates), stockage du jeton, brouillons de formulaire, règles de mot de passe… |
| `config/brand.js` | Nom et slogan de l'application (un seul endroit) |
| `test/setup.js` | Configuration des tests |
| `public/` | `sw.js` (service worker : cache et page hors ligne), `offline.html`, `manifest.webmanifest` (PWA installable), icônes |

### 6.3 Comment une page fonctionne

1. L'utilisateur ouvre `/porteur/demandes`.
2. Le routeur exécute le **loader de garde** (`guard({ roles: ['buyer'] })`) : `ensureAuthLoaded()` récupère l'utilisateur via `GET /api/auth/me` (une seule fois), puis `resolveAccess()` décide : passer, rediriger vers la connexion, vers « vérifiez votre e-mail », vers « compte en attente » ou vers la page 403.
3. Le fichier de la page est chargé à la demande (`lazy`), dans le layout de l'espace (barre latérale).
4. La page appelle une fonction de `api/` (ex. `fetchBuyerTenders()`), affiche un squelette pendant le chargement, puis les données — ou un état vide / une erreur avec « Réessayer ».
5. Les erreurs de l'API sont déjà traduites par l'intercepteur Axios (`error.userMessage`, `error.fieldErrors` pour afficher l'erreur sous chaque champ).

### 6.4 Fonctions transverses côté web

- **PWA / hors ligne** : `sw.js` met en cache les fichiers, `OfflineBanner` prévient quand la connexion tombe.
- **Aucune perte de saisie** : `useFormDraft` recopie les formulaires dans le navigateur.
- **Filtres dans l'URL** (catalogue, annuaire, listes admin) : lien partageable, bouton Retour fonctionnel.
- **Gestion des 401/403 centralisée** dans `main.jsx` (session expirée → connexion ; e-mail non vérifié → page dédiée ; fournisseur non validé → « compte en attente »).

---

## 7. L'application mobile (Expo / React Native)

- Dossier `mobile/`, application **TijaraLink** (`tn.tijaralink.app`), construite avec **Expo** ; l'APK Android est produit par **EAS Build** (`eas.json`, profil `preview` = APK, `production` = App Bundle pour le Play Store).
- Elle appelle **la même API** que le site (`src/api/client.js`, adresse dans `src/config.js` ou `EXPO_PUBLIC_API_URL`).
- Le jeton est rangé dans le **trousseau sécurisé** du téléphone (`expo-secure-store`) ; sur le web, dans le stockage local (`AuthContext.js`).
- Navigation : onglets du bas par espace (4 écrans principaux + « Menu ») et piles d'écrans (`App.js`, `navigation/menus.js` reprend exactement la barre latérale du site).
- Écrans regroupés par domaine : `HomeScreen`, `CatalogScreen`, `ProductScreen`, `DashboardScreen`, `BuyerScreens`, `SupplierScreens`, `AdminScreens`, `MessagingScreens`, `ListScreens`, `AssistantScreen` (chatbot), `AccountScreen`, `LoginScreen`, `MenuScreen`.
- `hooks/useApi.js` : charge une ressource, gère chargement/erreur/« tirer pour rafraîchir » et recharge à chaque retour sur l'écran (synchronisation avec le site).
- `sync/UnreadContext.js` : compteurs de messages et notifications non lus relus toutes les 30 s.

> Remarque : la décision R5 prévoyait au départ une PWA seule ; l'application Expo a été ajoutée ensuite. Le site reste installable (PWA) en plus de l'APK.

---

## 8. La connexion front ↔ back ↔ base : le parcours d'une requête

Exemple concret : **un porteur publie une demande**.

```
[Navigateur]  NewTenderPage.jsx
   │  handleSubmit() → createTender(formData)            (frontend/src/api/tenders.js)
   │  http.post('/buyer/tenders', FormData)               (frontend/src/api/http.js)
   │    intercepteur : ajoute  Authorization: Bearer 12|abc...
   ▼
[Internet] HTTPS → https://tijaralink-api.onrender.com/api/buyer/tenders
   ▼
[Conteneur API]  nginx (port $PORT) → PHP-FPM (127.0.0.1:9000) → public/index.php
   ▼
[Laravel]  routes/api.php
   auth:sanctum   → cherche le jeton haché dans personal_access_tokens → $request->user()
   verified       → e-mail vérifié ? sinon 403 {reason:"email_not_verified"}
   role:buyer     → rôle porteur ? sinon 403
   StoreTenderRequest → valide titre, description, catégorie, budget, date future, fichiers (sinon 422)
   Buyer\TenderController@store → TenderService::publish()
       DB::transaction :
         INSERT INTO tenders …
         INSERT INTO tender_attachments …  (fichiers via MediaStorage → disque ou Cloudinary)
         INSERT INTO tender_recipients … (fournisseurs cochés suggérés par l'IA)
       DiffuseTenderJob::dispatch()  → trouve les fournisseurs validés de la catégorie/région,
                                       calcule le score (RelevanceScorer), notifie (TenderReceivedNotification)
   ▼
[PostgreSQL]  écritures dans la même transaction (tout ou rien)
   ▼
[Laravel]  TenderResource → JSON 201 { data: { id, title, status: "ouverte", ... } }
   ▼
[Navigateur]  la page redirige vers /porteur/demandes/:id
[Fournisseurs] reçoivent la notification (cloche via Reverb ou rafraîchissement, e-mail, WhatsApp si accepté)
```

Résumé des « contrats » entre couches :

| Lien | Format | Sécurité |
|---|---|---|
| Front ↔ API | JSON sur HTTPS ; fichiers en `multipart/form-data` ; téléchargements en blob | Jeton Bearer, CORS limité aux URL du front (`config/cors.php`, `FRONTEND_URLS`) |
| API ↔ base | SQL via Eloquent/Query Builder (requêtes préparées, pas d'injection SQL) | TLS (`DB_SSLMODE=require` sur TiDB) |
| API → front (push) | WebSocket Reverb, événements ne contenant que des identifiants | Canal privé `user.{id}` autorisé par le jeton |
| API ↔ services externes | SMTP, API Cloudinary, API Gemini | Clés dans les variables d'environnement, jamais dans le code |

---

## 9. Les rôles et la sécurité

### 9.1 Les trois rôles (`App\Enums\UserRole`)

| Rôle | Valeur | Ce qu'il peut faire |
|---|---|---|
| **Porteur de projet** | `buyer` | Chercher dans le catalogue, gérer ses favoris, publier des demandes, comparer/accepter des devis, commander directement, suivre ses commandes, confirmer la réception, laisser un avis, ouvrir un litige, messagerie, tableau de bord, assistants IA |
| **Fournisseur** | `supplier` | S'inscrire avec justificatifs, attendre la validation, gérer son profil d'entreprise, ses produits (brouillon/publié, photos, mise en avant), recevoir des demandes classées par pertinence, envoyer des devis, faire avancer ses commandes, répondre aux avis / les signaler, messagerie, tableau de bord, IA |
| **Administrateur** | `admin` | Valider/refuser les fournisseurs, gérer catégories et utilisateurs (suspendre, réactiver, supprimer), modérer produits et avis, traiter les litiges, voir le tableau de bord global, les anomalies, le journal d'audit, exporter les statistiques |
| **Visiteur** (non connecté) | — | Accueil, catalogue, fiches produit et fournisseur, annuaire, inscription, chatbot |

### 9.2 Les statuts qui s'ajoutent au rôle

- **Statut du compte** (`UserStatus`) : `e-mail à vérifier` → `actif` ; `suspendu` (par un admin) ; `désactivé` (par l'utilisateur). Un compte suspendu/désactivé ne peut plus se connecter.
- **Statut du fournisseur** (`ValidationStatus`) : `en attente` / `validé` / `refusé`. Un fournisseur non validé ne voit que la page « Compte en attente » et son profil.
- **Visible dans le catalogue** (D17) = fournisseur validé + profil publié + compte actif.

### 9.3 Les couches de protection (défense en profondeur)

| Niveau | Où | Exemple |
|---|---|---|
| Authentification | `auth:sanctum` | pas de jeton → 401 |
| E-mail vérifié | `EnsureEmailIsVerified` | 403 `reason: email_not_verified` |
| Rôle | `EnsureUserHasRole` (`role:buyer,supplier`) | 403 « Accès refusé pour ce rôle » |
| Fournisseur validé | `EnsureSupplierIsValidated` | 403 `reason: supplier_not_validated` |
| Propriété de l'objet | `Policies/` + services | un porteur ne voit que SES demandes ; une conversation dont on ne fait pas partie → **404** (on ne révèle même pas son existence) |
| Champs autorisés | `FormRequest` | `validation_status` envoyé par un fournisseur est ignoré |
| Champs renvoyés | `Resources` | la fiche publique ne contient jamais documents, matricule fiscal ou coordonnées privées |
| Limites de débit | `throttle:*`, `AiService` | anti force brute, anti abus de l'IA |
| En-têtes | `SecurityHeaders` + nginx | `nosniff`, CSP `default-src 'none'`, `X-Frame-Options DENY` |
| Fichiers privés | disque privé / Cloudinary authentifié | téléchargement uniquement via l'API après contrôle des droits |
| Traçabilité | `AuditLogger` → `audit_logs` | chaque action d'admin est enregistrée, sans modification possible |
| Côté front | `router/guard.js` | confort d'affichage seulement : **la vraie sécurité est toujours côté API** |

---

## 10. Les routes (API et pages React)

### 10.1 Routes de l'API (`backend/routes/api.php`, préfixe `/api`)

**Publiques (sans connexion)**

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/auth/login` | Connexion → jeton |
| POST | `/auth/forgot-password`, `/auth/reset-password` | Mot de passe oublié |
| POST | `/auth/register/supplier`, `/auth/register/supplier/check-email` | Inscription fournisseur (3 étapes) |
| POST | `/auth/register/buyer` | Inscription porteur |
| GET | `/auth/email/verify/{id}/{hash}` | Validation du lien e-mail signé |
| GET | `/docs`, `/docs/openapi.json` | Documentation Swagger |
| GET | `/reference/regions`, `/reference/categories`, `/reference/sectors` | Listes des formulaires (cache 1 h) |
| GET | `/categories`, `/home` | Arborescence, page d'accueil (cache 5 min) |
| GET | `/products`, `/products/{id}` | Catalogue et fiche produit |
| GET | `/suppliers`, `/suppliers/{id}`, `/suppliers/{id}/products`, `/suppliers/{id}/reviews`, `/suppliers/{id}/public-reviews` | Annuaire et fiche fournisseur |

**Connecté (même e-mail non vérifié)**

| Méthode | Route | Rôle |
|---|---|---|
| GET/POST | `/auth/me`, `/auth/logout`, `/auth/email/resend` | Session |
| GET/PUT/PATCH/POST/DELETE | `/account`, `/account/profile`, `/account/password`, `/account/email`, `/account/deactivate` | Paramètres du compte |
| GET/PUT/POST | `/notifications`, `/notifications/unread-count`, `/notifications/preferences`, `/notifications/whatsapp`, `/notifications/read-all`, `/notifications/{uuid}/read` | Centre de notifications |
| POST | `/chatbot/messages` | Chatbot |

**Fournisseur** (`/supplier/*`, connecté + e-mail vérifié + `role:supplier`)

| Route | Rôle |
|---|---|
| `GET /dashboard` | Tableau de bord |
| `GET/PUT /profile`, `POST /profile/logo`, `PATCH /profile/publish` | Profil d'entreprise |
| `POST /documents`, `GET /documents/{id}/download` | Justificatifs |
| `GET /validation-status` | État du dossier |
| `GET /orders`, `POST /orders/{id}/advance` | Commandes reçues, avancer l'étape |
| `GET /reviews`, `POST /reviews/{id}/reply`, `POST /reviews/{id}/report` | Avis reçus |
| *+ `supplier.validated`* : `GET /tenders`, `GET /tenders/{id}`, pièces jointes, `POST/PUT /tenders/{id}/quote`, `GET /quotes` | Demandes reçues et devis |
| *+ `supplier.validated`* : `GET/POST /products`, `GET/PUT/DELETE /products/{id}`, `PATCH .../unpublish`, `POST/DELETE .../feature`, `POST .../images`, `PUT .../images/order`, `DELETE .../images/{img}` | Mes produits |

**Porteur de projet** (`/buyer/*`, `role:buyer`)

| Route | Rôle |
|---|---|
| `GET /dashboard`, `GET /recommendations` | Tableau de bord, fournisseurs recommandés |
| `GET/POST /tenders`, `GET /tenders/{id}`, pièces jointes, `POST .../cancel`, `POST .../invite` | Demandes |
| `POST /tenders/analyze`, `GET /tenders/{id}/market-price` | IA : analyse de la demande, prix du marché |
| `GET /tenders/{id}/quotes`, `POST /quotes/{id}/accept` | Comparer et accepter les devis |
| `GET/POST/PATCH /tenders/{id}/quotes/summary` | Résumé IA des devis |
| `GET /favorites` ; `GET/POST/DELETE /favorites/suppliers/{id}` | Favoris |
| `GET/POST /orders`, `GET /orders/{id}`, `POST .../confirm-receipt`, `POST .../review`, `POST .../dispute` | Commandes, réception, avis, litige |

**Porteur + fournisseur** : `/conversations` (liste, ouvrir, non-lus, messages, envoyer, marquer lu, pièce jointe), `/disputes`.
**Tout utilisateur vérifié** (contrôle par service/policy) : `/orders/{id}`, téléchargement des documents PDF, `/disputes/{id}`, `/ai/tender-draft`, `/ai/product-text`, `/ai/interactions/{id}/accept`.

**Administrateur** (`/admin/*`, `role:admin`) : `dashboard`, `anomalies` (+ `scan`, `handle`, `ignore`), `audit-logs`, `exports` (+ `download`), `products` (+ `withdraw`), `reported-reviews` (+ `keep`, `hide`), `categories` (CRUD + `move`), `suppliers` (+ `approve`, `reject`, documents), `users` (+ `suspend`, `reactivate`, `DELETE`), `disputes` (+ `take`, `decide`), et l'alias historique `supplier-applications`.

**Hors `/api`** : `GET /` (nom de l'API), `GET /up` (santé), `POST /api/broadcasting/auth` (WebSocket).

### 10.2 Pages du site React (`frontend/src/router/routes.jsx`)

| Zone | Adresses (exemples) | Garde |
|---|---|---|
| Vitrine | `/`, `/catalogue`, `/produits/:id`, `/fournisseurs`, `/fournisseurs/:id` | aucune |
| Authentification | `/connexion`, `/inscription` (choix), `/inscription/fournisseur`, `/inscription/porteur`, `/mot-de-passe-oublie`, `/mot-de-passe/nouveau`, `/verification-email`, `/email/verifier` | `guest` / `unverified` |
| Compte | `/parametres`, `/parametres/notifications` | `authenticated` |
| Fournisseur | `/fournisseur` (tableau de bord), `/fournisseur/demandes(/:id)`, `/fournisseur/devis`, `/fournisseur/produits` (+ `/nouveau`, `/:id/modifier`), `/fournisseur/profil`, `/fournisseur/commandes`, `/fournisseur/avis`, `/fournisseur/messagerie/:conversationId?`, `/fournisseur/litiges`, `/fournisseur/assistant-ia`, `/fournisseur/notifications`, `/fournisseur/en-attente` | `roles: supplier` (+ validé ou non) |
| Porteur | `/porteur` (tableau de bord), `/porteur/demandes` (+ `/nouvelle`, `/:id`, `/:id/devis`), `/porteur/devis/:id/comparer`, `/porteur/favoris`, `/porteur/commandes` (+ `/:id`, `/:id/litige`), `/porteur/messagerie/:conversationId?`, `/porteur/notifications`, `/porteur/litiges`, `/porteur/assistant-ia` | `roles: buyer` |
| Admin | `/admin` (tableau de bord), `/admin/fournisseurs`, `/admin/categories`, `/admin/utilisateurs(/:id)`, `/admin/catalogue`, `/admin/avis`, `/admin/litiges(/:id)`, `/admin/journal`, `/admin/notifications` | `roles: admin` |
| Commun | `/commandes/:id`, `/orders/:id`, `/litiges/:id` | connecté |
| Erreurs | `/acces-refuse` (403), `*` → 404 | — |

(Les chemins exacts sont centralisés dans `frontend/src/router/paths.js`.)

---

## 11. Fonctionnalité de chaque service

Les classes de `backend/app/Services/` portent toutes les règles métier.

| Service | Ce qu'il fait |
|---|---|
| **TenderService** | Publier une demande (transaction, pièces jointes, destinataires), l'annuler (notifie les fournisseurs qui avaient répondu), inviter un favori, vérifier que le porteur est propriétaire |
| **RelevanceScorer** | Score demande ↔ fournisseur sur 100 : catégorie (50 pts, 30 si catégorie sœur), région, mots-clés (enrichis par l'IA) |
| **TenderAnalysisService** | IA : détecte catégorie et mots-clés d'une demande, suggère des fournisseurs à cocher |
| **QuoteService** | Soumettre/mettre à jour un devis (unique), marquer une demande comme vue, **accepter un devis** : crée la commande, refuse les autres devis, clôt la demande (règle R1), notifie tout le monde |
| **QuoteSummaryService** | IA : résumé comparatif des devis (points forts, points d'attention, questions) **sans désigner de gagnant** ; recalculé si les devis changent (empreinte) |
| **MarketPriceService** | Fourchette de prix habituelle à partir des transactions des 12 derniers mois de la catégorie |
| **OrderService** | Liste et détail des commandes d'un porteur |
| **OrderDocumentService** | Génère les PDF devis et facture avec numérotation séquentielle |
| **ProductService** | Créer/modifier un produit, publier (exige description + 1 photo), dépublier, mettre en avant, supprimer, gérer les photos (4 max, ordre) ; un produit retiré par l'admin reste retiré |
| **ProductCatalogService** | Recherche publique : texte, catégories, type, région, prix, délai, note, tri, pagination en 3 requêtes SQL |
| **ProductModerationService** | IA : indice de suspicion d'une annonce (prix anormal vs médiane de la catégorie…), enregistre le motif pour l'admin |
| **ProductViewRecorder** | Compte une vue par visiteur et par produit par tranche de 30 min, après l'envoi de la réponse |
| **HomeService** | Données de l'accueil (chiffres, catégories, produits mis en avant), cache 10 min |
| **CategoryService** | Arborescence, création, déplacement (↑ ↓ / glisser-déposer), positions sans trous, suppression contrôlée, audit |
| **SupplierProfileService** | Charger/mettre à jour le profil, logo, ajouter un justificatif, **repasser le dossier « en attente »** après un refus, publier/dépublier |
| **SupplierRatingService** | Recalcule la note moyenne (avis publiés uniquement) |
| **SupplierRecommendationService** | Recommande des fournisseurs au porteur : intérêt pour la catégorie × 60 + note × 8, exclut favoris et déjà sollicités |
| **FavoriteService** | Ajout/retrait idempotents des favoris, liste des favoris encore visibles |
| **ConversationService** | Ouvre (ou retrouve) la conversation unique par couple et contexte, envoie un message, marque lu, compte les non-lus, une seule notification tant que non lu |
| **DisputeService** | Ouvrir un litige (règle R4 : d'« expédiée » à « livrée »), prise en charge par un admin, décision motivée, verrouillage pour éviter les doublons |
| **ReviewInsightService** | IA : sentiment et suspicion de chaque avis, synthèse « points forts / faibles » d'un fournisseur (à partir de 3 avis) |
| **UserAdministrationService** | Suspendre, réactiver, supprimer (douce) un compte ; interdit de bloquer soi-même ou un autre admin ; révoque les jetons |
| **AuditLogger** | Écrit dans `audit_logs` chaque action d'admin, fournit l'historique d'une cible |
| **AnomalyDetector** | Règles explicables avec score : pics de commandes, rafales d'avis, montants inhabituels, gros achat d'un compte récent, litiges répétés |
| **ChatbotService** | Répond aux questions d'utilisation **uniquement à partir du guide** `config/chatbot.php` (aucune donnée en base n'est lue) |
| **WritingAssistant** | IA : brouillon de demande, texte/reformulation de fiche produit (toujours une suggestion modifiable) |
| **Ai/AiService** | Point d'entrée unique de l'IA : vérifie l'activation, **limite 20/h/utilisateur**, appelle le pilote, valide la sortie, l'enregistre dans `ai_interactions`, transforme toute panne en `AiUnavailableException` (l'appli continue sans IA) |
| **Ai/GeminiAiClient** | Pilote réel Google Gemini (consigne séparée des données, réponse JSON selon un schéma) |
| **Ai/SimulatedAiClient** | Pilote simulé déterministe (règles de calcul) : fonctionne sans clé, affiché « simulé » |
| **Dashboard/Admin·Buyer·SupplierDashboardService** | Indicateurs et séries temporelles de chaque tableau de bord sur une période (heure de Tunis) |
| **Export/StatisticsExport, CsvWriter, XlsxWriter** | Tableaux d'export, CSV compatible Excel français, XLSX écrit sans librairie (textes jamais évalués comme formules) |
| **Media/LocalMediaStorage, CloudinaryMediaStorage** | Stockage des fichiers (voir §4.4) |
| **WhatsApp/*** | Paramètres de consentement, client simulé, message (titre + lien), repli e-mail en cas d'échec |

---

## 12. Déploiement, hébergement et flux

### 12.1 Trois environnements

| Environnement | Pour qui | Où | Base |
|---|---|---|---|
| **Local** | développeurs | Docker Desktop (`./deploy/start.sh`) | PostgreSQL 17 en conteneur |
| **Démo « TijaraLink »** | jury, testeurs | Render (`render.tijaralink.yaml`), <https://tijaralink-web.onrender.com> | PostgreSQL Render |
| **Mobile** | téléphones Android | APK via EAS Build | (appelle l'API TijaraLink) |

### 12.2 Hébergement de production (Render, plan gratuit, région Francfort)

Le fichier **`render.tijaralink.yaml`** (Blueprint = infrastructure décrite en code) crée **trois ressources** :

1. **`tijaralink-db`** — base **PostgreSQL managée** par Render (gratuite, 1 Go, expire après 30 jours sur le plan gratuit).
2. **`tijaralink-api`** — **Web Service Docker** construit à partir de `deploy/api/Dockerfile`, vérifié par `/up`, variables d'environnement (connexion à la base injectée automatiquement par `fromDatabase`, `APP_KEY` générée par Render, `AI_API_KEY` saisie à la main dans le tableau de bord = seul secret).
3. **`tijaralink-web`** — **Static Site** : Render exécute `npm ci && npm run build` dans `frontend/` et publie `dist/` sur son CDN. Règle de réécriture `/* → /index.html` (indispensable pour une SPA : toute adresse est servie par React). Cache d'un an sur `/assets/*` (les noms de fichiers contiennent une empreinte).

L'ancien fichier **`render.yaml`** (premier déploiement « Marketplace B2B », retiré du dépôt, voir l'historique git) était l'équivalent avec **TiDB Cloud** comme base, **Mailjet** pour les e-mails et **Cloudinary** pour les photos.

Contraintes du plan gratuit et solutions adoptées (décision D28) :

| Contrainte | Solution |
|---|---|
| Pas de *pre-deploy command* | Les migrations tournent au démarrage du conteneur (`RUN_MIGRATIONS=true`, idempotentes) |
| Pas de worker ni de cron | `QUEUE_CONNECTION=sync` : les jobs s'exécutent pendant la requête |
| Pas de serveur WebSocket | `BROADCAST_CONNECTION=null` : le front rafraîchit toutes les 30 s |
| Disque éphémère (effacé à chaque redémarrage) | Photos de démo recopiées depuis le dépôt au démarrage, ou Cloudinary |
| Mise en veille après inactivité | Premier appel lent (~1 min), puis normal |
| Pas de boîte e-mail (TijaraLink) | `MAIL_MAILER=log`, comptes de démo déjà vérifiés |

### 12.3 L'image Docker de l'API (`deploy/api/Dockerfile`)

Construction en **deux étapes** (*multi-stage*) :

1. Étape `vendor` (image `composer:2`) : installe les dépendances PHP sans les outils de dev, puis génère l'autoload optimisé.
2. Étape finale (`php:8.3-fpm-alpine`) : installe **nginx**, **supervisor** et les extensions PHP (`pdo_pgsql`, `gd`, `zip`, `intl`, `bcmath`, `pcntl`, `opcache`), copie le code, la configuration (`php.ini`, `nginx.conf.template`, `supervisord.conf`) et les scripts. `HEALTHCHECK` sur `/up`.

Au démarrage, **`entrypoint.sh`** :

1. Remplace `__PORT__` dans la config nginx par `$PORT` (Render impose le port).
2. Vérifie / complète `APP_KEY` (ajoute le préfixe `base64:` à la clé générée par Render, refuse une clé invalide).
3. **Attend la base** (jusqu'à 3 min) avec un petit script PDO.
4. Met en cache config, routes et vues (`config:cache`, `route:cache`, `view:cache`) pour la performance.
5. Si `RESET_DEMO_TOKEN` est nouveau : recrée la base de démo **une seule fois** (`demo:reset`).
6. `migrate --force` ; seed de démo si `SEED_DEMO_DATA=true` **et** table `users` vide.
7. En stockage local : `storage:link` et copie des photos de démo.
8. Lance **supervisord**, qui garde en vie **PHP-FPM** (exécute le PHP) et **nginx** (reçoit le HTTP, sert `/storage/`, transmet le reste à PHP-FPM).

L'image web (`deploy/web/Dockerfile`, utilisée en local) : build Vite dans `node:22-alpine` puis service des fichiers par `nginx:1.27-alpine`.

### 12.4 Le flux de déploiement (CI/CD)

```
Développeur ── git push (branche) ──► GitHub
                                       │
             Pull Request ─────────────┤──► GitHub Actions (.github/workflows/ci.yml)
                                       │       ├─ backend : PHPUnit sur SQLite
                                       │       ├─ backend-pgsql : PHPUnit sur PostgreSQL 17
                                       │       └─ frontend : Vitest (+ build)
                                       │     ✔ tests verts → revue → fusion dans main
                                       ▼
                     main mis à jour ──► Render (autoDeployTrigger: commit)
                                       ├─ tijaralink-api : docker build → entrypoint (migrations) → /up = 200 → bascule
                                       └─ tijaralink-web : npm ci + vite build → publication CDN
Mobile : eas build -p android --profile preview  ──► APK téléchargeable (pointe sur tijaralink-api)
```

Render ne remplace l'ancienne version que lorsque la nouvelle répond sur `/up` : pas de coupure si le build échoue.

### 12.5 Le flux à l'exécution (production)

```
Utilisateur → https://tijaralink-web.onrender.com  (CDN Render : index.html + JS/CSS)
           → le JS appelle https://tijaralink-api.onrender.com/api/... (VITE_API_URL figée au build)
           → nginx → PHP-FPM → Laravel → PostgreSQL Render (réseau interne)
                                       → Gemini (IA, si clé)
                                       → e-mails : journal (log) ou Mailjet (SMTP)
                                       → fichiers : disque du conteneur ou Cloudinary
```

### 12.6 En local

`./deploy/start.sh` lance avec Docker Compose : **db** (PostgreSQL 17, volume persistant), **api** (port 8000), **worker** (`queue:work`), **web** (port 5173), **mailpit** (boîte e-mail de test, port 8025). Un override `docker-compose.tidb.yml` permet (avec prudence) de brancher le local sur la base de production. Sans Docker : `php artisan serve` + `npm run dev`.

---

## 13. Pourquoi ces choix ? Avantages et inconvénients

| Choix | Pourquoi | Avantages | Inconvénients |
|---|---|---|---|
| **API REST séparée du front** (SPA) | Servir le web **et** le mobile avec un seul backend (D3) | Un seul endroit pour les règles et la sécurité ; front et back évoluent séparément ; testable | Deux déploiements ; CORS à gérer ; SEO limité (le contenu est rendu en JavaScript) |
| **Monolithe modulaire** (pas de microservices) | Taille de l'équipe, délais, hébergement gratuit, transactions | Simple à développer, tester, déployer ; transactions ACID ; pas de latence réseau interne | Tout redéploie ensemble ; mise à l'échelle globale et non par domaine ; une erreur grave peut affecter toute l'API |
| **Laravel 12** | Compétences de l'équipe, écosystème complet (D2) | Sanctum, files, notifications, broadcasting, migrations, validation, tests intégrés | PHP moins performant que Go/Node sur du temps réel ; framework « magique » à apprendre |
| **Jetons Bearer Sanctum** (pas de cookies) | Même mécanisme web et mobile, domaines différents | Simple, révocable, compatible mobile | Jeton en `localStorage` côté web : sensible au XSS (atténué par CSP et React) |
| **React 19 + Vite + Zustand** | Choix de l'équipe (D6) | Écosystème énorme, build très rapide, état global minimal | SPA : premier chargement plus lourd ; beaucoup de bibliothèques à maintenir |
| **Mobile Expo** | Même langage (JS/React) que le web | Une APK sans Android Studio, réutilisation des connaissances | Une deuxième interface à maintenir (écrans dupliqués par rapport au web) |
| **PostgreSQL** (TiDB / Render) | Parité local/CI/prod, gratuit | Robuste, transactions, JSON, index | TiDB n'accepte pas tout (contraintes `CHECK`) → migrations adaptées ; base Render gratuite limitée (1 Go, 30 jours) |
| **Couche Services + Requests + Resources + Policies** | Contrôleurs minces, règles testables | Lisible, réutilisable (web, mobile, jobs), sécurité à plusieurs niveaux | Beaucoup de fichiers ; plus long à écrire pour une petite fonctionnalité |
| **Contrats (AiClient, MediaStorage, WhatsAppClient)** | Ne pas dépendre d'un fournisseur | Mode simulé sans clé, changement de fournisseur = 1 classe + 1 ligne de config | Un peu plus d'abstraction |
| **IA « assistante », toujours facultative** | Éthique : l'humain décide (D18, D19) | Aucune fonctionnalité bloquée si l'IA tombe ; traçabilité (`ai_interactions`) ; limite de coût | Résultats simulés moins riches sans clé ; latence quand Gemini est utilisé |
| **Docker + Render Blueprints** | Reproductible, gratuit, déploiement automatique | « Ça marche chez moi » = « ça marche en prod » ; infrastructure versionnée | Plan gratuit : mise en veille, disque éphémère, pas de worker/cron/WebSocket |
| **Monorepo** (D4) | Une PR touche API + interface | Historique unique, cohérence des versions | Dépôt plus gros ; CI qui teste tout |
| **Code en anglais, interface en français** (D5) | Conventions + utilisateurs francophones | Lisible pour tout développeur | Mélange anglais/français dans les valeurs d'enum (`'validée'`, `'publié'`) |
| **Suppression douce, audit immuable** | Conserver l'historique commercial | Factures/avis cohérents, traçabilité admin | Tables qui grossissent ; requêtes doivent filtrer les supprimés |
| **Tests (PHPUnit, Vitest, Playwright) + CI** | Qualité, sprints courts | Régressions détectées à chaque PR, double test SQLite/PostgreSQL | Temps de CI ; tests à maintenir |

### Points d'attention repérés dans le dépôt

- À la racine se trouvent `AppLayout.jsx`, `AuthLayout.jsx`, `PublicLayout.jsx`, `SpaceLayout.jsx` : ce sont d'**anciennes copies** des fichiers de `frontend/src/layouts/` (ajoutées avec le commit « ajouter demo data », différentes des versions actuelles). Elles ne sont utilisées par rien et pourraient être supprimées.
- Quelques fichiers ont des accents mal encodés dans leurs commentaires (`TenderService.php`, `Supplier/TenderController.php`, `deploy/start.sh`) : sans effet sur le fonctionnement.
- La base PostgreSQL gratuite de Render **expire après 30 jours** : à prévoir avant une soutenance.

---

## 14. Arborescence complète des dossiers

> Générée à partir des fichiers suivis par git. Les images (photos de démo, icônes) sont résumées par dossier.
> Les dossiers `node_modules/`, `vendor/` et les fichiers `.env` ne sont pas versionnés.

```text
marketplace-b2b/
├── .github/
│   ├── workflows/
│   │   └── ci.yml
│   └── pull_request_template.md
├── backend/
│   ├── .github/
│   │   └── workflows/
│   │       ├── issues.yml
│   │       ├── pull-requests.yml
│   │       ├── tests.yml
│   │       └── update-changelog.yml
│   ├── app/
│   │   ├── Console/
│   │   │   └── Commands/
│   │   │       ├── GenerateApiDocs.php
│   │   │       └── ResetDemoData.php
│   │   ├── Contracts/
│   │   │   └── MediaStorage.php
│   │   ├── Enums/
│   │   │   ├── AiFeature.php
│   │   │   ├── AnomalyStatus.php
│   │   │   ├── ConversationContext.php
│   │   │   ├── DisputeDecision.php
│   │   │   ├── DisputeReason.php
│   │   │   ├── DisputeStatus.php
│   │   │   ├── OrderStatus.php
│   │   │   ├── ProductStatus.php
│   │   │   ├── QuoteStatus.php
│   │   │   ├── ReviewStatus.php
│   │   │   ├── SupplierSector.php
│   │   │   ├── TenderStatus.php
│   │   │   ├── UserRole.php
│   │   │   ├── UserStatus.php
│   │   │   ├── ValidationStatus.php
│   │   │   └── WhatsAppStatus.php
│   │   ├── Events/
│   │   │   ├── ConversationRead.php
│   │   │   ├── MessageSent.php
│   │   │   └── NotificationCreated.php
│   │   ├── Exceptions/
│   │   │   └── AiUnavailableException.php
│   │   ├── Http/
│   │   │   ├── Controllers/
│   │   │   │   ├── Api/
│   │   │   │   │   ├── Admin/
│   │   │   │   │   │   ├── AdminDashboardController.php
│   │   │   │   │   │   ├── AdminExportController.php
│   │   │   │   │   │   ├── AdminProductController.php
│   │   │   │   │   │   ├── AdminReviewController.php
│   │   │   │   │   │   ├── AnomalyAlertController.php
│   │   │   │   │   │   ├── AuditLogController.php
│   │   │   │   │   │   ├── CategoryController.php
│   │   │   │   │   │   ├── DisputeController.php
│   │   │   │   │   │   ├── SupplierValidationController.php
│   │   │   │   │   │   └── UserController.php
│   │   │   │   │   ├── Buyer/
│   │   │   │   │   │   ├── BuyerDashboardController.php
│   │   │   │   │   │   ├── BuyerOrderController.php
│   │   │   │   │   │   ├── BuyerReviewController.php
│   │   │   │   │   │   ├── FavoriteController.php
│   │   │   │   │   │   ├── FavoriteSupplierController.php
│   │   │   │   │   │   ├── OrderController.php
│   │   │   │   │   │   ├── QuoteController.php
│   │   │   │   │   │   ├── QuoteSummaryController.php
│   │   │   │   │   │   ├── RecommendationController.php
│   │   │   │   │   │   ├── TenderAiController.php
│   │   │   │   │   │   └── TenderController.php
│   │   │   │   │   ├── Supplier/
│   │   │   │   │   │   ├── ReviewReportController.php
│   │   │   │   │   │   ├── SupplierDashboardController.php
│   │   │   │   │   │   ├── SupplierDocumentController.php
│   │   │   │   │   │   ├── SupplierOrderController.php
│   │   │   │   │   │   ├── SupplierProductController.php
│   │   │   │   │   │   ├── SupplierProfileController.php
│   │   │   │   │   │   ├── SupplierReviewController.php
│   │   │   │   │   │   ├── SupplierValidationStatusController.php
│   │   │   │   │   │   └── TenderController.php
│   │   │   │   │   ├── AccountController.php
│   │   │   │   │   ├── AiController.php
│   │   │   │   │   ├── ApiDocsController.php
│   │   │   │   │   ├── AuthController.php
│   │   │   │   │   ├── BuyerRegistrationController.php
│   │   │   │   │   ├── CategoryController.php
│   │   │   │   │   ├── ChatbotController.php
│   │   │   │   │   ├── ConversationController.php
│   │   │   │   │   ├── DisputeController.php
│   │   │   │   │   ├── DocumentController.php
│   │   │   │   │   ├── EmailVerificationController.php
│   │   │   │   │   ├── HomeController.php
│   │   │   │   │   ├── NotificationController.php
│   │   │   │   │   ├── NotificationPreferenceController.php
│   │   │   │   │   ├── OrderController.php
│   │   │   │   │   ├── PasswordResetController.php
│   │   │   │   │   ├── ProductController.php
│   │   │   │   │   ├── ReferenceController.php
│   │   │   │   │   ├── SupplierController.php
│   │   │   │   │   ├── SupplierPublicReviewController.php
│   │   │   │   │   ├── SupplierRegistrationController.php
│   │   │   │   │   └── WhatsAppConsentController.php
│   │   │   │   └── Controller.php
│   │   │   ├── Middleware/
│   │   │   │   ├── EnsureEmailIsVerified.php
│   │   │   │   ├── EnsureSupplierIsValidated.php
│   │   │   │   ├── EnsureUserHasRole.php
│   │   │   │   └── SecurityHeaders.php
│   │   │   ├── Requests/
│   │   │   │   ├── Account/
│   │   │   │   │   ├── ConfirmAccountPasswordRequest.php
│   │   │   │   │   ├── UpdateAccountRequest.php
│   │   │   │   │   ├── UpdateEmailRequest.php
│   │   │   │   │   ├── UpdatePasswordRequest.php
│   │   │   │   │   └── UpdateProfileRequest.php
│   │   │   │   ├── Admin/
│   │   │   │   │   ├── CategoryRules.php
│   │   │   │   │   ├── ChangeUserStatusRequest.php
│   │   │   │   │   ├── MoveCategoryRequest.php
│   │   │   │   │   ├── StoreCategoryRequest.php
│   │   │   │   │   └── UpdateCategoryRequest.php
│   │   │   │   ├── Auth/
│   │   │   │   │   ├── ForgotPasswordRequest.php
│   │   │   │   │   ├── LoginRequest.php
│   │   │   │   │   ├── RegisterBuyerRequest.php
│   │   │   │   │   ├── RegisterSupplierRequest.php
│   │   │   │   │   └── ResetPasswordRequest.php
│   │   │   │   ├── Buyer/
│   │   │   │   │   ├── InviteSupplierRequest.php
│   │   │   │   │   └── StoreTenderRequest.php
│   │   │   │   ├── Catalog/
│   │   │   │   │   └── SearchProductsRequest.php
│   │   │   │   ├── Dashboard/
│   │   │   │   │   ├── ExportRequest.php
│   │   │   │   │   └── PeriodRangeRequest.php
│   │   │   │   ├── Dispute/
│   │   │   │   │   ├── DecideDisputeRequest.php
│   │   │   │   │   └── OpenDisputeRequest.php
│   │   │   │   ├── Messaging/
│   │   │   │   │   ├── OpenConversationRequest.php
│   │   │   │   │   └── SendMessageRequest.php
│   │   │   │   ├── Notification/
│   │   │   │   │   └── UpdateNotificationPreferencesRequest.php
│   │   │   │   └── Supplier/
│   │   │   │       ├── IndexSupplierProductsRequest.php
│   │   │   │       ├── PublishSupplierProfileRequest.php
│   │   │   │       ├── ReorderProductImagesRequest.php
│   │   │   │       ├── SaveProductRequest.php
│   │   │   │       ├── StoreProductImagesRequest.php
│   │   │   │       ├── StoreQuoteRequest.php
│   │   │   │       ├── StoreSupplierDocumentRequest.php
│   │   │   │       ├── UpdateSupplierLogoRequest.php
│   │   │   │       └── UpdateSupplierProfileRequest.php
│   │   │   └── Resources/
│   │   │       ├── AdminUserResource.php
│   │   │       ├── AuditLogResource.php
│   │   │       ├── CategoryResource.php
│   │   │       ├── ConversationResource.php
│   │   │       ├── DisputeResource.php
│   │   │       ├── FavoriteSupplierResource.php
│   │   │       ├── MessageResource.php
│   │   │       ├── NotificationResource.php
│   │   │       ├── OrderResource.php
│   │   │       ├── ProductCardResource.php
│   │   │       ├── ProductDetailResource.php
│   │   │       ├── QuoteResource.php
│   │   │       ├── ReceivedTenderResource.php
│   │   │       ├── ReviewResource.php
│   │   │       ├── SupplierDocumentResource.php
│   │   │       ├── SupplierProductResource.php
│   │   │       ├── SupplierProfileResource.php
│   │   │       ├── SupplierPublicResource.php
│   │   │       ├── SupplierValidationStatusResource.php
│   │   │       ├── TenderFavoriteSupplierResource.php
│   │   │       ├── TenderResource.php
│   │   │       └── UserResource.php
│   │   ├── Jobs/
│   │   │   ├── AnalyzeReviewJob.php
│   │   │   ├── DiffuseTenderJob.php
│   │   │   ├── GenerateExportJob.php
│   │   │   └── ModerateProductJob.php
│   │   ├── Models/
│   │   │   ├── AiInteraction.php
│   │   │   ├── AnomalyAlert.php
│   │   │   ├── AuditLog.php
│   │   │   ├── BuyerProfile.php
│   │   │   ├── Category.php
│   │   │   ├── Conversation.php
│   │   │   ├── ConversationParticipant.php
│   │   │   ├── Dispute.php
│   │   │   ├── DisputeAttachment.php
│   │   │   ├── Document.php
│   │   │   ├── Export.php
│   │   │   ├── Favorite.php
│   │   │   ├── Message.php
│   │   │   ├── NotificationPreference.php
│   │   │   ├── Order.php
│   │   │   ├── OrderItem.php
│   │   │   ├── OrderStatusHistory.php
│   │   │   ├── Product.php
│   │   │   ├── ProductImage.php
│   │   │   ├── ProductView.php
│   │   │   ├── Quote.php
│   │   │   ├── Region.php
│   │   │   ├── Review.php
│   │   │   ├── ReviewReport.php
│   │   │   ├── SupplierDocument.php
│   │   │   ├── SupplierProfile.php
│   │   │   ├── Tender.php
│   │   │   ├── TenderAttachment.php
│   │   │   ├── TenderRecipient.php
│   │   │   ├── User.php
│   │   │   └── WhatsAppDelivery.php
│   │   ├── Notifications/
│   │   │   ├── Channels/
│   │   │   │   └── WhatsAppChannel.php
│   │   │   ├── Concerns/
│   │   │   │   └── RespectsNotificationPreferences.php
│   │   │   ├── AccountDeletedNotification.php
│   │   │   ├── AccountReactivatedNotification.php
│   │   │   ├── AccountSuspendedNotification.php
│   │   │   ├── DisputeDecidedNotification.php
│   │   │   ├── DisputeUpdatedNotification.php
│   │   │   ├── ExportReadyNotification.php
│   │   │   ├── NewMessageNotification.php
│   │   │   ├── NewOrderNotification.php
│   │   │   ├── NewQuoteNotification.php
│   │   │   ├── OrderClosedNotification.php
│   │   │   ├── OrderStatusUpdatedNotification.php
│   │   │   ├── OrderValidatedNotification.php
│   │   │   ├── ProductWithdrawnNotification.php
│   │   │   ├── QuoteAcceptedNotification.php
│   │   │   ├── QuoteRejectedNotification.php
│   │   │   ├── ReviewModeratedNotification.php
│   │   │   ├── ReviewReplyNotification.php
│   │   │   ├── ReviewReportedNotification.php
│   │   │   ├── ReviewSubmittedNotification.php
│   │   │   ├── SupplierValidationNotification.php
│   │   │   ├── TenderCancelledNotification.php
│   │   │   └── TenderReceivedNotification.php
│   │   ├── Policies/
│   │   │   ├── ProductPolicy.php
│   │   │   ├── QuotePolicy.php
│   │   │   ├── SupplierDocumentPolicy.php
│   │   │   ├── SupplierProfilePolicy.php
│   │   │   └── TenderPolicy.php
│   │   ├── Providers/
│   │   │   └── AppServiceProvider.php
│   │   └── Services/
│   │       ├── Ai/
│   │       │   ├── AiClient.php
│   │       │   ├── AiRequest.php
│   │       │   ├── AiResponse.php
│   │       │   ├── AiService.php
│   │       │   ├── GeminiAiClient.php
│   │       │   └── SimulatedAiClient.php
│   │       ├── Dashboard/
│   │       │   ├── AdminDashboardService.php
│   │       │   ├── BuyerDashboardService.php
│   │       │   └── SupplierDashboardService.php
│   │       ├── Export/
│   │       │   ├── CsvWriter.php
│   │       │   ├── StatisticsExport.php
│   │       │   └── XlsxWriter.php
│   │       ├── Media/
│   │       │   ├── CloudinaryMediaStorage.php
│   │       │   └── LocalMediaStorage.php
│   │       ├── WhatsApp/
│   │       │   ├── SimulatedWhatsAppClient.php
│   │       │   ├── WhatsAppClient.php
│   │       │   ├── WhatsAppMessage.php
│   │       │   ├── WhatsAppResult.php
│   │       │   └── WhatsAppSettings.php
│   │       ├── AnomalyDetector.php
│   │       ├── AuditLogger.php
│   │       ├── CategoryService.php
│   │       ├── ChatbotService.php
│   │       ├── ConversationService.php
│   │       ├── DisputeService.php
│   │       ├── FavoriteService.php
│   │       ├── HomeService.php
│   │       ├── MarketPriceService.php
│   │       ├── OrderDocumentService.php
│   │       ├── OrderService.php
│   │       ├── ProductCatalogService.php
│   │       ├── ProductModerationService.php
│   │       ├── ProductService.php
│   │       ├── ProductViewRecorder.php
│   │       ├── QuoteService.php
│   │       ├── QuoteSummaryService.php
│   │       ├── RelevanceScorer.php
│   │       ├── ReviewInsightService.php
│   │       ├── SupplierProfileService.php
│   │       ├── SupplierRatingService.php
│   │       ├── SupplierRecommendationService.php
│   │       ├── TenderAnalysisService.php
│   │       ├── TenderService.php
│   │       ├── UserAdministrationService.php
│   │       └── WritingAssistant.php
│   ├── bootstrap/
│   │   ├── cache/
│   │   │   └── .gitignore
│   │   ├── app.php
│   │   └── providers.php
│   ├── config/
│   │   ├── ai.php
│   │   ├── app.php
│   │   ├── auth.php
│   │   ├── broadcasting.php
│   │   ├── cache.php
│   │   ├── chatbot.php
│   │   ├── cors.php
│   │   ├── database.php
│   │   ├── filesystems.php
│   │   ├── logging.php
│   │   ├── mail.php
│   │   ├── media.php
│   │   ├── queue.php
│   │   ├── reverb.php
│   │   ├── sanctum.php
│   │   ├── services.php
│   │   ├── session.php
│   │   └── whatsapp.php
│   ├── database/
│   │   ├── factories/
│   │   │   ├── CategoryFactory.php
│   │   │   ├── ProductFactory.php
│   │   │   ├── SupplierProfileFactory.php
│   │   │   └── UserFactory.php
│   │   ├── migrations/
│   │   │   ├── 0001_01_01_000000_create_users_table.php
│   │   │   ├── 0001_01_01_000001_create_cache_table.php
│   │   │   ├── 0001_01_01_000002_create_jobs_table.php
│   │   │   ├── 0001_01_01_000003_create_personal_access_tokens_table.php
│   │   │   ├── 2026_11_11_093029_create_referentiels_tables.php
│   │   │   ├── 2026_11_11_093040_create_comptes_profiles_tables.php
│   │   │   ├── 2026_11_11_093047_create_catalogue_tables.php
│   │   │   ├── 2026_11_11_093056_create_demandes_et_devis_tables.php
│   │   │   ├── 2026_11_11_093103_create_messagerie_tables.php
│   │   │   ├── 2026_11_11_093110_create_commandes_tables.php
│   │   │   ├── 2026_11_11_093118_create_avis_et_litiges_tables.php
│   │   │   ├── 2026_11_11_093125_create_ia_et_supervision_tables.php
│   │   │   ├── 2026_11_12_000000_add_registration_fields_to_account_tables.php
│   │   │   ├── 2026_11_16_100000_add_catalogue_indexes_to_products_table.php
│   │   │   ├── 2026_11_16_100000_update_orders_status_enum.php
│   │   │   ├── 2026_11_16_110000_add_soft_deletes_to_products_table.php
│   │   │   ├── 2026_11_17_000000_add_original_name_to_tender_attachments_table.php
│   │   │   ├── 2026_11_18_000000_fix_supplier_documents_type_check_for_pgsql.php
│   │   │   ├── 2026_11_23_100000_complete_messaging_and_review_reports.php
│   │   │   ├── 2026_11_23_200000_complete_disputes_tables.php
│   │   │   ├── 2026_11_24_000001_create_exports_table.php
│   │   │   ├── 2026_11_24_100000_complete_ai_interactions_table.php
│   │   │   ├── 2026_11_25_100000_add_whatsapp_notifications.php
│   │   │   ├── 2026_11_25_200000_convert_s6_disputes_and_ai_data.php
│   │   │   ├── 2026_11_25_300000_mark_reported_reviews.php
│   │   │   ├── 2026_11_25_400000_add_indicators_to_exports_table.php
│   │   │   ├── 2026_11_26_000000_drop_legacy_enum_checks_for_pgsql.php
│   │   │   └── 2026_11_27_000000_create_deployment_markers_table.php
│   │   ├── seeders/
│   │   │   ├── demo-images/
│   │   │   │   ├── logos/
│   │   │   │   │   └── [14 image(s)]
│   │   │   │   ├── products/
│   │   │   │   │   ├── [42 image(s)]
│   │   │   │   │   └── CREDITS.md
│   │   │   │   └── generate.cjs
│   │   │   ├── CatalogueDemoSeeder.php
│   │   │   ├── DatabaseSeeder.php
│   │   │   ├── FullDemoSeeder.php
│   │   │   └── SupplierProfileDemoSeeder.php
│   │   └── .gitignore
│   ├── public/
│   │   ├── .htaccess
│   │   ├── [1 image(s)]
│   │   ├── index.php
│   │   └── robots.txt
│   ├── resources/
│   │   └── views/
│   │       └── pdf/
│   │           ├── invoice.blade.php
│   │           └── quote.blade.php
│   ├── routes/
│   │   ├── api.php
│   │   ├── channels.php
│   │   ├── console.php
│   │   └── web.php
│   ├── storage/
│   │   ├── app/
│   │   │   ├── private/
│   │   │   │   └── .gitignore
│   │   │   ├── public/
│   │   │   │   └── .gitignore
│   │   │   └── .gitignore
│   │   ├── framework/
│   │   │   ├── cache/
│   │   │   │   ├── data/
│   │   │   │   │   └── .gitignore
│   │   │   │   └── .gitignore
│   │   │   ├── sessions/
│   │   │   │   └── .gitignore
│   │   │   ├── testing/
│   │   │   │   └── .gitignore
│   │   │   ├── views/
│   │   │   │   └── .gitignore
│   │   │   └── .gitignore
│   │   └── logs/
│   │       └── .gitignore
│   ├── tests/
│   │   ├── Feature/
│   │   │   ├── Admin/
│   │   │   │   ├── AdminDashboardTest.php
│   │   │   │   ├── AnomalyAlertTest.php
│   │   │   │   ├── AuditLogTest.php
│   │   │   │   ├── CategoryManagementTest.php
│   │   │   │   ├── ExportTest.php
│   │   │   │   ├── ModerationTest.php
│   │   │   │   └── UserManagementTest.php
│   │   │   ├── Ai/
│   │   │   │   ├── AiEndpointsTest.php
│   │   │   │   ├── ChatbotTest.php
│   │   │   │   ├── GeminiAiClientTest.php
│   │   │   │   ├── QuoteSummaryTest.php
│   │   │   │   ├── ReviewAiTest.php
│   │   │   │   └── TenderAiTest.php
│   │   │   ├── Auth/
│   │   │   │   ├── AccountDeletionTest.php
│   │   │   │   ├── AccountSettingsTest.php
│   │   │   │   ├── BuyerRegistrationTest.php
│   │   │   │   ├── EmailVerificationTest.php
│   │   │   │   ├── LoginTest.php
│   │   │   │   ├── PasswordResetTest.php
│   │   │   │   ├── RoleAccessTest.php
│   │   │   │   └── SupplierRegistrationTest.php
│   │   │   ├── Buyer/
│   │   │   │   ├── BuyerDashboardTest.php
│   │   │   │   ├── FavoriteSupplierTest.php
│   │   │   │   └── RecommendationTest.php
│   │   │   ├── Catalog/
│   │   │   │   ├── CatalogueDemoSeederTest.php
│   │   │   │   ├── FullDemoSeederTest.php
│   │   │   │   ├── HomePageTest.php
│   │   │   │   ├── ProductDetailTest.php
│   │   │   │   ├── ProductSearchTest.php
│   │   │   │   ├── SupplierDirectoryTest.php
│   │   │   │   └── SupplierPublicPageTest.php
│   │   │   ├── Journey/
│   │   │   │   └── TenderToReviewJourneyTest.php
│   │   │   ├── Messaging/
│   │   │   │   └── MessagingTest.php
│   │   │   ├── Notification/
│   │   │   │   ├── NotificationCenterTest.php
│   │   │   │   ├── PreferencesAppliedTest.php
│   │   │   │   └── WhatsAppTest.php
│   │   │   ├── Security/
│   │   │   │   └── SecurityAuditTest.php
│   │   │   ├── Supplier/
│   │   │   │   ├── FeaturedProductTest.php
│   │   │   │   ├── MyProductsTest.php
│   │   │   │   ├── ReviewReportTest.php
│   │   │   │   ├── SupplierDashboardTest.php
│   │   │   │   ├── SupplierProductTest.php
│   │   │   │   ├── SupplierProfileTest.php
│   │   │   │   ├── SupplierQuoteTest.php
│   │   │   │   └── SupplierValidationStatusTest.php
│   │   │   ├── Tender/
│   │   │   │   ├── AcceptQuoteTest.php
│   │   │   │   ├── RelevanceScorerTest.php
│   │   │   │   ├── TenderDiffusionTest.php
│   │   │   │   └── TenderTest.php
│   │   │   ├── ApiDocsTest.php
│   │   │   ├── DirectOrderTest.php
│   │   │   ├── DisputeTest.php
│   │   │   ├── ErrorResponseTest.php
│   │   │   ├── OrderClosureAndPdfTest.php
│   │   │   ├── OrderTrackingAndAdvanceTest.php
│   │   │   ├── PublicCategoryTest.php
│   │   │   ├── ReferenceDataSeederTest.php
│   │   │   ├── ReviewTest.php
│   │   │   └── SupplierValidationTest.php
│   │   ├── Unit/
│   │   │   ├── UserRoleTest.php
│   │   │   └── UserStatusTest.php
│   │   └── TestCase.php
│   ├── .editorconfig
│   ├── .env.example
│   ├── .gitattributes
│   ├── .gitignore
│   ├── .styleci.yml
│   ├── artisan
│   ├── composer.json
│   ├── composer.lock
│   ├── phpunit.xml
│   └── README.md
├── deploy/
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── Dockerfile.dockerignore
│   │   ├── entrypoint.sh
│   │   ├── nginx.conf.template
│   │   ├── php.ini
│   │   ├── supervisord.conf
│   │   └── worker.sh
│   ├── web/
│   │   ├── Dockerfile
│   │   ├── Dockerfile.dockerignore
│   │   └── nginx.conf
│   ├── .env.example
│   ├── docker-compose.tidb.yml
│   ├── docker-compose.yml
│   ├── README.md
│   ├── start.sh
│   └── stop.sh
├── docs/
│   ├── api/
│   │   ├── admin-dashboard.md
│   │   ├── openapi.json
│   │   └── postman_collection.json
│   ├── tasks/
│   │   └── SCRUM-122.md
│   ├── CONTRIBUTING.md
│   ├── decisions.md
│   ├── DEPLOYMENT.md
│   ├── ENTITIES.md
│   ├── EXPLICATION_COMPLETE.md
│   ├── OPEN_QUESTIONS.md
│   ├── PROGRESS.md
│   ├── ROADMAP.md
│   └── SECURITY.md
├── frontend/
│   ├── e2e-reel/
│   │   └── toutes-les-pages.spec.js
│   ├── e2e/
│   │   ├── support/
│   │   │   └── api.js
│   │   ├── parcours-1-porteur.spec.js
│   │   └── parcours-2-fournisseur.spec.js
│   ├── public/
│   │   ├── icons/
│   │   │   └── [4 image(s)]
│   │   ├── [1 image(s)]
│   │   ├── manifest.webmanifest
│   │   ├── offline.html
│   │   └── sw.js
│   ├── src/
│   │   ├── api/
│   │   │   ├── account.js
│   │   │   ├── adminAnomalies.js
│   │   │   ├── adminCategories.js
│   │   │   ├── adminDashboard.js
│   │   │   ├── adminExports.js
│   │   │   ├── adminModeration.js
│   │   │   ├── adminSuppliers.js
│   │   │   ├── adminUsers.js
│   │   │   ├── ai.js
│   │   │   ├── attachments.js
│   │   │   ├── auditLogs.js
│   │   │   ├── buyerDashboard.js
│   │   │   ├── buyerQuotes.js
│   │   │   ├── catalog.js
│   │   │   ├── categories.js
│   │   │   ├── chatbot.js
│   │   │   ├── disputes.js
│   │   │   ├── emailVerification.js
│   │   │   ├── favorites.js
│   │   │   ├── home.js
│   │   │   ├── http.js
│   │   │   ├── messaging.js
│   │   │   ├── notifications.js
│   │   │   ├── orders.js
│   │   │   ├── passwordReset.js
│   │   │   ├── products.js
│   │   │   ├── quoteSummary.js
│   │   │   ├── reviews.js
│   │   │   ├── supplierDashboard.js
│   │   │   ├── supplierProducts.js
│   │   │   ├── supplierProfile.js
│   │   │   ├── suppliers.js
│   │   │   ├── supplierTenders.js
│   │   │   ├── supplierValidation.js
│   │   │   └── tenders.js
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   │   ├── ActivityAreaChart.jsx
│   │   │   │   ├── ColorKpiCard.jsx
│   │   │   │   ├── DashboardPeriod.jsx
│   │   │   │   ├── EmptyState.jsx
│   │   │   │   ├── ErrorState.jsx
│   │   │   │   ├── KpiCard.jsx
│   │   │   │   ├── KpiIcon.jsx
│   │   │   │   ├── PeriodPicker.jsx
│   │   │   │   ├── Skeleton.jsx
│   │   │   │   ├── TimeSeriesChart.jsx
│   │   │   │   └── WelcomeBanner.jsx
│   │   │   ├── disputes/
│   │   │   │   ├── DisputeParts.jsx
│   │   │   │   └── OrderDisputeCard.jsx
│   │   │   ├── home/
│   │   │   │   ├── HomeCatalog.jsx
│   │   │   │   └── HomeIllustrations.jsx
│   │   │   ├── orders/
│   │   │   │   ├── OrderStatusBadge.jsx
│   │   │   │   └── OrderStatusBadge.test.jsx
│   │   │   ├── AiSuggestion.jsx
│   │   │   ├── AuthCard.jsx
│   │   │   ├── ChatbotWidget.jsx
│   │   │   ├── ChatbotWidget.test.jsx
│   │   │   ├── ContactButton.jsx
│   │   │   ├── ContactButton.test.jsx
│   │   │   ├── EmptyState.jsx
│   │   │   ├── ErrorPage.jsx
│   │   │   ├── FavoriteButton.jsx
│   │   │   ├── Logo.jsx
│   │   │   ├── LogoutButton.jsx
│   │   │   ├── MarketPriceCard.jsx
│   │   │   ├── MarketPriceCard.test.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── NavIcon.jsx
│   │   │   ├── NotificationBell.jsx
│   │   │   ├── OfflineBanner.jsx
│   │   │   ├── PageHeader.jsx
│   │   │   ├── Pagination.jsx
│   │   │   ├── ProductCard.jsx
│   │   │   ├── ProductImage.jsx
│   │   │   ├── ProductImage.test.jsx
│   │   │   ├── ProductImagePlaceholder.jsx
│   │   │   ├── PublicNotFound.jsx
│   │   │   ├── QuoteSummaryCard.jsx
│   │   │   ├── QuoteSummaryCard.test.jsx
│   │   │   ├── RelevanceScoreBadge.jsx
│   │   │   ├── ReviewInsights.jsx
│   │   │   ├── ReviewInsights.test.jsx
│   │   │   ├── ReviewItem.jsx
│   │   │   ├── StarRating.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   ├── TenderBadges.jsx
│   │   │   └── WhatsAppSettings.jsx
│   │   ├── config/
│   │   │   └── brand.js
│   │   ├── layouts/
│   │   │   ├── AdminLayout.jsx
│   │   │   ├── AppLayout.jsx
│   │   │   ├── AppLayout.test.jsx
│   │   │   ├── AuthLayout.jsx
│   │   │   ├── BuyerLayout.jsx
│   │   │   ├── PublicLayout.jsx
│   │   │   ├── PublicLayout.test.jsx
│   │   │   ├── SpaceLayout.jsx
│   │   │   └── SupplierLayout.jsx
│   │   ├── realtime/
│   │   │   └── realtime.js
│   │   ├── router/
│   │   │   ├── guard.js
│   │   │   ├── guard.test.js
│   │   │   ├── index.js
│   │   │   ├── paths.js
│   │   │   ├── routes.jsx
│   │   │   └── routes.test.jsx
│   │   ├── stores/
│   │   │   ├── adminDashboard.js
│   │   │   ├── auth.js
│   │   │   └── messaging.js
│   │   ├── test/
│   │   │   └── setup.js
│   │   ├── utils/
│   │   │   ├── format.js
│   │   │   ├── initials.js
│   │   │   ├── money.js
│   │   │   ├── passwordRules.js
│   │   │   ├── period.js
│   │   │   ├── relativeDate.js
│   │   │   ├── relativeDate.test.js
│   │   │   ├── roles.js
│   │   │   ├── saveBlob.js
│   │   │   ├── supplierDocuments.js
│   │   │   ├── tokenStorage.js
│   │   │   ├── useFormDraft.js
│   │   │   ├── useFormDraft.test.jsx
│   │   │   └── userStatus.js
│   │   ├── views/
│   │   │   ├── account/
│   │   │   │   ├── AccountSettingsView.jsx
│   │   │   │   └── AccountSettingsView.test.jsx
│   │   │   ├── admin/
│   │   │   │   ├── AdminAuditPage.jsx
│   │   │   │   ├── AdminAuditPage.test.jsx
│   │   │   │   ├── AdminDashboard.jsx
│   │   │   │   ├── AdminDashboard.test.jsx
│   │   │   │   ├── AdminDashboardView.jsx
│   │   │   │   ├── AdminDashboardView.test.jsx
│   │   │   │   ├── AdminDisputePage.jsx
│   │   │   │   ├── AdminDisputesPage.jsx
│   │   │   │   ├── AdminExportDialog.jsx
│   │   │   │   ├── AdminExportDialog.test.jsx
│   │   │   │   ├── AdminProductsPage.jsx
│   │   │   │   ├── AdminProductsPage.test.jsx
│   │   │   │   ├── AdminReviewsPage.jsx
│   │   │   │   ├── AdminReviewsPage.test.jsx
│   │   │   │   ├── AdminUserPage.jsx
│   │   │   │   ├── AdminUsers.test.jsx
│   │   │   │   ├── AdminUsersPage.jsx
│   │   │   │   ├── AnomalyAlertsCard.jsx
│   │   │   │   ├── AnomalyAlertsCard.test.jsx
│   │   │   │   ├── CategoryManagementPage.jsx
│   │   │   │   └── CategoryManagementPage.test.jsx
│   │   │   ├── auth/
│   │   │   │   ├── EmailVerifiedView.jsx
│   │   │   │   ├── ForgotPasswordView.jsx
│   │   │   │   ├── LoginView.jsx
│   │   │   │   ├── LoginView.test.jsx
│   │   │   │   ├── PasswordReset.test.jsx
│   │   │   │   ├── RegisterBuyerView.jsx
│   │   │   │   ├── RegisterBuyerView.test.jsx
│   │   │   │   ├── RegisterTypeView.jsx
│   │   │   │   ├── RegisterView.jsx
│   │   │   │   ├── RegisterView.test.jsx
│   │   │   │   ├── ResetPasswordView.jsx
│   │   │   │   └── VerifyEmailNoticeView.jsx
│   │   │   ├── buyer/
│   │   │   │   ├── BuyerAiPage.jsx
│   │   │   │   ├── BuyerAiPage.test.jsx
│   │   │   │   ├── BuyerDashboard.jsx
│   │   │   │   ├── BuyerOrdersPage.jsx
│   │   │   │   ├── BuyerOrdersPage.test.jsx
│   │   │   │   ├── CompareQuotesPage.jsx
│   │   │   │   ├── FavoriteSuppliersPage.jsx
│   │   │   │   ├── FavoriteSuppliersPage.test.jsx
│   │   │   │   ├── NewTenderPage.jsx
│   │   │   │   ├── OrderDetailPage.jsx
│   │   │   │   ├── OrdersPage.jsx
│   │   │   │   ├── RecentActivity.jsx
│   │   │   │   ├── RecommendedSuppliers.jsx
│   │   │   │   ├── RecommendedSuppliers.test.jsx
│   │   │   │   ├── TenderAiAnalysis.jsx
│   │   │   │   ├── TenderAiAnalysis.test.jsx
│   │   │   │   ├── TenderAiDraft.jsx
│   │   │   │   ├── TenderAiDraft.test.jsx
│   │   │   │   ├── TenderDetailPage.jsx
│   │   │   │   └── TendersPage.jsx
│   │   │   ├── catalog/
│   │   │   │   ├── CatalogFilters.jsx
│   │   │   │   ├── catalogParams.js
│   │   │   │   ├── catalogParams.test.js
│   │   │   │   ├── CatalogView.jsx
│   │   │   │   └── CatalogView.test.jsx
│   │   │   ├── disputes/
│   │   │   │   ├── DisputePage.jsx
│   │   │   │   ├── Disputes.test.jsx
│   │   │   │   ├── MyDisputesPage.jsx
│   │   │   │   ├── MyDisputesPage.test.jsx
│   │   │   │   └── NewDisputePage.jsx
│   │   │   ├── errors/
│   │   │   │   ├── ErrorBoundary.jsx
│   │   │   │   ├── ErrorBoundary.test.jsx
│   │   │   │   ├── ForbiddenView.jsx
│   │   │   │   └── NotFoundView.jsx
│   │   │   ├── messaging/
│   │   │   │   ├── ConversationList.jsx
│   │   │   │   ├── ConversationThread.jsx
│   │   │   │   ├── MessageComposer.jsx
│   │   │   │   ├── messageUtils.js
│   │   │   │   ├── messageUtils.test.js
│   │   │   │   ├── MessagingPage.jsx
│   │   │   │   └── MessagingPage.test.jsx
│   │   │   ├── notifications/
│   │   │   │   ├── NotificationPreferencesPage.jsx
│   │   │   │   ├── NotificationPreferencesPage.test.jsx
│   │   │   │   └── NotificationsPage.jsx
│   │   │   ├── orders/
│   │   │   │   ├── OrderTrackingPage.jsx
│   │   │   │   └── OrderTrackingPage.test.jsx
│   │   │   ├── products/
│   │   │   │   ├── OrderBox.jsx
│   │   │   │   ├── ProductPage.jsx
│   │   │   │   └── ProductPage.test.jsx
│   │   │   ├── supplier/
│   │   │   │   ├── pending/
│   │   │   │   │   ├── RejectionNotice.jsx
│   │   │   │   │   ├── ResubmitDocumentsForm.jsx
│   │   │   │   │   ├── TimelineStep.jsx
│   │   │   │   │   └── ValidationTimeline.jsx
│   │   │   │   ├── products/
│   │   │   │   │   ├── MyProductsPage.jsx
│   │   │   │   │   ├── MyProductsPage.test.jsx
│   │   │   │   │   ├── ProductAiText.jsx
│   │   │   │   │   ├── ProductAiText.test.jsx
│   │   │   │   │   ├── ProductFormPage.jsx
│   │   │   │   │   ├── ProductFormPage.test.jsx
│   │   │   │   │   └── ProductImagesField.jsx
│   │   │   │   ├── profile/
│   │   │   │   │   ├── CategoryTags.jsx
│   │   │   │   │   ├── CompanyInfoForm.jsx
│   │   │   │   │   ├── CoverageZones.jsx
│   │   │   │   │   ├── DocumentsCard.jsx
│   │   │   │   │   ├── Field.jsx
│   │   │   │   │   ├── LogoUploader.jsx
│   │   │   │   │   ├── ReputationCard.jsx
│   │   │   │   │   └── ValidationCard.jsx
│   │   │   │   ├── CompanyProfilePage.jsx
│   │   │   │   ├── CompanyProfilePage.test.jsx
│   │   │   │   ├── MyQuotesPage.jsx
│   │   │   │   ├── PendingAccountPage.jsx
│   │   │   │   ├── PendingAccountPage.test.jsx
│   │   │   │   ├── ReceivedTenderDetailPage.jsx
│   │   │   │   ├── ReceivedTendersPage.jsx
│   │   │   │   ├── ReportReviewModal.jsx
│   │   │   │   ├── SupplierAiPage.jsx
│   │   │   │   ├── SupplierAiPage.test.jsx
│   │   │   │   ├── SupplierDashboard.jsx
│   │   │   │   ├── SupplierDashboard.test.jsx
│   │   │   │   ├── SupplierOrdersPage.jsx
│   │   │   │   ├── SupplierOrdersPage.test.jsx
│   │   │   │   ├── SupplierReviewsPage.jsx
│   │   │   │   └── SupplierReviewsPage.test.jsx
│   │   │   ├── suppliers/
│   │   │   │   ├── SupplierPublicPage.jsx
│   │   │   │   ├── SupplierPublicPage.test.jsx
│   │   │   │   ├── SuppliersPage.jsx
│   │   │   │   └── SuppliersPage.test.jsx
│   │   │   ├── HomeView.jsx
│   │   │   └── HomeView.test.jsx
│   │   ├── main.jsx
│   │   └── style.css
│   ├── .env.example
│   ├── .gitignore
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── playwright.config.js
│   ├── playwright.reel.config.js
│   └── vite.config.js
├── mobile/
│   ├── .claude/
│   │   └── settings.json
│   ├── assets/
│   │   └── [6 image(s)]
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js
│   │   ├── auth/
│   │   │   └── AuthContext.js
│   │   ├── components/
│   │   │   ├── Icon.js
│   │   │   ├── PromptModal.js
│   │   │   └── ui.js
│   │   ├── hooks/
│   │   │   └── useApi.js
│   │   ├── navigation/
│   │   │   └── menus.js
│   │   ├── screens/
│   │   │   ├── AccountScreen.js
│   │   │   ├── AdminScreens.js
│   │   │   ├── AssistantScreen.js
│   │   │   ├── BuyerScreens.js
│   │   │   ├── CatalogScreen.js
│   │   │   ├── DashboardScreen.js
│   │   │   ├── HomeScreen.js
│   │   │   ├── ListScreens.js
│   │   │   ├── LoginScreen.js
│   │   │   ├── MenuScreen.js
│   │   │   ├── MessagingScreens.js
│   │   │   ├── ProductScreen.js
│   │   │   └── SupplierScreens.js
│   │   ├── sync/
│   │   │   └── UnreadContext.js
│   │   ├── utils/
│   │   │   └── format.js
│   │   ├── config.js
│   │   └── theme.js
│   ├── .gitignore
│   ├── AGENTS.md
│   ├── App.js
│   ├── app.json
│   ├── eas.json
│   ├── index.js
│   ├── LICENSE
│   ├── package-lock.json
│   ├── package.json
│   └── README.md
├── .gitignore
├── AppLayout.jsx
├── AuthLayout.jsx
├── PublicLayout.jsx
├── README.md
├── render.tijaralink.yaml
└── SpaceLayout.jsx
```

Total : 806 fichiers suivis, dont 68 images.

---

## 15. Fiche de chaque fichier

Pour chaque dossier : **pourquoi il existe et comment ses fichiers fonctionnent** ; puis pour chaque fichier : **ce qu'il contient / à quoi il sert** et **ses fonctions**. Les descriptions reprennent les commentaires d'en-tête écrits dans le code (SCRUM-xx = user story Jira, Fxx = fonctionnalité du cahier des charges). Un « … » signale un commentaire d'en-tête plus long, à lire dans le fichier.

### Glossaire des noms de fonctions récurrents

| Nom | Signification |
|---|---|
| `__construct` | Constructeur : Laravel y injecte automatiquement les services nécessaires |
| `index` / `show` / `store` / `update` / `destroy` | Lister / afficher un élément / créer / modifier / supprimer (contrôleurs REST) |
| `handle` | Travail principal d'un middleware, d'un job ou d'une commande |
| `authorize` / `rules` / `messages` / `attributes` / `prepareForValidation` | Form Request : droit, règles, messages d'erreur, noms des champs, nettoyage préalable |
| `toArray` | Resource ou notification : données JSON renvoyées / stockées |
| `via` / `toMail` / `eventType` | Notification : canaux, contenu de l'e-mail, type d'événement pour les préférences |
| `casts` | Modèle : conversion des colonnes (dates, enums, JSON, décimaux) |
| `scopeXxx` | Modèle : filtre réutilisable appelé `Model::xxx()` |
| `booted` | Modèle : règles automatiques à la création/modification |
| `values` | Enum : liste des valeurs autorisées |
| `validate` / `schema` | Services IA : vérifier la sortie de l'IA / décrire le JSON attendu |
| `definition` | Factory : valeurs par défaut d'un objet de test |
| `run` | Seeder ou service : point d'entrée |
| `up` / `down` | Migration : appliquer / annuler |
| `broadcastOn` / `broadcastAs` / `broadcastWith` | Événement : canal, nom, données diffusées |
| `handleXxx`, `onXxx`, `submit`, `toggle`, `update` (React) | Gestionnaires d'actions de l'utilisateur (clic, saisie, envoi) |
| `fetchXxx`, `createXxx`, `updateXxx`, `deleteXxx` (api/) | Appel HTTP GET / POST / PUT-PATCH / DELETE correspondant |
| Nom en PascalCase (React) | Composant React (fonction qui renvoie de l'interface) |

### Intégration continue (`.github/`)

*Pourquoi / comment :* Automatise les tests à chaque pull request : rien n'arrive sur main sans tests verts.

- **`.github/pull_request_template.md`** — Modèle de description pré-rempli pour chaque pull request (lien Jira, tests, captures).
- **`.github/workflows/ci.yml`** — Intégration continue GitHub Actions : tests PHPUnit (SQLite puis PostgreSQL 17) et tests/build du frontend à chaque PR et push sur main/develop.
### Racine du dépôt (`/`)

- **`.gitignore`** — Fichiers que git ignore (node_modules, vendor, .env, builds…).
- **`AppLayout.jsx`** — Ancienne copie de frontend/src/layouts/AppLayout.jsx, non utilisée (à supprimer).
- **`AuthLayout.jsx`** — Ancienne copie de frontend/src/layouts/AuthLayout.jsx, non utilisée (à supprimer).
- **`PublicLayout.jsx`** — Ancienne copie de frontend/src/layouts/PublicLayout.jsx, non utilisée (à supprimer).
- **`README.md`** — Présentation du projet : stack, installation, comptes de démo, architecture en bref, environnements et déploiement.
- **`SpaceLayout.jsx`** — Ancienne copie de frontend/src/layouts/SpaceLayout.jsx, non utilisée (à supprimer).
### Backend — racine (`backend/`)

*Pourquoi / comment :* Fichiers de projet Laravel.

- **`backend/.editorconfig`** — Règles d'indentation/encodage communes aux éditeurs.
- **`backend/.env.example`** — Modèle du fichier .env : toutes les variables (base, mail, IA, médias, Reverb…) avec leurs valeurs locales par défaut.
- **`backend/.gitattributes`** — Réglages git (fins de ligne, fichiers exclus des archives).
- **`backend/.github/workflows/issues.yml`** — Workflow hérité du squelette Laravel (gestion des tickets) ; inactif ici car seul le `.github/` racine est lu par GitHub.
- **`backend/.github/workflows/pull-requests.yml`** — Workflow hérité du squelette Laravel, inactif (dossier non lu par GitHub).
- **`backend/.github/workflows/tests.yml`** — Workflow de tests hérité du squelette Laravel, inactif : la vraie CI est `.github/workflows/ci.yml`.
- **`backend/.github/workflows/update-changelog.yml`** — Workflow hérité du squelette Laravel, inactif.
- **`backend/.gitignore`** — Fichiers ignorés propres au backend (vendor, .env, storage…).
- **`backend/.styleci.yml`** — Configuration du service de style de code (hérité du squelette Laravel).
- **`backend/README.md`** — README d'origine du squelette Laravel.
### Backend — commandes artisan (`backend/app/Console/`)

*Pourquoi / comment :* Commandes lancées en ligne de commande (php artisan …) ou par l'entrypoint Docker. handle() = ce que fait la commande.

- **`backend/app/Console/Commands/GenerateApiDocs.php`** — Documentation de l'API (SCRUM-91) générée à partir des routes réelles : impossible d'oublier un endpoint. Pour chaque route /api : méthode, chemin, résumé (PHPDoc du contrôleur), rôle requis (middlewares auth:sanctum, ve …  
  *Fonctions :* `handle`, `describe`, `fromController`, `ruleText`, `schema`, `example`, `openApi`, `postman`
- **`backend/app/Console/Commands/ResetDemoData.php`** — Recrée la base avec les données de démonstration (photos comprises), une seule fois par jeton. Appelée au démarrage du conteneur (deploy/api/entrypoint.sh) quand RESET_DEMO_TOKEN est défini. Le jeton appliqué est enregis …  
  *Fonctions :* `handle`, `alreadyApplied`
### Backend — contrats (interfaces) (`backend/app/Contracts/`)

*Pourquoi / comment :* Définissent ce qu'un fournisseur externe doit savoir faire ; le code métier dépend du contrat, pas de l'implémentation (inversion de dépendance).

- **`backend/app/Contracts/MediaStorage.php`** — Stockage des fichiers envoyés par les utilisateurs. Deux implémentations : disques Laravel (local, tests) et Cloudinary (production). La clé renvoyée par store() est ce qui est enregistré en base (colonne path, file_path …  
  *Fonctions :* `store`, `delete`, `url`, `download`
### Backend — énumérations (`backend/app/Enums/`)

*Pourquoi / comment :* Une seule source de vérité pour les valeurs autorisées (statuts, rôles…). values() renvoie la liste des valeurs (utilisée par les migrations et la validation).

- **`backend/app/Enums/AiFeature.php`** — Fonctionnalités IA (docs/ENTITIES.md, AIInteraction).
- **`backend/app/Enums/AnomalyStatus.php`** — Valeurs : nouvelle, traitée, ignorée.  
  *Fonctions :* `values`
- **`backend/app/Enums/ConversationContext.php`** — Contexte d'une conversation (colonne conversations.context_type).  
  *Fonctions :* `values`
- **`backend/app/Enums/DisputeDecision.php`** — Décision de l'administrateur. Elle est enregistrée et notifiée ; aucun remboursement n'est déclenché par l'application.  
  *Fonctions :* `values`
- **`backend/app/Enums/DisputeReason.php`** — Motif d'un litige. La valeur enregistrée est le libellé affiché (tableau de bord admin, e-mails).  
  *Fonctions :* `values`
- **`backend/app/Enums/DisputeStatus.php`** — Valeurs : ouvert, en cours, décidé.  
  *Fonctions :* `values`
- **`backend/app/Enums/OrderStatus.php`** — Valeurs : validée, en préparation, en livraison, expédiée, livrée, clôturée.  
  *Fonctions :* `values`
- **`backend/app/Enums/ProductStatus.php`** — Valeurs : brouillon, publié, retiré.  
  *Fonctions :* `values`
- **`backend/app/Enums/QuoteStatus.php`** — Valeurs : envoyé, en négociation, accepté, refusé.  
  *Fonctions :* `values`
- **`backend/app/Enums/ReviewStatus.php`** — Valeurs : publié, signalé, masqué.  
  *Fonctions :* `values`
- **`backend/app/Enums/SupplierSector.php`** — Secteurs d'activité proposés dans la liste déroulante « Secteur » du profil fournisseur (SCRUM-28). Liste fixe : ajouter un secteur = ajouter un cas ici.  
  *Fonctions :* `values`
- **`backend/app/Enums/TenderStatus.php`** — Valeurs : ouverte, en négociation, clôturée, annulée.  
  *Fonctions :* `values`
- **`backend/app/Enums/UserRole.php`** — Valeurs : supplier, buyer, admin.  
  *Fonctions :* `label`
- **`backend/app/Enums/UserStatus.php`** — Valeurs : e-mail à vérifier, actif, suspendu, désactivé.  
  *Fonctions :* `values`
- **`backend/app/Enums/ValidationStatus.php`** — Valeurs : en attente, validé, refusé.  
  *Fonctions :* `values`
- **`backend/app/Enums/WhatsAppStatus.php`** — Valeurs : envoyé, simulé, échoué.
### Backend — événements temps réel (`backend/app/Events/`)

*Pourquoi / comment :* Diffusés par Reverb sur le canal privé user.{id}. broadcastOn() = canal, broadcastAs() = nom de l'événement, broadcastWith() = données (identifiants seulement).

- **`backend/app/Events/ConversationRead.php`** — Un participant a lu la conversation : accusé « Lu » chez l'autre, compteurs à jour sur ses autres onglets.  
  *Fonctions :* `__construct`, `broadcastOn`, `broadcastAs`, `broadcastWith`
- **`backend/app/Events/MessageSent.php`** — Nouveau message (SCRUM-60). Seuls les identifiants sont diffusés : le contenu est ensuite lu par l'API, qui vérifie les droits et n'a pas de limite de taille.  
  *Fonctions :* `__construct`, `broadcastOn`, `broadcastAs`, `broadcastWith`
- **`backend/app/Events/NotificationCreated.php`** — Une notification vient d'être ajoutée au centre de l'utilisateur (SCRUM-62) : la cloche se met à jour.  
  *Fonctions :* `__construct`, `broadcastOn`, `broadcastAs`, `broadcastWith`
### Backend — exceptions (`backend/app/Exceptions/`)

*Pourquoi / comment :* Erreurs métier rendues en JSON propre (render()).

- **`backend/app/Exceptions/AiUnavailableException.php`** — L'IA ne peut pas répondre : désactivée, en panne, trop lente, refus ou sortie inutilisable. L'IA étant une aide, l'application doit toujours continuer sans elle.  
  *Fonctions :* `render`
### Backend — contrôleurs (`backend/app/Http/Controllers/`)

*Pourquoi / comment :* Points d'entrée des routes. Minces : ils reçoivent la requête validée, vérifient les droits (policy), appellent un service et renvoient une Resource. index = liste, show = détail, store = créer, update = modifier, destroy = supprimer ; __construct injecte les services.

- **`backend/app/Http/Controllers/Api/AccountController.php`** — Paramètres du compte (SCRUM-27 / SCRUM-98). Un utilisateur connecté met à jour ses informations, son mot de passe et son adresse e-mail, puis peut désactiver ou supprimer son compte. Ces routes restent accessibles tant q …  
  *Fonctions :* `show`, `updateAccount`, `updateProfile`, `updatePassword`, `updateEmail`, `deactivate`, `destroy`, `fillProfile`, `fillEmail`, `sendVerificationEmail`, `hideFromCatalog`, `revokeTokens`, `revokeOtherTokens`, `loadProfiles`
- **`backend/app/Http/Controllers/Api/Admin/AdminDashboardController.php`** — Tableau de bord administrateur (SCRUM-122 / F28, story SCRUM-70). Accessible uniquement au rôle `admin` (middleware du groupe de routes).  
  *Fonctions :* `__construct`, `index`
- **`backend/app/Http/Controllers/Api/Admin/AdminExportController.php`** — Exports des statistiques d'administration (SCRUM-75 / F28). CSV ou XLSX, avec les indicateurs choisis.  
  *Fonctions :* `index`, `store`, `download`
- **`backend/app/Http/Controllers/Api/Admin/AdminProductController.php`** — Modération du catalogue par l'administrateur (SCRUM-72 / F29). Le retrait est tracé dans le journal d'audit et le fournisseur est notifié avec le motif. Aucun produit n'est supprimé : il passe au statut `retiré`.  
  *Fonctions :* `__construct`, `index`, `withdraw`
- **`backend/app/Http/Controllers/Api/Admin/AdminReviewController.php`** — Modération des avis signalés (SCRUM-74 / F29). L'administrateur conserve l'avis ou le masque. Masquer un avis recalcule immédiatement la note du fournisseur ; chaque décision est auditée et l'auteur de l'avis et le fourn …  
  *Fonctions :* `__construct`, `index`, `keep`, `hide`, `moderate`
- **`backend/app/Http/Controllers/Api/Admin/AnomalyAlertController.php`** — Alertes d'anomalie (SCRUM-86) : liste, analyse à la demande, « traitée » ou « ignorée ».  
  *Fonctions :* `__construct`, `index`, `scan`, `handle`, `ignore`, `decide`
- **`backend/app/Http/Controllers/Api/Admin/AuditLogController.php`** — Historique des actions d'administration (SCRUM-76). Lecture seule : le journal est immuable, aucune route de modification ou de suppression n'existe. Filtres : administrateur, action, cible, période.  
  *Fonctions :* `index`, `day`
- **`backend/app/Http/Controllers/Api/Admin/CategoryController.php`** — Gestion des catégories et sous-catégories par l'administrateur (SCRUM-32, maquette AD5).  
  *Fonctions :* `__construct`, `index`, `store`, `update`, `move`, `destroy`
- **`backend/app/Http/Controllers/Api/Admin/DisputeController.php`** — Gestion des litiges par l'administrateur (SCRUM-117 / F23).  
  *Fonctions :* `__construct`, `index`, `show`, `take`, `decide`, `resource`
- **`backend/app/Http/Controllers/Api/Admin/SupplierValidationController.php`** — File des demandes fournisseurs, triée de la plus ancienne à la plus récente (SCRUM-31 / F05).  
  *Fonctions :* `index`, `show`, `showDocument`, `downloadDocument`, `serveDocument`, `approve`, `reject`
- **`backend/app/Http/Controllers/Api/Admin/UserController.php`** — Gestion des utilisateurs par l'administrateur (SCRUM-118 / F24).  
  *Fonctions :* `__construct`, `index`, `show`, `suspend`, `reactivate`, `destroy`, `find`, `detail`, `activity`, `counts`
- **`backend/app/Http/Controllers/Api/AiController.php`** — Assistants de rédaction (SCRUM-124, SCRUM-77, SCRUM-78 / F30). Le résumé des devis est sur la page de comparaison (QuoteSummaryController). Le texte proposé est toujours renvoyé comme une suggestion modifiable (`editable …  
  *Fonctions :* `__construct`, `tenderDraft`, `productText`, `accept`, `respond`
- **`backend/app/Http/Controllers/Api/ApiDocsController.php`** — Documentation de l'API accessible depuis l'environnement de démo (SCRUM-91). GET /api/docs : interface Swagger UI ; GET /api/docs/openapi.json : spécification (générée par « php artisan api:docs »).  
  *Fonctions :* `ui`, `spec`
- **`backend/app/Http/Controllers/Api/AuthController.php`** — Connexion, utilisateur connecté et déconnexion (SCRUM-25). Un compte dont l'e-mail reste à vérifier peut se connecter (pour redemander le lien), mais n'accède pas aux espaces métier (middleware "verified", SCRUM-24).  
  *Fonctions :* `login`, `tokenExpiry`, `me`, `logout`
- **`backend/app/Http/Controllers/Api/Buyer/BuyerDashboardController.php`** — Tableau de bord porteur de projet (SCRUM-121 / F27, story SCRUM-69). Accessible uniquement au rôle `buyer` (middleware du groupe de routes).  
  *Fonctions :* `__construct`, `index`
- **`backend/app/Http/Controllers/Api/Buyer/BuyerOrderController.php`** — Gestion des commandes côté porteur de projet (SCRUM-51, SCRUM-58 / F16).  
  *Fonctions :* `index`, `store`, `confirmReceipt`
- **`backend/app/Http/Controllers/Api/Buyer/BuyerReviewController.php`** — Dépôt d'un avis par l'acheteur sur une commande clôturée (SCRUM-64 / F20).  
  *Fonctions :* `store`
- **`backend/app/Http/Controllers/Api/Buyer/FavoriteController.php`** — Fournisseurs favoris du porteur, utilisés pour l'invitation sur une demande (SCRUM-49).  
  *Fonctions :* `index`, `store`, `destroy`
- **`backend/app/Http/Controllers/Api/Buyer/FavoriteSupplierController.php`** — Fournisseurs favoris du porteur de projet connecté (SCRUM-39).  
  *Fonctions :* `__construct`, `index`, `store`, `destroy`, `buyer`
- **`backend/app/Http/Controllers/Api/Buyer/OrderController.php`** — Suivi des commandes du porteur, sans paiement en ligne (SCRUM-48 / F14).  
  *Fonctions :* `__construct`, `index`, `show`
- **`backend/app/Http/Controllers/Api/Buyer/QuoteController.php`** — Comparaison et acceptation des devis reçus (SCRUM-47, SCRUM-48 / F14).  
  *Fonctions :* `__construct`, `index`, `accept`
- **`backend/app/Http/Controllers/Api/Buyer/QuoteSummaryController.php`** — Résumé automatique des devis (SCRUM-119 / F25).  
  *Fonctions :* `__construct`, `show`, `store`, `update`, `respond`
- **`backend/app/Http/Controllers/Api/Buyer/RecommendationController.php`** — Fournisseurs recommandés selon les achats passés (SCRUM-87), affichés sur le tableau de bord porteur.  
  *Fonctions :* `index`
- **`backend/app/Http/Controllers/Api/Buyer/TenderAiController.php`** — IA sur les demandes du porteur de projet (SCRUM-125 / F31). - SCRUM-81 : catégorie, mots-clés et fournisseurs suggérés pendant la saisie de « Publier une demande ». - SCRUM-82 : prix habituel du marché sur « Comparer les …  
  *Fonctions :* `analyze`, `marketPrice`
- **`backend/app/Http/Controllers/Api/Buyer/TenderController.php`** — Demandes du porteur de projet (SCRUM-41, SCRUM-43, SCRUM-49 / F11).  
  *Fonctions :* `__construct`, `index`, `store`, `show`, `downloadAttachment`, `cancel`, `invite`, `perPage`
- **`backend/app/Http/Controllers/Api/BuyerRegistrationController.php`** — Inscription d'un porteur de projet (SCRUM-23). Crée le compte et son profil, puis envoie l'e-mail de vérification. Aucune validation administrateur : le compte est actif dès la vérification.  
  *Fonctions :* `store`
- **`backend/app/Http/Controllers/Api/CategoryController.php`** — Arborescence publique des catégories (SCRUM-32) : filtres du catalogue, formulaire produit, fil d'Ariane, page d'accueil. products_count ne compte que les produits visibles.  
  *Fonctions :* `index`
- **`backend/app/Http/Controllers/Api/ChatbotController.php`** — Chatbot d'assistance (SCRUM-85) : un message de l'utilisateur, une réponse fondée sur le guide de la plateforme.  
  *Fonctions :* `send`
- **`backend/app/Http/Controllers/Api/ConversationController.php`** — Messagerie entre porteurs et fournisseurs (SCRUM-59, SCRUM-60, SCRUM-61 / F21, F22). Une conversation dont on ne fait pas partie répond 404 : son existence n'est pas révélée.  
  *Fonctions :* `__construct`, `index`, `unreadCount`, `store`, `show`, `messages`, `send`, `markRead`, `attachment`, `find`, `resource`
- **`backend/app/Http/Controllers/Api/DisputeController.php`** — Litiges côté acheteur et fournisseur (SCRUM-117 / F23). Un tiers reçoit 404.  
  *Fonctions :* `__construct`, `index`, `forOrder`, `store`, `show`, `attachment`, `find`, `findOrder`, `resource`
- **`backend/app/Http/Controllers/Api/DocumentController.php`** — Téléchargement des documents commerciaux PDF (SCRUM-57).  
  *Fonctions :* `download`
- **`backend/app/Http/Controllers/Api/EmailVerificationController.php`** — Vérification de l'adresse e-mail (SCRUM-24). Le lien reçu par e-mail ouvre l'application React (/email/verifier?id=…&hash=…&expires=…&signature=…), qui appelle ensuite verify() ci-dessous. Le lien est signé, expire (auth …  
  *Fonctions :* `verify`, `resend`, `invalidLink`
- **`backend/app/Http/Controllers/Api/HomeController.php`** — Page d'accueil (SCRUM-38) : chiffres clés, 8 catégories principales, 4 produits mis en avant.  
  *Fonctions :* `__invoke`
- **`backend/app/Http/Controllers/Api/NotificationController.php`** — Centre de notifications de l'utilisateur connecté (SCRUM-62 / F15).  
  *Fonctions :* `index`, `unreadCount`, `markRead`, `markAllRead`
- **`backend/app/Http/Controllers/Api/NotificationPreferenceController.php`** — Préférences de notification : un réglage par événement et par canal (SCRUM-63 / F15). Les e-mails critiques restent actifs côté serveur, même si l'interface les envoie à false.  
  *Fonctions :* `show`, `update`, `whatsappState`
- **`backend/app/Http/Controllers/Api/OrderController.php`** — Consultation détaillée d'une commande et de ses pièces jointes (SCRUM-51, SCRUM-58 / F16).  
  *Fonctions :* `show`, `downloadDocument`, `authorizeOrderAccess`
- **`backend/app/Http/Controllers/Api/PasswordResetController.php`** — Mot de passe oublié (SCRUM-26). 1. forgot() : envoie un lien vers l'application React (/mot-de-passe/nouveau?token=…&email=…). La réponse est la même que l'adresse existe ou non. 2. reset()  : enregistre le nouveau mot d …  
  *Fonctions :* `forgot`, `reset`
- **`backend/app/Http/Controllers/Api/ProductController.php`** — Consultation publique des fiches produits et catalogue fournisseur (SCRUM-51).  
  *Fonctions :* `index`, `show`, `bySupplier`
- **`backend/app/Http/Controllers/Api/ReferenceController.php`** — Données de référence utilisées par les formulaires (régions, catégories).  
  *Fonctions :* `regions`, `categories`, `sectors`
- **`backend/app/Http/Controllers/Api/Supplier/ReviewReportController.php`** — Signaler un avis abusif (SCRUM-66). L'avis passe « signalé », mais reste visible et compté dans la note jusqu'à la décision de l'administrateur : un signalement ne doit pas permettre de masquer une mauvaise note.  
  *Fonctions :* `store`
- **`backend/app/Http/Controllers/Api/Supplier/SupplierDashboardController.php`** — Tableau de bord fournisseur (SCRUM-120 / F26, story SCRUM-68). Accessible dès que le compte a un profil fournisseur : un fournisseur en attente de validation voit un tableau de bord vide plutôt qu'une erreur.  
  *Fonctions :* `__construct`, `index`
- **`backend/app/Http/Controllers/Api/Supplier/SupplierDocumentController.php`** — Documents justificatifs depuis le profil de l'entreprise (SCRUM-28) et renvoi de documents après un refus (SCRUM-27).  
  *Fonctions :* `__construct`, `store`, `download`
- **`backend/app/Http/Controllers/Api/Supplier/SupplierOrderController.php`** — Gestion des commandes côté fournisseur (SCRUM-58 / F16, SCRUM-55 / F18).  
  *Fonctions :* `index`, `advance`
- **`backend/app/Http/Controllers/Api/Supplier/SupplierProductController.php`** — Produits du fournisseur connecté et validé (SCRUM-33 : ajouter / modifier, photos ; SCRUM-34 : Mes produits, dépublier, supprimer).  
  *Fonctions :* `__construct`, `index`, `store`, `show`, `update`, `unpublish`, `feature`, `unfeature`, `destroy`, `storeImages`, `reorderImages`, `destroyImage`
- **`backend/app/Http/Controllers/Api/Supplier/SupplierProfileController.php`** — Profil de l'entreprise (SCRUM-28). Toutes les actions portent sur le profil de l'utilisateur connecté : aucun identifiant de profil dans l'URL, un fournisseur ne peut donc pas viser le profil d'un autre.  
  *Fonctions :* `__construct`, `show`, `update`, `updateLogo`, `publish`, `ownProfile`
- **`backend/app/Http/Controllers/Api/Supplier/SupplierReviewController.php`** — Gestion des avis reçus côté fournisseur (SCRUM-65 / F20).  
  *Fonctions :* `index`, `reply`
- **`backend/app/Http/Controllers/Api/Supplier/SupplierValidationStatusController.php`** — État du dossier du fournisseur connecté (SCRUM-27) : en attente, validé ou refusé avec le motif. Toujours le profil de l'utilisateur connecté (aucun identifiant dans l'URL).  
  *Fonctions :* `show`
- **`backend/app/Http/Controllers/Api/Supplier/TenderController.php`** — Demandes reçues et envoi de devis (SCRUM-44, SCRUM-45 / F13).  
  *Fonctions :* `__construct`, `index`, `show`, `downloadAttachment`, `storeQuote`, `updateQuote`, `myQuotes`
- **`backend/app/Http/Controllers/Api/SupplierController.php`** — Fiche publique d'un fournisseur (SCRUM-37) : accessible sans connexion. 404 si le fournisseur n'est pas visible (non validé, suspendu, désactivé, supprimé ou profil non publié).  
  *Fonctions :* `index`, `show`, `reviews`, `visibleOrFail`
- **`backend/app/Http/Controllers/Api/SupplierPublicReviewController.php`** — Consultation publique des avis d'un fournisseur (SCRUM-65 / F20).  
  *Fonctions :* `index`
- **`backend/app/Http/Controllers/Api/SupplierRegistrationController.php`** — Inscription d'un fournisseur (SCRUM-22). Crée le compte, le profil « en attente » et les justificatifs, puis envoie l'e-mail de vérification. Le profil reste invisible tant qu'un administrateur ne l'a pas validé.  
  *Fonctions :* `store`, `checkEmail`
- **`backend/app/Http/Controllers/Api/WhatsAppConsentController.php`** — Consentement aux notifications WhatsApp (SCRUM-133) : désactivées par défaut, retirable à tout moment.  
  *Fonctions :* `update`
- **`backend/app/Http/Controllers/Controller.php`** — Classe mère (vide) de tous les contrôleurs.
### Backend — middlewares (`backend/app/Http/Middleware/`)

*Pourquoi / comment :* Filtres exécutés avant le contrôleur. handle($request, $next) laisse passer ($next) ou répond 401/403.

- **`backend/app/Http/Middleware/EnsureEmailIsVerified.php`** — Ferme les pages connectées tant que l'adresse e-mail n'est pas vérifiée (SCRUM-24). Le champ "reason" permet au front d'envoyer l'utilisateur sur « Consultez votre boîte mail ».  
  *Fonctions :* `handle`
- **`backend/app/Http/Middleware/EnsureSupplierIsValidated.php`** — Ferme les pages de vente (produits, devis…) tant que l'administrateur n'a pas validé le dossier du fournisseur (SCRUM-27). Le champ "reason" permet au front de renvoyer l'utilisateur sur « Compte en attente de validation …  
  *Fonctions :* `handle`
- **`backend/app/Http/Middleware/EnsureUserHasRole.php`** — Autorise la requête seulement si l'utilisateur connecté a l'un des rôles donnés. Exemple : Route::middleware('role:supplier,admin')  
  *Fonctions :* `handle`
- **`backend/app/Http/Middleware/SecurityHeaders.php`** — En-têtes de sécurité de toutes les réponses de l'API (SCRUM-90) : - pas d'interprétation d'un JSON comme du HTML ou du script (nosniff, CSP « default-src 'none' ») ; - pas d'affichage dans un cadre d'un autre site (click …  
  *Fonctions :* `handle`
### Backend — validation (Form Requests) (`backend/app/Http/Requests/`)

*Pourquoi / comment :* Valident les données entrantes avant le contrôleur. authorize() = droit d'envoyer la requête ; prepareForValidation() = nettoyage (téléphone +216, espaces) ; rules() = règles ; messages()/attributes() = textes d'erreur en français. Échec : réponse 422 automatique.

- **`backend/app/Http/Requests/Account/ConfirmAccountPasswordRequest.php`** — Confirmation par mot de passe avant une action irréversible sur le compte (désactivation ou suppression, SCRUM-30 / SCRUM-98). Le mot de passe n'est jamais renvoyé dans la réponse d'erreur : seul un message générique est …  
  *Fonctions :* `authorize`, `rules`, `messages`, `attributes`
- **`backend/app/Http/Requests/Account/UpdateAccountRequest.php`** — Mise à jour complète du compte (SCRUM-98) : nom, téléphone, informations du profil et adresse e-mail. Réutilise les règles du profil ; l'e-mail peut rester inchangé (dans ce cas aucune nouvelle vérification n'est demandé …  
  *Fonctions :* `prepareForValidation`, `rules`, `messages`, `attributes`
- **`backend/app/Http/Requests/Account/UpdateEmailRequest.php`** — Changement d'adresse e-mail (SCRUM-27). La nouvelle adresse doit être disponible ; elle repasse ensuite par la vérification par e-mail avant de redonner accès aux espaces métier.  
  *Fonctions :* `authorize`, `prepareForValidation`, `rules`, `messages`, `attributes`
- **`backend/app/Http/Requests/Account/UpdatePasswordRequest.php`** — Changement de mot de passe (SCRUM-27). L'ancien mot de passe est exigé, puis le nouveau est soumis aux mêmes règles de robustesse qu'à l'inscription.  
  *Fonctions :* `authorize`, `rules`, `messages`, `attributes`
- **`backend/app/Http/Requests/Account/UpdateProfileRequest.php`** — Modification des informations personnelles (SCRUM-27). Le nom et le téléphone sont communs à tous les rôles ; l'organisation et le secteur ne concernent que le porteur de projet (BuyerProfile).  
  *Fonctions :* `authorize`, `prepareForValidation`, `normalizePhone`, `rules`, `messages`, `attributes`
- **`backend/app/Http/Requests/Admin/CategoryRules.php`** — Règles communes à la création et à la modification d'une catégorie (SCRUM-32).  
  *Fonctions :* `check`, `messages`
- **`backend/app/Http/Requests/Admin/ChangeUserStatusRequest.php`** — Suspendre, réactiver ou supprimer un compte : motif obligatoire, conservé dans le journal (SCRUM-118).  
  *Fonctions :* `authorize`, `prepareForValidation`, `rules`, `messages`
- **`backend/app/Http/Requests/Admin/MoveCategoryRequest.php`** — Réordonnancement d'une catégorie parmi ses sœurs (SCRUM-32) : { "direction": "up" …  
  *Fonctions :* `"down" } (boutons ↑ ↓) ou { "position": 3 } (glisser-déposer).`
- **`backend/app/Http/Requests/Admin/StoreCategoryRequest.php`** — Création d'une catégorie ou d'une sous-catégorie (SCRUM-32).  
  *Fonctions :* `authorize`, `rules`, `withValidator`, `messages`, `integerOrNull`
- **`backend/app/Http/Requests/Admin/UpdateCategoryRequest.php`** — Modification d'une catégorie : nom, catégorie parente, position (SCRUM-32). Champs facultatifs : seuls ceux envoyés sont modifiés (parent_id: null = catégorie principale).  
  *Fonctions :* `authorize`, `rules`, `withValidator`, `messages`
- **`backend/app/Http/Requests/Auth/ForgotPasswordRequest.php`** — « Mot de passe oublié » : saisie de l'adresse e-mail (SCRUM-26).  
  *Fonctions :* `authorize`, `rules`, `messages`
- **`backend/app/Http/Requests/Auth/LoginRequest.php`**  
  *Fonctions :* `authorize`, `rules`, `messages`
- **`backend/app/Http/Requests/Auth/RegisterBuyerRequest.php`** — Inscription d'un porteur de projet (SCRUM-23). Champs obligatoires de docs/ENTITIES.md : compte (nom, prénom, e-mail, téléphone, mot de passe) et profil (type de porteur, organisation, secteur, région, CGU). Les champs o …  
  *Fonctions :* `authorize`, `prepareForValidation`, `normalizePhone`, `rules`, `messages`, `attributes`
- **`backend/app/Http/Requests/Auth/RegisterSupplierRequest.php`** — Inscription d'un fournisseur en trois étapes (SCRUM-22). L'étape 1 (compte) et l'étape 2 (entreprise) sont envoyées avec l'étape 3 (justificatifs) : l'assistant de saisie conserve les données côté navigateur. Champs alig …  
  *Fonctions :* `authorize`, `prepareForValidation`, `normalizePhone`, `rules`, `messages`, `attributes`
- **`backend/app/Http/Requests/Auth/ResetPasswordRequest.php`** — « Nouveau mot de passe » (SCRUM-26) : jeton reçu par e-mail + mot de passe saisi deux fois. Mêmes règles de robustesse qu'à l'inscription (Password::defaults(), voir AppServiceProvider).  
  *Fonctions :* `authorize`, `rules`, `messages`
- **`backend/app/Http/Requests/Buyer/InviteSupplierRequest.php`** — Invitation d'un fournisseur favori sur une demande (SCRUM-49).  
  *Fonctions :* `authorize`, `rules`, `messages`
- **`backend/app/Http/Requests/Buyer/StoreTenderRequest.php`** — Publication d'une demande (SCRUM-41 / F11). Les pièces jointes sont optionnelles ; la date limite doit être future.  
  *Fonctions :* `authorize`, `prepareForValidation`, `rules`, `messages`
- **`backend/app/Http/Requests/Catalog/SearchProductsRequest.php`** — Paramètres du catalogue public (SCRUM-35), tels qu'ils apparaissent dans l'URL : ?q=carton&category=3,5&type=product&region=12&price_min=0&price_max=5000&delay=7&rating=4&sort=price_asc&page=2 Les listes (category, type, …  
  *Fonctions :* `authorize`, `prepareForValidation`, `rules`, `messages`
- **`backend/app/Http/Requests/Dashboard/ExportRequest.php`** — Période, format et indicateurs d'un export de statistiques (SCRUM-75).  
  *Fonctions :* `messages`, `rules`
- **`backend/app/Http/Requests/Dashboard/PeriodRangeRequest.php`** — Période commune aux tableaux de bord (SCRUM-122 / F28, réutilisable F26–F27). - `from` et `to` sont facultatifs : par défaut, les 30 derniers jours. - La période est interprétée en heure tunisienne (Africa/Tunis). - Elle …  
  *Fonctions :* `authorize`, `rules`, `withValidator`, `range`
- **`backend/app/Http/Requests/Dispute/DecideDisputeRequest.php`** — Décision de l'administrateur : motif obligatoire, envoyé aux deux parties (ENTITIES.md, règle 9).  
  *Fonctions :* `authorize`, `prepareForValidation`, `rules`, `messages`
- **`backend/app/Http/Requests/Dispute/OpenDisputeRequest.php`** — « Signaler un problème » sur une commande (SCRUM-117 / F23).  
  *Fonctions :* `authorize`, `prepareForValidation`, `rules`, `messages`
- **`backend/app/Http/Requests/Messaging/OpenConversationRequest.php`** — Ouvrir une conversation depuis une demande, un devis, une commande ou une fiche (SCRUM-61).  
  *Fonctions :* `authorize`, `rules`, `messages`
- **`backend/app/Http/Requests/Messaging/SendMessageRequest.php`** — Envoyer un message, une pièce jointe, ou les deux (SCRUM-60).  
  *Fonctions :* `authorize`, `prepareForValidation`, `rules`, `messages`
- **`backend/app/Http/Requests/Notification/UpdateNotificationPreferencesRequest.php`** — Mise à jour de la grille des préférences de notification (SCRUM-63).  
  *Fonctions :* `authorize`, `rules`, `messages`
- **`backend/app/Http/Requests/Supplier/IndexSupplierProductsRequest.php`** — Filtres de « Mes produits » (SCRUM-34) : ?status=published&category_id=3&page=2 …  
  *Fonctions :* `authorize`, `rules`, `messages`
- **`backend/app/Http/Requests/Supplier/PublishSupplierProfileRequest.php`** — Interrupteur « Profil publié » (SCRUM-28).  
  *Fonctions :* `authorize`, `rules`, `messages`
- **`backend/app/Http/Requests/Supplier/ReorderProductImagesRequest.php`** — Nouvel ordre des photos d'un produit (SCRUM-33) : { "image_ids": [7, 5, 6] }, la première devient l'image principale.  
  *Fonctions :* `authorize`, `rules`, `messages`
- **`backend/app/Http/Requests/Supplier/SaveProductRequest.php`** — Création ou modification d'un produit / service par son fournisseur (SCRUM-33). Les règles de publication (description et au moins une photo) sont vérifiées par ProductService, car elles dépendent des photos déjà enregis …  
  *Fonctions :* `authorize`, `prepareForValidation`, `rules`, `messages`
- **`backend/app/Http/Requests/Supplier/StoreProductImagesRequest.php`** — Ajout de photos à un produit (SCRUM-33) : JPG, PNG ou WebP, 3 Mo maximum, 4 photos au total.  
  *Fonctions :* `authorize`, `rules`, `messages`
- **`backend/app/Http/Requests/Supplier/StoreQuoteRequest.php`** — Envoi ou mise à jour d'un devis (SCRUM-45). Le montant et le délai sont obligatoires ; le devis reste unique par demande.  
  *Fonctions :* `authorize`, `prepareForValidation`, `rules`, `messages`
- **`backend/app/Http/Requests/Supplier/StoreSupplierDocumentRequest.php`** — Ajout d'un document justificatif depuis le profil (SCRUM-28). Il arrive « en attente ».  
  *Fonctions :* `authorize`, `rules`, `messages`
- **`backend/app/Http/Requests/Supplier/UpdateSupplierLogoRequest.php`** — Changement du logo de l'entreprise (SCRUM-28).  
  *Fonctions :* `authorize`, `rules`, `messages`
- **`backend/app/Http/Requests/Supplier/UpdateSupplierProfileRequest.php`** — Mise à jour du profil de l'entreprise (SCRUM-28). Seuls les champs listés ici sont acceptés : validation_status, is_published, rating_avg, reviews_count ou user_id envoyés dans la requête sont ignorés.  
  *Fonctions :* `authorize`, `prepareForValidation`, `normalizePhone`, `rules`, `messages`, `attributes`
### Backend — ressources JSON (`backend/app/Http/Resources/`)

*Pourquoi / comment :* Transforment un modèle en JSON renvoyé au front. toArray() choisit exactement les champs exposés (jamais de données privées par accident).

- **`backend/app/Http/Resources/AdminUserResource.php`** — Compte vu par l'administrateur (SCRUM-118).  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/AuditLogResource.php`** — Entrée du journal d'audit (SCRUM-76).  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/CategoryResource.php`** — Nœud de l'arborescence des catégories (SCRUM-32). products_count / tenders_count ne sont présents que s'ils ont été calculés (CategoryService::tree).  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/ConversationResource.php`** — Conversation vue par l'utilisateur connecté : « party » est toujours l'autre personne.  
  *Fonctions :* `toArray`, `loadContexts`, `contextFor`
- **`backend/app/Http/Resources/DisputeResource.php`** — Litige. Les coordonnées des parties et l'administrateur assigné ne sont visibles que par les admins.  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/FavoriteSupplierResource.php`** — Carte « Fournisseur favori » (SCRUM-39, maquette B8) : uniquement des informations publiques.  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/MessageResource.php`**  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/NotificationResource.php`** — Notification du centre de notifications (SCRUM-62).  
  *Fonctions :* `toArray`, `fallbackTitle`, `fallbackUrl`
- **`backend/app/Http/Resources/OrderResource.php`** — Commande créée par acceptation d'un devis (SCRUM-48).  
  *Fonctions :* `toArray`, `statusLabel`, `labelFor`
- **`backend/app/Http/Resources/ProductCardResource.php`** — Carte produit du catalogue public (SCRUM-35), réutilisée par la fiche produit (similaires), la fiche fournisseur et la page d'accueil. Attend mainImage, supplier et supplier.region chargés.  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/ProductDetailResource.php`** — Fiche produit publique (SCRUM-36) : photos ordonnées, catégorie et parent (fil d'Ariane), fournisseur et sa note, 3 derniers avis du fournisseur. Attend images, category.parent, supplier.region chargés ; latest_reviews, …  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/QuoteResource.php`** — Devis d'un fournisseur (SCRUM-46 / SCRUM-47 / F13-F14).  
  *Fonctions :* `toArray`, `canEdit`, `statusLabel`
- **`backend/app/Http/Resources/ReceivedTenderResource.php`** — Demande reçue par un fournisseur, avec score de pertinence et devis éventuel (SCRUM-44).  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/ReviewResource.php`** — Avis public (SCRUM-37 / SCRUM-36) : auteur abrégé (« Sana B. »), note, commentaire, réponse du fournisseur. Attend buyer.user chargé.  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/SupplierDocumentResource.php`**  
  *Fonctions :* `fileNameFor`, `toArray`
- **`backend/app/Http/Resources/SupplierProductResource.php`** — Produit vu par son fournisseur (SCRUM-33 / SCRUM-34) : tous les champs du formulaire, statut, motif de retrait, photos dans l'ordre, nombre de vues.  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/SupplierProfileResource.php`** — Profil de l'entreprise vu par son propriétaire (SCRUM-28).  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/SupplierPublicResource.php`** — Fiche publique d'un fournisseur (SCRUM-37). Jamais de documents, de coordonnées privées, d'identifiant fiscal ni d'informations de validation. Attend region, categories et coverageRegions chargés ; products_count et is_f …  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/SupplierValidationStatusResource.php`** — État du dossier d'un fournisseur (page « Compte en attente de validation », SCRUM-27).  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/TenderFavoriteSupplierResource.php`** — Fournisseur favori proposé à l'invitation sur une demande (SCRUM-49).  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/TenderResource.php`** — Demande vue par le porteur de projet (SCRUM-43 / F11).  
  *Fonctions :* `toArray`
- **`backend/app/Http/Resources/UserResource.php`**  
  *Fonctions :* `toArray`
### Backend — jobs (file d'attente) (`backend/app/Jobs/`)

*Pourquoi / comment :* Tâches longues exécutées en arrière-plan par le worker (ou immédiatement si QUEUE_CONNECTION=sync). handle() contient le travail.

- **`backend/app/Jobs/AnalyzeReviewJob.php`** — Après chaque nouvel avis (SCRUM-83, SCRUM-84) : sentiment et suspicion de l'avis, puis résumé du fournisseur. Sans review_id (avis masqué par l'admin), seul le résumé est recalculé. L'IA indisponible n'empêche rien : l'a …  
  *Fonctions :* `__construct`, `handle`
- **`backend/app/Jobs/DiffuseTenderJob.php`** — Diffusion automatique d'une demande aux fournisseurs validés dont la catégorie et la région correspondent (SCRUM-42 / F12). Le score de pertinence est calculé à la volée et conservé sur chaque destinataire.  
  *Fonctions :* `__construct`, `handle`
- **`backend/app/Jobs/GenerateExportJob.php`** — Génère le fichier CSV ou XLSX d'un export de statistiques (SCRUM-75 / F28). Le job tourne en file d'attente : l'API répond immédiatement et l'administrateur reçoit une notification quand le fichier est prêt.  
  *Fonctions :* `__construct`, `handle`
- **`backend/app/Jobs/ModerateProductJob.php`** — Contrôle IA d'une annonce publiée (SCRUM-84), en file de tâches pour ne pas ralentir l'enregistrement.  
  *Fonctions :* `__construct`, `handle`
### Backend — modèles Eloquent (`backend/app/Models/`)

*Pourquoi / comment :* Une classe = une table. casts() convertit les colonnes (dates, enums, JSON) ; les méthodes nommées comme une autre entité (user, orders…) sont des relations ; scopeXxx() = filtres réutilisables (Product::visible()) ; booted() = règles automatiques (ex. journal non modifiable).

- **`backend/app/Models/AiInteraction.php`** — Sortie d'une fonctionnalité IA (docs/ENTITIES.md, règle 10) : toujours enregistrée, modifiable par l'utilisateur. « output » garde la sortie d'origine ; « edited_output » la version de l'utilisateur.  
  *Fonctions :* `casts`, `user`
- **`backend/app/Models/AnomalyAlert.php`** — Alerte d'anomalie (SCRUM-86, docs/ENTITIES.md entité 30) : cible (compte ou commande), type, score de 0 à 100, statut nouvelle / traitée / ignorée. Créée par AnomalyDetector, traitée par l'administrateur.  
  *Fonctions :* `casts`, `scopeOpen`
- **`backend/app/Models/AuditLog.php`** — La table audit_logs est non modifiable et ne possède pas updated_at.  
  *Fonctions :* `casts`, `booted`, `admin`
- **`backend/app/Models/BuyerProfile.php`** — Profil d'un porteur de projet (table buyer_profiles). Créé à l'inscription (SCRUM-23) ; complété par les stories de l'espace porteur.  
  *Fonctions :* `casts`, `user`, `region`, `tenders`, `favorites`, `favoriteSuppliers`, `orders`
- **`backend/app/Models/Category.php`** — Catégorie du catalogue. Arborescence limitée à deux niveaux : catégories principales (parent_id null) et sous-catégories.  
  *Fonctions :* `casts`, `parent`, `children`, `products`, `scopeOrdered`, `scopeSiblingsOf`, `isRoot`
- **`backend/app/Models/Conversation.php`** — Conversation entre un porteur de projet et un fournisseur (SCRUM-59 à SCRUM-61).  
  *Fonctions :* `casts`, `buyer`, `supplier`, `participants`, `messages`, `latestMessage`, `scopeForUser`, `scopeWithUnreadCountFor`, `hasParticipant`
- **`backend/app/Models/ConversationParticipant.php`** — Participant d'une conversation et dernier message qu'il a lu (compteur de non lus, SCRUM-59).  
  *Fonctions :* `casts`, `conversation`, `user`
- **`backend/app/Models/Dispute.php`** — Litige ouvert par l'acheteur sur une commande (SCRUM-117 / F23). Cycle : ouvert → en cours (pris en charge par un admin) → décidé.  
  *Fonctions :* `casts`, `order`, `opener`, `assignedAdmin`, `attachments`, `scopeUndecided`
- **`backend/app/Models/DisputeAttachment.php`** — Preuve jointe à un litige (photo ou PDF), sur le disque privé.  
  *Fonctions :* `dispute`
- **`backend/app/Models/Document.php`** — Document commercial rattaché à une commande : devis, facture (SCRUM-58).  
  *Fonctions :* `casts`, `order`
- **`backend/app/Models/Export.php`** — Demande d'export des statistiques d'administration (SCRUM-75 / F28). Le fichier est produit par un job en file d'attente ; l'administrateur est notifié dès qu'il est prêt. Formats : CSV et XLSX (D23).  
  *Fonctions :* `casts`, `selectedIndicators`, `user`
- **`backend/app/Models/Favorite.php`** — Fournisseur favori d'un porteur de projet (table favorites). Sert notamment à l'invitation d'un fournisseur de confiance sur une demande (SCRUM-49).  
  *Fonctions :* `buyer`, `supplier`
- **`backend/app/Models/Message.php`** — Message d'une conversation, avec une pièce jointe facultative (SCRUM-60).  
  *Fonctions :* `casts`, `conversation`, `sender`, `scopeUnreadBy`
- **`backend/app/Models/NotificationPreference.php`** — Préférences de notification : un choix par événement et par canal (SCRUM-63). Les e-mails critiques (commande validée, compte validé/refusé, litige) ne peuvent pas être désactivés : la règle est appliquée ici, jamais uni …  
  *Fonctions :* `casts`, `user`, `isCriticalEmail`, `allows`, `enabledByDefault`, `gridFor`
- **`backend/app/Models/Order.php`** — Commande B2B (SCRUM-51, SCRUM-58 / F16). Cycle de vie : validée → expédiée → livrée → clôturée.  
  *Fonctions :* `casts`, `buyer`, `supplier`, `quote`, `items`, `statusHistory`, `documents`, `disputes`, `review`
- **`backend/app/Models/OrderItem.php`** — Ligne d'article dans une commande (SCRUM-51 / F16). Fige la désignation et le prix unitaire au moment de la commande.  
  *Fonctions :* `getLineTotalAttribute`, `casts`, `order`, `product`
- **`backend/app/Models/OrderStatusHistory.php`** — Historique des statuts d'une commande (SCRUM-51, SCRUM-58 / F16). Table immuable sans colonne updated_at.  
  *Fonctions :* `casts`, `order`, `changedBy`, `changer`
- **`backend/app/Models/Product.php`** — Produit ou service du catalogue (SCRUM-34, SCRUM-51).  
  *Fonctions :* `casts`, `supplier`, `category`, `orderItems`, `images`, `views`, `hasBeenOrdered`, `mainImage`, `apiType`, `typeFromApi`, `apiStatus`, `isWithdrawn`, `isFeatured`, `scopeFeatured`, `statusFromApi`, `isService`, `scopeVisible`
- **`backend/app/Models/ProductImage.php`** — Photo d'un produit (entité 9). position 1 = image principale.  
  *Fonctions :* `casts`, `product`, `url`
- **`backend/app/Models/ProductView.php`** — Consultation d'une fiche produit (entité 10) : alimente le nombre de vues de « Mes produits ». Enregistrée par la fiche produit publique (SCRUM-36).  
  *Fonctions :* `casts`, `product`
- **`backend/app/Models/Quote.php`** — Devis soumis par un fournisseur en réponse à un appel d'offres (SCRUM-46).  
  *Fonctions :* `casts`, `tender`, `supplier`, `order`, `isEditable`
- **`backend/app/Models/Region.php`** — Modèle Eloquent de la table correspondante.
- **`backend/app/Models/Review.php`** — Avis client lié à une commande (SCRUM-65).  
  *Fonctions :* `casts`, `order`, `buyer`, `supplier`, `reports`, `scopePendingModeration`, `scopePublished`, `authorDisplayName`
- **`backend/app/Models/ReviewReport.php`** — Signalement d'un avis abusif par le fournisseur concerné (SCRUM-66). Décision de l'admin : F29 / SCRUM-74.  
  *Fonctions :* `getReasonLabelAttribute`, `review`, `author`
- **`backend/app/Models/SupplierDocument.php`** — Modèle Eloquent de la table correspondante.  
  *Fonctions :* `casts`, `supplierProfile`
- **`backend/app/Models/SupplierProfile.php`** — Modèle Eloquent de la table correspondante.  
  *Fonctions :* `casts`, `user`, `region`, `scopeVisibleInCatalog`, `canSell`, `documents`, `categories`, `coverageRegions`, `products`, `tenderRecipients`, `tenders`, `quotes`, `favoritedBy`, `validator`, `orders`, `reviews`
- **`backend/app/Models/Tender.php`** — Demande (appel d'offres) publiée par un porteur de projet (SCRUM-41 / F11).  
  *Fonctions :* `casts`, `buyer`, `category`, `aiCategory`, `region`, `attachments`, `recipients`, `quotes`, `scopeOpen`, `isOpen`, `statusLabel`
- **`backend/app/Models/TenderAttachment.php`** — Pièce jointe d'une demande (cahier des charges, photo, devis modèle…).  
  *Fonctions :* `tender`
- **`backend/app/Models/TenderRecipient.php`** — Fournisseur destinataire d'une demande (table tender_recipients). Conserve le score de pertinence et les dates de notification / consultation.  
  *Fonctions :* `casts`, `tender`, `supplier`
- **`backend/app/Models/User.php`** — Modèle Eloquent de la table correspondante.  
  *Fonctions :* `casts`, `booted`, `supplierProfile`, `buyerProfile`, `hasRole`, `isActive`, `isBlocked`, `markEmailAsVerified`
- **`backend/app/Models/WhatsAppDelivery.php`** — Trace d'un envoi WhatsApp (SCRUM-133), sans numéro ni contenu.  
  *Fonctions :* `casts`, `user`
### Backend — notifications (`backend/app/Notifications/`)

*Pourquoi / comment :* Messages envoyés aux utilisateurs. via() choisit les canaux (database = cloche, mail, WhatsApp) selon les préférences ; toMail() = e-mail ; toArray() = contenu stocké pour la cloche ; eventType() = clé de préférence.

- **`backend/app/Notifications/AccountDeletedNotification.php`** — Compte supprimé par un administrateur, avec le motif (SCRUM-71). Toujours par e-mail : l'utilisateur ne peut plus se connecter.  
  *Fonctions :* `__construct`, `via`, `toMail`
- **`backend/app/Notifications/AccountReactivatedNotification.php`** — Compte réactivé (SCRUM-118).  
  *Fonctions :* `__construct`, `via`, `toMail`, `toArray`
- **`backend/app/Notifications/AccountSuspendedNotification.php`** — Compte suspendu, avec le motif (SCRUM-118). Toujours par e-mail : l'utilisateur ne peut plus se connecter.  
  *Fonctions :* `__construct`, `via`, `toMail`
- **`backend/app/Notifications/Channels/WhatsAppChannel.php`** — Canal WhatsApp (SCRUM-133). Règle R6 : si l'envoi échoue, l'e-mail part à la place, même si l'utilisateur l'avait désactivé pour cet événement — sauf s'il part déjà.  
  *Fonctions :* `__construct`, `send`, `fallBackToEmail`
- **`backend/app/Notifications/Concerns/RespectsNotificationPreferences.php`** — Applique les préférences de notification (événement × canal) au moment de l'envoi. Le contrôle est côté serveur : désactiver une case dans l'interface ne suffit pas à contourner la règle, et les e-mails critiques restent …  
  *Fonctions :* `channelsFor`, `frontendUrl`
- **`backend/app/Notifications/DisputeDecidedNotification.php`** — Décision de l'administrateur, avec son motif, envoyée aux deux parties. L'e-mail est critique : toujours envoyé.  
  *Fonctions :* `__construct`, `via`, `toArray`, `toMail`, `eventType`
- **`backend/app/Notifications/DisputeUpdatedNotification.php`** — Litige ouvert (fournisseur et admins) ou pris en charge (acheteur et fournisseur) — SCRUM-117 / F23.  
  *Fonctions :* `__construct`, `via`, `toArray`, `toMail`, `eventType`, `title`, `path`
- **`backend/app/Notifications/ExportReadyNotification.php`** — Notification envoyée à l'administrateur dès qu'un export est prêt (SCRUM-75).  
  *Fonctions :* `__construct`, `via`, `toMail`, `toArray`
- **`backend/app/Notifications/NewMessageNotification.php`** — Nouveau message reçu (SCRUM-60). Envoyée au premier message non lu de la conversation seulement.  
  *Fonctions :* `__construct`, `via`, `toArray`, `toMail`, `eventType`, `preview`, `senderName`, `path`
- **`backend/app/Notifications/NewOrderNotification.php`** — Notification envoyée au fournisseur lors de la réception d'une nouvelle commande (SCRUM-51).  
  *Fonctions :* `__construct`, `via`, `toMail`, `toArray`, `eventType`
- **`backend/app/Notifications/NewQuoteNotification.php`** — Un fournisseur a envoyé (ou mis à jour) son devis (SCRUM-45).  
  *Fonctions :* `__construct`, `via`, `toArray`, `toMail`, `eventType`
- **`backend/app/Notifications/OrderClosedNotification.php`** — Notification envoyée au fournisseur lorsque l'acheteur confirme la réception de sa commande (SCRUM-56).  
  *Fonctions :* `__construct`, `via`, `toMail`, `toArray`, `eventType`
- **`backend/app/Notifications/OrderStatusUpdatedNotification.php`** — Notification envoyée à l'acheteur lors de l'évolution du statut de sa commande (SCRUM-54, SCRUM-55).  
  *Fonctions :* `__construct`, `via`, `toMail`, `toArray`, `eventType`
- **`backend/app/Notifications/OrderValidatedNotification.php`** — Commande validée, après acceptation d'un devis ou commande directe (e-mail critique, SCRUM-48 / SCRUM-63).  
  *Fonctions :* `__construct`, `via`, `toArray`, `toMail`, `eventType`
- **`backend/app/Notifications/ProductWithdrawnNotification.php`** — Notification au fournisseur lorsqu'un produit est retiré du catalogue (SCRUM-72).  
  *Fonctions :* `__construct`, `via`, `toMail`, `toArray`, `eventType`
- **`backend/app/Notifications/QuoteAcceptedNotification.php`** — Le porteur a accepté le devis : la commande est créée (SCRUM-48).  
  *Fonctions :* `__construct`, `via`, `toArray`, `toMail`, `eventType`
- **`backend/app/Notifications/QuoteRejectedNotification.php`** — Un autre devis a été accepté : ce devis est refusé et la demande clôturée (SCRUM-48).  
  *Fonctions :* `__construct`, `via`, `toArray`, `toMail`, `eventType`
- **`backend/app/Notifications/ReviewModeratedNotification.php`** — Notification à l'auteur d'un avis après modération (SCRUM-74).  
  *Fonctions :* `__construct`, `via`, `toMail`, `toArray`, `isSupplier`, `sentence`, `eventType`
- **`backend/app/Notifications/ReviewReplyNotification.php`** — Notification envoyée à l'acheteur lorsque le fournisseur répond à son avis (SCRUM-65).  
  *Fonctions :* `__construct`, `via`, `toMail`, `toArray`, `eventType`
- **`backend/app/Notifications/ReviewReportedNotification.php`** — Un fournisseur a signalé un avis : prévient les administrateurs (SCRUM-66). Traitement : F29 / SCRUM-74.  
  *Fonctions :* `__construct`, `via`, `toArray`
- **`backend/app/Notifications/ReviewSubmittedNotification.php`** — Notification envoyée au fournisseur lorsqu'un acheteur dépose un avis sur sa commande (SCRUM-64). Inclut une alerte prioritaire si la note est ≤ 2 étoiles.  
  *Fonctions :* `__construct`, `via`, `toMail`, `toArray`, `eventType`
- **`backend/app/Notifications/SupplierValidationNotification.php`** — Canaux de notification : e-mail + base de données (table notifications).  
  *Fonctions :* `__construct`, `via`, `toMail`, `toArray`, `eventType`
- **`backend/app/Notifications/TenderCancelledNotification.php`** — Le porteur a annulé une demande à laquelle le fournisseur avait répondu (SCRUM-43).  
  *Fonctions :* `__construct`, `via`, `toArray`, `toMail`, `eventType`
- **`backend/app/Notifications/TenderReceivedNotification.php`** — Une demande correspond au fournisseur : diffusion automatique ou invitation (SCRUM-42 / SCRUM-49).  
  *Fonctions :* `__construct`, `via`, `toArray`, `toMail`, `eventType`
### Backend — policies (autorisations) (`backend/app/Policies/`)

*Pourquoi / comment :* Répondent à « cet utilisateur a-t-il le droit sur CET objet ? » (view, update, delete, accept…). Appelées par Gate::authorize dans les contrôleurs.

- **`backend/app/Policies/ProductPolicy.php`** — Produits d'un fournisseur (SCRUM-33 / SCRUM-34) : seul le propriétaire les consulte en privé, les modifie, les dépublie ou les supprime.  
  *Fonctions :* `view`, `update`, `delete`, `owns`
- **`backend/app/Policies/QuotePolicy.php`** — Droits sur un devis : le fournisseur auteur, ou le porteur propriétaire de la demande.  
  *Fonctions :* `accept`, `update`
- **`backend/app/Policies/SupplierDocumentPolicy.php`** — Justificatifs d'un fournisseur : fichiers privés, téléchargeables par leur propriétaire ou par un administrateur dans le cadre de la validation (SCRUM-31).  
  *Fonctions :* `view`
- **`backend/app/Policies/SupplierProfilePolicy.php`** — Profil de l'entreprise (SCRUM-28) : seul le propriétaire le consulte en privé et le modifie.  
  *Fonctions :* `view`, `update`
- **`backend/app/Policies/TenderPolicy.php`** — Accès aux demandes : le porteur propriétaire, ou un fournisseur destinataire (SCRUM-43 / SCRUM-44).  
  *Fonctions :* `view`, `cancel`, `invite`
### Backend — service providers (`backend/app/Providers/`)

*Pourquoi / comment :* Code exécuté au démarrage : liaisons d'interfaces (AiClient, MediaStorage…), limites de débit, règles de mot de passe, liens des e-mails vers React.

- **`backend/app/Providers/AppServiceProvider.php`** — E-mail de vérification (SCRUM-24) : envoyé automatiquement par l'événement Registered déclenché à l'inscription. Le lien ouvre l'application React, qui appelle ensuite l'API.  
  *Fonctions :* `register`, `boot`, `configureEmailVerification`, `configurePasswordReset`
### Backend — services métier (`backend/app/Services/`)

*Pourquoi / comment :* Toutes les règles métier, transactions et appels externes. Réutilisés par les contrôleurs, les jobs et les commandes (voir partie 11).

- **`backend/app/Services/Ai/AiClient.php`** — Contrat d'un fournisseur d'IA. Un pilote réel doit : - respecter config('ai.timeout') ; - transmettre $request->data comme des données, séparées de la consigne ; - demander une réponse conforme à $request->schema ; - tra …  
  *Fonctions :* `generate`
- **`backend/app/Services/Ai/AiRequest.php`** — Demande faite à l'IA, indépendante du fournisseur.  
  *Fonctions :* `__construct`
- **`backend/app/Services/Ai/AiResponse.php`** — Réponse structurée. Elle reste à valider par la fonctionnalité qui l'a demandée.  
  *Fonctions :* `__construct`
- **`backend/app/Services/Ai/AiService.php`** — Point d'entrée commun des fonctionnalités IA (SCRUM-119 / F25) : limite par utilisateur, appel du fournisseur, validation de la sortie, enregistrement dans ai_interactions.  
  *Fonctions :* `isEnabled`, `run`
- **`backend/app/Services/Ai/GeminiAiClient.php`** — Fournisseur réel : l'API Gemini de Google (AI_PROVIDER=gemini). - la consigne de l'application va dans « systemInstruction », les données dans le message, entre balises : le texte saisi par les utilisateurs n'est jamais …  
  *Fonctions :* `generate`, `errorMessage`, `normalizeSchema`
- **`backend/app/Services/Ai/SimulatedAiClient.php`** — Mode simulé : des règles de calcul, sans appel extérieur ni clé. Le résultat est déterministe et toujours présenté à l'utilisateur comme simulé, jamais comme une réponse d'IA.  
  *Fonctions :* `generate`, `quoteSummary`, `tenderDraft`, `productText`, `tenderAnalysis`, `priceEstimate`, `reviewAnalysis`, `supplierReviewSummary`, `productModeration`, `chatbot`, `polarity`, `quantile`, `words`, `stems`, `stem`, `rephrase`, `money`, `decimal`, `days`
- **`backend/app/Services/AnomalyDetector.php`** — Détection des comptes et commandes au comportement inhabituel (SCRUM-86) : règles explicables, chacune avec un score de 0 à 100. Une alerte reste unique par cible et par type tant qu'elle est « nouvelle » (son score est …  
  *Fonctions :* `run`, `orderSpikes`, `reviewBursts`, `unusualAmounts`, `newAccountLargeOrders`, `repeatedDisputes`, `record`, `present`, `median`
- **`backend/app/Services/AuditLogger.php`** — Journal des actions des administrateurs (table audit_logs, non modifiable) — SCRUM-118 / F24.  
  *Fonctions :* `record`, `historyOf`
- **`backend/app/Services/CategoryService.php`** — Gestion de l'arborescence des catégories (SCRUM-32). Les positions sont des entiers 1, 2, 3… sans trou, propres à chaque groupe de catégories sœurs (les racines entre elles, les sous-catégories d'un même parent entre ell …  
  *Fonctions :* `tree`, `create`, `update`, `move`, `delete`, `nameTaken`, `place`, `compact`, `renumber`, `audit`, `plural`
- **`backend/app/Services/ChatbotService.php`** — Chatbot d'assistance (SCRUM-85 / EP10) : répond aux questions sur l'utilisation de la plateforme. Confidentialité : le modèle ne reçoit que la question, le rôle de l'utilisateur, la page ouverte et le guide (config/chatb …  
  *Fonctions :* `__construct`, `reply`, `guide`, `validate`, `schema`
- **`backend/app/Services/ConversationService.php`** — Règles de la messagerie (SCRUM-59 à SCRUM-61). Une conversation réunit toujours un porteur et un fournisseur. Il y en a une seule par couple et par contexte (une demande, un devis, une commande, ou le contact direct) : « …  
  *Fonctions :* `open`, `send`, `markRead`, `unreadTotal`, `notifyRecipients`, `directParties`, `tenderParties`, `quoteParties`, `orderParties`, `assertParty`, `buyerOf`, `supplierOf`, `deny`, `unavailable`
- **`backend/app/Services/Dashboard/AdminDashboardService.php`** — Agrégats du tableau de bord administrateur (SCRUM-122 / F28, story SCRUM-70). Les indicateurs sont calculés côté serveur. Les tables `orders`, `tenders`, `products` et `disputes` sont lues via le Query Builder (lecture s …  
  *Fonctions :* `build`, `activeUsers`, `series`, `countByDay`, `revenueByDay`, `reportedReviews`, `validationQueue`, `urgentDisputes`, `topCategories`
- **`backend/app/Services/Dashboard/BuyerDashboardService.php`** — Agrégats du tableau de bord porteur de projet (SCRUM-121 / F27, story SCRUM-69). Toutes les valeurs sont calculées côté serveur pour la période demandée. Définitions retenues : - dépenses = somme des commandes passées su …  
  *Fonctions :* `build`, `pendingQuotesQuery`, `series`, `publishedRequests`, `pendingQuotes`, `favoriteSuppliers`, `latestOrders`
- **`backend/app/Services/Dashboard/SupplierDashboardService.php`** — Agrégats du tableau de bord fournisseur (SCRUM-120 / F26, story SCRUM-68). Définitions retenues : - revenu = somme des commandes `clôturée` créées sur la période ; - commandes en cours = commandes non clôturées créées su …  
  *Fonctions :* `__construct`, `build`, `series`, `mostViewedProducts`, `mostSoldProducts`, `openRequests`, `latestReviews`
- **`backend/app/Services/DisputeService.php`** — Règles des litiges (SCRUM-117 / F23, règle métier R4).  
  *Fonctions :* `__construct`, `refusalFor`, `open`, `take`, `decide`, `canView`, `isBuyer`, `lockUndecided`, `supplierUser`, `parties`, `activeAdmins`
- **`backend/app/Services/Export/CsvWriter.php`** — CSV pour Excel en français : UTF-8 avec BOM, point-virgule, virgule décimale.  
  *Fonctions :* `build`, `cell`
- **`backend/app/Services/Export/StatisticsExport.php`** — Tableaux d'un export de statistiques (SCRUM-75), selon les indicateurs choisis.  
  *Fonctions :* `__construct`, `tables`
- **`backend/app/Services/Export/XlsxWriter.php`** — Classeur XLSX minimal, sans dépendance (D23) : une feuille par tableau, textes et nombres. Les textes sont des chaînes littérales (inlineStr) : jamais évalués comme des formules.  
  *Fonctions :* `build`, `sheet`, `escape`
- **`backend/app/Services/FavoriteService.php`** — Fournisseurs favoris d'un porteur de projet (SCRUM-39). Ajout et retrait idempotents ; seuls les fournisseurs encore visibles sont listés.  
  *Fonctions :* `list`, `add`, `remove`, `isFavorite`, `buyerIdOf`
- **`backend/app/Services/HomeService.php`** — Données de la page d'accueil (SCRUM-38), mises en cache 10 minutes. Tous les compteurs reposent sur les mêmes règles de visibilité que le catalogue.  
  *Fonctions :* `__construct`, `data`, `forget`, `build`, `stats`, `featured`
- **`backend/app/Services/MarketPriceService.php`** — Prix habituel du marché pour une demande (SCRUM-82 / F31), affiché sur « Comparer les devis ». Transactions comparables des 12 derniers mois dans la catégorie de la demande (et ses sous-catégories) : devis acceptés sur d …  
  *Fonctions :* `__construct`, `estimate`, `amounts`, `validate`, `schema`
- **`backend/app/Services/Media/CloudinaryMediaStorage.php`** — Stockage Cloudinary. Clé enregistrée en base : "<resource_type>:<public_id>". - image:...  → photo de produit ou logo, type "upload" (CDN public) - raw:...    → document privé, type "authenticated" (URL signée obligatoir …  
  *Fonctions :* `store`, `delete`, `url`, `download`, `client`, `folder`, `asset`, `isCloudinaryKey`, `split`
- **`backend/app/Services/Media/LocalMediaStorage.php`** — Stockage sur les disques Laravel (développement local et tests). Les images vont sur le disque "public" (servi par /storage), les documents privés sur le disque "local" (storage/app/private).  
  *Fonctions :* `store`, `delete`, `url`, `download`
- **`backend/app/Services/OrderDocumentService.php`** — Service de génération et gestion des documents PDF de commande (SCRUM-57).  
  *Fonctions :* `generateSequentialNumber`, `generateQuotePdf`, `generateInvoicePdf`, `generateDocument`
- **`backend/app/Services/OrderService.php`** — Consultation des commandes du porteur (créées par acceptation d'un devis en S3).  
  *Fonctions :* `forBuyer`, `show`, `buyerProfile`
- **`backend/app/Services/ProductCatalogService.php`** — Recherche dans le catalogue public (SCRUM-35). Toujours limitée aux produits visibles. Une page = 3 requêtes quel que soit le nombre de résultats (compte, produits, images ; fournisseurs et régions en eager loading), pou …  
  *Fonctions :* `cardRelations`, `search`, `applyFilters`, `applySort`, `escapeLike`
- **`backend/app/Services/ProductModerationService.php`** — Annonces douteuses (SCRUM-84 / F32) : à chaque publication ou modification d'un produit publié, l'IA calcule un indice de suspicion. Au-delà de FLAG_THRESHOLD, le motif est enregistré dans products.ai_flag_reason et l'an …  
  *Fonctions :* `__construct`, `analyze`, `categoryMedian`, `validate`, `schema`
- **`backend/app/Services/ProductService.php`** — Produits d'un fournisseur (SCRUM-33) : enregistrement, publication, photos. Règles de publication : une description et au moins une photo. Un produit retiré par l'administrateur reste retiré (il ne peut pas être republié …  
  *Fonctions :* `__construct`, `create`, `update`, `save`, `unpublish`, `feature`, `unfeature`, `delete`, `addImages`, `reorderImages`, `deleteImage`, `resolveStatus`, `ensurePublishable`
- **`backend/app/Services/ProductViewRecorder.php`** — Enregistre une consultation de fiche produit (SCRUM-36), après l'envoi de la réponse. - une seule vue par visiteur et par produit par tranche de 30 minutes (dédoublonnage par le cache, sans migration : un visiteur = son …  
  *Fonctions :* `record`
- **`backend/app/Services/QuoteService.php`** — Règles métier des devis (SCRUM-44 à SCRUM-48).  
  *Fonctions :* `submit`, `markSeen`, `accept`, `loadForSupplier`, `loadOrder`, `supplierProfile`, `buyerProfile`, `notifyBuyer`, `notifyDecision`
- **`backend/app/Services/QuoteSummaryService.php`** — Résumé automatique des devis d'une demande (SCRUM-119 / F25). Il aide à comparer ; il ne désigne aucun gagnant.  
  *Fonctions :* `__construct`, `latest`, `canGenerate`, `isStale`, `summarize`, `data`, `comparableQuotes`, `validate`, `schema`, `fingerprint`, `context`
- **`backend/app/Services/RelevanceScorer.php`** — Score de pertinence (SCRUM-50 / F12), enrichi par l'analyse IA de la demande (SCRUM-81 / F31). Trois signaux suffisent pour classer les demandes chez les bons fournisseurs : - la catégorie du besoin (50 points ; 30 si se …  
  *Fonctions :* `score`, `keywords`
- **`backend/app/Services/ReviewInsightService.php`** — IA sur les avis (SCRUM-126 / F32). - SCRUM-83 : sentiment de chaque avis et résumé « points forts / points faibles » du fournisseur, à partir de MIN_REVIEWS avis publiés. - SCRUM-84 : indice de suspicion de chaque avis.  
  *Fonctions :* `__construct`, `analyzeReview`, `summarizeSupplier`, `summaryFor`, `latestSummary`, `summaryContext`, `hash`, `validateReview`, `validateSummary`, `reviewSchema`, `summarySchema`
- **`backend/app/Services/SupplierProfileService.php`** — Règles métier du profil de l'entreprise (SCRUM-28).  
  *Fonctions :* `__construct`, `load`, `update`, `updateLogo`, `addDocument`, `resubmitIfRejected`, `setPublished`
- **`backend/app/Services/SupplierRatingService.php`** — Recalcul de la note moyenne d'un fournisseur (SCRUM-72 / F29). Seuls les avis publiés comptent : masquer un avis le retire immédiatement de la moyenne affichée dans le catalogue.  
  *Fonctions :* `recompute`
- **`backend/app/Services/SupplierRecommendationService.php`** — Fournisseurs recommandés au porteur de projet (SCRUM-87), sur son tableau de bord. Score = intérêt pour la catégorie (part de ses achats dans cette catégorie) × 60 + note du fournisseur × 8. Les achats comptent les comma …  
  *Fonctions :* `forBuyer`, `categoryInterests`, `families`, `excludedSuppliers`, `rating`
- **`backend/app/Services/TenderAnalysisService.php`** — IA sur les demandes (SCRUM-81 / F31) : catégorie et mots-clés détectés dans le texte, fournisseurs suggérés. L'IA propose, le porteur décide : la catégorie reste modifiable et seuls les fournisseurs qu'il coche deviennen …  
  *Fonctions :* `__construct`, `analyze`, `suggestSuppliers`, `apply`, `categoryVocabulary`, `family`, `reasons`, `validate`, `schema`
- **`backend/app/Services/TenderService.php`** — Règles métier des demandes côté porteur de projet (SCRUM-41, SCRUM-43, SCRUM-49).  
  *Fonctions :* `__construct`, `publish`, `cancel`, `invite`, `loadForBuyer`, `buyerProfile`, `assertOwner`, `notifySuppliers`
- **`backend/app/Services/UserAdministrationService.php`** — Gestion des comptes par l'administrateur (SCRUM-118 / F24).  
  *Fonctions :* `__construct`, `suspend`, `reactivate`, `delete`, `refusalFor`, `lockManageable`, `refuse`
- **`backend/app/Services/WhatsApp/SimulatedWhatsAppClient.php`** — Mode simulé : rien n'est envoyé. Le statut « simulé » ne se confond jamais avec un envoi réel.  
  *Fonctions :* `send`
- **`backend/app/Services/WhatsApp/WhatsAppClient.php`** — Contrat d'un fournisseur WhatsApp. Un pilote réel respecte config('whatsapp.timeout') et lève une exception pour tout envoi refusé : le repli sur l'e-mail est géré par WhatsAppChannel.  
  *Fonctions :* `send`
- **`backend/app/Services/WhatsApp/WhatsAppMessage.php`** — Message sortant : un titre et un lien, rien de privé (le numéro n'est pas vérifié). Les fournisseurs exigent un modèle approuvé pour un message à l'initiative de l'entreprise : title et url en sont les deux variables.  
  *Fonctions :* `__construct`
- **`backend/app/Services/WhatsApp/WhatsAppResult.php`**  
  *Fonctions :* `__construct`
- **`backend/app/Services/WhatsApp/WhatsAppSettings.php`** — Qui peut recevoir des messages WhatsApp (SCRUM-133).  
  *Fonctions :* `isAvailable`, `isSimulated`, `numberFor`, `canReceive`, `maskedNumberFor`
- **`backend/app/Services/WritingAssistant.php`** — Aide à la rédaction (SCRUM-124, SCRUM-77, SCRUM-78 / F30) : brouillon de demande et texte produit. Passe par AiService (limite par utilisateur, validation, enregistrement). Rien n'est publié automatiquement.  
  *Fonctions :* `__construct`, `tenderDraft`, `productText`, `run`
### Backend — racine (`backend/`)

*Pourquoi / comment :* Fichiers de projet Laravel.

- **`backend/artisan`** — Exécutable de la ligne de commande Laravel (php artisan migrate, serve, test…).
### Backend — démarrage (`backend/bootstrap/`)

*Pourquoi / comment :* Construction de l'application Laravel.

- **`backend/bootstrap/app.php`** — Configuration centrale de Laravel 12 : routes, /up, broadcasting, middlewares (alias role/verified/supplier.validated, proxies, en-têtes), rendu JSON français des erreurs.
- **`backend/bootstrap/cache/.gitignore`** — Garde le dossier de cache vide dans git.
- **`backend/bootstrap/providers.php`** — Liste des service providers chargés (AppServiceProvider).
### Backend — racine (`backend/`)

*Pourquoi / comment :* Fichiers de projet Laravel.

- **`backend/composer.json`** — Dépendances PHP (Laravel, Sanctum, Reverb, génération PDF, Cloudinary…) et scripts Composer.
- **`backend/composer.lock`** — Versions exactes installées des dépendances PHP (reproductibilité).
### Backend — configuration (`backend/config/`)

*Pourquoi / comment :* Chaque fichier renvoie un tableau de réglages lus depuis les variables d'environnement (env()). Changer d'environnement = changer les variables, jamais le code.

- **`backend/config/ai.php`** — Service IA : fournisseur (simulated/gemini/disabled), pilotes, clé, modèle, délai, limite par utilisateur.
- **`backend/config/app.php`** — Nom, environnement, URL, fuseau (Africa/Tunis), langue (fr), clé de chiffrement, FRONTEND_URL.
- **`backend/config/auth.php`** — Gardes d'authentification, durée des liens de vérification et de réinitialisation.
- **`backend/config/broadcasting.php`** — Connexion du temps réel (reverb, log ou null).
- **`backend/config/cache.php`** — Stockage du cache (base de données par défaut).
- **`backend/config/chatbot.php`** — Guide de la plateforme utilisé par le chatbot : message d'accueil, fiches par rôle, mots-clés et liens.
- **`backend/config/cors.php`** — Origines autorisées à appeler l'API (FRONTEND_URLS : site web, mobile).
- **`backend/config/database.php`** — Connexions aux bases (pgsql, mysql, sqlite), SSL, Redis.
- **`backend/config/filesystems.php`** — Disques de stockage : local (privé), public (servi par /storage).
- **`backend/config/logging.php`** — Canaux de journalisation (stderr en production).
- **`backend/config/mail.php`** — Transport des e-mails (smtp, log…) et adresse d'expédition.
- **`backend/config/media.php`** — Choix du stockage des fichiers (local ou cloudinary).
- **`backend/config/queue.php`** — Connexion de la file d'attente (sync, database).
- **`backend/config/reverb.php`** — Serveur WebSocket Reverb : hôte, port, clés d'application.
- **`backend/config/sanctum.php`** — Sanctum : durée de vie des jetons (7 jours), domaines.
- **`backend/config/services.php`** — Identifiants des services tiers (mailers, Cloudinary…).
- **`backend/config/session.php`** — Sessions (base de données), peu utilisées car l'API est sans état.
- **`backend/config/whatsapp.php`** — Notifications WhatsApp : fournisseur (simulated/disabled), pilotes, délai, simulation d'échec.
### Backend — base de données (autres) (`backend/database/`)

- **`backend/database/.gitignore`** — Ignore le fichier SQLite local.
### Backend — factories (`backend/database/factories/`)

*Pourquoi / comment :* Fabriquent des objets réalistes pour les tests. definition() = valeurs par défaut ; les autres méthodes sont des états (published(), validated(), suspended()…).

- **`backend/database/factories/CategoryFactory.php`** — Catégorie de test : racine par défaut, ->childOf($parent) pour une sous-catégorie.  
  *Fonctions :* `definition`, `childOf`
- **`backend/database/factories/ProductFactory.php`** — Produit de test. Par défaut : brouillon d'un fournisseur en attente. Utilisez ->published() et un fournisseur ->visible() pour un produit affiché dans le catalogue.  
  *Fonctions :* `definition`, `published`, `withdrawn`, `service`
- **`backend/database/factories/SupplierProfileFactory.php`** — Profil fournisseur de test (SCRUM-28) : permet de tester sans passer par l'inscription (F01).  
  *Fonctions :* `definition`, `pending`, `validated`, `visible`, `rejected`
- **`backend/database/factories/UserFactory.php`**  
  *Fonctions :* `definition`, `supplier`, `buyer`, `admin`, `suspended`, `deactivated`, `unverified`
### Backend — migrations (`backend/database/migrations/`)

*Pourquoi / comment :* Historique versionné du schéma de la base : up() crée/modifie, down() annule. Exécutées par php artisan migrate (au démarrage du conteneur en production). Détail des tables : partie 5.

- **`backend/database/migrations/0001_01_01_000000_create_users_table.php`** — Migration : create users table.
- **`backend/database/migrations/0001_01_01_000001_create_cache_table.php`** — Migration : create cache table.
- **`backend/database/migrations/0001_01_01_000002_create_jobs_table.php`** — Migration : create jobs table.
- **`backend/database/migrations/0001_01_01_000003_create_personal_access_tokens_table.php`** — Migration : create personal access tokens table.
- **`backend/database/migrations/2026_11_11_093029_create_referentiels_tables.php`** — Migration : create referentiels tables.
- **`backend/database/migrations/2026_11_11_093040_create_comptes_profiles_tables.php`** — Migration : create comptes profiles tables.
- **`backend/database/migrations/2026_11_11_093047_create_catalogue_tables.php`** — Migration : create catalogue tables.
- **`backend/database/migrations/2026_11_11_093056_create_demandes_et_devis_tables.php`** — Migration : create demandes et devis tables.
- **`backend/database/migrations/2026_11_11_093103_create_messagerie_tables.php`** — Migration : create messagerie tables.
- **`backend/database/migrations/2026_11_11_093110_create_commandes_tables.php`** — Migration : create commandes tables.
- **`backend/database/migrations/2026_11_11_093118_create_avis_et_litiges_tables.php`** — Migration : create avis et litiges tables.
- **`backend/database/migrations/2026_11_11_093125_create_ia_et_supervision_tables.php`** — Migration : create ia et supervision tables.
- **`backend/database/migrations/2026_11_12_000000_add_registration_fields_to_account_tables.php`** — Migration : add registration fields to account tables.
- **`backend/database/migrations/2026_11_16_100000_add_catalogue_indexes_to_products_table.php`** — Migration : add catalogue indexes to products table.
- **`backend/database/migrations/2026_11_16_100000_update_orders_status_enum.php`** — Migration : update orders status enum.
- **`backend/database/migrations/2026_11_16_110000_add_soft_deletes_to_products_table.php`** — Migration : add soft deletes to products table.
- **`backend/database/migrations/2026_11_17_000000_add_original_name_to_tender_attachments_table.php`** — Migration : add original name to tender attachments table.
- **`backend/database/migrations/2026_11_18_000000_fix_supplier_documents_type_check_for_pgsql.php`** — Migration : fix supplier documents type check for pgsql.
- **`backend/database/migrations/2026_11_23_100000_complete_messaging_and_review_reports.php`** — Migration : complete messaging and review reports.
- **`backend/database/migrations/2026_11_23_200000_complete_disputes_tables.php`** — Migration : complete disputes tables.
- **`backend/database/migrations/2026_11_24_000001_create_exports_table.php`** — Migration : create exports table.
- **`backend/database/migrations/2026_11_24_100000_complete_ai_interactions_table.php`** — Migration : complete ai interactions table.
- **`backend/database/migrations/2026_11_25_100000_add_whatsapp_notifications.php`** — Migration : add whatsapp notifications.
- **`backend/database/migrations/2026_11_25_200000_convert_s6_disputes_and_ai_data.php`** — Migration : convert s6 disputes and ai data.
- **`backend/database/migrations/2026_11_25_300000_mark_reported_reviews.php`** — Migration : mark reported reviews.
- **`backend/database/migrations/2026_11_25_400000_add_indicators_to_exports_table.php`** — Migration : add indicators to exports table.
- **`backend/database/migrations/2026_11_26_000000_drop_legacy_enum_checks_for_pgsql.php`** — Migration : drop legacy enum checks for pgsql.
- **`backend/database/migrations/2026_11_27_000000_create_deployment_markers_table.php`** — Migration : create deployment markers table.
### Backend — seeders (données initiales/démo) (`backend/database/seeders/`)

*Pourquoi / comment :* Remplissent la base : run() est le point d'entrée.

- **`backend/database/seeders/CatalogueDemoSeeder.php`** — Données de démonstration du catalogue (sprint 2) : fournisseurs et produits des maquettes V1 à V4. Mot de passe de tous les comptes : « password ». php artisan db:seed --class=CatalogueDemoSeeder Idempotent : peut être r …  
  *Fonctions :* `run`, `seedBuyersAndReviews`, `buyer`, `category`
- **`backend/database/seeders/DatabaseSeeder.php`** — Laissez à false pour garder les tables métier vides au démarrage. Passez SEED_DEMO_DATA=true (variable d'environnement) pour insérer les données de test Jira (96+ lignes). Les données de référence (régions, catégories) s …  
  *Fonctions :* `demoEnabled`, `run`, `seedRegions`, `seedCategories`
- **`backend/database/seeders/FullDemoSeeder.php`** — Démonstration complète de TijaraLink : tous les écrans ont des données réalistes. php artisan storage:link php artisan db:seed --class=FullDemoSeeder Contenu : 14 fournisseurs (dont un en attente et un refusé) avec logo, …  
  *Fonctions :* `run`, `renameOldDemoAccounts`, `normalizeCategories`, `seedExtraReviews`, `seedSuppliers`, `seedProducts`, `seedImagesAndLogos`, `seedScenario`, `buyer`, `tender`, `quote`, `accept`, `advance`, `close`, `review`, `catalogueOrder`, `conversation`, `product`, `categoryIds`, `at`, `backdate`
- **`backend/database/seeders/SupplierProfileDemoSeeder.php`** — Deux fournisseurs de démonstration pour tester la page « Profil de l'entreprise » (SCRUM-28) sans passer par l'inscription : un validé et un en attente. Mot de passe : « password ». php artisan db:seed --class=SupplierPr …  
  *Fonctions :* `run`, `supplier`
- **`backend/database/seeders/demo-images/generate.cjs`** — Génère les images de démonstration (produits, logos des fournisseurs, icônes de l'application) avec Chromium. Les images produites sont versionnées : ce script ne sert qu'à les refaire. cd frontend && node ../backend/dat …  
  *Fonctions :* `page`, `productHtml`, `logoHtml`, `iconHtml`, `shot`
- **`backend/database/seeders/demo-images/products/CREDITS.md`** — Origine des photos de démonstration.
### Backend — racine (`backend/`)

*Pourquoi / comment :* Fichiers de projet Laravel.

- **`backend/phpunit.xml`** — Configuration des tests PHPUnit (SQLite en mémoire, files synchrones, mails en tableau).
### Backend — dossier public (`backend/public/`)

*Pourquoi / comment :* Seul dossier exposé par nginx : index.php et fichiers statiques.

- **`backend/public/.htaccess`** — Réécriture d'URL pour Apache (hors Docker) vers index.php.
- **`backend/public/index.php`** — Point d'entrée unique de toutes les requêtes HTTP de l'API.
- **`backend/public/robots.txt`** — Consignes pour les robots d'indexation.
### Backend — vues (`backend/resources/`)

*Pourquoi / comment :* Gabarits Blade des PDF.

- **`backend/resources/views/pdf/invoice.blade.php`** — Gabarit HTML (Blade) de la facture PDF d'une commande.
- **`backend/resources/views/pdf/quote.blade.php`** — Gabarit HTML (Blade) du devis PDF d'une commande.
### Backend — routes (`backend/routes/`)

*Pourquoi / comment :* Associent adresses et contrôleurs (détail : partie 10).

- **`backend/routes/api.php`** — Toutes les routes /api : publiques, connectées, espaces fournisseur/porteur/admin, avec middlewares et limites de débit.
- **`backend/routes/channels.php`** — Autorisation du canal temps réel privé user.{id} (un utilisateur n'écoute que le sien).
- **`backend/routes/console.php`** — Commandes artisan maison et planification (anomalies:detect toutes les 15 min).
- **`backend/routes/web.php`** — Seule route web : GET / renvoie le nom de l'API (le backend n'a pas d'interface).
### Backend — stockage (`backend/storage/`)

*Pourquoi / comment :* Dossiers d'exécution (fichiers envoyés, cache, logs) ; les .gitignore gardent l'arborescence vide dans git.

- **`backend/storage/app/.gitignore`** — Garde ce dossier dans git (contenu ignoré).
- **`backend/storage/app/private/.gitignore`** — Garde ce dossier dans git (contenu ignoré).
- **`backend/storage/app/public/.gitignore`** — Garde ce dossier dans git (contenu ignoré).
- **`backend/storage/framework/.gitignore`** — Garde ce dossier dans git (contenu ignoré).
- **`backend/storage/framework/cache/.gitignore`** — Garde ce dossier dans git (contenu ignoré).
- **`backend/storage/framework/cache/data/.gitignore`** — Garde ce dossier dans git (contenu ignoré).
- **`backend/storage/framework/sessions/.gitignore`** — Garde ce dossier dans git (contenu ignoré).
- **`backend/storage/framework/testing/.gitignore`** — Garde ce dossier dans git (contenu ignoré).
- **`backend/storage/framework/views/.gitignore`** — Garde ce dossier dans git (contenu ignoré).
- **`backend/storage/logs/.gitignore`** — Garde ce dossier dans git (contenu ignoré).
### Backend — tests PHPUnit (`backend/tests/`)

*Pourquoi / comment :* Tests automatiques : Feature = appels HTTP réels sur l'API avec une base de test ; Unit = classes isolées. Chaque méthode test_… vérifie un comportement.

- **`backend/tests/Feature/Admin/AdminDashboardTest.php`** — Tests : admin dashboard.
- **`backend/tests/Feature/Admin/AnomalyAlertTest.php`** — Tests : anomaly alert.
- **`backend/tests/Feature/Admin/AuditLogTest.php`** — Tests : audit log.
- **`backend/tests/Feature/Admin/CategoryManagementTest.php`** — Tests : category management.
- **`backend/tests/Feature/Admin/ExportTest.php`** — Tests : export.
- **`backend/tests/Feature/Admin/ModerationTest.php`** — Tests : moderation.
- **`backend/tests/Feature/Admin/UserManagementTest.php`** — Tests : user management.
- **`backend/tests/Feature/Ai/AiEndpointsTest.php`** — Tests : ai endpoints.
- **`backend/tests/Feature/Ai/ChatbotTest.php`** — Tests : chatbot.
- **`backend/tests/Feature/Ai/GeminiAiClientTest.php`** — Tests : gemini ai client.
- **`backend/tests/Feature/Ai/QuoteSummaryTest.php`** — Tests : quote summary.
- **`backend/tests/Feature/Ai/ReviewAiTest.php`** — Tests : review ai.
- **`backend/tests/Feature/Ai/TenderAiTest.php`** — Tests : tender ai.
- **`backend/tests/Feature/ApiDocsTest.php`** — Tests : api docs.
- **`backend/tests/Feature/Auth/AccountDeletionTest.php`** — Tests : account deletion.
- **`backend/tests/Feature/Auth/AccountSettingsTest.php`** — Tests : account settings.
- **`backend/tests/Feature/Auth/BuyerRegistrationTest.php`** — Tests : buyer registration.
- **`backend/tests/Feature/Auth/EmailVerificationTest.php`** — Tests : email verification.
- **`backend/tests/Feature/Auth/LoginTest.php`** — Tests : login.
- **`backend/tests/Feature/Auth/PasswordResetTest.php`** — Tests : password reset.
- **`backend/tests/Feature/Auth/RoleAccessTest.php`** — Tests : role access.
- **`backend/tests/Feature/Auth/SupplierRegistrationTest.php`** — Tests : supplier registration.
- **`backend/tests/Feature/Buyer/BuyerDashboardTest.php`** — Tests : buyer dashboard.
- **`backend/tests/Feature/Buyer/FavoriteSupplierTest.php`** — Tests : favorite supplier.
- **`backend/tests/Feature/Buyer/RecommendationTest.php`** — Tests : recommendation.
- **`backend/tests/Feature/Catalog/CatalogueDemoSeederTest.php`** — Tests : catalogue demo seeder.
- **`backend/tests/Feature/Catalog/FullDemoSeederTest.php`** — Tests : full demo seeder.
- **`backend/tests/Feature/Catalog/HomePageTest.php`** — Tests : home page.
- **`backend/tests/Feature/Catalog/ProductDetailTest.php`** — Tests : product detail.
- **`backend/tests/Feature/Catalog/ProductSearchTest.php`** — Tests : product search.
- **`backend/tests/Feature/Catalog/SupplierDirectoryTest.php`** — Tests : supplier directory.
- **`backend/tests/Feature/Catalog/SupplierPublicPageTest.php`** — Tests : supplier public page.
- **`backend/tests/Feature/DirectOrderTest.php`** — Tests : direct order.
- **`backend/tests/Feature/DisputeTest.php`** — Tests : dispute.
- **`backend/tests/Feature/ErrorResponseTest.php`** — Tests : error response.
- **`backend/tests/Feature/Journey/TenderToReviewJourneyTest.php`** — Tests : tender to review journey.
- **`backend/tests/Feature/Messaging/MessagingTest.php`** — Tests : messaging.
- **`backend/tests/Feature/Notification/NotificationCenterTest.php`** — Tests : notification center.
- **`backend/tests/Feature/Notification/PreferencesAppliedTest.php`** — Tests : preferences applied.
- **`backend/tests/Feature/Notification/WhatsAppTest.php`** — Tests : whats app.
- **`backend/tests/Feature/OrderClosureAndPdfTest.php`** — Tests : order closure and pdf.
- **`backend/tests/Feature/OrderTrackingAndAdvanceTest.php`** — Tests : order tracking and advance.
- **`backend/tests/Feature/PublicCategoryTest.php`** — Tests : public category.
- **`backend/tests/Feature/ReferenceDataSeederTest.php`** — Tests : reference data seeder.
- **`backend/tests/Feature/ReviewTest.php`** — Tests : review.
- **`backend/tests/Feature/Security/SecurityAuditTest.php`** — Tests : security audit.
- **`backend/tests/Feature/Supplier/FeaturedProductTest.php`** — Tests : featured product.
- **`backend/tests/Feature/Supplier/MyProductsTest.php`** — Tests : my products.
- **`backend/tests/Feature/Supplier/ReviewReportTest.php`** — Tests : review report.
- **`backend/tests/Feature/Supplier/SupplierDashboardTest.php`** — Tests : supplier dashboard.
- **`backend/tests/Feature/Supplier/SupplierProductTest.php`** — Tests : supplier product.
- **`backend/tests/Feature/Supplier/SupplierProfileTest.php`** — Tests : supplier profile.
- **`backend/tests/Feature/Supplier/SupplierQuoteTest.php`** — Tests : supplier quote.
- **`backend/tests/Feature/Supplier/SupplierValidationStatusTest.php`** — Tests : supplier validation status.
- **`backend/tests/Feature/SupplierValidationTest.php`** — Tests : supplier validation.
- **`backend/tests/Feature/Tender/AcceptQuoteTest.php`** — Tests : accept quote.
- **`backend/tests/Feature/Tender/RelevanceScorerTest.php`** — Tests : relevance scorer.
- **`backend/tests/Feature/Tender/TenderDiffusionTest.php`** — Tests : tender diffusion.
- **`backend/tests/Feature/Tender/TenderTest.php`** — Tests : tender.
- **`backend/tests/TestCase.php`** — Classe de base de tous les tests (helpers communs).
- **`backend/tests/Unit/UserRoleTest.php`** — Tests : user role.
- **`backend/tests/Unit/UserStatusTest.php`** — Tests : user status.
### Déploiement (Docker) (`deploy/`)

*Pourquoi / comment :* Images et scripts qui font tourner l'application en local et en production (partie 12).

- **`deploy/.env.example`** — Modèle des variables de la stack Docker locale (ports, mots de passe, TiDB, médias).
- **`deploy/README.md`** — Mode d'emploi de la stack Docker locale et de l'override TiDB.
- **`deploy/api/Dockerfile`** — Image de production de l'API : étape Composer puis PHP 8.3-FPM Alpine + nginx + supervisor + extensions.
- **`deploy/api/Dockerfile.dockerignore`** — Fichiers exclus du contexte de build de l'image API.
- **`deploy/api/entrypoint.sh`** — Démarrage du conteneur API : port nginx, APP_KEY, attente de la base, caches, reset démo, migrations, seed, photos, puis supervisord.
- **`deploy/api/nginx.conf.template`** — Serveur nginx de l'API : port injecté, PHP via FastCGI (127.0.0.1:9000), /storage servi en statique, en-têtes de sécurité.
- **`deploy/api/php.ini`** — Réglages PHP de production (taille des envois, mémoire, opcache).
- **`deploy/api/supervisord.conf`** — Supervisor garde en vie PHP-FPM et nginx dans le même conteneur.
- **`deploy/api/worker.sh`** — Démarrage du worker : attend la base puis lance php artisan queue:work.
- **`deploy/docker-compose.tidb.yml`** — Override avancé : branche l'API locale sur la base TiDB de production (seed désactivé).
- **`deploy/docker-compose.yml`** — Stack locale : db (PostgreSQL 17), api, worker, web, mailpit.
- **`deploy/start.sh`** — Construit et démarre toute la stack Docker puis attend que /up réponde.
- **`deploy/stop.sh`** — Arrête la stack Docker locale.
- **`deploy/web/Dockerfile`** — Image du site : build Vite (Node 22) puis service par nginx.
- **`deploy/web/Dockerfile.dockerignore`** — Fichiers exclus du build de l'image web.
- **`deploy/web/nginx.conf`** — nginx du site : fichiers statiques et renvoi de toute adresse vers index.html (SPA).
### Documentation (`docs/`)

*Pourquoi / comment :* Documents de l'équipe.

- **`docs/CONTRIBUTING.md`** — Règles d'équipe : branches, commits liés à Jira, pull requests.
- **`docs/DEPLOYMENT.md`** — Procédure de mise en production : variables, base TiDB, Mailjet, vérifications.
- **`docs/ENTITIES.md`** — Modèle de données métier : entités, champs et règles.
- **`docs/EXPLICATION_COMPLETE.md`** — Ce document.
- **`docs/OPEN_QUESTIONS.md`** — Questions métier en suspens (Q1…).
- **`docs/PROGRESS.md`** — Avancement des sprints.
- **`docs/ROADMAP.md`** — Feuille de route des fonctionnalités.
- **`docs/SECURITY.md`** — Mesures de sécurité de l'application.
- **`docs/api/admin-dashboard.md`** — Contrat JSON du tableau de bord administrateur.
- **`docs/api/openapi.json`** — Spécification OpenAPI générée par php artisan api:docs (servie par /api/docs).
- **`docs/api/postman_collection.json`** — Collection Postman générée pour tester l'API à la main.
- **`docs/decisions.md`** — Journal des décisions techniques (D1–D28) et règles métier (R1–R6) avec leurs raisons.
- **`docs/tasks/SCRUM-122.md`** — Notes de la tâche Jira SCRUM-122 (tableau de bord admin).
### Frontend — racine (`frontend/`)

*Pourquoi / comment :* Configuration du projet web.

- **`frontend/.env.example`** — Modèle des variables du site : VITE_API_URL, VITE_REVERB_*.
- **`frontend/.gitignore`** — Fichiers ignorés du frontend (node_modules, dist…).
### Frontend — tests de bout en bout (Playwright) (`frontend/e2e`)

*Pourquoi / comment :* Pilotent un vrai navigateur pour rejouer des parcours complets.

- **`frontend/e2e-reel/toutes-les-pages.spec.js`** — Ouvre toutes les pages sur la vraie plateforme (API + base) avec chaque rôle et vérifie qu'elles s'affichent.
- **`frontend/e2e/parcours-1-porteur.spec.js`** — Test de bout en bout : parcours complet d'un porteur de projet.
- **`frontend/e2e/parcours-2-fournisseur.spec.js`** — Test de bout en bout : parcours complet d'un fournisseur.
- **`frontend/e2e/support/api.js`** — API simulée dans le navigateur pour les tests Playwright (indépendants de Laravel).
### Frontend — racine (`frontend/`)

*Pourquoi / comment :* Configuration du projet web.

- **`frontend/index.html`** — Page HTML unique de la SPA : contient <div id="root"> et charge src/main.jsx.
- **`frontend/package-lock.json`** — Versions exactes des paquets npm.
- **`frontend/package.json`** — Dépendances (React, React Router, Zustand, Axios, Recharts, Echo) et scripts (dev, build, test, test:e2e, test:reel).
- **`frontend/playwright.config.js`** — Tests de bout en bout (SCRUM-89 / F34) : parcours 1 (porteur) et 2 (fournisseur) dans un vrai navigateur. L'API est simulée dans le navigateur (e2e/support/api.js) : les tests ne dépendent ni de Laravel ni d'une base. La …
- **`frontend/playwright.reel.config.js`** — Tests sur la vraie plateforme (API Laravel + base + données de démonstration), à la différence de playwright.config.js qui simule l'API. Démarrer d'abord la plateforme : ./deploy/start.sh Lancer : npm run test:reel Autre …
### Frontend — fichiers publics (`frontend/public/`)

*Pourquoi / comment :* Copiés tels quels dans le build (PWA, hors ligne, icônes).

- **`frontend/public/manifest.webmanifest`** — Manifeste PWA : nom, icônes, couleurs (application installable).
- **`frontend/public/offline.html`** — Page affichée par le service worker quand il n'y a pas de connexion.
- **`frontend/public/sw.js`** — Service worker : met en cache les fichiers et les réponses publiques, sert offline.html hors connexion.
### Frontend — appels à l'API (`frontend/src/api/`)

*Pourquoi / comment :* Une fonction par appel HTTP, via le client unique http.js. Les pages n'appellent jamais axios directement : si une route change, un seul fichier change.

- **`frontend/src/api/account.js`** — Mise à jour complète du compte (SCRUM-98) : informations, profil et adresse e-mail.  
  *Fonctions :* `updateAccount`, `updateProfile`, `updateEmail`, `updatePassword`, `deactivateAccount`, `deleteAccount`
- **`frontend/src/api/adminAnomalies.js`** — Alertes d'anomalie (SCRUM-86). Liste : { data: [{ id, target_type, target_id, target_label, anomaly_type, score, status, created_at }], meta, counts: { new } }.  
  *Fonctions :* `fetchAnomalies`, `scanAnomalies`, `decideAnomaly`
- **`frontend/src/api/adminCategories.js`** — Gestion des catégories par l'administrateur (SCRUM-32). L'arbre renvoyé : [{ id, name, parent_id, position, products_count, tenders_count, children: [...] }] …  
  *Fonctions :* `fetchAdminCategories`, `createCategory`, `updateCategory`, `moveCategory`, `deleteCategory`
- **`frontend/src/api/adminDashboard.js`** — Tableau de bord administrateur (SCRUM-122 / F28, story SCRUM-70). `from` et `to` sont facultatifs : sans eux, l'API renvoie les 30 derniers jours.  
  *Fonctions :* `fetchAdminDashboard`
- **`frontend/src/api/adminExports.js`** — Exports des statistiques d'administration (SCRUM-75 / F28). Le fichier est produit par un job : l'API répond 202 puis la liste indique quand l'export est prêt.  
  *Fonctions :* `fetchExports`, `createExport`, `downloadExport`
- **`frontend/src/api/adminModeration.js`** — Modération du catalogue et des avis signalés (SCRUM-72, SCRUM-74 / F29).  
  *Fonctions :* `fetchAdminProducts`, `withdrawProduct`, `fetchReportedReviews`, `keepReview`, `hideReview`
- **`frontend/src/api/adminSuppliers.js`** — File des demandes fournisseurs (SCRUM-31 / F05) : Récupère les fournisseurs selon le statut ('en attente', 'validé', 'refusé', 'all').  
  *Fonctions :* `fetchAdminSuppliers`, `fetchAdminSupplier`, `fetchAdminDocumentBlob`, `openAdminDocument`, `approveSupplier`, `rejectSupplier`
- **`frontend/src/api/adminUsers.js`** — Gestion des utilisateurs (SCRUM-118 / F24).  
  *Fonctions :* `fetchAdminUsers`, `fetchAdminUser`, `suspendUser`, `deleteUser`, `reactivateUser`
- **`frontend/src/api/ai.js`** — Assistants IA (SCRUM-124, SCRUM-77, SCRUM-78 / F30). Le texte renvoyé est toujours une suggestion modifiable.  
  *Fonctions :* `generateTenderDraft`, `generateProductText`, `acceptAiSuggestion`
- **`frontend/src/api/attachments.js`** — Télécharge une pièce jointe privée d'une demande : le jeton Bearer ne peut pas accompagner un simple lien, le fichier est donc récupéré puis enregistré sous son nom d'origine.  
  *Fonctions :* `downloadTenderAttachment`
- **`frontend/src/api/auditLogs.js`** — Journal d'audit (SCRUM-76), lecture seule. Réponse paginée : { data, meta, actions: [code], admins: [{ id, name }] }.  
  *Fonctions :* `fetchAuditLogs`
- **`frontend/src/api/buyerDashboard.js`** — Tableau de bord porteur de projet (SCRUM-121 / F27). `from` et `to` sont facultatifs : sans eux, l'API renvoie les 30 derniers jours.  
  *Fonctions :* `fetchBuyerDashboard`
- **`frontend/src/api/buyerQuotes.js`** — Comparaison et acceptation des devis reçus (F14 / SCRUM-47, SCRUM-48).  
  *Fonctions :* `fetchTenderQuotes`, `acceptQuote`
- **`frontend/src/api/catalog.js`** — Catalogue public (SCRUM-35) : accessible sans connexion. params : { q, category, type, region, price_min, price_max, delay, rating, sort, page, per_page, supplier_id, exclude } Réponse : { data: [ProductCard], meta: { cu …  
  *Fonctions :* `searchProducts`, `fetchRegions`
- **`frontend/src/api/categories.js`** — Arborescence publique des catégories (SCRUM-32), triée par position. products_count = produits visibles dans le catalogue (sous-catégories incluses pour une catégorie principale).  
  *Fonctions :* `fetchCategories`
- **`frontend/src/api/chatbot.js`** — Chatbot d'assistance (SCRUM-85). Réponse : { interaction_id, answer, links: [{ label, path }], simulated }. history : derniers échanges [{ from: 'user' …  
  *Fonctions :* `'assistant'`, `text }].`
- **`frontend/src/api/disputes.js`** — Litiges (SCRUM-117 / F23).  
  *Fonctions :* `fetchOrderDispute`, `fetchMyDisputes`, `openDispute`, `fetchDispute`, `downloadDisputeAttachment`, `fetchAdminDisputes`, `fetchAdminDispute`, `takeDispute`, `decideDispute`
- **`frontend/src/api/emailVerification.js`** — Vérification de l'adresse e-mail (SCRUM-24). Le lien reçu par e-mail ouvre /email/verifier?id=…&hash=…&expires=…&signature=… La page transmet ces paramètres tels quels à l'API, qui contrôle la signature.  
  *Fonctions :* `verifyEmail`, `resendVerificationEmail`
- **`frontend/src/api/favorites.js`** — Fournisseurs favoris du porteur de projet connecté (SCRUM-39). Liste : [{ id, company_name, logo_url, region, rating_avg, reviews_count, categories: [nom], favorited_at }] …  
  *Fonctions :* `fetchFavoriteSuppliers`, `addFavoriteSupplier`, `removeFavoriteSupplier`
- **`frontend/src/api/home.js`** — Page d'accueil (SCRUM-38) : { stats: { suppliers, products, regions }, categories: [8], featured_products: [4] }. Mise en cache 10 minutes par l'API.  
  *Fonctions :* `fetchHome`
- **`frontend/src/api/http.js`** — Client HTTP unique pour toute l'application. - ajoute le jeton Bearer à chaque requête - transforme les erreurs de l'API en messages lisibles (error.userMessage) - prévient l'application en cas de 401 / 403 (voir onAuthE …  
  *Fonctions :* `onAuthError`, `messageFor`
- **`frontend/src/api/messaging.js`** — Messagerie (SCRUM-59 à SCRUM-61 / F21, F22).  
  *Fonctions :* `fetchConversations`, `fetchConversation`, `openConversation`, `fetchMessages`, `sendMessage`, `markConversationRead`, `fetchUnreadMessages`, `downloadMessageAttachment`
- **`frontend/src/api/notifications.js`** — Centre de notifications et préférences (F15 / SCRUM-62, SCRUM-63).  
  *Fonctions :* `fetchNotifications`, `fetchUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`, `fetchNotificationPreferences`, `updateNotificationPreferences`, `setWhatsAppConsent`
- **`frontend/src/api/orders.js`** — Récupère les commandes passées par l'acheteur connecté (SCRUM-58).  
  *Fonctions :* `fetchBuyerOrders`, `fetchBuyerOrder`, `createBuyerOrder`, `fetchSupplierOrders`, `fetchOrderDetails`, `fetchOrderDocumentBlob`, `advanceSupplierOrder`, `confirmReceiptOrder`, `fetchDocumentDownloadBlob`
- **`frontend/src/api/passwordReset.js`** — « Mot de passe oublié » (SCRUM-26) : la réponse est la même que le compte existe ou non.  
  *Fonctions :* `requestPasswordReset`, `resetPassword`
- **`frontend/src/api/products.js`** — Récupère le détail d'un produit et d'autres produits du même fournisseur (SCRUM-51).  
  *Fonctions :* `fetchProduct`, `fetchSupplierProducts`
- **`frontend/src/api/quoteSummary.js`** — Résumé automatique des devis (SCRUM-119 / F25). Réponse : { can_generate, summary …  
  *Fonctions :* `null }`
- **`frontend/src/api/reviews.js`** — Dépose un avis sur une commande clôturée côté acheteur (SCRUM-64 / F20). payload: { rating: number, comment?: string } …  
  *Fonctions :* `submitBuyerReview`, `fetchSupplierReviews`, `replyToSupplierReview`, `reportReview`, `fetchPublicSupplierReviews`
- **`frontend/src/api/supplierDashboard.js`** — Tableau de bord fournisseur (SCRUM-120 / F26). `from` et `to` sont facultatifs : sans eux, l'API renvoie les 30 derniers jours.  
  *Fonctions :* `fetchSupplierDashboard`
- **`frontend/src/api/supplierProducts.js`** — Produits du fournisseur connecté (SCRUM-33 ajouter / modifier, SCRUM-34 Mes produits). Réservé à un fournisseur validé par l'administrateur. Produit : { id, type: 'product'|'service', title, description, price, unit, sto …  
  *Fonctions :* `fetchSupplierProduct`, `createSupplierProduct`, `updateSupplierProduct`, `uploadProductImages`, `reorderProductImages`, `deleteProductImage`, `fetchSupplierProducts`, `unpublishSupplierProduct`, `featureSupplierProduct`, `unfeatureSupplierProduct`, `deleteSupplierProduct`
- **`frontend/src/api/supplierProfile.js`** — Profil de l'entreprise du fournisseur connecté (SCRUM-28). L'API agit toujours sur le profil de l'utilisateur connecté (aucun identifiant dans l'URL).  
  *Fonctions :* `fetchSupplierProfile`, `updateSupplierProfile`, `uploadSupplierLogo`, `setSupplierProfilePublished`, `addSupplierDocument`, `openSupplierDocument`, `fetchProfileReferences`
- **`frontend/src/api/supplierTenders.js`** — Demandes reçues et devis du fournisseur (F13 / SCRUM-44 à SCRUM-46).  
  *Fonctions :* `fetchSupplierTenders`, `fetchSupplierTender`, `submitTenderQuote`, `fetchSupplierQuotes`
- **`frontend/src/api/supplierValidation.js`** — État du dossier du fournisseur connecté (SCRUM-27) : { status, rejection_reason, steps: { account_created_at, email_verified_at, reviewed_at }, is_published, documents } …  
  *Fonctions :* `fetchValidationStatus`
- **`frontend/src/api/suppliers.js`** — Fiche publique d'un fournisseur (SCRUM-37) : accessible sans connexion, 404 si non visible. { id, company_name, logo_url, description, sector, region, categories: [{ id, name }], coverage_regions: [nom], rating_avg, revi …  
  *Fonctions :* `fetchSupplier`, `searchSuppliers`, `fetchSupplierReviews`
- **`frontend/src/api/tenders.js`** — Demandes du porteur de projet (F11 / SCRUM-41, SCRUM-43, SCRUM-49).  
  *Fonctions :* `fetchTenderReferences`, `fetchBuyerTenders`, `fetchBuyerTender`, `createTender`, `analyzeTender`, `fetchMarketPrice`, `cancelTender`, `inviteSupplier`, `fetchFavoriteSuppliers`, `addFavoriteSupplier`, `removeFavoriteSupplier`
### Frontend — composants réutilisables (`frontend/src/components/`)

*Pourquoi / comment :* Briques d'interface partagées. Une fonction en PascalCase = un composant React ; les autres sont des fonctions internes (gestionnaires handleX/onX, calculs).

- **`frontend/src/components/AiSuggestion.jsx`** — Suggestion générée par l'IA (SCRUM-124 / F30). Le texte reste toujours modifiable : l'IA propose, l'utilisateur décide. onUse (formulaires) : « Utiliser ce texte » le place dans le champ ; onDismiss : garder son propre t …  
  *Fonctions :* `AiSuggestion`, `Suggestion`, `accept`, `use`
- **`frontend/src/components/AuthCard.jsx`** — Carte centrée utilisée par les pages d'authentification (connexion, vérification d'e-mail…).  
  *Fonctions :* `AuthCard`
- **`frontend/src/components/ChatbotWidget.jsx`** — Identifiant de conversation (une par ouverture de session du navigateur).  
  *Fonctions :* `newConversationId`, `ChatbotWidget`, `onKey`, `send`
- **`frontend/src/components/ChatbotWidget.test.jsx`** — Tests Vitest de ChatbotWidget.
- **`frontend/src/components/ContactButton.jsx`** — « Contacter » : ouvre la conversation liée à un contexte (SCRUM-61). - contact direct : réservé aux porteurs ; un visiteur passe par la connexion puis revient sur la page ; - demande, devis, commande : les deux parties ; …  
  *Fonctions :* `ContactButton`, `handleClick`
- **`frontend/src/components/ContactButton.test.jsx`** — Tests Vitest de ContactButton.
- **`frontend/src/components/EmptyState.jsx`** — État vide réutilisable : aucun résultat, aucun favori, aucun avis… action : bouton ou lien optionnel affiché sous le texte.  
  *Fonctions :* `EmptyState`
- **`frontend/src/components/ErrorPage.jsx`** — Page d'erreur plein écran (403, 404, 500, hors ligne — SCRUM-92) : code, explication et liens de retour. retry : affiche « Réessayer » (recharge la page).  
  *Fonctions :* `ErrorPage`
- **`frontend/src/components/FavoriteButton.jsx`** — Ajouter / retirer un fournisseur des favoris (SCRUM-39), sur la fiche produit et la fiche fournisseur. - invité : envoie vers la connexion puis revient sur la page ; - fournisseur ou administrateur : bouton masqué ; - po …  
  *Fonctions :* `HeartIcon`, `FavoriteButton`, `toggle`
- **`frontend/src/components/Logo.jsx`** — Emblème TijaraLink : un « T » dont la barre relie deux points, le porteur de projet et le fournisseur. variant « light » pour un fond foncé (pied de page, panneau d'authentification).  
  *Fonctions :* `LogoMark`, `Logo`
- **`frontend/src/components/LogoutButton.jsx`** — Bouton « Déconnexion », présent sur toutes les pages d'un utilisateur connecté (SCRUM-25).  
  *Fonctions :* `LogoutButton`, `handleLogout`
- **`frontend/src/components/MarketPriceCard.jsx`** — « Prix habituel du marché » sur la page Comparer les devis (SCRUM-82 / F31) : fourchette calculée à partir des transactions comparables de la catégorie, avec leur nombre. Un repère pour juger un devis, pas un verdict. qu …  
  *Fonctions :* `money`, `MarketPriceCard`
- **`frontend/src/components/MarketPriceCard.test.jsx`** — Tests Vitest de MarketPriceCard.
- **`frontend/src/components/Modal.jsx`** — Fenêtre modale simple (confirmation, motif de retrait…). Fermeture : Échap, clic sur le fond, bouton.  
  *Fonctions :* `Modal`, `onKey`
- **`frontend/src/components/NavIcon.jsx`** — Icônes de la barre latérale des espaces (trait de 1,8 px, 24 × 24, couleur du texte). name : clé de ICONS ; un nom inconnu n'affiche rien.  
  *Fonctions :* `NavIcon`
- **`frontend/src/components/NotificationBell.jsx`** — « il y a 5 min », « hier »… pour la liste déroulante.  
  *Fonctions :* `relativeTime`, `BellIcon`, `NotificationBell`, `onFocus`, `onNotification`, `onPointerDown`, `handleOpenItem`, `handleMarkAll`
- **`frontend/src/components/OfflineBanner.jsx`** — Bandeau « hors ligne » (SCRUM-88 / SCRUM-92) : prévient dès que la connexion tombe, disparaît à son retour.  
  *Fonctions :* `OfflineBanner`, `update`
- **`frontend/src/components/PageHeader.jsx`** — En-tête de page : titre, sous-titre et actions alignées à droite (empilées sur mobile).  
  *Fonctions :* `PageHeader`
- **`frontend/src/components/Pagination.jsx`** — Pagination ‹ 1 2 3 … 25 › (maquettes V2, F2). Affiche toujours la première et la dernière page, et les pages voisines de la page courante.  
  *Fonctions :* `pageItems`, `Pagination`
- **`frontend/src/components/ProductCard.jsx`** — Carte produit (maquettes V1 à V4, aperçu F3) : image, titre, fournisseur + région + note, prix. product : réponse ProductCardResource de l'API. linkable=false pour l'aperçu du formulaire.  
  *Fonctions :* `ProductCard`, `ProductCardSkeleton`
- **`frontend/src/components/ProductImage.jsx`** — Photo d'un produit. Sans photo, ou si le fichier est introuvable, affiche le dégradé à la place d'une image cassée. seed et label : voir ProductImagePlaceholder.  
  *Fonctions :* `ProductImage`
- **`frontend/src/components/ProductImage.test.jsx`** — Tests Vitest de ProductImage.
- **`frontend/src/components/ProductImagePlaceholder.jsx`** — Dégradé pastel affiché quand un produit n'a pas de photo (maquettes V1 à V4). La teinte dépend de l'identifiant pour varier d'une carte à l'autre.  
  *Fonctions :* `ProductImagePlaceholder`
- **`frontend/src/components/PublicNotFound.jsx`** — Page introuvable dans la vitrine publique (produit retiré, fournisseur non visible…).  
  *Fonctions :* `PublicNotFound`
- **`frontend/src/components/QuoteSummaryCard.jsx`** — Résumé automatique des devis (SCRUM-119 / F25) : aide à comparer, sans désigner de gagnant. Généré à l'ouverture de la page s'il manque ou si les devis ont changé. Une panne de l'IA n'empêche jamais de comparer : la cart …  
  *Fonctions :* `Points`, `QuoteSummaryCard`, `save`, `nameOf`
- **`frontend/src/components/QuoteSummaryCard.test.jsx`** — Tests Vitest de QuoteSummaryCard.
- **`frontend/src/components/RelevanceScoreBadge.jsx`** — Badge réutilisable du score de pertinence demande ↔ fournisseur (SCRUM-50). Vert à partir de 80 %, orange à partir de 50 %, neutre en dessous.  
  *Fonctions :* `RelevanceScoreBadge`
- **`frontend/src/components/ReviewInsights.jsx`** — « Ce que les clients en disent » (SCRUM-83 / F32) : synthèse, points forts et points faibles tirés des avis. summary : { summary, strengths, weaknesses, reviews_count, simulated } ou null (moins de 3 avis : rien n'est af …  
  *Fonctions :* `ReviewInsights`
- **`frontend/src/components/ReviewInsights.test.jsx`** — Tests Vitest de ReviewInsights.
- **`frontend/src/components/ReviewItem.jsx`** — Un avis client (SCRUM-37 / SCRUM-36) : auteur abrégé, étoiles, commentaire, réponse du fournisseur en retrait.  
  *Fonctions :* `ReviewItem`
- **`frontend/src/components/StarRating.jsx`** — Étoiles de notation (maquettes V3, V4) : pleines en orange, vides en contour. value : note de 0 à 5 (arrondie à l'étoile la plus proche pour l'affichage).  
  *Fonctions :* `StarRating`
- **`frontend/src/components/StatusBadge.jsx`** — Variante associée à un statut de validation de l'API (« validé », « en attente », « refusé »).  
  *Fonctions :* `variantForStatus`, `StatusBadge`, `defaultLabel`
- **`frontend/src/components/TenderBadges.jsx`** — Statut d'une demande (F11/F13).  
  *Fonctions :* `TenderStatusBadge`, `QuoteStatusBadge`
- **`frontend/src/components/WhatsAppSettings.jsx`** — Notifications WhatsApp (SCRUM-133) : consentement explicite, numéro masqué, derniers envois. state : bloc « whatsapp » renvoyé par l'API ; onChange reçoit { preferences, whatsapp }.  
  *Fonctions :* `WhatsAppSettings`, `toggle`
- **`frontend/src/components/dashboard/ActivityAreaChart.jsx`** — Additionne les jours d'un groupe.  
  *Fonctions :* `total`, `prepare`, `ChartTooltip`, `ActivityAreaChart`
- **`frontend/src/components/dashboard/ColorKpiCard.jsx`** — Petite courbe décorative sous la valeur ; rien n'est dessiné avec moins de deux points.  
  *Fonctions :* `Sparkline`, `ColorKpiCard`
- **`frontend/src/components/dashboard/DashboardPeriod.jsx`** — Raccourcis de période : nombre de jours jusqu'à aujourd'hui inclus (l'API accepte 366 jours au plus).  
  *Fonctions :* `lastDays`, `DashboardPeriod`
- **`frontend/src/components/dashboard/EmptyState.jsx`** — État vide d'une section : message court et, si besoin, une action.  
  *Fonctions :* `EmptyState`
- **`frontend/src/components/dashboard/ErrorState.jsx`** — Erreur de chargement avec un bouton de nouvelle tentative.  
  *Fonctions :* `ErrorState`
- **`frontend/src/components/dashboard/KpiCard.jsx`** — Carte d'un indicateur clé (libellé, valeur déjà formatée, précision).  
  *Fonctions :* `KpiCard`
- **`frontend/src/components/dashboard/KpiIcon.jsx`** — Icônes pleines et colorées des cartes d'indicateurs (maquette du tableau de bord porteur de projet). tone : couleur du rond et de l'icône (voir TONES) ; name : clé de ICONS.  
  *Fonctions :* `KpiIcon`
- **`frontend/src/components/dashboard/PeriodPicker.jsx`** — Sélecteur de période commun aux tableaux de bord (F26–F28). Champs natifs `<input type="date">` : aucune dépendance supplémentaire.  
  *Fonctions :* `PeriodPicker`, `update`, `handleSubmit`
- **`frontend/src/components/dashboard/Skeleton.jsx`** — Bloc gris animé utilisé pendant le chargement (respecte `prefers-reduced-motion` via Tailwind).  
  *Fonctions :* `Skeleton`
- **`frontend/src/components/dashboard/TimeSeriesChart.jsx`** — Courbe d'évolution commune aux tableaux de bord (Recharts). `lines` permet d'afficher d'autres séries (dépenses, revenu…).  
  *Fonctions :* `shortDate`, `TimeSeriesChart`
- **`frontend/src/components/dashboard/WelcomeBanner.jsx`** — Illustration de la bannière : une boutique, un chariot et une coche de validation.  
  *Fonctions :* `ShopIllustration`, `WelcomeBanner`
- **`frontend/src/components/disputes/DisputeParts.jsx`** — Preuves jointes : fichiers privés, téléchargés par l'API.  
  *Fonctions :* `disputeStatusLabel`, `DisputeStatusBadge`, `DisputeAttachments`, `download`, `DisputeContent`
- **`frontend/src/components/disputes/OrderDisputeCard.jsx`** — Bloc « Litige » de la page d'une commande (SCRUM-117 / F23) : suivi du dernier litige, ou « Signaler un problème » quand c'est possible (règle R4 vérifiée par l'API). À monter avec key={order.status} : la possibilité dép …  
  *Fonctions :* `OrderDisputeCard`
- **`frontend/src/components/home/HomeCatalog.jsx`** — Aperçu du catalogue sur la page d'accueil : derniers produits avec leurs photos, filtrables par catégorie. categories : catégories principales déjà chargées par la page (pastilles de filtre).  
  *Fonctions :* `HomeCatalog`
- **`frontend/src/components/home/HomeIllustrations.jsx`** — Illustrations de la page d'accueil (maquette « landing ») : dessinées en SVG, sans image externe.  
  *Fonctions :* `HeroIllustration`, `ShopIllustration`, `LineIcon`, `categoryIcon`
- **`frontend/src/components/orders/OrderStatusBadge.jsx`** — Composant / module « OrderStatusBadge ».  
  *Fonctions :* `OrderStatusBadge`, `OrderStatusProgress`
- **`frontend/src/components/orders/OrderStatusBadge.test.jsx`** — Tests Vitest de OrderStatusBadge.
### Frontend — configuration (`frontend/src/config/`)

*Pourquoi / comment :* Identité de la marque.

- **`frontend/src/config/brand.js`** — Identité de l'application : à modifier ici seulement (nom, slogan). « Tijara » signifie « commerce » en arabe : le lien entre porteurs de projet et fournisseurs tunisiens.
### Frontend — mises en page (`frontend/src/layouts/`)

*Pourquoi / comment :* Cadres communs (en-tête, barre latérale, pied de page) dans lesquels les pages s'affichent (<Outlet/>).

- **`frontend/src/layouts/AdminLayout.jsx`** — Mise en page du back-office administrateur (maquettes AD1 à AD8). Les entrées des fonctionnalités à venir sont affichées mais inactives (« Bientôt disponible »).  
  *Fonctions :* `AdminLayout`
- **`frontend/src/layouts/AppLayout.jsx`** — Liens du compte : sur une ligne dans l'en-tête, ou empilés dans le menu du téléphone.  
  *Fonctions :* `adminLinkClass`, `AccountLinks`, `AppLayout`, `close`
- **`frontend/src/layouts/AppLayout.test.jsx`** — Tests Vitest de AppLayout.
- **`frontend/src/layouts/AuthLayout.jsx`** — Mise en page des écrans d'authentification (connexion, inscription) : fond lavande, accueil et atouts à gauche, carte blanche du formulaire à droite. Sur mobile, seuls le logo et la carte sont affichés. <AuthLayout><Auth …  
  *Fonctions :* `Illustration`, `Welcome`, `AuthCard`, `BackHome`, `AuthLayout`
- **`frontend/src/layouts/BuyerLayout.jsx`** — Mise en page « Espace porteur de projet » (maquettes B1 à B8). Les entrées sans adresse arrivent dans les prochains sprints : elles sont affichées, mais inactives.  
  *Fonctions :* `BuyerLayout`
- **`frontend/src/layouts/PublicLayout.jsx`** — Mise en page des pages publiques (maquettes V1 à V4) : en-tête + pied de page sombre. Accessible sans connexion ; un utilisateur connecté voit son avatar et un lien vers son espace.  
  *Fonctions :* `BrandLogo`, `linkClass`, `NavLinks`, `AccountActions`, `PublicHeader`, `close`, `PublicFooter`, `PublicLayout`
- **`frontend/src/layouts/PublicLayout.test.jsx`** — Tests Vitest de PublicLayout.
- **`frontend/src/layouts/SpaceLayout.jsx`** — Mise en page commune des espaces connectés (maquettes Figma) : barre latérale + en-tête (fil d'Ariane, recherche, notifications, nom affiché). Utilisée par l'espace fournisseur, l'administration et l'espace porteur de pr …  
  *Fonctions :* `UnreadBadge`, `UnreadMessagesWatcher`, `groupItems`, `Sidebar`, `HelpCard`, `SidebarFooter`, `BellIcon`, `SpaceLayout`, `handleSearch`, `handleLogout`
- **`frontend/src/layouts/SupplierLayout.jsx`** — Mise en page « Espace fournisseur » (maquette Figma) : barre latérale et en-tête communs (SpaceLayout).  
  *Fonctions :* `SupplierLayout`
### Frontend — entrée (`frontend/src/`)

*Pourquoi / comment :* Point d'entrée de l'application.

- **`frontend/src/main.jsx`** — 401 : jeton expiré ou révoqué → retour à la connexion.
### Frontend — temps réel (`frontend/src/realtime/`)

*Pourquoi / comment :* Connexion WebSocket à Reverb et diffusion des événements aux pages.

- **`frontend/src/realtime/realtime.js`** — Temps réel (Laravel Reverb) : un canal privé par utilisateur. Événements : message.sent, conversation.read, notification.created, et « connected » (connexion établie ou rétablie : les pages ouvertes rattrapent ce qu'elle …  
  *Fonctions :* `isRealtimeConnected`, `onRealtime`, `emitRealtime`, `useRealtime`, `connect`, `disconnect`, `startRealtime`, `sync`
### Frontend — routage (`frontend/src/router/`)

*Pourquoi / comment :* Adresses, arbre des pages et règles d'accès.

- **`frontend/src/router/guard.js`** — Règles d'accès aux pages, séparées du routeur pour être testées facilement. access.guest           : page réservée aux visiteurs non connectés (connexion, inscription) access.authenticated   : page réservée à tout utilis …  
  *Fonctions :* `resolveAccess`
- **`frontend/src/router/guard.test.js`** — Tests Vitest de guard.
- **`frontend/src/router/index.js`** — Crée le routeur React Router à partir de createRoutes() et remonte en haut de page à chaque navigation.
- **`frontend/src/router/paths.js`** — Centre de notifications de l'espace de ce rôle.  
  *Fonctions :* `notificationsPathFor`, `disputePath`, `newDisputePath`, `adminDisputePath`, `adminUserPath`, `messagingPathFor`, `conversationPath`, `orderTrackingPath`, `productDetailPath`, `productPath`, `supplierProductEditPath`, `supplierTenderPath`, `buyerTenderPath`, `buyerTenderQuotesPath`, `buyerOrderPath`, `catalogPath`, `supplierPublicPath`, `loginPath`, `safeRedirect`
- **`frontend/src/router/routes.jsx`** — Racine : la page demandée, le bandeau hors ligne (SCRUM-88) et le chatbot d'assistance (SCRUM-85).  
  *Fonctions :* `RootLayout`, `page`, `guard`, `space`, `verifyEmailLoader`, `supplierOnly`, `createRoutes`
- **`frontend/src/router/routes.test.jsx`** — Tests Vitest de routes.
### Frontend — état global (Zustand) (`frontend/src/stores/`)

*Pourquoi / comment :* Données partagées par toute l'application ; selectX() = sélecteurs pour lire une partie de l'état.

- **`frontend/src/stores/adminDashboard.js`** — État du tableau de bord administrateur. `requestId` protège contre les réponses arrivées dans le désordre : quand l'administrateur change de période pendant un chargement, seule la dernière réponse est conservée.  
  *Fonctions :* `selectAdminDashboard`, `selectAdminDashboardLoading`, `selectAdminDashboardError`
- **`frontend/src/stores/auth.js`** — État de connexion partagé par toute l'application. Dans un composant : useAuthStore(selectUser). Hors composant : useAuthStore.getState().  
  *Fonctions :* `selectUser`, `selectRole`, `selectIsAuthenticated`, `ensureAuthLoaded`
- **`frontend/src/stores/messaging.js`** — Nombre de messages non lus, affiché dans le menu (SCRUM-59).
### Frontend — entrée (`frontend/src/`)

*Pourquoi / comment :* Point d'entrée de l'application.

- **`frontend/src/style.css`** — Styles globaux : import Tailwind, couleurs et variables de la charte TijaraLink.
### Frontend — configuration des tests (`frontend/src/test/`)

- **`frontend/src/test/setup.js`** — findBy… / waitFor : 5 s au lieu de 1 s. Les pages chargées à la demande (lazy) peuvent dépasser 1 s …
### Frontend — utilitaires (`frontend/src/utils/`)

*Pourquoi / comment :* Fonctions pures et hooks partagés (formatage, stockage, règles).

- **`frontend/src/utils/format.js`** — Formats d'affichage partagés (prix, notes, nombres) — français de Tunisie.  
  *Fonctions :* `clean`, `formatAmount`, `formatPrice`, `formatPriceWithUnit`, `formatRating`, `formatNumber`, `pluralize`
- **`frontend/src/utils/initials.js`** — Initiales affichées à la place d'un logo ou d'un avatar : « Atlas Emballages » → « AE ».  
  *Fonctions :* `initialsOf`
- **`frontend/src/utils/money.js`** — Formatage des montants renvoyés par l'API. L'API envoie des montants décimaux sous forme de chaîne (« 1500.00 ») pour éviter les erreurs d'arrondi. On formate donc la chaîne sans la convertir en nombre flottant : séparat …  
  *Fonctions :* `formatAmount`, `formatCount`
- **`frontend/src/utils/passwordRules.js`** — Règles de robustesse du mot de passe, identiques à l'API (Password::min(8)->letters()->mixedCase()->numbers(), voir AppServiceProvider).  
  *Fonctions :* `isStrongPassword`
- **`frontend/src/utils/period.js`** — Période par défaut des tableaux de bord : les 30 derniers jours, bornes incluses. Les dates sont envoyées à l'API au format `YYYY-MM-DD`.  
  *Fonctions :* `defaultPeriod`, `toDateInputValue`, `periodError`, `formatDate`, `startOfDay`
- **`frontend/src/utils/relativeDate.js`** — Date lisible et relative : « Aujourd'hui, 09:12 », « Hier, 17:40 », « 12 nov., 14:05 » (l'année est ajoutée si ce n'est pas l'année en cours). Heure locale du navigateur.  
  *Fonctions :* `startOfDay`, `formatRelativeDate`
- **`frontend/src/utils/relativeDate.test.js`** — Tests Vitest de relativeDate.
- **`frontend/src/utils/roles.js`** — Adresse du tableau de bord d'un rôle.  
  *Fonctions :* `homePathFor`, `landingPathFor`
- **`frontend/src/utils/saveBlob.js`** — Enregistre un fichier privé récupéré avec le jeton Bearer (un simple lien ne peut pas le transmettre).  
  *Fonctions :* `saveBlob`
- **`frontend/src/utils/supplierDocuments.js`** — Justificatifs du fournisseur : partagé par le profil (SCRUM-28) et la page « Compte en attente » (renvoi de documents après un refus, SCRUM-27).  
  *Fonctions :* `documentFileError`
- **`frontend/src/utils/tokenStorage.js`** — Stockage du jeton Sanctum. Le stockage peut être indisponible (navigation privée) : on ne plante pas.  
  *Fonctions :* `read`, `remove`
- **`frontend/src/utils/useFormDraft.js`** — Aucune perte de saisie (SCRUM-92) : le formulaire est recopié dans le navigateur à chaque modification et restauré à la réouverture de la page (coupure réseau, rechargement, onglet fermé par erreur). Seuls des champs tex …  
  *Fonctions :* `read`, `write`, `remove`, `useFormDraft`
- **`frontend/src/utils/useFormDraft.test.jsx`** — Tests Vitest de useFormDraft.
- **`frontend/src/utils/userStatus.js`** — Mêmes valeurs que App\Enums\UserStatus côté Laravel ; « supprimé » = suppression douce.  
  *Fonctions :* `userStatusConfig`
### Frontend — pages (`frontend/src/views/`)

*Pourquoi / comment :* Une page par écran, rangée par espace. Le composant principal porte le nom du fichier ; handleX/submit/update = gestionnaires d'actions ; les fichiers .test.jsx testent la page avec Vitest.

- **`frontend/src/views/HomeView.jsx`** — Page d'accueil (SCRUM-38, maquette « landing ») : recherche, chiffres clés, catégories, catalogue avec photos, produits mis en avant, « Comment ça marche », bandeau fournisseurs. Reste lisible si l'API ne répond pas.  
  *Fonctions :* `Stat`, `SectionHeader`, `HomeView`, `search`
- **`frontend/src/views/HomeView.test.jsx`** — Tests Vitest de HomeView.
- **`frontend/src/views/account/AccountSettingsView.jsx`** — Le téléphone est stocké « +216 71000000 » ; le formulaire n'affiche que les 8 chiffres.  
  *Fonctions :* `isStrongPassword`, `phoneDigits`, `firstError`, `AccountSettingsView`, `updateProfileField`, `updatePasswordField`, `handleProfileSubmit`, `handlePasswordSubmit`, `openConfirmation`, `closeConfirmation`, `handleAccountAction`, `Feedback`, `ConfirmAccountAction`
- **`frontend/src/views/account/AccountSettingsView.test.jsx`** — Tests Vitest de AccountSettingsView.
- **`frontend/src/views/admin/AdminAuditPage.jsx`** — Cible de l'action, avec un lien quand une page existe.  
  *Fonctions :* `actionLabel`, `formatDateTime`, `Target`, `AdminAuditPage`, `get`, `update`, `goTo`
- **`frontend/src/views/admin/AdminAuditPage.test.jsx`** — Tests Vitest de AdminAuditPage.
- **`frontend/src/views/admin/AdminDashboard.jsx`** — Composant / module « AdminDashboard ».  
  *Fonctions :* `AdminDashboard`, `handleApprove`, `openRejectModal`, `closeRejectModal`, `handleConfirmReject`, `handleOpenViewer`, `closeViewer`, `documentLabel`
- **`frontend/src/views/admin/AdminDashboard.test.jsx`** — Tests Vitest de AdminDashboard.
- **`frontend/src/views/admin/AdminDashboardView.jsx`** — Composant / module « AdminDashboardView ».  
  *Fonctions :* `plural`, `waitingLabel`, `DashboardSkeleton`, `SectionHeader`, `AdminDashboardView`, `setExportOpen`
- **`frontend/src/views/admin/AdminDashboardView.test.jsx`** — Tests Vitest de AdminDashboardView.
- **`frontend/src/views/admin/AdminDisputePage.jsx`** — Traitement d'un litige par l'administrateur (SCRUM-117 / F23) : prise en charge puis décision motivée.  
  *Fonctions :* `Party`, `AdminDisputePage`, `run`
- **`frontend/src/views/admin/AdminDisputesPage.jsx`** — Gestion des litiges (SCRUM-117 / F23) : les plus urgents d'abord. Filtres conservés dans l'adresse.  
  *Fonctions :* `AdminDisputesPage`, `update`, `countFor`
- **`frontend/src/views/admin/AdminExportDialog.jsx`** — Fenêtre d'export des statistiques (SCRUM-75 / F28). Le fichier (CSV ou XLSX, indicateurs au choix) est produit par un job : la liste se rafraîchit et le bouton de téléchargement apparaît quand il est prêt.  
  *Fonctions :* `AdminExportDialog`, `toggleIndicator`, `handleSubmit`, `handleDownload`
- **`frontend/src/views/admin/AdminExportDialog.test.jsx`** — Tests Vitest de AdminExportDialog.
- **`frontend/src/views/admin/AdminProductsPage.jsx`** — Contrôle du catalogue (SCRUM-72 / F29), annonces signalées par l'IA en premier : rechercher, filtrer et retirer un produit avec un motif. Le retrait notifie le fournisseur et reste audité.  
  *Fonctions :* `AdminProductsPage`, `applySearch`, `changeStatus`, `openWithdraw`, `submitWithdraw`
- **`frontend/src/views/admin/AdminProductsPage.test.jsx`** — Tests Vitest de AdminProductsPage.
- **`frontend/src/views/admin/AdminReviewsPage.jsx`** — Seuil à partir duquel l'IA soumet un avis à l'admin (ReviewInsightService::SUSPICION_THRESHOLD).  
  *Fonctions :* `authorName`, `Stars`, `AdminReviewsPage`, `keep`, `openHide`, `submitHide`
- **`frontend/src/views/admin/AdminReviewsPage.test.jsx`** — Tests Vitest de AdminReviewsPage.
- **`frontend/src/views/admin/AdminUserPage.jsx`** — Ce que la suspension ou la suppression entraîne, selon le rôle et l'activité du compte.  
  *Fonctions :* `Row`, `BlockingEffects`, `AdminUserPage`, `openAction`, `confirm`
- **`frontend/src/views/admin/AdminUsers.test.jsx`** — Tests Vitest de AdminUsers.
- **`frontend/src/views/admin/AdminUsersPage.jsx`** — Utilisateurs (SCRUM-118 / F24). Filtres conservés dans l'adresse.  
  *Fonctions :* `AdminUsersPage`, `update`, `label`
- **`frontend/src/views/admin/AnomalyAlertsCard.jsx`** — Alertes d'anomalie du tableau de bord administrateur (SCRUM-86) : comptes et commandes au comportement inhabituel, du plus grave au moins grave. L'admin marque chaque alerte « traitée » ou « ignorée » ; rien n'est bloqué …  
  *Fonctions :* `scoreTone`, `AnomalyAlertsCard`, `reload`, `scan`, `decide`
- **`frontend/src/views/admin/AnomalyAlertsCard.test.jsx`** — Tests Vitest de AnomalyAlertsCard.
- **`frontend/src/views/admin/CategoryManagementPage.jsx`** — Gestion des catégories et sous-catégories (SCRUM-32, maquette AD5). Liste à gauche (↑ ↓, glisser-déposer, Modifier), panneau d'édition à droite. Le réordonnancement ne se fait qu'entre catégories sœurs (racines entre ell …  
  *Fonctions :* `productsLabel`, `flatten`, `findCategory`, `formFrom`, `errorMessage`, `GripIcon`, `Field`, `ConfirmDeleteDialog`, `CategoryManagementPage`, `openPanel`, `startCreate`, `startEdit`, `updateField`, `handleSubmit`, `runMove`, `handleDelete`, `canDropOn`, `handleDrop`
- **`frontend/src/views/admin/CategoryManagementPage.test.jsx`** — Tests Vitest de CategoryManagementPage.
- **`frontend/src/views/auth/EmailVerifiedView.jsx`** — Page ouverte par le lien de l'e-mail (/email/verifier?…). Le résultat vient du loader (routes.jsx). Après vérification : porteur → tableau de bord ; fournisseur → « Compte en attente de validation ».  
  *Fonctions :* `EmailVerifiedView`
- **`frontend/src/views/auth/ForgotPasswordView.jsx`** — « Mot de passe oublié » (SCRUM-26) : même message affiché que l'adresse existe ou non.  
  *Fonctions :* `ForgotPasswordView`, `handleSubmit`
- **`frontend/src/views/auth/LoginView.jsx`** — Connexion (SCRUM-25) : redirection vers l'espace du rôle, message générique en cas d'erreur, message explicite pour un compte suspendu ou désactivé, « Se souvenir de moi ».  
  *Fonctions :* `FieldIcon`, `LoginView`, `update`, `handleSubmit`
- **`frontend/src/views/auth/LoginView.test.jsx`** — Tests Vitest de LoginView.
- **`frontend/src/views/auth/PasswordReset.test.jsx`** — Tests Vitest de PasswordReset.
- **`frontend/src/views/auth/RegisterBuyerView.jsx`** — Inscription d'un porteur de projet (SCRUM-23). Champs obligatoires de docs/ENTITIES.md : compte (prénom, nom, e-mail, téléphone, mot de passe) et profil (type de porteur, organisation, secteur, région, CGU). Les erreurs …  
  *Fonctions :* `emailIsValid`, `passwordIsValid`, `phoneIsValid`, `RegisterBuyerView`, `loadRegions`, `clearFieldError`, `update`, `validate`, `handleSubmit`
- **`frontend/src/views/auth/RegisterBuyerView.test.jsx`** — Tests Vitest de RegisterBuyerView.
- **`frontend/src/views/auth/RegisterTypeView.jsx`** — Composant / module « RegisterTypeView ».  
  *Fonctions :* `RegisterTypeView`
- **`frontend/src/views/auth/RegisterView.jsx`** — Miroir des règles du backend : PDF/JPG/PNG, 5 Mo maximum.  
  *Fonctions :* `phoneIsValid`, `emailIsValid`, `passwordIsValid`, `fileError`, `stepForErrors`, `RegisterView`, `loadReferences`, `clearFieldError`, `update`, `toggleValue`, `checkEmail`, `validateStepOne`, `validateStepTwo`, `validateStepThree`, `goNext`, `handleSubmit`, `handleRegisterFile`, `handleTaxCertificate`, `handleManagerId`, `handleCertifications`, `removeCertification`
- **`frontend/src/views/auth/RegisterView.test.jsx`** — Tests Vitest de RegisterView.
- **`frontend/src/views/auth/ResetPasswordView.jsx`** — « Nouveau mot de passe » (SCRUM-26), ouverte par le lien reçu par e-mail (?token=…&email=…). Mot de passe saisi deux fois, règles de robustesse affichées en direct, puis retour à la connexion.  
  *Fonctions :* `ResetPasswordView`, `handleSubmit`, `InvalidLink`
- **`frontend/src/views/auth/VerifyEmailNoticeView.jsx`** — « Consultez votre boîte mail » : affichée tant que l'adresse e-mail n'est pas vérifiée (SCRUM-24).  
  *Fonctions :* `VerifyEmailNoticeView`, `handleResend`, `handleCheck`, `handleLogout`
- **`frontend/src/views/buyer/BuyerAiPage.jsx`** — Assistant IA du porteur de projet (SCRUM-124 / SCRUM-79 / F30) : brouillon de demande et accès au résumé des devis (page de comparaison).  
  *Fonctions :* `BuyerAiPage`, `submitDraft`
- **`frontend/src/views/buyer/BuyerAiPage.test.jsx`** — Tests Vitest de BuyerAiPage.
- **`frontend/src/views/buyer/BuyerDashboard.jsx`** — Tableau de bord porteur de projet (SCRUM-121 / F27) : dépenses, commandes, demandes publiées, devis en attente et fournisseurs favoris.  
  *Fonctions :* `plural`, `DashboardSkeleton`, `BuyerDashboard`
- **`frontend/src/views/buyer/BuyerOrdersPage.jsx`** — Composant / module « BuyerOrdersPage ».  
  *Fonctions :* `BuyerOrdersPage`, `handleTabChange`, `handleDownloadDocument`
- **`frontend/src/views/buyer/BuyerOrdersPage.test.jsx`** — Tests Vitest de BuyerOrdersPage.
- **`frontend/src/views/buyer/CompareQuotesPage.jsx`** — Comparaison des devis reçus puis acceptation (SCRUM-47, SCRUM-48 / F14). L'acceptation crée la commande, refuse les autres devis et clôt la demande.  
  *Fonctions :* `Stars`, `CompareQuotesPage`, `handleAccept`
- **`frontend/src/views/buyer/FavoriteSuppliersPage.jsx`** — Fournisseurs favoris (SCRUM-39, maquette B8) : ouvrir la fiche, retirer (avec « Annuler » pendant 5 s). « Inviter à une demande » (S3) et « Contacter » (S5) arrivent dans les prochains sprints.  
  *Fonctions :* `SupplierAvatar`, `FavoriteSuppliersPage`, `remove`, `cancelRemoval`
- **`frontend/src/views/buyer/FavoriteSuppliersPage.test.jsx`** — Tests Vitest de FavoriteSuppliersPage.
- **`frontend/src/views/buyer/NewTenderPage.jsx`** — Regroupe les catégories par catégorie principale pour la liste déroulante.  
  *Fonctions :* `categoryOptions`, `NewTenderPage`, `update`, `addFiles`, `handleSubmit`
- **`frontend/src/views/buyer/OrderDetailPage.jsx`** — Suivi d'une commande issue d'un devis accepté (SCRUM-48 / F14) : lignes, coordonnées du fournisseur, conditions et historique des étapes.  
  *Fonctions :* `OrderDetailPage`
- **`frontend/src/views/buyer/OrdersPage.jsx`** — Commandes du porteur créées par acceptation d'un devis (SCRUM-48 / F14).  
  *Fonctions :* `OrdersPage`
- **`frontend/src/views/buyer/RecentActivity.jsx`** — « il y a 2 heures », « hier »… à partir d'une date ISO.  
  *Fonctions :* `timeAgo`, `ActivityIcon`, `activities`, `RecentActivity`
- **`frontend/src/views/buyer/RecommendedSuppliers.jsx`** — Fournisseurs recommandés selon les achats passés (SCRUM-87), sur le tableau de bord porteur. Chaque carte indique la raison de la recommandation. Favoris et fournisseurs déjà sollicités sont exclus côté API.  
  *Fonctions :* `RecommendedSuppliers`
- **`frontend/src/views/buyer/RecommendedSuppliers.test.jsx`** — Tests Vitest de RecommendedSuppliers.
- **`frontend/src/views/buyer/TenderAiAnalysis.jsx`** — Analyse IA de la demande dans « Publier une demande » (SCRUM-81 / F31) : catégorie proposée (modifiable), mots-clés détectés et fournisseurs suggérés à cocher. L'IA propose, le porteur décide ; sans elle, la publication …  
  *Fonctions :* `TenderAiAnalysis`, `analyze`, `toggle`
- **`frontend/src/views/buyer/TenderAiAnalysis.test.jsx`** — Tests Vitest de TenderAiAnalysis.
- **`frontend/src/views/buyer/TenderAiDraft.jsx`** — « Rédiger avec l'IA » dans « Publier une demande » (SCRUM-77 / F30) : titre + mots-clés → description proposée, entièrement modifiable. L'IA indisponible n'empêche jamais de rédiger soi-même.  
  *Fonctions :* `TenderAiDraft`, `generate`, `close`
- **`frontend/src/views/buyer/TenderAiDraft.test.jsx`** — Tests Vitest de TenderAiDraft.
- **`frontend/src/views/buyer/TenderDetailPage.jsx`** — Détail d'une demande côté porteur (SCRUM-43 / F11) : suivi de la diffusion, invitation d'un fournisseur favori et annulation.  
  *Fonctions :* `TenderDetailPage`, `handleCancel`, `handleInvite`, `handleAttachment`
- **`frontend/src/views/buyer/TendersPage.jsx`** — Liste des demandes publiées par le porteur (SCRUM-43 / F11) : statut, nombre de fournisseurs touchés et de devis reçus.  
  *Fonctions :* `TendersPage`
- **`frontend/src/views/catalog/CatalogFilters.jsx`** — Colonne de filtres du catalogue (maquette V2 + filtres Délai et Note exigés par SCRUM-35). Cases et boutons radio : effet immédiat. Prix : appliqué 400 ms après la saisie, ou à la validation.  
  *Fonctions :* `Section`, `Checkbox`, `Radio`, `toggle`, `PriceField`, `CatalogFilters`, `typeChecked`, `changeType`
- **`frontend/src/views/catalog/CatalogView.jsx`** — Catalogue public (SCRUM-35, maquette V2) : recherche, filtres combinables, tri, pagination. Les filtres vivent dans l'URL : lien partageable, bouton Retour du navigateur fonctionnel.  
  *Fonctions :* `CatalogView`, `resetFilters`, `changePage`, `submitSearch`, `filterPanel`
- **`frontend/src/views/catalog/CatalogView.test.jsx`** — Tests Vitest de CatalogView.
- **`frontend/src/views/catalog/catalogParams.js`** — Lecture / écriture des filtres du catalogue dans l'URL (SCRUM-35) : /catalogue?q=carton&category=3,5&type=product&region=12&price_min=0&price_max=5000&delay=7&rating=4&sort=price_asc&page=2 …  
  *Fonctions :* `list`, `readFilters`, `get`, `toApiParams`, `applyChanges`, `activeFilterCount`
- **`frontend/src/views/catalog/catalogParams.test.js`** — Tests Vitest de catalogParams.
- **`frontend/src/views/disputes/DisputePage.jsx`** — Litige vu par l'acheteur et le fournisseur (SCRUM-117 / F23).  
  *Fonctions :* `DisputePage`
- **`frontend/src/views/disputes/Disputes.test.jsx`** — Tests Vitest de Disputes.
- **`frontend/src/views/disputes/MyDisputesPage.jsx`** — « Mes litiges » du porteur et « Litiges reçus » du fournisseur (SCRUM-67). Un litige s'ouvre depuis la commande concernée ; la décision appartient à l'administration.  
  *Fonctions :* `MyDisputesPage`
- **`frontend/src/views/disputes/MyDisputesPage.test.jsx`** — Tests Vitest de MyDisputesPage.
- **`frontend/src/views/disputes/NewDisputePage.jsx`** — « Signaler un problème » sur une commande (SCRUM-117 / F23).  
  *Fonctions :* `fileProblem`, `NewDisputePage`, `addFiles`, `submit`
- **`frontend/src/views/errors/ErrorBoundary.jsx`** — Fichier de page impossible à télécharger : connexion coupée ou nouvelle version déployée.  
  *Fonctions :* `isLoadingFailure`, `ErrorBoundary`
- **`frontend/src/views/errors/ErrorBoundary.test.jsx`** — Tests Vitest de ErrorBoundary.
- **`frontend/src/views/errors/ForbiddenView.jsx`** — Composant / module « ForbiddenView ».  
  *Fonctions :* `ForbiddenView`
- **`frontend/src/views/errors/NotFoundView.jsx`** — Composant / module « NotFoundView ».  
  *Fonctions :* `NotFoundView`
- **`frontend/src/views/messaging/ConversationList.jsx`** — Liste des conversations (SCRUM-59) : dernier message, contexte, non lus.  
  *Fonctions :* `Avatar`, `ConversationList`
- **`frontend/src/views/messaging/ConversationThread.jsx`** — Fil d'une conversation (SCRUM-60). À monter avec key={conversationId} : changer de conversation repart de zéro. onActivity : prévient la liste (nouveau message, lecture).  
  *Fonctions :* `Bubble`, `ConversationThread`, `onVisible`, `onScroll`, `loadOlder`, `handleSend`, `handleDownload`
- **`frontend/src/views/messaging/MessageComposer.jsx`** — Saisie d'un message avec pièce jointe. Entrée envoie, Maj + Entrée va à la ligne.  
  *Fonctions :* `MessageComposer`, `chooseFile`, `submit`, `onKeyDown`
- **`frontend/src/views/messaging/MessagingPage.jsx`** — Messagerie (SCRUM-59 à SCRUM-61) : conversations à gauche, fil à droite ; sur mobile, l'un ou l'autre selon l'adresse.  
  *Fonctions :* `MessagingPage`
- **`frontend/src/views/messaging/MessagingPage.test.jsx`** — Tests Vitest de MessagingPage.
- **`frontend/src/views/messaging/messageUtils.js`** — Contrôle avant l'envoi (l'API revérifie). Renvoie un message d'erreur ou null.  
  *Fonctions :* `attachmentError`, `formatFileSize`, `mergeMessages`, `messagePreview`, `dayLabel`, `startOf`, `timeLabel`, `shortDate`
- **`frontend/src/views/messaging/messageUtils.test.js`** — Tests Vitest de messageUtils.
- **`frontend/src/views/notifications/NotificationPreferencesPage.jsx`** — Préférences de notification (SCRUM-63 / F15) : une case par événement et par canal. Les e-mails critiques (commande validée, compte validé/refusé, litige) restent verrouillés : la règle est aussi appliquée côté serveur.  
  *Fonctions :* `NotificationPreferencesPage`, `apply`, `applyConsent`, `toggle`, `handleSave`
- **`frontend/src/views/notifications/NotificationPreferencesPage.test.jsx`** — Tests Vitest de NotificationPreferencesPage.
- **`frontend/src/views/notifications/NotificationsPage.jsx`** — Centre de notifications (SCRUM-62 / F15) : liste paginée, marquage lu, et accès aux préférences par événement / canal.  
  *Fonctions :* `relativeTime`, `NotificationsPage`, `handleOpen`, `handleMarkAll`
- **`frontend/src/views/orders/OrderTrackingPage.jsx`** — Composant / module « OrderTrackingPage ».  
  *Fonctions :* `OrderTrackingPage`, `handleAdvanceStatus`, `handleConfirmReceipt`, `handleSubmitReview`, `handleDownloadDocument`
- **`frontend/src/views/orders/OrderTrackingPage.test.jsx`** — Tests Vitest de OrderTrackingPage.
- **`frontend/src/views/products/OrderBox.jsx`** — Sélection mémorisée avant la connexion, si elle concerne ce produit.  
  *Fonctions :* `readPending`, `savePending`, `clearPending`, `isValidQuantity`, `QuantityField`, `OrderBox`, `toggleAddon`, `order`, `confirm`, `closeSummary`
- **`frontend/src/views/products/ProductPage.jsx`** — Fiche détaillée d'un produit (SCRUM-36, maquette V3) : accessible sans connexion. Commande directe (SCRUM-51) : voir OrderBox.  
  *Fonctions :* `Gallery`, `DetailRow`, `SimilarProducts`, `ProductPage`
- **`frontend/src/views/products/ProductPage.test.jsx`** — Tests Vitest de ProductPage.
- **`frontend/src/views/supplier/CompanyProfilePage.jsx`** — Valeurs du formulaire à partir du profil renvoyé par l'API.  
  *Fonctions :* `formFromProfile`, `arrayErrors`, `CompanyProfilePage`, `updateField`, `syncHeader`, `handleSave`, `handleLogo`, `handlePublish`, `handleAddDocument`, `handleOpenDocument`
- **`frontend/src/views/supplier/CompanyProfilePage.test.jsx`** — Tests Vitest de CompanyProfilePage.
- **`frontend/src/views/supplier/MyQuotesPage.jsx`** — Devis envoyés par le fournisseur et leur statut (SCRUM-46 / F13).  
  *Fonctions :* `MyQuotesPage`
- **`frontend/src/views/supplier/PendingAccountPage.jsx`** — « Compte en attente de validation » (SCRUM-27, maquette A5) : un fournisseur arrive ici après avoir vérifié son e-mail, tant qu'un administrateur n'a pas validé son dossier. Dossier refusé : motif + renvoi de documents, …  
  *Fonctions :* `PendingAccountPage`, `handleResubmitted`, `handleLogout`, `LoadingSkeleton`
- **`frontend/src/views/supplier/PendingAccountPage.test.jsx`** — Tests Vitest de PendingAccountPage.
- **`frontend/src/views/supplier/ReceivedTenderDetailPage.jsx`** — Détail d'une demande reçue et envoi du devis unique (SCRUM-44, SCRUM-45 / F13). Un seul devis par demande, modifiable tant qu'il n'est pas accepté.  
  *Fonctions :* `formFromQuote`, `ReceivedTenderDetailPage`, `update`, `handleSubmit`, `handleAttachment`
- **`frontend/src/views/supplier/ReceivedTendersPage.jsx`** — Demandes reçues par le fournisseur, classées par pertinence (SCRUM-44 / F13). Le score vient de la diffusion automatique (catégorie, région, mots-clés).  
  *Fonctions :* `ReceivedTendersPage`, `updateFilter`
- **`frontend/src/views/supplier/ReportReviewModal.jsx`** — Signaler un avis abusif à l'administrateur (SCRUM-66).  
  *Fonctions :* `ReportReviewModal`, `submit`
- **`frontend/src/views/supplier/SupplierAiPage.jsx`** — Assistant IA du fournisseur (SCRUM-77 / SCRUM-78 / F30) : rédaction et reformulation de la description d'un produit. Le texte reste modifiable.  
  *Fonctions :* `SupplierAiPage`, `submit`
- **`frontend/src/views/supplier/SupplierAiPage.test.jsx`** — Tests Vitest de SupplierAiPage.
- **`frontend/src/views/supplier/SupplierDashboard.jsx`** — Tableau de bord fournisseur (SCRUM-120 / F26) : revenu, commandes, taux de devis acceptés, produits les plus vus/vendus, demandes reçues et derniers avis.  
  *Fonctions :* `plural`, `DashboardSkeleton`, `Stars`, `SupplierDashboard`
- **`frontend/src/views/supplier/SupplierDashboard.test.jsx`** — Tests Vitest de SupplierDashboard.
- **`frontend/src/views/supplier/SupplierOrdersPage.jsx`** — Composant / module « SupplierOrdersPage ».  
  *Fonctions :* `SupplierOrdersPage`, `handleTabChange`, `handleDownloadDocument`
- **`frontend/src/views/supplier/SupplierOrdersPage.test.jsx`** — Tests Vitest de SupplierOrdersPage.
- **`frontend/src/views/supplier/SupplierReviewsPage.jsx`** — Gestion des formulaires de réponse : { [reviewId]: string } …  
  *Fonctions :* `SupplierReviewsPage`, `handleOpenReplyForm`, `handleReported`, `handleCancelReply`, `handleReplyChange`, `handleSubmitReply`
- **`frontend/src/views/supplier/SupplierReviewsPage.test.jsx`** — Tests Vitest de SupplierReviewsPage.
- **`frontend/src/views/supplier/pending/RejectionNotice.jsx`** — Encadré rouge clair avec le motif du refus donné par l'administrateur (SCRUM-27).  
  *Fonctions :* `RejectionNotice`
- **`frontend/src/views/supplier/pending/ResubmitDocumentsForm.jsx`** — « Renvoyer mes documents » après un refus (SCRUM-27) : type + fichier. L'API repasse alors le dossier « en attente » ; onSubmitted reçoit la réponse ({ message, … }).  
  *Fonctions :* `ResubmitDocumentsForm`, `handleFile`, `handleSubmit`
- **`frontend/src/views/supplier/pending/TimelineStep.jsx`** — Une étape de la frise du dossier fournisseur (SCRUM-27). state : 'done' (coche verte)  
  *Fonctions :* `'current' (pastille orange)`
- **`frontend/src/views/supplier/pending/ValidationTimeline.jsx`** — Frise en 4 étapes du dossier fournisseur (maquette A5) : compte créé → e-mail vérifié → validation par l'administrateur → publication du profil.  
  *Fonctions :* `ValidationTimeline`
- **`frontend/src/views/supplier/products/MyProductsPage.jsx`** — Mes produits (SCRUM-34, maquette F2) : onglets par statut avec compteurs, filtre catégorie, tableau (cartes sur mobile), actions Modifier / Voir le motif, menu « … » Dépublier / Supprimer.  
  *Fonctions :* `formatDay`, `FeaturedBadge`, `ActionsMenu`, `close`, `PrimaryAction`, `priceOf`, `stockOf`, `MyProductsPage`, `setParam`, `unpublish`, `openFeature`, `confirmFeature`, `unfeature`, `confirmDelete`
- **`frontend/src/views/supplier/products/MyProductsPage.test.jsx`** — Tests Vitest de MyProductsPage.
- **`frontend/src/views/supplier/products/ProductAiText.jsx`** — « Rédiger » et « Reformuler » dans l'éditeur de produit (SCRUM-78 / F30), avec comparaison avant / après. Rédiger part de la description saisie (quelques mots) ou, à défaut, du titre.  
  *Fonctions :* `ProductAiText`, `generate`
- **`frontend/src/views/supplier/products/ProductAiText.test.jsx`** — Tests Vitest de ProductAiText.
- **`frontend/src/views/supplier/products/ProductFormPage.jsx`** — Ajouter / modifier un produit ou un service (SCRUM-33, maquette F3). « Enregistrer le brouillon » ou « Publier » ; un produit retiré par l'administrateur reste retiré. L'estimation de prix IA (S7) et la mise en avant ne …  
  *Fonctions :* `formFromProduct`, `imagesFromProduct`, `toPayload`, `number`, `flattenErrors`, `Field`, `Card`, `ProductFormPage`, `update`, `changeImages`, `save`
- **`frontend/src/views/supplier/products/ProductFormPage.test.jsx`** — Tests Vitest de ProductFormPage.
- **`frontend/src/views/supplier/products/ProductImagesField.jsx`** — Photos d'un produit (SCRUM-33, maquette F3) : 4 vignettes au plus, la première est l'image principale. Ajout par clic ou glisser-déposer de fichiers ; réordonnancement par glisser-déposer des vignettes (ou boutons ← → au …  
  *Fonctions :* `checkFiles`, `ProductImagesField`, `addFiles`, `move`, `remove`
- **`frontend/src/views/supplier/profile/CategoryTags.jsx`** — Catégories proposées : étiquettes retirables + « + Ajouter » (liste groupée par catégorie parente). Ces catégories servent à la diffusion des demandes aux fournisseurs concernés.  
  *Fonctions :* `CategoryTags`, `available`, `add`
- **`frontend/src/views/supplier/profile/CompanyInfoForm.jsx`** — Champs texte du profil : nom, description, secteur, gouvernorat, téléphone, e-mail.  
  *Fonctions :* `CompanyInfoForm`, `update`
- **`frontend/src/views/supplier/profile/CoverageZones.jsx`** — Zones couvertes : une case à cocher par gouvernorat. Sert aussi à la diffusion des demandes.  
  *Fonctions :* `CoverageZones`, `toggle`
- **`frontend/src/views/supplier/profile/DocumentsCard.jsx`** — Documents justificatifs : liste + statut par document, et ajout d'un document (envoyé dès la sélection du fichier, il arrive « en attente »).  
  *Fonctions :* `DocumentsCard`, `chooseFile`, `handleChange`
- **`frontend/src/views/supplier/profile/Field.jsx`** — Message d'erreur de validation affiché sous un champ (première erreur renvoyée par l'API).  
  *Fonctions :* `FieldError`, `Field`
- **`frontend/src/views/supplier/profile/LogoUploader.jsx`** — Logo de l'entreprise : envoyé dès la sélection du fichier. Initiales si aucun logo.  
  *Fonctions :* `LogoUploader`, `handleChange`
- **`frontend/src/views/supplier/profile/ReputationCard.jsx`** — Réputation (lecture seule) : note moyenne et nombre d'avis, calculés à partir des avis (EP07).  
  *Fonctions :* `ReputationCard`
- **`frontend/src/views/supplier/profile/ValidationCard.jsx`** — Statut de validation (lecture seule) + interrupteur « Profil publié » (bloqué tant que non validé).  
  *Fonctions :* `ValidationCard`
- **`frontend/src/views/suppliers/SupplierPublicPage.jsx`** — Fiche publique d'un fournisseur (SCRUM-37, maquette V4) : accessible sans connexion. Onglets Produits / Avis / À propos dans l'URL (?tab=avis), pagination des produits et des avis (?page=2).  
  *Fonctions :* `Card`, `About`, `ProductsTab`, `ReviewsTab`, `SupplierPublicPage`, `selectTab`, `changePage`
- **`frontend/src/views/suppliers/SupplierPublicPage.test.jsx`** — Tests Vitest de SupplierPublicPage.
- **`frontend/src/views/suppliers/SuppliersPage.jsx`** — Annuaire public des fournisseurs : uniquement les fournisseurs validés et publiés. Recherche, région (siège ou zone couverte), catégorie et tri sont gardés dans l'adresse (?q=…&region_id=…), pour partager une recherche.  
  *Fonctions :* `SupplierCard`, `SuppliersPage`, `update`
- **`frontend/src/views/suppliers/SuppliersPage.test.jsx`** — Tests Vitest de SuppliersPage.
### Frontend — racine (`frontend/`)

*Pourquoi / comment :* Configuration du projet web.

- **`frontend/vite.config.js`** — Configuration Vite : plugin React, Tailwind, alias @ → src, configuration Vitest.
### Mobile — racine (`mobile/`)

*Pourquoi / comment :* Configuration du projet Expo.

- **`mobile/.claude/settings.json`** — Réglages locaux de l'outil Claude Code pour le dossier mobile.
- **`mobile/.gitignore`** — Fichiers ignorés de l'application mobile.
- **`mobile/AGENTS.md`** — Consignes pour les assistants de code travaillant sur le mobile.
- **`mobile/App.js`** — Onglets de chaque espace : les 4 écrans les plus utilisés + « Menu », qui reprend toute la barre latérale du site.  
  *Fonctions :* `tab`, `SpaceTabs`, `PublicTabs`, `SpaceScreens`, `Root`, `App`
- **`mobile/LICENSE`** — Licence du squelette Expo.
- **`mobile/README.md`** — Lancement de l'application mobile (Expo Go, APK).
- **`mobile/app.json`** — Configuration Expo : nom TijaraLink, identifiant tn.tijaralink.app, icônes, écran de démarrage, plugins, projet EAS.
- **`mobile/eas.json`** — Profils EAS Build : preview (APK interne) et production (App Bundle), URL de l'API de production.
- **`mobile/index.js`** — registerRootComponent calls AppRegistry.registerComponent('main', () => App); …
- **`mobile/package-lock.json`** — Versions exactes des paquets mobiles.
- **`mobile/package.json`** — Dépendances mobiles (Expo, React Native, React Navigation, SecureStore…) et scripts de lancement.
### Mobile — code source (`mobile/src/`)

*Pourquoi / comment :* Application Expo/React Native : mêmes données et mêmes rôles que le site.

- **`mobile/src/api/client.js`** — Appelée sur une réponse 401 (jeton expiré) : l'application revient à l'écran public.  
  *Fonctions :* `setToken`, `setUnauthorizedHandler`, `api`, `mediaUrl`
- **`mobile/src/auth/AuthContext.js`** — Le jeton est rangé dans le trousseau du téléphone ; le navigateur n'en a pas, il utilise le stockage local.  
  *Fonctions :* `AuthProvider`, `useAuth`
- **`mobile/src/components/Icon.js`** — Icônes au trait (mêmes dessins que la barre latérale du site).  
  *Fonctions :* `Icon`, `LogoMark`
- **`mobile/src/components/PromptModal.js`** — Fenêtre de saisie (motif d'un refus, réponse à un avis…). onSubmit(texte) peut lever une erreur : son message est affiché et la fenêtre reste ouverte.  
  *Fonctions :* `PromptModal`, `confirm`
- **`mobile/src/components/ui.js`** — Carte blanche arrondie (sections du tableau de bord, listes).  
  *Fonctions :* `Logo`, `Card`, `SectionTitle`, `Button`, `Badge`, `statusTone`, `WelcomeBanner`, `Sparkline`, `KpiCard`, `ProductCard`, `Loading`, `ErrorBox`, `Empty`, `ListRow`
- **`mobile/src/config.js`** — Adresse de l'API Laravel, dans cet ordre : 1. EXPO_PUBLIC_API_URL (fichier mobile/.env), si elle est donnée ; 2. sinon, l'adresse du PC qui fait tourner « npx expo start » : Expo Go la connaît déjà (c'est elle qui sert l …  
  *Fonctions :* `devHost`
- **`mobile/src/hooks/useApi.js`** — Charge une ressource de l'API : { data, loading, refreshing, error, reload, refresh }. Synchronisation avec le site : les données sont rechargées sans indicateur à chaque retour sur l'écran (une action faite sur le site …  
  *Fonctions :* `useApi`
- **`mobile/src/navigation/menus.js`** — Menus de chaque espace (mêmes rubriques et icônes que la barre latérale du site).
- **`mobile/src/screens/AccountScreen.js`** — Compte : identité, raccourcis vers le site, assistant IA, déconnexion.  
  *Fonctions :* `initials`, `AccountScreen`
- **`mobile/src/screens/AdminScreens.js`** — Onglets de filtre (statut) au-dessus d'une liste.  
  *Fonctions :* `Filters`, `Action`, `SupplierValidationScreen`, `done`, `UsersScreen`, `CategoriesScreen`, `ProductControlScreen`, `ReportedReviewsScreen`, `moderate`, `AuditScreen`
- **`mobile/src/screens/AssistantScreen.js`** — Identifiant de conversation (UUID v4) exigé par l'API du chatbot.  
  *Fonctions :* `uuid`, `AssistantScreen`, `send`
- **`mobile/src/screens/BuyerScreens.js`** — Confirmation (Alert sur téléphone, confirm() dans le navigateur).  
  *Fonctions :* `confirmAction`, `Field`, `Chips`, `PublishTenderScreen`, `set`, `submit`, `FavoritesScreen`, `remove`, `DisputesScreen`
- **`mobile/src/screens/CatalogScreen.js`** — Catalogue : recherche, filtre par catégorie, grille de produits avec photos, pagination au défilement.  
  *Fonctions :* `CatalogScreen`, `chooseCategory`, `runSearch`
- **`mobile/src/screens/DashboardScreen.js`** — Cartes d'indicateurs selon le rôle (mêmes chiffres et couleurs que le site).  
  *Fonctions :* `toInput`, `lastDays`, `kpisFor`, `trend`, `Activity`, `DashboardScreen`
- **`mobile/src/screens/HomeScreen.js`** — Accueil : recherche, chiffres clés, catégories, catalogue avec photos, étapes, bandeau fournisseurs.  
  *Fonctions :* `categoryIcon`, `HomeScreen`, `search`
- **`mobile/src/screens/ListScreens.js`** — Liste générique : chargement, erreur, tirer pour rafraîchir, état vide.  
  *Fonctions :* `ApiList`, `BuyerTendersScreen`, `SupplierTendersScreen`, `SupplierProductsScreen`, `OrdersScreen`, `NotificationsScreen`, `markAll`
- **`mobile/src/screens/LoginScreen.js`** — Connexion (même maquette que le site : accueil, atouts, carte blanche avec icônes).  
  *Fonctions :* `Field`, `LoginScreen`, `submit`, `openWeb`
- **`mobile/src/screens/MenuScreen.js`** — Menu complet de l'espace : mêmes rubriques et entrées que la barre latérale du site.  
  *Fonctions :* `MenuScreen`
- **`mobile/src/screens/MessagingScreens.js`** — Liste des conversations (mêmes que la messagerie du site), rafraîchie toutes les 10 secondes.  
  *Fonctions :* `Avatar`, `ConversationsScreen`, `ConversationScreen`, `send`
- **`mobile/src/screens/ProductScreen.js`** — Fiche produit : photos, prix, fournisseur, description et derniers avis.  
  *Fonctions :* `ProductScreen`
- **`mobile/src/screens/SupplierScreens.js`** — Mes devis (fournisseur).  
  *Fonctions :* `QuotesScreen`, `ReviewsScreen`, `CompanyProfileScreen`
- **`mobile/src/sync/UnreadContext.js`** — Compteurs partagés avec le site (messages et notifications non lus) : relus toutes les 30 secondes, au retour au premier plan de l'application, et après chaque lecture.  
  *Fonctions :* `UnreadProvider`, `useUnread`
- **`mobile/src/theme.js`** — Couleurs et rayons repris du site web.
- **`mobile/src/utils/format.js`** — « 2026-11-27… » → « 27/11/2026 ».  
  *Fonctions :* `formatNumber`, `formatAmount`, `formatPrice`, `formatDate`, `timeAgo`, `plural`, `rows`
### Racine du dépôt (`/`)

- **`render.tijaralink.yaml`** — Blueprint Render « TijaraLink » : base PostgreSQL Render + API Docker + site statique, IA Gemini, réinitialisation de démo.
- **`render.tijaralink.yaml`** — Blueprint Render « TijaraLink » : base PostgreSQL, API Docker et site statique ; démo et photos créées au premier démarrage.

