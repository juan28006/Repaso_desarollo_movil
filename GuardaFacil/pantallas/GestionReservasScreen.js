import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContexto } from '../contextos/AuthContexto';
import { useEstadoConexion } from '../contextos/EstadoConexionContexto';
import AvisoOffline from '../componentes/AvisoOffline';
import EstadoBadge from '../componentes/estadoBadge';
import { obtenerTodasLasReservas } from '../services/gestionService';
import { ejecutarOEncolar } from '../services/offlineQueueService';
import { puedeCancelarReserva } from '../services/reglasReserva';
import { obtenerEstadoReserva } from '../constantes/estadosReserva';

const FILTROS = [
  { id: 'vigentes', texto: 'Vigentes' },
  { id: 'todas', texto: 'Todas' },
];

export default function GestionReservasScreen({ navigation }) {
  const { usuario } = useAuthContexto();
  const { puedeContactarApi, cola, actualizarCola } = useEstadoConexion();
  const enfocada = useIsFocused();
  const [reservas, setReservas] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('vigentes');
  const [liberandoId, setLiberandoId] = useState(null);

  const cargar = useCallback(async (mostrarCarga = true) => {
    if (!usuario?.uid) return;
    if (mostrarCarga) setCargando(true);
    try {
      const resultado = await obtenerTodasLasReservas(usuario.uid);
      setReservas(resultado.datos);
      setCacheInfo(resultado);
      setError('');
    } catch (err) {
      console.error('Error cargando las reservas de gestión:', err);
      setError(err.code === 'permission-denied'
        ? 'Tu rol ya no tiene acceso a esta pantalla.'
        : 'No se pudieron cargar las reservas. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  useEffect(() => {
    if (!enfocada || !puedeContactarApi) return undefined;
    const temporizador = setTimeout(() => cargar(false), 0);
    return () => clearTimeout(temporizador);
  }, [enfocada, puedeContactarApi, cola, cargar]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return reservas.filter((reserva) => {
      const estado = obtenerEstadoReserva(reserva);
      if (filtro === 'vigentes' && !['reservado', 'en_uso'].includes(estado)) return false;
      if (!texto) return true;
      return [reserva.usuarioEmail, reserva.casilleroNumero, reserva.zonaNombre]
        .some((campo) => String(campo || '').toLowerCase().includes(texto));
    });
  }, [reservas, busqueda, filtro]);

  const refrescar = async () => {
    setActualizando(true);
    try {
      await cargar(false);
    } finally {
      setActualizando(false);
    }
  };

  const solicitarLiberacion = (reserva) => {
    Alert.alert(
      'Liberar casillero',
      `Se cancelará la reserva del casillero ${reserva.casilleroNumero} (${reserva.usuarioEmail}) del ${reserva.fecha}, franja ${reserva.franja}, y el casillero quedará libre.`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Sí, liberar',
          style: 'destructive',
          onPress: async () => {
            setLiberandoId(reserva.id);
            try {
              const resultado = await ejecutarOEncolar(
                usuario.uid,
                'cancelar',
                { reservaId: reserva.id },
                puedeContactarApi
              );
              try {
                await actualizarCola();
              } catch (err) {
                console.error('No se pudo refrescar la cola después de liberar:', err);
              }
              setReservas((actuales) => actuales.map((item) => {
                if (item.id !== reserva.id) return item;
                return resultado.pendiente
                  ? { ...item, cancelacionPendiente: true }
                  : { ...item, ...resultado.resultado };
              }));
              if (resultado.pendiente) {
                Alert.alert(
                  'Liberación pendiente de validación',
                  'La solicitud se guardó en este dispositivo y se validará con el servidor al recuperar la conexión.'
                );
              }
            } catch (err) {
              Alert.alert('No se pudo liberar el casillero', err.message || 'Inténtalo nuevamente.');
            } finally {
              setLiberandoId(null);
            }
          },
        },
      ]
    );
  };

  if (cargando && reservas.length === 0) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#273c9c" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.contenido}
        refreshControl={<RefreshControl refreshing={actualizando} onRefresh={refrescar} colors={['#273c9c']} />}
      >
        <Text style={styles.titulo}>Gestión de reservas</Text>
        <Text style={styles.descripcion}>
          Libera casilleros cancelando reservas. Para reservar a nombre de un estudiante, abre un
          casillero e indica su correo.
        </Text>
        <AvisoOffline
          desdeCache={cacheInfo?.desdeCache}
          actualizadoEn={cacheInfo?.actualizadoEn}
          cacheError={cacheInfo?.cacheError}
        />

        <Pressable
          accessibilityRole="button"
          style={styles.botonSecundario}
          onPress={() => navigation.navigate('Lista')}
        >
          <Text style={styles.botonSecundarioTexto}>Reservar un casillero</Text>
        </Pressable>

        <TextInput
          style={styles.buscador}
          placeholder="Buscar por correo, casillero o zona"
          value={busqueda}
          onChangeText={setBusqueda}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.pestanas}>
          {FILTROS.map((opcion) => (
            <Pressable
              key={opcion.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: filtro === opcion.id }}
              style={[styles.pestana, filtro === opcion.id && styles.pestanaActiva]}
              onPress={() => setFiltro(opcion.id)}
            >
              <Text style={[styles.pestanaTexto, filtro === opcion.id && styles.pestanaTextoActiva]}>
                {opcion.texto}
              </Text>
            </Pressable>
          ))}
        </View>

        {error && reservas.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.errorTexto}>{error}</Text>
            <Pressable style={styles.reintentar} onPress={() => cargar()}>
              <Text style={styles.reintentarTexto}>Reintentar</Text>
            </Pressable>
          </View>
        ) : visibles.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioTitulo}>No hay reservas para mostrar</Text>
          </View>
        ) : visibles.map((reserva) => {
          const liberable = puedeCancelarReserva(reserva) && !reserva.cancelacionPendiente;
          return (
            <View key={reserva.id} style={styles.tarjeta}>
              <View style={styles.tarjetaEncabezado}>
                <Text style={styles.casillero}>Casillero {reserva.casilleroNumero || reserva.casilleroId}</Text>
                <EstadoBadge reserva={reserva} />
              </View>
              <Text style={styles.detalle}>{reserva.zonaNombre || 'Zona'}</Text>
              <Text style={styles.detalle}>{reserva.fecha} · {reserva.franja}</Text>
              <Text style={styles.detalle}>Reservado por: {reserva.usuarioEmail}</Text>
              {reserva.cancelacionPendiente && (
                <Text style={styles.detallePendiente}>Liberación pendiente de validación</Text>
              )}
              {liberable && (
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(liberandoId)}
                  style={[styles.botonLiberar, Boolean(liberandoId) && styles.botonDeshabilitado]}
                  onPress={() => solicitarLiberacion(reserva)}
                >
                  <Text style={styles.botonLiberarTexto}>
                    {liberandoId === reserva.id ? 'Liberando...' : 'Cancelar y liberar casillero'}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7ff' },
  contenido: { padding: 24, paddingBottom: 40, flexGrow: 1 },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 28, fontWeight: '800', color: '#172044' },
  descripcion: { color: '#69728e', fontSize: 15, marginTop: 6, marginBottom: 16, lineHeight: 21 },
  botonSecundario: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#273c9c',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    marginBottom: 14,
  },
  botonSecundarioTexto: { color: '#273c9c', fontSize: 15, fontWeight: '700' },
  buscador: {
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 15,
  },
  pestanas: {
    flexDirection: 'row',
    backgroundColor: '#e8ecf8',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  pestana: { flex: 1, alignItems: 'center', borderRadius: 9, paddingVertical: 11 },
  pestanaActiva: { backgroundColor: '#273c9c' },
  pestanaTexto: { color: '#69728e', fontSize: 15, fontWeight: '700' },
  pestanaTextoActiva: { color: '#fff' },
  tarjeta: {
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tarjetaEncabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  casillero: { color: '#172044', fontSize: 17, fontWeight: '800', flexShrink: 1 },
  detalle: { color: '#69728e', fontSize: 14, marginTop: 4 },
  detallePendiente: { color: '#9b6400', fontSize: 13, fontWeight: '700', marginTop: 8 },
  botonLiberar: {
    alignItems: 'center',
    borderColor: '#e74c3c',
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 46,
    marginTop: 14,
  },
  botonDeshabilitado: { opacity: 0.55 },
  botonLiberarTexto: { color: '#c0392b', fontSize: 15, fontWeight: '700' },
  vacio: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
  },
  vacioTitulo: { color: '#172044', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  errorTexto: { color: '#c0392b', fontSize: 15, textAlign: 'center' },
  reintentar: { marginTop: 16, padding: 10 },
  reintentarTexto: { color: '#273c9c', fontSize: 15, fontWeight: '700' },
});
