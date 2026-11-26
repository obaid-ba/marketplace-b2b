# Déploiement — TiDB, Render, Mailjet, Cloudinary

Branche de référence : `feature/SCRUM-129-deploiement` (ticket **SCRUM-129 / F35**).
Objectif : une mise en production reproductible, gratuite, sans disque local persistant pour les fichiers utilisateurs.

## Environnements

Trois environnements, trois usages distincts — et **un seul** utilise la vraie base :

| Environnement | Pour qui | Base de données | Accès |
|---|---|---|---|
| **Démo publique** (`marketplace-web-v2.onrender.com`) | toute l'équipe, le jury, les testeurs | TiDB Cloud (production) | URL seule, aucun compte à créer, aucune installation |
| **Local** (`localhost:5173`) | développement, modifications de code | PostgreSQL 17 dans un conteneur Docker | `./deploy/start.sh`, rien à configurer |
| **TiDB via Docker** (exceptionnel) | reproduire un bug lié à la base réelle | TiDB Cloud (production) | identifiants de production, cf. [`deploy/README.md`](../deploy/README.md#brancher-la-stack-sur-tidb-déconseillé) |

> **Règle d'équipe** : pour tester l'application, on utilise l'URL Render — pas Docker, pas TiDB.
> Docker sert à *modifier le code* ; la base TiDB ne se manipule que depuis Render, sauf cas exceptionnel.

## Architecture de production

```mermaid
flowchart LR
  U["Navigateur<br/>équipe · jury · testeurs"] --> S

  subgraph Render["Render (plan gratuit)"]
    S["Static Site<br/>marketplace-web-v2.onrender.com<br/>React buildé par Vite"]
    A["Web Service Docker<br/>marketplace-api-v2.onrender.com<br/>nginx + PHP-FPM + supervisor"]
  end

  S -->|"fetch VITE_API_URL/api<br/>HTTPS + CORS"| A
  A -->|"pgsql + TLS obligatoire<br/>sslmode=require"| T[("TiDB Cloud Starter<br/>protocole PostgreSQL")]
  A -->|"SMTP 587 (STARTTLS)"| M["Mailjet<br/>e-mails transactionnels"]
  A -->|"URLs signées"| C["Cloudinary<br/>photos, logos, justificatifs"]
```

| Composant | Rôle | Détail |
|---|---|---|
| **TiDB Cloud Starter** | Base de données managée | Compatible **protocole PostgreSQL** (port 5432), TLS obligatoire |
| **Render Web Service** `marketplace-api-v2` | API Laravel en Docker | `deploy/api/Dockerfile`, nginx + PHP-FPM + supervisor, healthcheck `/up` |
| **Render Static Site** `marketplace-web-v2` | Front React (build Vite) | réécriture SPA vers `index.html`, `VITE_API_URL` → API |
| **Mailjet** | E-mails transactionnels | SMTP `in-v3.mailjet.com:587`, expéditeur validé |
| **Cloudinary** | Stockage des fichiers | images/logos publics, documents privés servis par URL signée |

Le dépôt fournit l'infrastructure dans [`deploy/`](../deploy/) et le blueprint Render [`render.yaml`](../render.yaml).

> **Plan gratuit Render** : pas de worker ni de cron dédiés, pas de disque persistant,
> `QUEUE_CONNECTION=sync`, et le service s'endort après inactivité (premier appel ~30-60 s).
> Conséquence directe : le **pre-deploy command n'existe pas sur le plan gratuit**
> (il est réservé aux instances payantes). Les migrations tournent donc **au démarrage du
> conteneur**, via `RUN_MIGRATIONS=true` et [`deploy/api/entrypoint.sh`](../deploy/api/entrypoint.sh).

## 1. Base de données (TiDB Cloud)

TiDB Cloud propose une instance **compatible protocole PostgreSQL** : Laravel s'y connecte
avec le driver `pgsql`, exactement comme sur un PostgreSQL classique. Aucun code spécifique,
juste deux précautions : **TLS obligatoire** et un socle de migrations portable.

1. Dans [TiDB Cloud](https://tidbcloud.com) → cluster **Starter** → **Connect** : notez le host,
   le port (`5432`), l'utilisateur et le mot de passe (réinitialisable à tout moment).
   Le host ressemble à `<cluster>.gateway01.<region>.prod.aws.pg.tidbcloud.com`.
2. La base utilisée est `postgres` (base par défaut). Ne pas mettre le nom d'une base qui
   n'existe pas : l'attente de la base dans l'entrypoint échouerait avec un message explicite.
3. Renseigner les variables côté Render (voir §4) :

| Variable | Valeur |
|---|---|
| `DB_CONNECTION` | `pgsql` |
| `DB_HOST` | host TiDB (secret Render) |
| `DB_PORT` | `5432` |
| `DB_DATABASE` | `postgres` |
| `DB_USERNAME` / `DB_PASSWORD` | identifiants TiDB (secrets Render) |
| `DB_SSLMODE` | `require` |
| `DB_URL` | **vide** (sinon elle écrase les variables ci-dessus) |

### Explorer la base et les tables

```bash
psql "host=<cluster>.gateway01.<region>.prod.aws.pg.tidbcloud.com port=5432 \
      user=<utilisateur> dbname=postgres sslmode=require"
```

```sql
\dt                                   -- liste des tables
\d+ products                          -- structure d'une table
select count(*) from products;        -- 47 avec les données de démo
select email, role from users order by id limit 10;
select * from migrations order by id desc limit 5;
```

GUI équivalentes : DBeaver, pgAdmin, TablePlus — connexion PostgreSQL, port `5432`,
base `postgres`, schéma `public`, **SSL = require**.

### Portabilité des migrations

Trois écarts TiDB ont déjà été corrigés, à garder en tête pour toute nouvelle migration :

- `->change()` sur une colonne `id` génère `DROP IDENTITY` : **non supporté** par TiDB.
  La migration `2026_11_12_000000_add_registration_fields_to_account_tables` a été rendue
  idempotente (`hasColumn` + SQL direct) ;
- les contraintes `CHECK` générées par les enums doivent être supprimées explicitement
  (`2026_11_18_000000_fix_supplier_documents_type_check_for_pgsql`) ;
- `PostgresGrammar::compileChange()` ne met **pas à jour** ces `CHECK` lors d'un `->change()`.
  La migration `2026_11_26_000000_drop_legacy_enum_checks_for_pgsql` retire les contraintes
  obsolètes de `notification_preferences.channel` (`whatsapp`) et de
  `orders.status` / `order_status_history.status` (`expédiée`) ; sans elle, ces valeurs
  seraient refusées par la base de production.

Les tests CI tournent sur SQLite **et** sur PostgreSQL 17 pour détecter les écarts avant la production.

## 2. E-mails (Mailjet)

Mailjet remplace Brevo : compte gratuit, 6 000 e-mails/mois et 200/jour, SMTP standard.
La configuration applicative ne change pas (Laravel `smtp`), seuls l'hôte et les identifiants changent.

### 2.1 Créer et valider l'expéditeur

Aucun envoi n'est possible tant que l'expéditeur (ou le domaine) n'est pas validé.
Dans **Account Settings → Senders & Domains** :

- **Option rapide — adresse unique** : *Add a sender address* → saisir l'adresse
  (ex. `no-reply@tijaralink.test` si vous possédez le domaine, sinon votre adresse réelle).
  Mailjet envoie un e-mail d'activation : cliquez sur le lien, connectez-vous, c'est validé.
  Suffisant pour une démo, mais **DKIM n'est pas actif** → risque de spam.
- **Option recommandée — domaine entier** : *Add a domain* (ex. `marketplace.tn`), puis ajouter
  le **TXT de validation** et les enregistrements **SPF / DKIM** fournis par Mailjet dans la zone
  DNS du domaine. Propagation : de quelques minutes à 48 h. Une fois validé, toutes les adresses
  `*@marketplace.tn` sont utilisables et les e-mails sont signés.

### 2.2 Récupérer les identifiants SMTP

**Account Settings → API Key Management** (ou *SMTP and SEND API settings*) :

- **API Key** = identifiant SMTP → `MAIL_USERNAME`
- **Secret Key** = mot de passe SMTP → `MAIL_PASSWORD` (affiché **une seule fois**, à copier immédiatement)

Mailjet est un hôte global unique : `in-v3.mailjet.com`.

### 2.3 Variables

| Variable | Valeur |
|---|---|
| `MAIL_MAILER` | `smtp` |
| `MAIL_HOST` | `in-v3.mailjet.com` |
| `MAIL_PORT` | `587` (STARTTLS) — ou `465` avec `MAIL_SCHEME=smtps` |
| `MAIL_USERNAME` | API Key Mailjet |
| `MAIL_PASSWORD` | Secret Key Mailjet |
| `MAIL_FROM_ADDRESS` | adresse **validée** chez Mailjet |
| `MAIL_FROM_NAME` | `TijaraLink` |

Ces valeurs vont dans **Render → Environment** (secrets) et, pour des tests locaux réels,
dans `deploy/.env` (jamais commité).

### 2.4 Vérifier que ça marche

1. **Redéployer** le service API (Render applique les nouvelles variables au déploiement).
2. Déclencher un envoi :
   ```bash
   curl -X POST https://marketplace-api-v2-8gr1.onrender.com/api/auth/forgot-password \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d '{"email":"sana@tijaralink.test"}'
   ```
   Réponse attendue : `200`. (L'endpoint répond toujours 200 : il ne révèle pas si l'adresse existe.)
3. **Parcours complet de vérification de compte** (c'est ce lien que l'équipe utilisera) :
   ```bash
   curl -X POST https://marketplace-api-v2-8gr1.onrender.com/api/auth/register/buyer \
        -H "Content-Type: application/json" -H "Accept: application/json" \
        -d '{"name":"Test Mailjet","email":"<votre-adresse>","password":"Password123!","password_confirmation":"Password123!","phone":"+216 20 000 000","region_id":1}'
   ```
   → l'e-mail contient un lien signé vers `https://marketplace-web-v2.onrender.com/email/verifier?...`.
   Cliquer dessus vérifie le compte ; l'API renvoie ensuite `email_verified_at` non nul.
   Sans clic, `POST /api/auth/email/resend` (1 par minute) régénère un lien.
4. **Côté Mailjet** : *Statistics → Events* (ou *Real-time*) montre l'e-mail en `sent` / `delivered` /
   `opened`. Statut `blocked` ou `error` = expéditeur non validé ou quota atteint.
5. **Côté Render** : en cas d'échec SMTP, l'erreur apparaît dans les logs du service
   (`npm`/SMTP 535 = mauvais identifiants, 550 = expéditeur refusé).

> **Piège connu** : un compte Mailjet neuf peut être limité aux destinataires vérifiés tant que
> la vérification d'identité du compte n'est pas terminée. Symptôme : authentification OK, mais
> l'e-mail n'arrive jamais (événement en erreur côté Mailjet). Terminer la vérification du compte
> ou envoyer d'abord vers une adresse validée.

## 3. Fichiers (Cloudinary)

Les fichiers utilisateurs ne sont **pas** stockés sur le disque du conteneur (éphémère sur Render).
Le pilote est sélectionné par `MEDIA_DRIVER` :

- `local` : disques Laravel (`storage/app/public` et `storage/app/private`) — développement et tests, volume Docker `api-storage` ;
- `cloudinary` : production.

Configuration :

1. Créer un compte Cloudinary et récupérer `CLOUDINARY_URL` (`cloudinary://api_key:api_secret@cloud_name`).
2. Dans **Settings → Security** :
   - activer **Allow delivery of PDF and ZIP files** (justificatifs et pièces jointes),
   - s'assurer que les assets `authenticated` sont autorisés (le backend signe les URLs).
3. Variables : `MEDIA_DRIVER=cloudinary`, `CLOUDINARY_URL=...`.

Comportement :

- **Images et logos** : ressource `image`, type `upload` (URL publique CDN) ;
- **Documents privés** (justificatifs fournisseurs…) : ressource `raw`, type `authenticated`,
  servis par l'API via une **URL signée** (aucun accès public direct) ;
- les clés stockées en base sont préfixées (`image:...`, `raw:...`).

Le seeder de démonstration respecte le pilote : avec `MEDIA_DRIVER=cloudinary`, les 42 photos
et les logos sont envoyés sur Cloudinary au premier démarrage (le disque local de Render est
éphémère) ; en local ils restent sur le disque `public`. Les PDF de commande et les exports
sont encore générés sur le disque local : ils sont recréés à la demande pour les PDF
(`OrderDocumentService`) et doivent être téléchargés rapidement pour les exports.

## 4. Render

### Déploiement via Blueprint

1. Pousser la branche, puis **Render Dashboard → Blueprints → New Blueprint Instance** sur le
   dépôt (fichier `render.yaml`). Un `git push` sur la branche redéploie automatiquement.
2. Créer le groupe d'environnement `marketplace-api-env` et renseigner les secrets marqués
   `sync: false` :

| Variable | Note |
|---|---|
| `APP_KEY` | `php artisan key:generate --show` (`base64:...`, 32 octets). L'entrypoint **refuse** un placeholder |
| `DB_HOST` / `DB_DATABASE` / `DB_USERNAME` / `DB_PASSWORD` | TiDB Cloud (cf. §1) |
| `CLOUDINARY_URL` | `cloudinary://...` |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | API Key / Secret Key Mailjet |
| `MAIL_FROM_ADDRESS` | adresse validée chez Mailjet |

3. Site statique `marketplace-web-v2` : `VITE_API_URL=https://marketplace-api-v2-8gr1.onrender.com/api`.
4. `healthCheckPath: /up` ; `preDeployCommand` n'est **pas** disponible en plan gratuit →
   `RUN_MIGRATIONS=true` (migrations au démarrage). `SEED_DEMO_DATA=true` insère la démo
   **uniquement si la table `users` est vide** : un redémarrage ne duplique rien.

### Détails runtime

- L'image API (`deploy/api/Dockerfile`) embarque nginx + PHP-FPM derrière supervisor et écoute sur `$PORT` (exigence Render).
- Healthcheck : `GET /up` (200).
- Proxy TLS pris en compte (`TrustProxies`), URLs forcées en HTTPS en production.
- `QUEUE_CONNECTION=sync` : les jobs (diffusion des demandes, e-mails) s'exécutent dans la requête — pas de worker.
- `php artisan cache:clear` au démarrage, sinon la page d'accueil sert des compteurs figés (cache 10 min).

## 5. Cycle de déploiement

```mermaid
flowchart LR
  D["git push<br/>feature/SCRUM-129-deploiement"] --> G["GitHub"]
  G -->|"autoDeployTrigger: commit"| B["Build de l'image Docker<br/>deploy/api/Dockerfile"]
  B --> P["Entrypoint<br/>attente de la base<br/>validation d'APP_KEY"]
  P --> M["migrate --force<br/>(RUN_MIGRATIONS=true)"]
  M --> S["db:seed si users vide<br/>(SEED_DEMO_DATA=true)"]
  S --> L["API prête sur le port 8000<br/>/up → 200 · service live"]
```

Journal type d'un déploiement réussi :

```text
▶ Attente de la base de données…
  base joignable
▶ Migrations
  ... 27 s DONE
▶ Données de démonstration
  Database\Seeders\CatalogueDemoSeeder ... DONE
▶ API prête sur le port 8000
Your service is live 🎉
```

Si un `git push` ne déclenche rien : vérifier `autoDeployTrigger` du service et que la branche
surveillée est bien celle poussée. Un redéploiement manuel se fait depuis **Manual Deploy →
Deploy latest commit**.

## 6. Développement local

La stack locale reproduit la production (PostgreSQL 17, worker, Mailpit) mais reste isolée :

```bash
./deploy/start.sh            # build + démarrage (web :5173, api :8000, mailpit :8025)
./deploy/stop.sh             # arrêt (données conservées)
./deploy/stop.sh --reset     # remise à zéro (volumes supprimés)
```

Détails, réglages et override TiDB : [`deploy/README.md`](../deploy/README.md).

Comptes de démonstration (mot de passe `password`) créés au premier démarrage sur base vide :
`admin@tijaralink.test`, `buyer1@tijaralink.test` …, `supplier1@tijaralink.test` …

## 7. Opérations

- **Migrations** : automatiques au démarrage (`migrate --force`). En manuel, depuis le Shell Render :
  `php artisan migrate --force`. Les rendre **idempotentes** et portables (cf. §1).
- **Caches** : l'entrypoint régénère `config:cache` (et tente `route:cache` / `view:cache`, ignoré
  faute de vues Blade) puis vide le cache applicatif.
- **Rollback applicatif** : redéployer le commit précédent depuis Render. Les migrations ne sont pas
  annulées automatiquement — prévoir une migration corrective plutôt qu'un `migrate:rollback`.
- **Vérification rapide** : `GET /up` (200), `GET /api/home` (compteurs non nuls),
  connexion avec un compte de démo, réception d'un e-mail Mailjet.

## 8. Limites et points d'attention

- **Render gratuit** : cold start de 30-60 s après inactivité ; 750 h/mois ; bande passante limitée ;
  pas de worker, pas de cron, pas de pre-deploy, pas de disque persistant.
- **TiDB Cloud Starter** : quota de stockage et de connexions limité. Les tests locaux qui
  écrivent en masse doivent se faire sur le PostgreSQL Docker, pas sur TiDB.
- **Mailjet** : expéditeur validé obligatoire (sinon `550`), quota 200/jour, compte neuf éventuellement
  restreint aux destinataires vérifiés.
- **Cloudinary (gratuit)** : activer la livraison PDF/ZIP ; les URLs signées sont générées côté
  application, ce qui évite d'exposer les quotas API.
- **Pièces jointes des appels d'offres (S3)** : le flux d'upload/téléchargement des demandes est livré
  sur la branche/PR S3 ; le raccordement à `MediaStorage` doit être finalisé après fusion de la PR #18.

## 9. Décisions liées

Les choix Neon → TiDB, Brevo/Resend → Mailjet et « Postgres local pour développer » sont
consignés dans [`docs/decisions.md`](decisions.md) (D25 à D28).
