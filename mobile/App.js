import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from './src/auth/AuthContext'
import Icon from './src/components/Icon'
import { Loading } from './src/components/ui'
import AccountScreen from './src/screens/AccountScreen'
import {
  AuditScreen,
  CategoriesScreen,
  ProductControlScreen,
  ReportedReviewsScreen,
  SupplierValidationScreen,
  UsersScreen,
} from './src/screens/AdminScreens'
import AssistantScreen from './src/screens/AssistantScreen'
import { DisputesScreen, FavoritesScreen, PublishTenderScreen } from './src/screens/BuyerScreens'
import CatalogScreen from './src/screens/CatalogScreen'
import DashboardScreen from './src/screens/DashboardScreen'
import HomeScreen from './src/screens/HomeScreen'
import {
  BuyerTendersScreen,
  NotificationsScreen,
  OrdersScreen,
  SupplierProductsScreen,
  SupplierTendersScreen,
} from './src/screens/ListScreens'
import LoginScreen from './src/screens/LoginScreen'
import MenuScreen from './src/screens/MenuScreen'
import { ConversationScreen, ConversationsScreen } from './src/screens/MessagingScreens'
import ProductScreen from './src/screens/ProductScreen'
import { CompanyProfileScreen, QuotesScreen, ReviewsScreen } from './src/screens/SupplierScreens'
import { UnreadProvider, useUnread } from './src/sync/UnreadContext'
import { colors } from './src/theme'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: colors.brand600, background: colors.page } }

const header = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
}

const tabBar = {
  ...header,
  tabBarActiveTintColor: colors.brand600,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: { borderTopColor: colors.line },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
}

const tab = (icon, title, badge) => ({
  title,
  tabBarIcon: ({ color, size }) => <Icon name={icon} size={size - 2} color={color} />,
  tabBarBadge: badge > 0 ? (badge > 99 ? '99+' : badge) : undefined,
  tabBarBadgeStyle: { backgroundColor: colors.brand600 },
})

/**
 * Onglets de chaque espace : les 4 écrans les plus utilisés + « Menu », qui reprend toute la barre latérale du site.
 */
function SpaceTabs() {
  const { user } = useAuth()
  const unread = useUnread()
  const role = user?.role

  return (
    <Tab.Navigator screenOptions={tabBar}>
      <Tab.Screen name="Tableau de bord" component={DashboardScreen} options={tab('home', 'Accueil')} />
      {role === 'buyer' && (
        <>
          <Tab.Screen name="Demandes" component={BuyerTendersScreen} options={tab('file', 'Mes demandes')} />
          <Tab.Screen name="Commandes" component={OrdersScreen} options={tab('cart', 'Commandes')} />
          <Tab.Screen name="Messagerie" component={ConversationsScreen} options={tab('message', 'Messagerie', unread.messages)} />
        </>
      )}
      {role === 'supplier' && (
        <>
          <Tab.Screen name="Demandes" component={SupplierTendersScreen} options={tab('inbox', 'Demandes reçues')} />
          <Tab.Screen name="Commandes" component={OrdersScreen} options={tab('cart', 'Commandes')} />
          <Tab.Screen name="Messagerie" component={ConversationsScreen} options={tab('message', 'Messagerie', unread.messages)} />
        </>
      )}
      {role === 'admin' && (
        <>
          <Tab.Screen name="Validation" component={SupplierValidationScreen} options={tab('check', 'Validation')} />
          <Tab.Screen name="Utilisateurs" component={UsersScreen} options={tab('users', 'Utilisateurs')} />
          <Tab.Screen name="Litiges" component={DisputesScreen} options={tab('alert', 'Litiges')} />
        </>
      )}
      <Tab.Screen name="Menu" component={MenuScreen} options={tab('menu', 'Menu', unread.notifications)} />
    </Tab.Navigator>
  )
}

/** Onglets visiteur : accueil, catalogue, connexion. */
function PublicTabs() {
  return (
    <Tab.Navigator screenOptions={tabBar}>
      <Tab.Screen name="Accueil" component={HomeScreen} options={{ ...tab('home', 'Accueil'), headerShown: false }} />
      <Tab.Screen name="Catalogue" component={CatalogScreen} options={tab('grid', 'Catalogue')} />
      <Tab.Screen name="Connexion" component={LoginScreen} options={{ ...tab('user', 'Connexion'), headerShown: false }} />
    </Tab.Navigator>
  )
}

/** Écrans ouverts depuis le menu (au-dessus des onglets, avec bouton retour). */
function SpaceScreens(role) {
  const common = (
    <>
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Compte" component={AccountScreen} options={{ title: 'Paramètres' }} />
      <Stack.Screen name="Accueil" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Catalogue" component={CatalogScreen} options={{ title: 'Catalogue des produits' }} />
    </>
  )

  if (role === 'admin') {
    return (
      <>
        {common}
        <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Gestion des catégories' }} />
        <Stack.Screen name="ControleCatalogue" component={ProductControlScreen} options={{ title: 'Contrôle du catalogue' }} />
        <Stack.Screen name="AvisSignales" component={ReportedReviewsScreen} options={{ title: 'Avis signalés' }} />
        <Stack.Screen name="Audit" component={AuditScreen} options={{ title: "Journal d'audit" }} />
      </>
    )
  }

  return (
    <>
      {common}
      <Stack.Screen name="Assistant" component={AssistantScreen} options={{ title: 'Assistant IA' }} />
      <Stack.Screen name="Conversation" component={ConversationScreen} options={({ route }) => ({ title: route.params?.title ?? 'Conversation' })} />
      <Stack.Screen name="Litiges" component={DisputesScreen} options={{ title: role === 'buyer' ? 'Mes litiges' : 'Litiges reçus' }} />
      {role === 'buyer' && (
        <>
          <Stack.Screen name="Publier" component={PublishTenderScreen} options={{ title: 'Publier une demande' }} />
          <Stack.Screen name="Favoris" component={FavoritesScreen} options={{ title: 'Fournisseurs favoris' }} />
        </>
      )}
      {role === 'supplier' && (
        <>
          <Stack.Screen name="Produits" component={SupplierProductsScreen} options={{ title: 'Mes produits' }} />
          <Stack.Screen name="Devis" component={QuotesScreen} options={{ title: 'Mes devis' }} />
          <Stack.Screen name="Avis" component={ReviewsScreen} options={{ title: 'Mes avis' }} />
          <Stack.Screen name="Profil" component={CompanyProfileScreen} options={{ title: "Profil de l'entreprise" }} />
        </>
      )}
    </>
  )
}

function Root() {
  const { user, ready } = useAuth()
  if (!ready) return <Loading />

  return (
    <Stack.Navigator screenOptions={header}>
      {user ? (
        <>
          <Stack.Screen name="Espace" component={SpaceTabs} options={{ headerShown: false }} />
          {SpaceScreens(user.role)}
        </>
      ) : (
        <Stack.Screen name="Public" component={PublicTabs} options={{ headerShown: false }} />
      )}
      <Stack.Screen name="Produit" component={ProductScreen} options={({ route }) => ({ title: route.params?.title ?? 'Produit' })} />
    </Stack.Navigator>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UnreadProvider>
          <NavigationContainer theme={theme}>
            <StatusBar style="dark" />
            <Root />
          </NavigationContainer>
        </UnreadProvider>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
