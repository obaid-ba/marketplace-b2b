# Journal des décisions

L'énoncé demande de « noter les décisions techniques importantes » et de « tenir un journal des décisions ». Chaque décision : date, décision, raison. Les règles métier en suspens sont suivies dans Jira (**SCRUM-20**) et recopiées ici une fois tranchées.

## Décisions techniques

| # | Date | Décision | Raison |
|---|---|---|---|
| D1 | 2026-10-17 | Périmètre du backlog : cahier des charges de 42 pages (messagerie interne en temps réel, le profil fournisseur sert de boutique) | Document le plus complet et le plus cohérent avec le modèle de données |
| D2 | 2026-11-06 | Stack : Laravel 12 (API) + Vue 3 (SPA) + MySQL | Compétences de l'équipe, écosystème complet (files de tâches, Reverb, Sanctum) |
| D3 | 2026-11-06 | Authentification par jeton Bearer Sanctum (pas de cookies) | Un seul mécanisme pour le web et le mobile ; API et front sur des domaines différents |
| D4 | 2026-11-06 | Monorepo : `backend/` + `frontend/` dans un seul dépôt | Une seule PR peut toucher l'API et l'interface ; un seul historique pour le jury |
| D5 | 2026-11-06 | Code en anglais, interface en français | Conventions Laravel/Vue en anglais ; utilisateurs francophones |

## Règles métier (SCRUM-20)

| # | Question | Décision | Date |
|---|---|---|---|
| R1 | À l'acceptation d'un devis, les autres sont-ils refusés et la demande clôturée ? | *à trancher* | |
| R2 | Achat direct : une commande = un produit = un fournisseur ? | *à trancher* | |
| R3 | Qui clôture la commande ? | *à trancher* | |
| R4 | Dans quels statuts un litige peut-il être ouvert ? | *à trancher* | |
| R5 | Mobile : PWA ou application dédiée ? | *à trancher* | |
| R6 | Notifications WhatsApp / Messenger : incluses ou non ? | *à trancher* | |
