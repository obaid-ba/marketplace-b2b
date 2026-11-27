/**
 * Menus de chaque espace : mêmes rubriques, libellés et icônes que la barre latérale du site
 * (frontend/src/layouts/BuyerLayout.jsx, SupplierLayout.jsx, AdminLayout.jsx).
 * screen : écran de l'application ; badge « messages » : nombre de messages non lus.
 */
export const MENUS = {
  buyer: [
    {
      group: 'Achats',
      items: [
        { label: 'Tableau de bord', icon: 'home', screen: 'Tableau de bord' },
        { label: 'Mes demandes', icon: 'file', screen: 'Demandes' },
        { label: 'Publier une demande', icon: 'plus', screen: 'Publier' },
        { label: 'Mes commandes', icon: 'cart', screen: 'Commandes' },
        { label: 'Fournisseurs favoris', icon: 'heart', screen: 'Favoris' },
        { label: 'Mes litiges', icon: 'alert', screen: 'Litiges' },
      ],
    },
    {
      group: 'Communication',
      items: [
        { label: 'Assistant IA', icon: 'sparkles', screen: 'Assistant' },
        { label: 'Messagerie', icon: 'message', screen: 'Messagerie', badge: 'messages' },
        { label: 'Notifications', icon: 'bell', screen: 'Notifications' },
      ],
    },
    {
      group: 'Compte',
      items: [
        { label: 'Catalogue des produits', icon: 'grid', screen: 'Catalogue' },
        { label: 'Paramètres', icon: 'settings', screen: 'Compte' },
      ],
    },
  ],
  supplier: [
    {
      group: 'Ventes',
      items: [
        { label: 'Tableau de bord', icon: 'home', screen: 'Tableau de bord' },
        { label: 'Mes produits', icon: 'box', screen: 'Produits' },
        { label: 'Demandes reçues', icon: 'inbox', screen: 'Demandes' },
        { label: 'Mes devis', icon: 'file', screen: 'Devis' },
        { label: 'Mes commandes', icon: 'cart', screen: 'Commandes' },
        { label: 'Mes avis', icon: 'star', screen: 'Avis' },
        { label: 'Litiges reçus', icon: 'alert', screen: 'Litiges' },
      ],
    },
    {
      group: 'Communication',
      items: [
        { label: 'Assistant IA', icon: 'sparkles', screen: 'Assistant' },
        { label: 'Messagerie', icon: 'message', screen: 'Messagerie', badge: 'messages' },
        { label: 'Notifications', icon: 'bell', screen: 'Notifications' },
      ],
    },
    {
      group: 'Compte',
      items: [
        { label: "Profil de l'entreprise", icon: 'building', screen: 'Profil' },
        { label: 'Catalogue des produits', icon: 'grid', screen: 'Catalogue' },
        { label: 'Paramètres', icon: 'settings', screen: 'Compte' },
      ],
    },
  ],
  admin: [
    {
      group: 'Pilotage',
      items: [
        { label: 'Tableau de bord', icon: 'home', screen: 'Tableau de bord' },
        { label: 'Validation fournisseurs', icon: 'check', screen: 'Validation' },
        { label: 'Utilisateurs', icon: 'users', screen: 'Utilisateurs' },
        { label: 'Gestion des catégories', icon: 'tag', screen: 'Categories' },
      ],
    },
    {
      group: 'Modération',
      items: [
        { label: 'Contrôle du catalogue', icon: 'shield', screen: 'ControleCatalogue' },
        { label: 'Avis signalés', icon: 'flag', screen: 'AvisSignales' },
        { label: 'Litiges', icon: 'alert', screen: 'Litiges' },
        { label: "Journal d'audit", icon: 'history', screen: 'Audit' },
      ],
    },
    {
      group: 'Compte',
      items: [
        { label: 'Notifications', icon: 'bell', screen: 'Notifications' },
        { label: 'Catalogue des produits', icon: 'grid', screen: 'Catalogue' },
        { label: 'Paramètres', icon: 'settings', screen: 'Compte' },
      ],
    },
  ],
}
