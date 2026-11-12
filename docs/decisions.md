# Journal des décisions

L'énoncé demande de « noter les décisions techniques importantes » et de « tenir un journal des décisions ». Chaque décision : date, décision, raison. Les règles métier en suspens sont suivies dans Jira (**SCRUM-20**) et recopiées ici une fois tranchées.

## Décisions techniques

| # | Date | Décision | Raison |
|---|---|---|---|
| D1 | 2026-10-17 | Périmètre du backlog : cahier des charges de 42 pages (messagerie interne en temps réel, le profil fournisseur sert de boutique) | Document le plus complet et le plus cohérent avec le modèle de données |
| D2 | 2026-11-06 | Stack : Laravel 12 (API) + Vue 3 (SPA) + MySQL — *front remplacé par React, voir D6* | Compétences de l'équipe, écosystème complet (files de tâches, Reverb, Sanctum) |
| D3 | 2026-11-06 | Authentification par jeton Bearer Sanctum (pas de cookies) | Un seul mécanisme pour le web et le mobile ; API et front sur des domaines différents |
| D4 | 2026-11-06 | Monorepo : `backend/` + `frontend/` dans un seul dépôt | Une seule PR peut toucher l'API et l'interface ; un seul historique pour le jury |
| D5 | 2026-11-06 | Code en anglais, interface en français | Conventions Laravel/React en anglais ; utilisateurs francophones |
| D6 | 2026-11-08 | Frontend : React 19 + React Router + Zustand à la place de Vue 3 + Vue Router + Pinia (Vite, Axios et Tailwind conservés) | Choix de l'équipe ; migration faite tôt, quand le front ne contenait que l'authentification et les tableaux de bord vides |
| D7 | 2026-11-12 | Enums de statut : noms de cas en `UPPER_SNAKE` (`EMAIL_TO_VERIFY`, `ACTIVE`, `SUSPENDED`, `DEACTIVATED`, `PENDING`…), comme dans les migrations et les seeders. `UserRole` garde ses cas `Supplier`/`Buyer`/`Admin` | La migration `users` et le seeder référencent déjà `UserStatus::ACTIVE` et `UserStatus::EMAIL_TO_VERIFY` : c'est la convention majoritaire des enums de statut du projet. Le modèle `User` et la factory utilisaient `Active`/`Suspended`, ce qui provoquait une erreur PHP à l'exécution |

## Règles métier (SCRUM-20)

| # | Question | Décision | Date |
|---|---|---|---|
| R1 | À l'acceptation d'un devis, les autres sont-ils refusés et la demande clôturée ? | Oui. Le devis accepté passe à « accepté », tous les autres devis de la demande passent à « refusé » et la demande passe à « clôturée ». Aucun nouveau devis n'est possible sur une demande clôturée. *(Stories : SCRUM-46, 48)* | 2026-11-08 |
| R2 | Achat direct : une commande = un produit = un fournisseur ? | Une commande = **plusieurs produits** = un seul fournisseur, sans panier. Une commande a donc un seul fournisseur et une ou plusieurs lignes (OrderItem). *(Stories : SCRUM-51, 57)* | 2026-11-08 |
| R3 | Qui clôture la commande ? | L'acheteur clôture la commande en confirmant la réception. Pas de clôture automatique dans la première version. L'avis sur le fournisseur est ajouté après la clôture. *(Stories : SCRUM-56, 57, 64)* | 2026-11-08 |
| R4 | Dans quels statuts un litige peut-il être ouvert ? | Uniquement par l'acheteur, à partir du statut « expédiée » (ou « confirmée » s'il n'y a pas de statut d'expédition) jusqu'à « livrée ». Impossible une fois la commande « clôturée ». *(Stories : SCRUM-67, 73)* | 2026-11-08 |
| R5 | Mobile : PWA ou application dédiée ? | PWA (site installable sur le téléphone, responsive), pas d'application native. Raison : une seule base de code, livrable dans les délais. *(Story : SCRUM-88)* | 2026-11-08 |
| R6 | Notifications WhatsApp / Messenger : incluses ou non ? | Canaux de base : notifications dans l'application + e-mail. WhatsApp : option prévue au dernier sprint, avec repli automatique sur l'e-mail si l'envoi échoue. Messenger : hors périmètre, documenté comme évolution possible. *(Story : SCRUM-62)* | 2026-11-08 |