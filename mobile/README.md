# TijaraLink — application mobile (React Native / Expo)

Application mobile de la plateforme TijaraLink. Elle utilise **la même API Laravel** que le site web et reprend le
même design : couleurs, logo, cartes colorées du tableau de bord, catalogue avec photos.

## Écrans

Chaque espace a 4 onglets (les écrans les plus utilisés) et un onglet **Menu** qui reprend toute la barre latérale du
site, avec les mêmes rubriques, icônes et badges.

| Visiteur | Porteur de projet | Fournisseur | Administrateur |
|---|---|---|---|
| Accueil, catalogue, fiche produit, connexion | Tableau de bord, Mes demandes, **Publier une demande**, Mes commandes, **Fournisseurs favoris**, **Mes litiges** | Tableau de bord, **Mes produits**, Demandes reçues, **Mes devis**, Mes commandes, **Mes avis** (réponse), **Litiges reçus** | Tableau de bord, **Validation fournisseurs** (valider / refuser), **Utilisateurs** (suspendre / réactiver), **Catégories** |
| | Assistant IA, **Messagerie**, Notifications, Paramètres | Assistant IA, **Messagerie**, Notifications, **Profil de l'entreprise**, Paramètres | **Contrôle du catalogue** (retrait), **Avis signalés** (conserver / masquer), **Litiges**, **Journal d'audit**, Notifications |

Restent sur le site (lien direct depuis l'application) : inscription, mot de passe oublié, pièces jointes, dépôt d'un
devis, décision d'un litige, modification du profil et des catégories.

## Synchronisation avec le site

Le site et l'application utilisent le même backend et la même base : tout ce qui est fait d'un côté apparaît de l'autre.
L'application se met à jour d'elle-même :

- à chaque retour sur un écran (rechargement discret) et en tirant la liste vers le bas ;
- toutes les 10 secondes dans la messagerie (nouveaux messages, accusés de lecture) ;
- toutes les 30 secondes pour les compteurs de messages et de notifications non lus (badges), et au retour de
  l'application au premier plan.

## Lancer l'application

Prérequis : Node.js 20 ou plus, et l'application **Expo Go** sur votre téléphone (Play Store / App Store).

```bash
cd mobile
npm install
npx expo start
```

Scannez ensuite le QR code avec Expo Go (Android) ou l'appareil photo (iPhone).
Touche `a` : émulateur Android, `w` : navigateur.

## Relier l'application au backend

Le backend doit tourner (`php artisan serve --port=8001`). L'adresse de l'API se règle dans `mobile/.env` :

```bash
# Téléphone réel sur le même Wi-Fi que le PC : adresse IP du PC (ipconfig)
EXPO_PUBLIC_API_URL=http://192.168.1.20:8001/api
EXPO_PUBLIC_WEB_URL=http://192.168.1.20:5173
```

Sur un téléphone réel, lancez le backend sur toutes les interfaces : `php artisan serve --host=0.0.0.0 --port=8001`.
Sans `.env` : émulateur Android → `http://10.0.2.2:8001/api`, navigateur → `http://localhost:8001/api`.

Pour tester dans le navigateur (`npx expo start --web`, port 8081), ajoutez l'origine au CORS du backend :
`FRONTEND_URLS=http://localhost:5173,http://localhost:8081` dans `backend/.env`.

Comptes de démonstration : ceux du README principal (mot de passe `password`), par exemple `sana@tijaralink.test`.

## Générer un APK Android

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

## Organisation

```
App.js                 navigation (onglets selon le rôle)
src/config.js          adresse de l'API et du site
src/theme.js           couleurs du site
src/api/client.js      appels à l'API (jeton Sanctum, erreurs en français, images)
src/auth/AuthContext.js  connexion, session gardée dans le trousseau du téléphone
src/components/        logo, icônes, cartes, cartes produit, indicateurs
src/screens/           écrans
```
