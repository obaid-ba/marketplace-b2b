import { Platform } from 'react-native'
import Constants from 'expo-constants'

/**
 * Adresse de l'API Laravel, dans cet ordre :
 * 1. EXPO_PUBLIC_API_URL (fichier mobile/.env), si elle est donnée ;
 * 2. sinon, l'adresse du PC qui fait tourner « npx expo start » : Expo Go la connaît déjà (c'est elle qui sert
 *    l'application), on garde son adresse IP et on vise le port 8001 du backend. Ainsi un vrai téléphone sur le
 *    même Wi-Fi trouve l'API sans aucun réglage ;
 * 3. sinon : émulateur Android → 10.0.2.2, navigateur et simulateur iOS → localhost.
 *
 * Sur un vrai téléphone, le backend doit écouter sur le réseau : php artisan serve --host=0.0.0.0 --port=8001
 */
function devHost() {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? Constants.manifest2?.extra?.expoGo?.debuggerHost
  const host = hostUri?.split(':')[0]
  return host && host !== 'localhost' && host !== '127.0.0.1' ? host : null
}

const host = Platform.OS === 'web' ? null : devHost()
const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost'

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || `http://${host ?? fallbackHost}:8001/api`).replace(/\/$/, '')

/** Adresse du site web (inscription, pages ouvertes depuis l'application). */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || `http://${host ?? 'localhost'}:5173`).replace(/\/$/, '')

export const APP_NAME = 'TijaraLink'
