# Feuille de route — SoukPro / Marketplace B2B

Dernière mise à jour : **2026-11-18**.

## Vue d'ensemble

| Sprint | Fenêtre | Objectif | État |
|---|---|---|---|
| S0 — Cadrage | 17–31 oct. 2026 | Besoins, modèle de données, stack | Terminé |
| S1 — Comptes et accès | 12–14 nov. 2026 | Inscription, connexion, vérification e-mail, comptes | En cours (F01–F03, F05 terminés ; F04 livré) |
| S2 — Catalogue | 15–28 nov. 2026 | Produits, catégories, recherche, favoris | En cours |
| S3 — Appels d'offres et devis | 16 nov.–12 déc. 2026 | Demandes, devis, notifications | En cours |
| S4 — Commandes et paiement | 12–26 déc. 2026 | Commandes, Stripe, factures | À venir |
| S5 — Messagerie et avis | 26 déc. 2026–9 janv. 2027 | Messagerie, avis, litiges, AuditLog, AiClient | À venir |
| **S6 — Dashboards et admin** | **9–23 janv. 2027** | **Dashboards 3 rôles, modération, litiges, export, IA de base** | **En cours — F28 cœur livré (16 nov.)** |
| S7 — IA avancée, livraison | 23 janv.–6 févr. 2027 | IA avancée, PWA, déploiement | En cours (préparation déploiement SCRUM-129 : Neon/Render/Resend/Cloudinary) |

## Sprint 6 — Dashboards et admin (38 pts)

Objectif Jira : *« Dashboards des 3 rôles, modération, litiges, export, IA de base »*.
Branche de travail : `Dashboards` (alignée sur `origin/develop` au 16 nov. 2026).

| Feature | Jira | Titre | Pts | Propriétaire | État | Dépendances / blocages |
|---|---|---|---|---|---|---|
| F26 | SCRUM-120 | Dashboard fournisseur (API + React) | 8 | Basmala Aouida | PLANIFIÉ | Modèles `Order`, `Quote`, `ProductView`, `Review`, `TenderRecipient`, notifications, messages (S3/S4/S5) |
| F27 | SCRUM-121 | Dashboard porteur de projet (API + React) | 5 | ahmedbenkhmis07 | PLANIFIÉ | Modèles `Order`, `Tender`, `Quote`, `Favorite` (S2–S4) |
| F28 | SCRUM-122 | Dashboard admin + export des statistiques (API + React) | 11 | Aziz Grolli | **EN COURS — cœur livré (API + React), export bloqué Q7** | Modèles S2–S5 remplacés par Query Builder ; file de jobs ; `Dispute` (S5) ; approbations export |
| F29 | SCRUM-123 | Back-office : modération catalogue + avis signalés | 6 | JAPOUNI | PLANIFIÉ | `Product`, `Review`, `ReviewReport`, `AuditLogger`, notifications (S2/S4/S5) |
| F30 | SCRUM-124 | Assistants de rédaction IA (demande + fiche produit) | 8 | oumayma | PLANIFIÉ | `AiClient` + `AIInteraction` (F25 / SCRUM-80, S5), clé fournisseur LLM ou mode simulé |

### Détail du premier lot — SCRUM-122 (F28, cœur sans export) — livré le 2026-11-16

- [x] `PeriodRangeRequest` partagé (`from`, `to`, défaut 30 jours, max 366 jours, `Africa/Tunis`).
- [x] Agrégats admin : utilisateurs actifs, fournisseurs validés, commandes, revenu global.
- [x] Série temporelle des inscriptions / commandes / demandes.
- [x] File de validation fournisseurs (réutilise F05) et catégories les plus actives.
- [x] Emplacement vide pour les alertes d'anomalie (V2) ; recommandations réservées à F27.
- [x] Composants React partagés : `PeriodPicker`, `KpiCard`, `TimeSeriesChart` (Recharts), `EmptyState`, `ErrorState`, `Skeleton`.
- [x] Tests backend (rôles, 401/403, agrégats, bornes de dates) et frontend ; **127 tests backend / 88 tests frontend verts**.
- [x] Page React responsive (360 px) avec états chargement / vide / erreur ; layout admin et validation fournisseurs déplacée vers `/admin/fournisseurs`.
- [x] Endpoint réel vérifié sur MySQL : `200` en **57 ms** ; contrat dans [`docs/api/admin-dashboard.md`](api/admin-dashboard.md).
- [ ] Mesure < 1 s sur le jeu de données de performance (bloquée par Q9).

L'export CSV/XLSX (SCRUM-75), les litiges (F23) et l'IA (F30) suivent après réponses aux questions Q1–Q10
(voir `docs/OPEN_QUESTIONS.md`).

## Suivi

- Journal chronologique : [`PROGRESS.md`](PROGRESS.md)
- Décisions : [`decisions.md`](decisions.md)
- Questions ouvertes : [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md)
- Feuilles de tâche : [`tasks/`](tasks/)
