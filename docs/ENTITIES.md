# Marketplace B2B

Entités métier du modèle de données

Projet d'intégration - ISET Djerba - Licence informatique, 3e année

Ces entités sont déduites du document **« Les pages de la plateforme — Marketplace B2B »** (45 pages, 4 profils) : chaque entité est reliée aux pages qui en ont besoin. Elles servent de base pour vérifier les besoins métier avant de rédiger le backlog (épics, user stories, critères d'acceptation) et les sprints.

**Contenu :** 1. Entités par domaine (dont champs détaillés d'inscription) - 2. Valeurs de statut - 3. Données calculées (sans table) - 4. Règles métier à valider - 5. Écarts avec la première version.

## 1. Entités par domaine

31 entités. Les attributs communs (id, created_at, updated_at) ne sont pas répétés.

### 1. Comptes et accès

| Entité | Attributs principaux | Relations | Pages concernées |
|---|---|---|---|
| User | email, mot de passe, rôle (fournisseur / porteur / admin), statut (e-mail à vérifier, actif, suspendu, désactivé), email_verified_at, nom, téléphone, suppression douce | 1-1 avec SupplierProfile ou BuyerProfile | Inscriptions, Connexion, Paramètres, Gestion des utilisateurs |
| SupplierProfile | user_id, nom de l'entreprise, logo, description, secteur, region_id, coordonnées, **is_published**, validation_status (en attente / validé / refusé), motif de refus, validé par / le, note moyenne, nombre d'avis | N-1 Region ; N-N Category et Region (couverture) ; 1-N Product, Quote | Inscription fournisseur, Profil de l'entreprise, Fiche fournisseur, Validation des fournisseurs |
| BuyerProfile | user_id, organisation ou projet représenté, secteur | 1-N Tender, Order ; N-N Favorite | Inscription porteur de projet, Tableau de bord |
| SupplierDocument | supplier_id, type (registre de commerce, certification), fichier, statut, envoyé le | N-1 SupplierProfile | Inscription fournisseur (étape 3), Compte en attente, Validation des fournisseurs |
| NotificationPreference | user_id, type d'événement, canal (e-mail / sur le site), activé | N-1 User | Paramètres du compte |

### Comptes et accès : champs détaillés à l'inscription

Les attributs du tableau ci-dessus restent valables. Les champs ci-dessous les complètent ; ils vont au-delà du document d'origine et sont une proposition à valider en équipe. **Oui** = obligatoire à l'inscription ; **Non** = optionnel (complétable dans le profil) ; **Système** = renseigné par l'application.

#### User (commun à tous les rôles)

| Champ | Type | Obligatoire |
|---|---|---|
| nom | chaîne | Oui |
| prénom | chaîne | Oui |
| email | chaîne, unique | Oui |
| téléphone | chaîne (+216, 8 chiffres) | Oui |
| mot de passe | haché | Oui |
| rôle | énumération : fournisseur, porteur, admin | Système |
| statut | énumération : e-mail à vérifier, actif, suspendu, désactivé | Système |
| email_verified_at | date | Système |
| avatar | chemin du fichier | Non |
| suppression douce | date | Système |

#### BuyerProfile (porteur de projet)

| Champ | Type | Obligatoire |
|---|---|---|
| user_id | clé étrangère User (1-1) | Système |
| type de porteur | énumération : individu, startup, entreprise, association, institution | Oui |
| organisation ou nom du projet | chaîne | Oui |
| fonction (poste) | chaîne | Non |
| CIN | chaîne, 8 chiffres, unique | Non |
| secteur | chaîne ou clé étrangère Category | Oui |
| region_id | clé étrangère Region | Oui |
| délégation / ville | chaîne | Non |
| adresse | chaîne | Non |
| site web | chaîne | Non |
| description du projet | texte | Non |
| matricule fiscal | chaîne | Non (si l'entité est enregistrée) |
| source de découverte | énumération : réseaux sociaux, bouche-à-oreille, événement, autre | Non |
| acceptation des CGU | booléen + date | Oui |

#### SupplierProfile (fournisseur)

| Champ | Type | Obligatoire |
|---|---|---|
| user_id | clé étrangère User (1-1) | Système |
| raison sociale | chaîne | Oui |
| forme juridique | énumération : personne physique, SARL, SUARL, SA, auto-entrepreneur, coopérative | Oui |
| matricule fiscal | chaîne, unique | Oui |
| numéro RNE / registre de commerce | chaîne, unique | Oui |
| année de création | année | Non |
| nombre d'employés | énumération : 1-5, 6-20, 21-50, 50+ | Non |
| secteur d'activité | chaîne | Oui |
| description | texte | Oui |
| logo | chemin du fichier | Non |
| adresse | chaîne | Oui |
| region_id | clé étrangère Region | Oui |
| délégation / ville | chaîne | Oui |
| email professionnel | chaîne | Non |
| téléphone professionnel | chaîne | Non |
| site web / réseaux sociaux | chaîne / JSON | Non |
| personne de contact : nom, fonction, téléphone | chaînes | Oui |
| délai de livraison moyen | entier (jours) | Non |
| conditions de paiement | texte | Non |
| validation_status | en attente, validé, refusé | Système |
| motif de refus, validé par / le | texte, clé étrangère User, date | Système |
| is_published | booléen | Système |
| note moyenne, nombre d'avis | décimal, entier | Système |

Relations à renseigner à l'inscription : catégories proposées (N-N avec Category) et régions couvertes (N-N avec Region).

#### SupplierDocument (étape 3 de l'inscription fournisseur)

| Champ | Type | Obligatoire |
|---|---|---|
| supplier_id | clé étrangère SupplierProfile | Système |
| type | énumération : registre de commerce (RNE), attestation fiscale / patente, CIN du gérant, certification | Oui |
| fichier | chemin du fichier | Oui |
| statut | énumération | Système |
| envoyé le | date | Système |

Documents requis : extrait du registre de commerce (RNE), attestation d'identification fiscale / patente, CIN du gérant. Les certifications (ISO, etc.) sont optionnelles.

#### Parcours et règles de validation proposés

- **Fournisseur (3 étapes) :** 1. Compte (nom, prénom, email, téléphone, mot de passe) - 2. Entreprise (raison sociale, forme juridique, matricule fiscal, RNE, région, adresse, contact, catégories, régions couvertes) - 3. Documents.
- **Porteur de projet :** un seul formulaire (compte + profil) ; les détails se complètent plus tard dans le profil.
- CIN : exactement 8 chiffres. Téléphone : 8 chiffres après +216.
- Matricule fiscal : 7 chiffres suivis d'une lettre de contrôle (des codes optionnels peuvent suivre) ; format exact à confirmer en équipe.
- Email, matricule fiscal et numéro RNE : uniques.
- CIN : donnée personnelle, optionnelle pour le porteur ; pour le fournisseur, stockée uniquement comme document envoyé.
- Coordonnées bancaires (RIB/IBAN) : non prévues, le paiement passe par Stripe.

### 2. Référentiels

| Entité | Attributs principaux | Relations | Pages concernées |
|---|---|---|---|
| Region | nom (gouvernorat) | 1-N SupplierProfile ; N-N couverture ; 1-N Tender | Filtres du catalogue, Inscription fournisseur, Demandes reçues |
| Category | parent_id, nom, position (réordonnable) | Auto-référence (sous-catégories) ; 1-N Product, Tender | Catalogue, Éditeur de produit, Gestion des catégories |

### 3. Catalogue

| Entité | Attributs principaux | Relations | Pages concernées |
|---|---|---|---|
| Product | supplier_id, category_id, type (produit / service), titre, description, prix, unité, stock, délai de disponibilité, statut (brouillon / publié / retiré), mis en avant jusqu'au, motif de signalement IA, motif de retrait | N-1 SupplierProfile, Category ; 1-N ProductImage, ProductView, OrderItem | Accueil, Catalogue, Fiche produit, Mes produits, Éditeur, Contrôle du catalogue |
| ProductImage | product_id, chemin, position | N-1 Product | Fiche produit, Éditeur de produit |
| ProductView | product_id, date, user_id (optionnel) | N-1 Product | Tableau de bord fournisseur (produits les plus consultés), Mes produits (nombre de vues) |
| Favorite | buyer_id, supplier_id | Table pivot BuyerProfile / SupplierProfile | Fiche produit, Fiche fournisseur, Fournisseurs favoris |

### 4. Appels d'offres et devis

| Entité | Attributs principaux | Relations | Pages concernées |
|---|---|---|---|
| Tender (demande) | buyer_id, titre, description, category_id, region_id, budget indicatif, délai souhaité, statut (ouverte / en négociation / clôturée / annulée), catégorie et mots-clés détectés par IA | 1-N Quote, TenderAttachment, TenderRecipient | Publier une demande, Mes demandes, Demandes reçues, Comparer les devis |
| TenderAttachment | tender_id, fichier | N-1 Tender | Publier une demande, Détail d'une demande |
| TenderRecipient | tender_id, supplier_id, score de pertinence, source (automatique / suggéré par IA / invité par l'acheteur), notifié le, vu le | N-1 Tender, SupplierProfile | Publier une demande, Fournisseurs favoris (inviter), Demandes reçues, Tableau de bord fournisseur |
| Quote (devis) | tender_id, supplier_id, montant, délai de livraison, conditions, commentaire, statut (envoyé / en négociation / accepté / refusé) ; unique (tender, supplier) | N-1 Tender, SupplierProfile ; 0-1 Order | Détail d'une demande, Mes devis, Comparer les devis |

### 5. Messagerie et notifications

| Entité | Attributs principaux | Relations | Pages concernées |
|---|---|---|---|
| Conversation | buyer_id, supplier_id, type de contexte (demande / devis / commande / direct), id du contexte | 1-N Message, ConversationParticipant | Messagerie, Fiche produit et Fiche fournisseur (Contacter) |
| ConversationParticipant | conversation_id, user_id, lu jusqu'à | N-1 Conversation, User | Messagerie (compteur de non lus) |
| Message | conversation_id, expéditeur, contenu, pièce jointe, envoyé le | N-1 Conversation | Messagerie (temps réel) |
| Notification | user_id, type (nouveau devis, message, commande validée, changement d'étape, compte validé, annonce retirée...), contenu, lu le | N-1 User | Notifications, cloche |

### 6. Commandes et paiement

| Entité | Attributs principaux | Relations | Pages concernées |
|---|---|---|---|
| Order | buyer_id, supplier_id, quote_id (nullable), origine (devis / catalogue), total, statut (validée / en préparation / en livraison / livrée / clôturée), statut de paiement | N-1 BuyerProfile, SupplierProfile ; 1-N OrderItem, OrderStatusHistory, Payment, Document | Comparer les devis, Fiche produit (Commander), Paiement, Suivi de la commande, Mes commandes |
| OrderItem | order_id, product_id (nullable), désignation, quantité, prix unitaire | N-1 Order, Product | Fiche produit, Paiement, Suivi de la commande |
| OrderStatusHistory | order_id, statut, changé par, date | N-1 Order | Suivi de la commande (ligne de suivi) |
| Payment | order_id, id Stripe, montant, statut, nombre de tentatives, raison de l'échec, payé le | N-1 Order | Paiement, Résultat du paiement, Suivi de la commande |
| Document | order_id, type (devis / facture), numéro, chemin du PDF, émis le | N-1 Order | Comparer les devis (devis PDF), Suivi de la commande, Mes commandes |

### 7. Avis et litiges

| Entité | Attributs principaux | Relations | Pages concernées |
|---|---|---|---|
| Review | order_id (unique), buyer_id, supplier_id, note 1 à 5, commentaire, réponse du fournisseur, statut (publié / signalé / masqué), score de suspicion IA, sentiment IA | N-1 Order ; 1-N ReviewReport | Laisser un avis, Fiche fournisseur, Mes avis, Avis signalés |
| ReviewReport | review_id, auteur (fournisseur), motif, statut, décision de l'admin | N-1 Review | Mes avis, Avis signalés |
| Dispute (litige) | order_id, ouvert par, motif, description, statut, admin assigné, décision, note de décision | 1-N DisputeAttachment ; N-1 Order | Signaler un problème, Gestion des litiges |
| DisputeAttachment | dispute_id, fichier | N-1 Dispute | Signaler un problème, Gestion des litiges |

### 8. IA et supervision

| Entité | Attributs principaux | Relations | Pages concernées |
|---|---|---|---|
| AIInteraction | user_id, fonctionnalité (rédaction, reformulation, matching, résumé de devis, estimation de prix, sentiment, chatbot), contexte, entrée, sortie, accepté (oui/non) | N-1 User | Publier une demande, Éditeur de produit, Comparer les devis, Fiche fournisseur, chatbot |
| AnomalyAlert | type de cible (compte, commande), id de la cible, type d'anomalie, score, statut | N-1 User ou Order | Tableau de bord administrateur |
| AuditLog | admin_id, action, cible, motif, date | N-1 User (admin) | Utilisateurs, Validation, Catalogue, Litiges, Avis signalés |

## 2. Valeurs de statut

| Entité | Champ | Valeurs |
|---|---|---|
| User | statut | e-mail à vérifier, actif, suspendu, désactivé |
| SupplierProfile | validation_status | en attente, validé, refusé (avec motif) |
| Product | statut | brouillon, publié, retiré |
| Tender | statut | ouverte, en négociation, clôturée, annulée |
| Quote | statut | envoyé, en négociation, accepté, refusé |
| Order | statut | validée, en préparation, en livraison, livrée, clôturée |
| Payment | statut | en attente, réussi, échoué |
| Review | statut | publié, signalé, masqué |
| Dispute | statut | ouvert, en cours, décidé |
| AnomalyAlert | statut | nouvelle, traitée, ignorée |

## 3. Données calculées (pas de table dédiée)

Chiffre d'affaires, dépenses, nombre de commandes, taux de conversion des devis, catégories les plus actives, nombre de produits par catégorie, courbes d'évolution, et export CSV/Excel : ces valeurs se calculent à partir des tables ci-dessus. La note moyenne et le nombre d'avis sont stockés sur SupplierProfile pour éviter un calcul à chaque affichage. Les tables du framework (jetons Sanctum, réinitialisation de mot de passe, file de tâches) sont fournies par Laravel.

## 4. Règles métier à valider

1. Un porteur de projet est actif dès que son e-mail est vérifié ; un fournisseur doit être validé par l'admin et peut préparer son profil sans le publier (is_published).

2. L'acceptation d'un devis crée la commande et le devis PDF avant le paiement. Que deviennent les autres devis du même appel d'offres (refusés automatiquement ?) et le statut de la demande (clôturée ?) ?

3. « Commander » sur une fiche produit : un seul produit par commande ? Recommandation : une commande par fournisseur.

4. Qui passe la commande à « clôturée » ? Cette étape débloque l'avis et la facture PDF. Suggestion : l'acheteur confirme la réception.

5. Contacter un fournisseur depuis une fiche produit ou une fiche fournisseur crée une conversation de type « direct », sans appel d'offres ni commande.

6. Un seul avis par commande clôturée ; le fournisseur peut y répondre une fois et le signaler à l'admin.

7. Dans quels statuts de commande un litige peut-il être ouvert ?

8. La suppression d'un compte est une suppression douce, pour conserver commandes, factures et avis.

9. Quand l'admin refuse un fournisseur, retire une annonce ou tranche un litige, une notification avec le motif est envoyée automatiquement et l'action est tracée dans AuditLog.

10. L'IA reste une aide à la décision : chaque sortie (résumé, estimation, suggestion) est enregistrée dans AIInteraction et modifiable par l'utilisateur.

## 5. Écarts avec la première version

| Élément | Changement | Raison |
|---|---|---|
| Shop | Supprimée | La fiche fournisseur et le profil de l'entreprise tiennent lieu de vitrine. |
| Project | Supprimée | Aucune page ne l'utilise. |
| ExternalChannel | Supprimée | WhatsApp/Messenger (énoncé) n'apparaît pas dans les pages. À rajouter, avec un 3e canal dans NotificationPreference, si cette fonction est conservée. |
| Region, SupplierCoverageRegion, SupplierCategory | Ajoutées | Filtre par région, zone couverte et catégories proposées. |
| TenderMatch | Devient TenderRecipient | Ajout du champ source (le porteur peut inviter un favori). |
| Quote | Modifiée | Nouveau statut « en négociation ». |
| Conversation | Modifiée | Nouveau type de contexte « direct ». |
| ConversationParticipant, DisputeAttachment | Ajoutées | Compteur de non lus ; pièces jointes des litiges. |
