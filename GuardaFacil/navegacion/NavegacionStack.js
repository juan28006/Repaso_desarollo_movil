import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;

try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthContexto } from '../contextos/AuthContexto';
import HomeScreen from '../pantallas/HomeScreen';
import LoginScreen from '../pantallas/LoginScreen';
import RegistroScreen from '../pantallas/RegistroScreen';
import ListaScreen from '../pantallas/ListaScreen';
import CasillerosScreen from '../pantallas/CasillerosScreen';
import DetalleCasilleroScreen from '../pantallas/DetalleCasilleroScreen';

const Stack = createNativeStackNavigator();

export default function NavegacionStack() {
  const { usuario, cargando } = useAuthContexto();

  if (cargando) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" /></View>;
  }

  return (
    <Stack.Navigator>
      {usuario ? (
        <>
          <Stack.Screen name="Lista" component={ListaScreen} options={{ title: 'Inicio' }} />
          <Stack.Screen name="Casilleros" component={CasillerosScreen} options={{ title: 'Casilleros' }} />
          <Stack.Screen name="DetalleCasillero" component={DetalleCasilleroScreen} options={{ title: 'Detalle del casillero' }} />
        </>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Iniciar sesión' }} />
          <Stack.Screen name="Registro" component={RegistroScreen} options={{ title: 'Crear cuenta' }} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}