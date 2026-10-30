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
import MisReservasScreen from '../pantallas/MisReservasScreen';
import GestionReservasScreen from '../pantallas/GestionReservasScreen';
import UsuariosScreen from '../pantallas/UsuariosScreen';
import { esAdministrador, esPersonal } from '../constantes/roles';
import IndicadorConexion from '../componentes/IndicadorConexion';

const Stack = createNativeStackNavigator();

export default function NavegacionStack() {
  const { usuario, rol, cargando } = useAuthContexto();

  if (cargando) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" /></View>;
  }

  return (
    <Stack.Navigator
      screenOptions={usuario ? { headerRight: () => <IndicadorConexion /> } : undefined}
    >
      {usuario ? (
        <>
          <Stack.Screen name="Lista" component={ListaScreen} options={{ title: 'Inicio' }} />
          <Stack.Screen name="MisReservas" component={MisReservasScreen} options={{ title: 'Mis reservas' }} />
          <Stack.Screen
            name="Casilleros"
            component={CasillerosScreen}
            options={({ route }) => ({
              title: route.params?.zonaNombre || 'Todos los casilleros',
            })}
          />
          <Stack.Screen name="DetalleCasillero" component={DetalleCasilleroScreen} options={{ title: 'Detalle del casillero' }} />
          {esPersonal(rol) && (
            <Stack.Screen name="GestionReservas" component={GestionReservasScreen} options={{ title: 'Gestión de reservas' }} />
          )}
          {esAdministrador(rol) && (
            <Stack.Screen name="Usuarios" component={UsuariosScreen} options={{ title: 'Usuarios y roles' }} />
          )}
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