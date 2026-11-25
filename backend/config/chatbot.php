<?php

/*
| Guide de la plateforme fourni au chatbot (SCRUM-85 / EP10).
|
| Le chatbot répond UNIQUEMENT à partir de ces fiches : aucune donnée d'utilisateur n'est lue en base,
| il ne peut donc rien révéler d'un autre compte. Pour enrichir l'assistant, ajoutez ou complétez une fiche :
| - roles : rôles concernés (guest = visiteur non connecté) ;
| - keywords : mots qui orientent vers la fiche (sans accents ni pluriel inutiles) ;
| - links : pages proposées, sous la forme [libellé, chemin de l'application React].
*/
return [

    'welcome' => 'Bonjour ! Je suis l’assistant de TijaraLink. Posez-moi une question sur l’utilisation de la plateforme : publier un besoin, répondre à une demande, commander, payer, laisser un avis…',

    'fallback' => 'Je n’ai pas trouvé de réponse précise à cette question dans le guide de la plateforme. Essayez de reformuler (par exemple « comment publier une demande ? ») ou contactez l’équipe via la messagerie depuis une commande ou une fiche fournisseur.',

    // Nombre de messages précédents transmis pour le contexte (sans données personnelles).
    'history' => 6,

    'sections' => [
        'inscription' => [
            'title' => 'Créer un compte',
            'roles' => ['guest'],
            'keywords' => ['inscription', 'inscrire', 'creer', 'compte', 'rejoindre', 'enregistrer'],
            'answer' => 'Cliquez sur « S’inscrire » et choisissez votre profil. Le porteur de projet remplit un seul formulaire puis confirme son adresse e-mail. Le fournisseur s’inscrit en trois étapes (compte, entreprise, documents : RNE, attestation fiscale, CIN du gérant) ; son compte est ensuite vérifié par l’administrateur avant de pouvoir vendre.',
            'links' => [['S’inscrire', '/inscription']],
        ],
        'connexion' => [
            'title' => 'Connexion et mot de passe',
            'roles' => ['guest', 'buyer', 'supplier', 'admin'],
            'keywords' => ['connexion', 'connecter', 'mot', 'passe', 'oublie', 'identifiant', 'login', 'reinitialiser'],
            'answer' => 'Connectez-vous avec votre e-mail et votre mot de passe. En cas d’oubli, utilisez « Mot de passe oublié » : un lien valable 60 minutes vous est envoyé par e-mail. Vous pouvez changer votre mot de passe dans « Paramètres du compte ».',
            'links' => [['Se connecter', '/connexion'], ['Mot de passe oublié', '/mot-de-passe-oublie']],
        ],
        'validation' => [
            'title' => 'Validation du compte fournisseur',
            'roles' => ['supplier', 'guest'],
            'keywords' => ['validation', 'valide', 'attente', 'refuse', 'document', 'justificatif', 'verifier', 'approuve'],
            'answer' => 'Après l’inscription, l’administrateur vérifie vos documents. Tant que le dossier est « en attente », vous pouvez compléter votre profil d’entreprise sans le publier. En cas de refus, le motif est affiché et vous pouvez envoyer un nouveau justificatif. Une fois validé, vous accédez aux demandes, aux devis et à vos produits.',
            'links' => [['État de mon dossier', '/fournisseur/en-attente'], ['Profil de l’entreprise', '/fournisseur/profil']],
        ],
        'publier_demande' => [
            'title' => 'Publier un besoin (demande de devis)',
            'roles' => ['buyer', 'guest'],
            'keywords' => ['publier', 'demande', 'besoin', 'appel', 'offre', 'consultation', 'cahier', 'charge', 'nouvelle'],
            'answer' => 'Dans votre espace porteur, ouvrez « Mes demandes » puis « Publier une demande ». Indiquez un titre, décrivez votre besoin, choisissez la catégorie et la région, et ajoutez si besoin un budget, une date limite et des pièces jointes. Le bouton « Analyser ma demande » propose une catégorie et des fournisseurs à inviter. À la publication, les fournisseurs validés de la catégorie sont notifiés et vous envoient leurs devis.',
            'links' => [['Publier une demande', '/porteur/demandes/nouvelle'], ['Mes demandes', '/porteur/demandes']],
        ],
        'comparer_devis' => [
            'title' => 'Comparer et accepter un devis',
            'roles' => ['buyer'],
            'keywords' => ['comparer', 'devis', 'accepter', 'choisir', 'offre', 'proposition', 'prix', 'marche', 'resume'],
            'answer' => 'Ouvrez votre demande puis « Comparer les devis » : montant, délai, conditions et note de chaque fournisseur côte à côte, avec un résumé automatique et le prix habituel du marché quand l’historique est suffisant. L’IA ne choisit jamais à votre place. Accepter un devis crée la commande et le devis PDF ; les autres devis sont refusés et la demande est clôturée.',
            'links' => [['Mes demandes', '/porteur/demandes']],
        ],
        'repondre_demande' => [
            'title' => 'Répondre à une demande (fournisseur)',
            'roles' => ['supplier'],
            'keywords' => ['repondre', 'demande', 'recue', 'devis', 'envoyer', 'proposer', 'offre', 'pertinence'],
            'answer' => 'Les demandes qui correspondent à vos catégories et à votre zone apparaissent dans « Demandes reçues », classées par score de pertinence. Ouvrez une demande, consultez les pièces jointes, puis envoyez votre devis : montant, délai de livraison et conditions. Vous pouvez le modifier tant que le porteur ne l’a pas accepté et suivre vos réponses dans « Mes devis ».',
            'links' => [['Demandes reçues', '/fournisseur/demandes'], ['Mes devis', '/fournisseur/devis']],
        ],
        'produits' => [
            'title' => 'Gérer ses produits',
            'roles' => ['supplier'],
            'keywords' => ['produit', 'service', 'ajouter', 'catalogue', 'photo', 'image', 'publier', 'stock', 'prix', 'avant', 'promouvoir', 'visibilite'],
            'answer' => 'Dans « Mes produits », cliquez sur « Ajouter un produit » : titre, catégorie, description, prix, unité, stock et au moins une photo pour publier. Vous pouvez dépublier, modifier ou supprimer un produit, et le « Mettre en avant » 7, 14 ou 30 jours pour qu’il apparaisse sur l’accueil et en tête du catalogue.',
            'links' => [['Mes produits', '/fournisseur/produits'], ['Ajouter un produit', '/fournisseur/produits/nouveau']],
        ],
        'commander' => [
            'title' => 'Commander depuis le catalogue',
            'roles' => ['buyer', 'guest'],
            'keywords' => ['commander', 'acheter', 'catalogue', 'produit', 'achat', 'panier', 'quantite'],
            'answer' => 'Parcourez le catalogue, ouvrez une fiche produit, choisissez la quantité et cliquez sur « Commander ». Une commande regroupe des produits d’un seul fournisseur. Il faut être connecté avec un compte porteur de projet ; sinon vous serez redirigé vers la connexion puis ramené à la fiche.',
            'links' => [['Catalogue', '/catalogue']],
        ],
        'paiement' => [
            'title' => 'Paiement',
            'roles' => ['buyer'],
            'keywords' => ['payer', 'paiement', 'carte', 'echec', 'refuse', 'reessayer', 'stripe', 'facture'],
            'answer' => 'Après la création de la commande, vous êtes invité à la payer. Si le paiement échoue, la page de résultat explique pourquoi et propose de réessayer. Le devis PDF est disponible dès l’acceptation et la facture PDF à la clôture de la commande.',
            'links' => [['Mes commandes', '/porteur/commandes']],
        ],
        'suivi_commande' => [
            'title' => 'Suivre une commande',
            'roles' => ['buyer', 'supplier'],
            'keywords' => ['suivre', 'suivi', 'commande', 'statut', 'livraison', 'etape', 'expedie', 'preparation', 'cloturer', 'reception'],
            'answer' => 'Chaque commande passe par les étapes : validée, en préparation, en livraison, livrée puis clôturée. Le fournisseur fait avancer le statut depuis « Commandes reçues » ; le porteur suit chaque étape et clôture la commande en confirmant la réception. La clôture débloque l’avis et la facture.',
            'links' => [['Mes commandes (porteur)', '/porteur/commandes'], ['Commandes reçues (fournisseur)', '/fournisseur/commandes']],
        ],
        'avis' => [
            'title' => 'Avis et réputation',
            'roles' => ['buyer', 'supplier'],
            'keywords' => ['avis', 'note', 'etoile', 'commentaire', 'evaluer', 'reputation', 'signaler', 'repondre'],
            'answer' => 'Après la clôture d’une commande, le porteur peut laisser un seul avis (note de 1 à 5 et commentaire). Le fournisseur peut y répondre une fois et le signaler à l’administrateur s’il le juge abusif ; l’avis reste visible jusqu’à la décision. Un résumé des points forts et faibles apparaît sur la fiche fournisseur à partir de 3 avis.',
            'links' => [['Mes avis (fournisseur)', '/fournisseur/avis'], ['Mes commandes', '/porteur/commandes']],
        ],
        'litige' => [
            'title' => 'Signaler un problème (litige)',
            'roles' => ['buyer', 'supplier'],
            'keywords' => ['litige', 'probleme', 'reclamation', 'defaut', 'abime', 'conforme', 'rembourser', 'plainte'],
            'answer' => 'Un litige peut être ouvert par le porteur quand la commande est en livraison ou livrée, avant sa clôture : depuis la commande, choisissez « Signaler un problème », décrivez-le et joignez des photos. L’administrateur examine le dossier et prend une décision motivée, notifiée aux deux parties.',
            'links' => [['Mes litiges (porteur)', '/porteur/litiges'], ['Litiges reçus (fournisseur)', '/fournisseur/litiges']],
        ],
        'messagerie' => [
            'title' => 'Messagerie',
            'roles' => ['buyer', 'supplier'],
            'keywords' => ['message', 'messagerie', 'contacter', 'discuter', 'ecrire', 'conversation', 'question'],
            'answer' => 'Utilisez « Contacter » sur une fiche produit ou fournisseur, une demande, un devis ou une commande pour ouvrir une conversation. Toutes vos conversations se trouvent dans « Messagerie », avec le nombre de messages non lus.',
            'links' => [['Messagerie (porteur)', '/porteur/messagerie'], ['Messagerie (fournisseur)', '/fournisseur/messagerie']],
        ],
        'notifications' => [
            'title' => 'Notifications',
            'roles' => ['buyer', 'supplier', 'admin'],
            'keywords' => ['notification', 'alerte', 'email', 'whatsapp', 'cloche', 'prevenir', 'preference'],
            'answer' => 'La cloche en haut de page affiche vos notifications (nouveau devis, commande, message…). Dans « Paramètres du compte » > « Notifications », choisissez pour chaque événement les canaux : sur le site, par e-mail et, après votre accord, par WhatsApp.',
            'links' => [['Préférences de notification', '/parametres/notifications']],
        ],
        'favoris' => [
            'title' => 'Fournisseurs favoris',
            'roles' => ['buyer'],
            'keywords' => ['favori', 'favoris', 'coeur', 'enregistrer', 'inviter', 'confiance'],
            'answer' => 'Cliquez sur le cœur d’une fiche fournisseur pour l’ajouter à vos favoris. Retrouvez-les dans « Fournisseurs favoris » et invitez-les directement sur une de vos demandes ouvertes.',
            'links' => [['Fournisseurs favoris', '/porteur/favoris']],
        ],
        'compte' => [
            'title' => 'Paramètres du compte',
            'roles' => ['buyer', 'supplier', 'admin'],
            'keywords' => ['parametre', 'profil', 'modifier', 'email', 'telephone', 'supprimer', 'desactiver', 'compte', 'information'],
            'answer' => 'Dans « Paramètres du compte », modifiez vos informations personnelles, votre e-mail (un lien de confirmation est envoyé) et votre mot de passe. Vous pouvez aussi désactiver ou supprimer votre compte ; vos commandes, factures et avis sont conservés.',
            'links' => [['Paramètres du compte', '/parametres']],
        ],
        'ia' => [
            'title' => 'Aides de l’IA',
            'roles' => ['buyer', 'supplier', 'guest'],
            'keywords' => ['ia', 'intelligence', 'artificielle', 'rediger', 'assistant', 'automatique', 'suggestion', 'simule'],
            'answer' => 'L’IA aide sans décider à votre place : rédaction d’une demande ou d’une fiche produit, catégorie et fournisseurs suggérés, résumé des devis, prix habituel du marché, résumé des avis. Chaque proposition est modifiable et indiquée comme générée automatiquement.',
            'links' => [],
        ],
        'administration' => [
            'title' => 'Administration',
            'roles' => ['admin'],
            'keywords' => ['admin', 'valider', 'fournisseur', 'moderation', 'retirer', 'suspendre', 'utilisateur', 'categorie', 'export', 'anomalie', 'journal'],
            'answer' => 'Le back-office regroupe le tableau de bord (indicateurs et alertes d’anomalies), la validation des fournisseurs, la gestion des utilisateurs, des catégories, le contrôle du catalogue, les avis signalés, les litiges, l’export des statistiques et le journal d’audit. Chaque décision demande un motif et est tracée.',
            'links' => [['Tableau de bord', '/admin'], ['Validation des fournisseurs', '/admin/fournisseurs']],
        ],
    ],
];
