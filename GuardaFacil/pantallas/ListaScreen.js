import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuthContexto } from '../contextos/AuthContexto';
import { useEstadoConexion } from '../contextos/EstadoConexionContexto';
import AvisoOffline from '../componentes/AvisoOffline';
import { obtenerZonas } from '../services/zonasService';
import {
  cerrarSesionSinSincronizacionActiva,
  obtenerColaOffline,
} from '../services/offlineQueueService';

export default function ListaScreen({ navigation }) {
  const { usuario, cerrarSesion } = useAuthContexto();
  const {
    conectado,
    actualizarCola,
    reintentarSincronizacion,
  } = useEstadoConexion();
  const [zonas, setZonas] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargarZonas = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resultado = await obtenerZonas(usuario.uid);
      setZonas(resultado.datos);
      setCacheInfo(resultado);
    } catch (err) {
      console.error('Error cargando zonas:', err);
      setZonas([]);
      setCacheInfo(null);
      setError('No se pudieron cargar las zonas. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    if (!usuario?.uid) return undefined;
    const temporizador = setTimeout(cargarZonas, 0);
    return () => clearTimeout(temporizador);
  }, [usuario?.uid, conectado, cargarZonas]);

  const solicitarCierreSesion = async () => {
    const terminarSesion = async () => {
      try {
        const cerrada = await cerrarSesionSinSincronizacionActiva(
          usuario.uid,
          cerrarSesion
        );
        if (!cerrada) {
          Alert.alert(
            'Sincronización en curso',
            'Espera a que termine la operación con Firestore antes de cerrar sesión.'
          );
        }
      } catch (error) {
        console.error('No se pudo cerrar la sesión:', error);
        Alert.alert('No se pudo cerrar la sesión', 'Inténtalo de nuevo.');
      }
    };

    let operacionesPendientes;
    try {
      operacionesPendientes = await obtenerColaOffline(usuario.uid);
    } catch (error) {
      console.error('No se pudo comprobar la cola antes de cerrar sesión:', error);
      Alert.alert(
        'No se pudo comprobar la cola',
        'Para proteger tus operaciones locales, no se cerró la sesión. Inténtalo de nuevo.'
      );
      return;
    }

    if (operacionesPendientes.length === 0) {
      await terminarSesion();
      return;
    }

    Alert.alert(
      'Hay operaciones sin sincronizar',
      'Puedes intentar sincronizarlas ahora o cerrar sesión conservándolas de forma privada para esta cuenta. No se enviarán con otra cuenta.',
      [
        { text: 'Seguir conectado', style: 'cancel' },
        {
          text: 'Intentar sincronizar',
          onPress: async () => {
            try {
              await reintentarSincronizacion();
              const pendientes = await actualizarCola();
              if (pendientes.length === 0) {
                await terminarSesion();
                return;
              }
              Alert.alert(
                'Operaciones aún pendientes',
                'No se confirmó la sincronización. Puedes volver a intentar o cerrar sesión conservando los datos.'
              );
            } catch (error) {
              console.error('Error al sincronizar antes de cerrar sesión:', error);
              Alert.alert(
                'No se pudo verificar la sincronización',
                'Las operaciones se conservarán en esta cuenta. Puedes cerrar sesión conservándolas o seguir conectado.'
              );
            }
          },
        },
        {
          text: 'Cerrar conservando pendientes',
          style: 'destructive',
          onPress: terminarSesion,
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenido a GuardaFácil</Text>
      <Text style={styles.email}>{usuario?.email}</Text>
      <AvisoOffline
        desdeCache={cacheInfo?.desdeCache}
        actualizadoEn={cacheInfo?.actualizadoEn}
        cacheError={cacheInfo?.cacheError}
      />
      <Pressable
        accessibilityRole="button"
        style={styles.reservasButton}
        onPress={() => navigation.navigate('MisReservas')}
      >
        <Text style={styles.reservasButtonText}>Mis reservas</Text>
      </Pressable>
      <Text style={styles.description}>
        {cacheInfo?.desdeCache || conectado === false ? 'Zonas guardadas:' : 'Zonas disponibles:'}
      </Text>

      {cargando ? (
        <ActivityIndicator size="large" color="#273c9c" />
      ) : (
        <View style={styles.listaContenido}>
          {error ? (
            <View>
              <Text style={styles.error}>{error}</Text>
              <Pressable onPress={cargarZonas}>
                <Text style={styles.reintentar}>Reintentar</Text>
              </Pressable>
            </View>
          ) : null}
          {!error || zonas.length > 0 ? (
            <FlatList
              data={zonas}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() =>
                    navigation.navigate('Casilleros', {
                      zonaId: item.id,
                      zonaNombre: item.nombre,
                    })
                  }
                >
                  <Text style={styles.nombreZona}>{item.nombre}</Text>
                  <Text style={styles.ubicacion}>{item.ubicacion}</Text>
                </TouchableOpacity>
              )}
            />
          ) : null}
        </View>
      )}
      <Pressable style={styles.primaryButton} onPress={solicitarCierreSesion}>
        <Text style={styles.primaryButtonText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, padding: 24, backgroundColor: '#f5f7ff' },
  title: { fontSize: 28, fontWeight: '800', color: '#172044' },
  email: { color: '#273c9c', fontSize: 16, fontWeight: '600' },
  description: { color: '#69728e', fontSize: 16 },
  reservasButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#273c9c',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  reservasButtonText: { color: '#273c9c', fontSize: 15, fontWeight: '700' },
  item: {
    padding: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 12,
  },
  nombreZona: { fontSize: 16, fontWeight: '700', color: '#172044' },
  ubicacion: { fontSize: 14, color: '#69728e' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#273c9c',
    borderRadius: 12,
    minHeight: 54,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  error: { color: '#c0392b', fontSize: 14 },
  reintentar: { color: '#273c9c', fontSize: 14, fontWeight: '700', marginTop: 8 },
  listaContenido: { flex: 1 },
});
