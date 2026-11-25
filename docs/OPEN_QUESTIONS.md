# Questions ouvertes — Sprint 6

Statut au **2026-11-16** : Q1 répondu (option A) ; Q3/Q5 appliquées en provisoire ; les autres questions restent en attente. Aucune écriture Jira effectuée.

| # | Sujet | Question | Statut |
|---|---|---|---|
| Q1 | Prérequis / calendrier | S4 et S5 ne sont pas terminés. Faut-il (a) démarrer les parties indépendantes, (b) attendre, ou (c) créer des versions minimales des tables manquantes ? | **Répondu 2026-11-16 : option A** |
| Q2 | Stories détaillées 67, 71, 73, 76, 79, 80 | Sont-elles livrées par F23/F24/F25 (S5) ou à construire en S6 ? Puis-je proposer un re-lien dans Jira ? | En attente |
| Q3 | Définitions des KPI | Valider : revenu = somme des `OrderItem` des commandes payées et `clôturée` ; en cours = `validée`…`livrée` ; terminées = `clôturée` ; taux d'acceptation = devis acceptés / envoyés sur la période ; utilisateurs actifs = comptes vérifiés non suspendus connectés sous 30 jours. Devise et format des montants ? | En attente — définitions **provisoires** appliquées (D9) |
| Q4 | Règles métier 2 et 4 | Confirmer : commande multi-produits, un seul fournisseur. Fenêtre de litige : de `en livraison` à `livrée` (les statuts « expédiée »/« confirmée » n'existent pas). | En attente |
| Q5 | Urgence des litiges et signalements | Proposer : litiges ouverts d'abord, du plus ancien au plus récent, puis par montant de commande ; avis signalés par nombre de signalements puis ancienneté. Confirmer ? | Tri proposé appliqué le 2026-11-25 (D24), à confirmer |
| Q6 | Champs IA pour F29 | `reviews.ai_suspicion_score` existe déjà ; `products.ai_flag_reason` existe mais pas `ai_flagged_at`. Puis-je ajouter `ai_flagged_at` (nullable, rempli en S7) ? | En attente |
| Q7 | Export | Approuver le paquet XLSX/CSV (proposition : `maatwebsite/excel`), le driver de file (`database`, table `jobs` déjà présente) et le mode d'exécution du worker en dev ; conservation des fichiers 7 jours. | **XLSX livré sans dépendance le 2026-11-25 (D23)** ; durée de conservation des fichiers en attente |
| Q8 | Fournisseur LLM | Quel fournisseur/modèle ? Fournir la clé dans `backend/.env` (`AI_PROVIDER`, `AI_API_KEY`, `AI_TIMEOUT`, `AI_RATE_LIMIT`), ou confirmer « mode simulé uniquement ». Valeur de la limite par utilisateur ? | **Mode simulé livré le 2026-11-24 (F25, D18)**, limite provisoire 20/h ; fournisseur et clé en attente |
| Q9 | Jeu de données de performance | Puis-je ajouter un seeder de développement générant ~10 000 commandes et ~100 000 vues produit pour vérifier la cible < 1 s ? | En attente |
| Q10 | Workflow | « Go » après chaque feuille de route ou auto-go pour le sprint ? Puis-je pousser des branches, ouvrir des PR et modifier les statuts Jira ? Conserver les dates S6 du 9 au 23 janvier 2027 ? | « Go » accordé pour le lot 1 ; **push/PR/Jira en attente** |

## Précisions déjà vérifiées dans le dépôt

- `reviews.ai_suspicion_score` et `products.ai_flag_reason` sont **déjà** dans les migrations.
- La table `jobs` existe (driver `database` possible sans installation).
- Export XLSX sans paquet (D23).
- Aucun `AiClient`, `AuditLogger`, modèle `Order`/`Tender`/`Product`/`Review`/`Dispute` n'est présent sur `develop`.
