import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthContexto } from '../contextos/AuthContexto';
import LoginScreen from '../pantallas/LoginScreen';
import ListaScreen from '../pantallas/ListaScreen';

const Stack = createNativeStackNavigator();

export default function NavegacionStack() {
  const { usuario, cargando } = useAuthContexto();

  if (cargando) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" /></View>;
  }

  return (
    <Stack.Navigator>
      {usuario ? (
        <Stack.Screen name="Lista" component={ListaScreen} options={{ title: 'Inicio' }} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Iniciar sesión' }} />
      )}
    </Stack.Navigator>
  );
}
