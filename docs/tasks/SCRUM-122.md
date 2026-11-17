# SCRUM-122 — Dashboard admin + export des statistiques (F28, Sprint 6, 11 pts, owner : Aziz Grolli)

Statut : **IN PROGRESS — lot 1 livré (backend + React du tableau de bord, sans export) le 2026-11-16 ; export en attente de Q7**
Histoires détaillées liées : SCRUM-70 (dashboard admin), SCRUM-75 (export)
Dépend de (doit déjà exister) : `users`, `supplier_profiles`, `orders`, `order_items`, `tenders`, `categories`,
`disputes` (S5), file de jobs, notifications (F15), `AuditLogger` (F24).

## Objectif

Donner à l'administrateur une vue consolidée de la plateforme (utilisateurs, fournisseurs, commandes, revenu),
des courbes d'évolution et les files à traiter, puis exporter les indicateurs en CSV/XLSX via la file de jobs.

## Critères d'acceptation (Jira)

### SCRUM-70
- [x] Utilisateurs actifs, fournisseurs validés, commandes, revenu global
- [x] Courbe d'évolution des inscriptions, commandes et demandes sur une période
- [x] File de validation des fournisseurs (réutilise F05)
- [ ] Signalements et litiges triés par urgence — litiges livrés ; signalements d'avis dépendent de F29
- [x] Catégories les plus actives
- [x] Emplacement vide pour les alertes d'anomalie (V2, SCRUM-86)

### SCRUM-75
- [ ] Choix de la période et des indicateurs (inscriptions, commandes, revenu, demandes, catégories)
- [ ] Export CSV et XLSX
- [ ] Export lourd traité par la file de jobs + notification quand le fichier est prêt

## Feuille de route (une étape = un commit)

1. [x] **Socle partagé** : `PeriodRangeRequest` (from/to, défaut 30 jours, max 366, `Africa/Tunis`), helpers d'agrégation, tests unitaires.
2. [x] **Tables S2–S5** : lecture via le Query Builder (`orders`, `tenders`, `products`, `disputes`) tant que leurs modèles Eloquent ne sont pas fusionnés — aucun stub, contrat JSON stable.
3. [x] **Agrégats** : service `AdminDashboardService` (KPI + séries + catégories), requêtes groupées et index.
4. [x] **Endpoint** `GET /api/admin/dashboard?from=&to=` (middleware `role:admin`), contrat JSON documenté, tests Feature (403 autres rôles, bornes de dates, agrégats).
5. [x] **File de validation / litiges urgents** dans la réponse.
6. [x] **React** : module `api/adminDashboard.js`, store Zustand, page « Tableau de bord administrateur » (KpiCard, Recharts, listes, états chargement/vide/erreur, 360 px), layout admin et déplacement de la validation fournisseurs vers `/admin/fournisseurs`.
7. [ ] **Export** (après Q7) : table `exports`, `POST /api/admin/exports` (202 + id), job, `GET /api/admin/exports/{id}` et `/download`, notification, AuditLog, purge à 7 jours.
8. [x] **Tests frontend** (Vitest) et **documentation** API/ROADMAP/PROGRESS ; smoke Playwright à ajouter à la clôture du sprint.

## Fichiers livrés

- `backend/app/Http/Requests/Dashboard/PeriodRangeRequest.php`
- `backend/app/Services/Dashboard/AdminDashboardService.php`
- `backend/app/Http/Controllers/Api/Admin/AdminDashboardController.php`
- `backend/routes/api.php`
- `backend/tests/Feature/Admin/AdminDashboardTest.php`
- `backend/app/Jobs/GenerateStatisticsExport.php` (phase export, à venir)
- `frontend/src/api/adminDashboard.js`, `frontend/src/stores/adminDashboard.js`
- `frontend/src/utils/period.js`, `frontend/src/utils/money.js`
- `frontend/src/components/dashboard/` : `PeriodPicker`, `KpiCard`, `TimeSeriesChart`, `EmptyState`, `ErrorState`, `Skeleton`
- `frontend/src/layouts/AdminLayout.jsx`
- `frontend/src/views/admin/AdminDashboardView.jsx` + test
- `frontend/src/router/paths.js`, `frontend/src/router/routes.jsx` (+ tests)
- `docs/api/admin-dashboard.md`

## Résultats du lot 1 (2026-11-16)

- Backend : `php artisan test` → **127 tests / 626 assertions, tous verts** ; `AdminDashboardTest` → 6 tests / 39 assertions.
- Frontend : `npm test` → **88 tests / 12 fichiers, tous verts** ; `npm run build` → OK (chunk dashboard 390 kB à cause de Recharts, chargé à la demande).
- Vérification réelle MySQL : `GET /api/admin/dashboard` → **200 en 57 ms** sur la base `marketplace_b2b` (transaction de contrôle annulée, aucune donnée laissée).
- Pint appliqué sur les fichiers PHP modifiés.
- PR [#16](https://github.com/obaid-ba/marketplace-b2b/pull/16) ouverte vers `develop` ; les deux jobs GitHub Actions (API Laravel, React) sont verts.

## Interventions humaines

- **Q1** : répondu le 2026-11-16 (« go ») → option A, parties indépendantes d'abord.
- **Q3** : définitions des KPI et devise — **en attente**, définitions provisoires documentées (voir `decisions.md` D8).
- **Q4** : règles commandes/litiges — en attente ; les agrégats suivent `orders`/`order_items`.
- **Q7** : paquet d'export, driver de file, worker, rétention — **bloque le volet export**.
- **Q9** : seeder de performance — en attente ; mesure < 1 s sur volume réel impossible pour l'instant.
- **Q10** : « go » accordé pour ce lot ; **push/PR/Jira restent à autoriser**.

## Risques / questions

- Les tables `orders`, `tenders`, `products` et `disputes` sont lues via le Query Builder : à remplacer par les modèles Eloquent dès que S2–S5 arrivent sur `develop` (contrat JSON inchangé).
- La cible < 1 s n'a pas encore de jeu de données de référence (Q9) ; la requête réelle répond en 57 ms sur la base locale actuelle (volumes faibles).
- L'export XLSX nécessite une dépendance non approuvée à ce jour (Q7).

## Definition of Done

- [ ] Critères Jira cochés (cœur du dashboard uniquement ; export et signalements d'avis en attente)
- [x] Tests Feature (happy path, 403, IDOR, bornes) — performance < 1 s à rejouer sur le jeu de données Q9
- [ ] Tests frontend + smoke Playwright — component tests livrés, Playwright à ajouter
- [x] Aucune fuite de données entre rôles (routes admin réservées, tests 401/403)
- [x] États chargement/vide/erreur, classes responsive 360 px, textes en français
- [ ] Export : job, notification, AuditLog, téléchargement privé, purge
- [x] Documentation API + ROADMAP + PROGRESS + decisions
- [ ] PR ouverte **après autorisation** ; commits `SCRUM-122: ...`
