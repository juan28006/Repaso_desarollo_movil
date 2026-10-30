import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContexto } from '../contextos/AuthContexto';
import { useEstadoConexion } from '../contextos/EstadoConexionContexto';
import AvisoOffline from '../componentes/AvisoOffline';
import { obtenerCasilleros, obtenerZonas } from '../services/zonasService';
import { ETIQUETAS_ROL, esAdministrador, esPersonal } from '../constantes/roles';
import {
  colorEstadoCasillero,
  etiquetaEstadoCasillero,
  ESTADOS_CASILLERO,
  normalizarEstadoCasillero,
  tieneDatoMantenimiento,
  tieneEstadoCasillero,
} from '../constantes/estadosCasillero';
import {
  cerrarSesionSinSincronizacionActiva,
  obtenerColaOffline,
} from '../services/offlineQueueService';

export default function ListaScreen({ navigation }) {
  const { usuario, rol, cerrarSesion } = useAuthContexto();
  const {
    conectado,
    actualizarCola,
    reintentarSincronizacion,
  } = useEstadoConexion();
  const [zonas, setZonas] = useState([]);
  const [casilleros, setCasilleros] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [inventarioCompleto, setInventarioCompleto] = useState(true);

  const cargarZonas = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resultado = await obtenerZonas(usuario.uid);
      setZonas(resultado.datos);
      const resultadosCasilleros = await Promise.allSettled(
        resultado.datos.map(async (zona) => ({
          zona,
          resultado: await obtenerCasilleros(usuario.uid, zona.id),
        }))
      );
      const cargados = resultadosCasilleros
        .filter((resultadoCasilleros) => resultadoCasilleros.status === 'fulfilled')
        .map((resultadoCasilleros) => resultadoCasilleros.value);
      const fallidos = resultadosCasilleros.filter(
        (resultadoCasilleros) => resultadoCasilleros.status === 'rejected'
      );
      const inventario = cargados.flatMap(({ zona, resultado: carga }) => (
        carga.datos.map((casillero) => ({
          ...casillero,
          zonaId: zona.id,
          zonaNombre: zona.nombre || `Zona ${zona.id}`,
          ubicacion: zona.ubicacion || zona.nombre || `Zona ${zona.id}`,
          estadoNormalizado: normalizarEstadoCasillero(casillero),
        }))
      ));
      const fechasCache = [resultado, ...cargados.map(({ resultado: carga }) => carga)]
        .map((carga) => carga.actualizadoEn)
        .filter((fecha) => Number.isFinite(fecha));

      setCasilleros(inventario);
      setInventarioCompleto(fallidos.length === 0);
      setCacheInfo({
        desdeCache: resultado.desdeCache || cargados.some(({ resultado: carga }) => carga.desdeCache),
        actualizadoEn: fechasCache.length ? Math.min(...fechasCache) : null,
        cacheError: resultado.cacheError
          || cargados.find(({ resultado: carga }) => carga.cacheError)?.resultado.cacheError
          || null,
      });

      if (fallidos.length > 0) {
        fallidos.forEach(({ reason }) => console.error('Error cargando casilleros para el inventario:', reason));
        setError(`No se pudo cargar el inventario de ${fallidos.length} zona${fallidos.length === 1 ? '' : 's'}. Se muestran los datos disponibles.`);
      }
    } catch (err) {
      console.error('Error cargando zonas:', err);
      setZonas([]);
      setCasilleros([]);
      setCacheInfo(null);
      setInventarioCompleto(false);
      setError('No se pudieron cargar las zonas. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  const busquedaNormalizada = busqueda.trim().toLowerCase();
  const casillerosCoincidentes = busquedaNormalizada
    ? casilleros.filter((casillero) => (
      String(casillero.numero ?? casillero.codigo ?? casillero.id)
        .toLowerCase()
        .includes(busquedaNormalizada)
    ))
    : [];
  const totalConEstado = casilleros.filter(tieneEstadoCasillero).length;
  const estadisticas = {
    total: casilleros.length,
    disponibles: casilleros.filter(
      (casillero) => casillero.estadoNormalizado === ESTADOS_CASILLERO.DISPONIBLE
    ).length,
    ocupados: casilleros.filter(
      (casillero) => casillero.estadoNormalizado === ESTADOS_CASILLERO.OCUPADO
    ).length,
    mantenimiento: casilleros.filter(
      (casillero) => casillero.estadoNormalizado === ESTADOS_CASILLERO.MANTENIMIENTO
    ).length,
    desconocidos: casilleros.length - totalConEstado,
    reportaMantenimiento: casilleros.some(tieneDatoMantenimiento),
  };
  const mostrarPorcentajes = estadisticas.total > 0
    && estadisticas.desconocidos === 0
    && inventarioCompleto;
  const porcentajeDisponible = mostrarPorcentajes
    ? Math.round((estadisticas.disponibles / estadisticas.total) * 100)
    : null;
  const porcentajeOcupado = mostrarPorcentajes
    ? Math.round((estadisticas.ocupados / estadisticas.total) * 100)
    : null;

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
            'Espera a que termine la sincronización con el servidor antes de cerrar sesión.'
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
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.container}
        data={zonas}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={(
          <View>
            <Text style={styles.title}>Bienvenido a GuardaFácil</Text>
            <Text style={styles.email}>{usuario?.email}</Text>
            {rol && <Text style={styles.rol}>Rol: {ETIQUETAS_ROL[rol] || rol}</Text>}
            <AvisoOffline
              desdeCache={cacheInfo?.desdeCache}
              actualizadoEn={cacheInfo?.actualizadoEn}
              cacheError={cacheInfo?.cacheError}
            />

            <Text style={styles.sectionTitle}>Resumen del inventario</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {cargando ? (
              <ActivityIndicator size="large" color="#273c9c" />
            ) : (
              <View style={styles.estadisticas}>
                {[
                  { etiqueta: 'Total', valor: estadisticas.total },
                  {
                    etiqueta: 'Disponibles',
                    valor: estadisticas.disponibles,
                    porcentaje: porcentajeDisponible,
                  },
                  {
                    etiqueta: 'Ocupados',
                    valor: estadisticas.ocupados,
                    porcentaje: porcentajeOcupado,
                  },
                  {
                    etiqueta: 'Mantenimiento',
                    valor: estadisticas.reportaMantenimiento
                      ? estadisticas.mantenimiento
                      : '—',
                  },
                ].map((dato) => (
                  <View key={dato.etiqueta} style={styles.tarjetaEstadistica}>
                    <Text style={styles.etiquetaEstadistica}>{dato.etiqueta}</Text>
                    <Text style={styles.valorEstadistica}>{dato.valor}</Text>
                    {dato.porcentaje !== undefined && (
                      <Text style={styles.porcentajeEstadistica}>
                        {dato.porcentaje === null ? 'Porcentaje no disponible' : `${dato.porcentaje}% del total`}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
            {estadisticas.desconocidos > 0 && !cargando && (
              <Text style={styles.nota}>
                {estadisticas.desconocidos} casillero{estadisticas.desconocidos === 1 ? '' : 's'} sin estado informado.
              </Text>
            )}

            <Text style={styles.sectionTitle}>Buscar casillero</Text>
            <TextInput
              accessibilityLabel="Buscar casillero por número"
              style={styles.buscador}
              placeholder="Buscar por número (ej. A-101)"
              value={busqueda}
              onChangeText={setBusqueda}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {busquedaNormalizada && !cargando && casillerosCoincidentes.length === 0 && (
              <Text style={styles.nota}>No se encontraron casilleros con ese número.</Text>
            )}
            {casillerosCoincidentes.map((casillero) => (
              <Pressable
                key={`${casillero.zonaId}-${casillero.id}`}
                accessibilityRole="button"
                style={styles.resultadoBusqueda}
                onPress={() => navigation.navigate('DetalleCasillero', {
                  zonaId: casillero.zonaId,
                  casilleroId: casillero.id,
                  zonaNombre: casillero.zonaNombre,
                })}
              >
                <View style={styles.resultadoTexto}>
                  <Text style={styles.nombreZona}>
                    {casillero.numero ?? casillero.codigo ?? casillero.id}
                  </Text>
                  <Text style={styles.ubicacion}>
                    {casillero.zonaNombre} · {casillero.ubicacion}
                  </Text>
                </View>
                <Text style={[
                  styles.estadoResultado,
                  { color: colorEstadoCasillero(casillero.estadoNormalizado) },
                ]}>
                  {etiquetaEstadoCasillero(casillero.estadoNormalizado)}
                </Text>
              </Pressable>
            ))}

            <Pressable
              accessibilityRole="button"
              style={styles.reservasButton}
              onPress={() => navigation.navigate('Casilleros')}
            >
              <Text style={styles.reservasButtonText}>Ver todos los casilleros</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.reservasButton}
              onPress={() => navigation.navigate('MisReservas')}
            >
              <Text style={styles.reservasButtonText}>Mis reservas</Text>
            </Pressable>
            {esPersonal(rol) && (
              <Pressable
                accessibilityRole="button"
                style={styles.reservasButton}
                onPress={() => navigation.navigate('GestionReservas')}
              >
                <Text style={styles.reservasButtonText}>Gestión de reservas</Text>
              </Pressable>
            )}
            {esAdministrador(rol) && (
              <Pressable
                accessibilityRole="button"
                style={styles.reservasButton}
                onPress={() => navigation.navigate('Usuarios')}
              >
                <Text style={styles.reservasButtonText}>Usuarios y roles</Text>
              </Pressable>
            )}
            <Text style={styles.description}>
              {cacheInfo?.desdeCache || conectado === false ? 'Zonas guardadas:' : 'Zonas disponibles:'}
            </Text>
            {error && (
              <Pressable onPress={cargarZonas}>
                <Text style={styles.reintentar}>Reintentar</Text>
              </Pressable>
            )}
          </View>
        )}
        ListEmptyComponent={!cargando ? (
          <Text style={styles.nota}>No hay zonas para mostrar.</Text>
        ) : null}
        ListFooterComponent={(
          <Pressable style={styles.primaryButton} onPress={solicitarCierreSesion}>
            <Text style={styles.primaryButtonText}>Cerrar sesión</Text>
          </Pressable>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('Casilleros', {
              zonaId: item.id,
              zonaNombre: item.nombre,
            })}
          >
            <Text style={styles.nombreZona}>{item.nombre}</Text>
            <Text style={styles.ubicacion}>{item.ubicacion}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7ff' },
  container: { gap: 16, padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#172044' },
  email: { color: '#273c9c', fontSize: 16, fontWeight: '600' },
  rol: { color: '#69728e', fontSize: 14, marginTop: -8 },
  sectionTitle: { color: '#172044', fontSize: 19, fontWeight: '800', marginTop: 8 },
  description: { color: '#69728e', fontSize: 16, marginTop: 8 },
  estadisticas: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tarjetaEstadistica: {
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 12,
    flexBasis: '47%',
    flexGrow: 1,
    padding: 14,
  },
  etiquetaEstadistica: { color: '#69728e', fontSize: 13, fontWeight: '600' },
  valorEstadistica: { color: '#172044', fontSize: 24, fontWeight: '800', marginTop: 4 },
  porcentajeEstadistica: { color: '#69728e', fontSize: 12, marginTop: 2 },
  nota: { color: '#69728e', fontSize: 14, marginBottom: 8 },
  buscador: {
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  resultadoBusqueda: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    padding: 14,
  },
  resultadoTexto: { flex: 1 },
  estadoResultado: { fontSize: 12, fontWeight: '700', textAlign: 'right' },
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
});
