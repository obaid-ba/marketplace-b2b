# Sécurité et confidentialité — audit du sprint 7

Audit réalisé pour SCRUM-90 / SCRUM-128 (F34). Chaque point est vérifié par un test automatisé lancé sur chaque pull request.

| Exigence | Mesure en place | Vérifié par |
|---|---|---|
| Aucun accès aux données d'un autre utilisateur (IDOR) | Policies (`TenderPolicy`, `ProductPolicy`, `QuotePolicy`…) et contrôles de propriété dans les contrôleurs ; un porteur ou un fournisseur reçoit 403/404 sur la demande, les devis, la commande, les documents PDF, les pièces jointes ou les suggestions IA d'un autre | `tests/Feature/Security/SecurityAuditTest.php` |
| Contrôle de propriété avant la validation | Les requêtes produit (`SaveProductRequest`, photos) vérifient la propriété dans `authorize()` : le produit d'un autre fournisseur répond 403 sans détailler ses champs (corrigé pendant l'audit) | idem |
| CSRF | Authentification par jeton Bearer dans l'en-tête `Authorization`, jamais par cookie : pas de requête forgée possible depuis un autre site | conception (D3) |
| XSS | Aucun `dangerouslySetInnerHTML` dans le frontend : React échappe tout texte ; l'API répond en JSON avec `X-Content-Type-Options: nosniff` et `Content-Security-Policy: default-src 'none'` ; `X-Frame-Options: DENY` contre le clickjacking | recherche dans `frontend/src` + `SecurityAuditTest` |
| Jeton jamais dans l'URL | Jeton stocké dans `localStorage`/`sessionStorage` et envoyé en en-tête ; seuls les liens signés d'e-mail (vérification, mot de passe oublié) portent un jeton à usage unique | recherche dans `frontend/src` |
| Validation stricte des entrées | Form Requests sur chaque endpoint d'écriture ; réponses 422 en français (`bootstrap/app.php`) | `ErrorResponseTest`, tests de chaque fonctionnalité |
| Limitation de débit | Connexion : 5 essais / minute par e-mail et IP ; inscription, mot de passe oublié, messages, IA (20 générations / heure / utilisateur, `AI_RATE_LIMIT`) ; 429 avec délai | `SecurityAuditTest::test_limitation_de_debit_sur_la_connexion_et_l_ia` |
| Fichiers téléversés | Types et tailles vérifiés ; pièces jointes, documents fournisseurs et pièces de litige sur le disque privé `local` (`storage/app/private`), téléchargés uniquement via un endpoint qui contrôle l'accès ; seules les photos produits et logos sont publics | `SecurityAuditTest::test_les_fichiers_televerses_restent_prives` |
| Mots de passe | Hachés (bcrypt, cast `hashed`) ; jamais renvoyés par l'API | `SecurityAuditTest::test_les_mots_de_passe_sont_haches` |
| Secrets | Uniquement dans `backend/.env` (non versionné) ; `.env.example` sans valeur sensible ; aucune clé dans le code | revue du dépôt |
| Erreurs | En production (`APP_DEBUG=false`), aucune trace technique : message 500 générique | `ErrorResponseTest::test_500_sans_detail_technique_en_production` |
| IA | Les textes des utilisateurs sont transmis comme données, jamais comme consignes ; chaque sortie est validée avant d'être enregistrée ; le chatbot ne lit aucune donnée de la base | tests `tests/Feature/Ai/*` |

## Tests de bout en bout

`frontend/e2e/` (Playwright, `npm run test:e2e`) : parcours 1 (porteur : publier une demande, comparer, accepter) et parcours 2 (fournisseur : demande reçue, envoi du devis), sur ordinateur et à 360 px, avec l'API simulée dans le navigateur. Côté API, `tests/Feature/Journey/TenderToReviewJourneyTest.php` rejoue le parcours complet demande → devis → commande → suivi → clôture → avis avec les règles métier.

## Points restant à traiter au déploiement

- Forcer HTTPS (l'en-tête `Strict-Transport-Security` est envoyé dès que la requête arrive en HTTPS).
- `APP_DEBUG=false`, `APP_ENV=production` et une `APP_KEY` propre à l'environnement.
- Restreindre `config/cors.php` à l'adresse du frontend déployé.
