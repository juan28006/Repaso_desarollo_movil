import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContexto } from '../contextos/AuthContexto';
import { useEstadoConexion } from '../contextos/EstadoConexionContexto';
import AvisoOffline from '../componentes/AvisoOffline';
import {
  obtenerReservasUsuario,
  puedeCancelarReserva,
} from '../services/zonasService';
import { puedeIniciarUso } from '../services/usoReservaService';
import {
  ejecutarOEncolar,
  obtenerColaOffline,
} from '../services/offlineQueueService';
import { obtenerEstadoReserva } from '../constantes/estadosReserva';
import EstadoBadge from '../componentes/estadoBadge';

const franjas = {
  Mañana: '06:00',
  Tarde: '12:00',
  Noche: '18:00',
};

const formatearFecha = (fecha) => {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(anio, mes - 1, dia));
};

export default function MisReservasScreen() {
  const { usuario } = useAuthContexto();
  const {
    conectado,
    cola,
    actualizarCola,
  } = useEstadoConexion();
  const enfocada = useIsFocused();
  const [reservasState, setReservasState] = useState({ uid: null, items: [] });
  const [cacheState, setCacheState] = useState({ uid: null, resultado: null });
  const reservas = useMemo(
    () => (reservasState.uid === usuario?.uid ? reservasState.items : []),
    [reservasState, usuario?.uid]
  );
  const cacheInfo = cacheState.uid === usuario?.uid ? cacheState.resultado : null;
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState('activas');
  const [cancelandoId, setCancelandoId] = useState(null);
  const [iniciandoId, setIniciandoId] = useState(null);

  const cargarReservas = useCallback(async (mostrarCarga = true) => {
    if (!usuario?.uid) {
      setCargando(false);
      return;
    }

    if (mostrarCarga) {
      setCargando(true);
    }
    setError('');

    try {
      const [cargaReservas, operaciones] = await Promise.all([
        obtenerReservasUsuario(usuario.uid)
          .then((resultado) => ({ resultado }))
          .catch((error) => ({ error })),
        obtenerColaOffline(usuario.uid),
      ]);
      const reservasLocales = operaciones
        .filter((operacion) => operacion.tipo === 'reservar')
        .map((operacion) => ({
          ...operacion.datos,
          id: `${operacion.datos.casilleroId}_${operacion.datos.fecha}_${operacion.datos.franja}`,
          estado: operacion.estado === 'conflicto'
            ? 'conflicto_validacion'
            : 'pendiente_validacion',
          origen: 'local',
          operacionId: operacion.id,
        }));
      const resultado = cargaReservas.resultado || {
        datos: [],
        desdeCache: true,
        actualizadoEn: null,
      };
      const pendientesPorId = new Map(
        reservasLocales.map((reserva) => [reserva.id, reserva])
      );
      const reservasMostradas = resultado.datos.map((reserva) => (
        pendientesPorId.get(reserva.id)
          ? { ...pendientesPorId.get(reserva.id), origen: 'local' }
          : reserva
      ));
      const idsMostrados = new Set(reservasMostradas.map((reserva) => reserva.id));
      setReservasState({
        uid: usuario.uid,
        items: [
          ...reservasMostradas,
          ...reservasLocales.filter((reserva) => !idsMostrados.has(reserva.id)),
        ],
      });
      setCacheState({ uid: usuario.uid, resultado });
      if (cargaReservas.error) {
        console.error('No se pudieron actualizar las reservas:', cargaReservas.error);
        setError('No se pudieron actualizar las reservas; se muestran los datos locales disponibles.');
      }
    } catch (err) {
      console.error('Error cargando mis reservas:', err);
      setCacheState((actual) => (
        actual.uid === usuario.uid && actual.resultado
          ? {
            uid: usuario.uid,
            resultado: { ...actual.resultado, desdeCache: true, error: err.message },
          }
          : actual
      ));
      setError('No se pudieron cargar tus reservas. Inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useFocusEffect(useCallback(() => {
    cargarReservas();
  }, [cargarReservas]));

  useEffect(() => {
    if (!enfocada || !conectado) return undefined;
    const temporizador = setTimeout(() => cargarReservas(false), 0);
    return () => clearTimeout(temporizador);
  }, [enfocada, conectado, cola, cargarReservas]);

  const reservasFiltradas = useMemo(() => {
    const esActiva = (reserva) => (
      ['reservado', 'en_uso', 'pendiente_validacion', 'conflicto_validacion']
        .includes(obtenerEstadoReserva(reserva))
    );
    const activas = reservas.filter(esActiva);
    const historicas = reservas.filter((reserva) => !esActiva(reserva));
    const seleccionadas = pestana === 'activas' ? activas : historicas;

    return seleccionadas.sort((a, b) => {
      const ordenFecha = String(a.fecha).localeCompare(String(b.fecha));
      const ordenFranja = Object.keys(franjas).indexOf(a.franja)
        - Object.keys(franjas).indexOf(b.franja);
      return pestana === 'activas'
        ? ordenFecha || ordenFranja
        : -(ordenFecha || ordenFranja);
    });
  }, [pestana, reservas]);

  const refrescar = async () => {
    setActualizando(true);
    try {
      await cargarReservas(false);
    } finally {
      setActualizando(false);
    }
  };

  const solicitarCancelacion = (reserva) => {
    Alert.alert(
      'Cancelar reserva',
      `¿Quieres cancelar el casillero ${reserva.casilleroNumero} para el ${formatearFecha(reserva.fecha)} en la franja ${reserva.franja}?`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancelandoId(reserva.id);
            try {
              const resultado = await ejecutarOEncolar(
                usuario.uid,
                'cancelar',
                { reservaId: reserva.id },
                conectado === true
              );
              try {
                await actualizarCola();
              } catch (error) {
                console.error('No se pudo refrescar la cola después de cancelar:', error);
              }
              setReservasState((actual) => (
                actual.uid === usuario.uid
                  ? {
                    ...actual,
                    items: actual.items.map((item) => (
                      item.id === reserva.id && item.origen === reserva.origen
                        ? resultado.pendiente
                          ? { ...item, cancelacionPendiente: true }
                          : { ...item, estado: 'cancelada' }
                        : item
                    )),
                  }
                  : actual
              ));
              Alert.alert(
                resultado.pendiente ? 'Cancelación pendiente de validación' : 'Reserva cancelada',
                resultado.pendiente
                  ? 'La solicitud se guardó en este dispositivo y se validará con Firestore al recuperar la conexión.'
                  : 'La reserva se agregó a tu historial.'
              );
            } catch (err) {
              Alert.alert(
                'No se pudo cancelar la reserva',
                err.message || 'Inténtalo nuevamente.'
              );
            } finally {
              setCancelandoId(null);
            }
          },
        },
      ]
    );
  };

  const solicitarInicioUso = (reserva) => {
    Alert.alert(
      'Iniciar uso',
      `¿Quieres iniciar el uso del casillero ${reserva.casilleroNumero}?`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Sí, iniciar',
          onPress: async () => {
            setIniciandoId(reserva.id);
            try {
              const resultado = await ejecutarOEncolar(
                usuario.uid,
                'iniciar_uso',
                { reservaId: reserva.id },
                conectado === true
              );
              try {
                await actualizarCola();
              } catch (error) {
                console.error('No se pudo refrescar la cola después de iniciar el uso:', error);
              }
              setReservasState((actual) => (
                actual.uid === usuario.uid
                  ? {
                    ...actual,
                    items: actual.items.map((item) => (
                      item.id === reserva.id && item.origen === reserva.origen
                        ? resultado.pendiente
                          ? { ...item, inicioUsoPendiente: true }
                          : { ...item, estado: 'en_uso' }
                        : item
                    )),
                  }
                  : actual
              ));
              if (resultado.pendiente) {
                Alert.alert(
                  'Inicio de uso pendiente de validación',
                  'La solicitud se guardó en este dispositivo y se validará con Firestore al recuperar la conexión.'
                );
              }
            } catch (err) {
              Alert.alert(
                'No se pudo iniciar el uso',
                err.message || 'Inténtalo nuevamente.'
              );
            } finally {
              setIniciandoId(null);
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
        refreshControl={(
          <RefreshControl
            refreshing={actualizando}
            onRefresh={refrescar}
            colors={['#273c9c']}
          />
        )}
      >
        <Text style={styles.titulo}>Mis reservas</Text>
        <Text style={styles.descripcion}>Consulta tus reservas y su estado.</Text>
        <AvisoOffline
          desdeCache={cacheInfo?.desdeCache}
          actualizadoEn={cacheInfo?.actualizadoEn}
          cacheError={cacheInfo?.cacheError}
        />
        {error && reservas.length > 0 && (
          <Text style={styles.errorTexto}>{error}</Text>
        )}

        <View style={styles.pestanas}>
          {[
            { id: 'activas', texto: 'Activas' },
            { id: 'historial', texto: 'Historial' },
          ].map((opcion) => (
            <Pressable
              key={opcion.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: pestana === opcion.id }}
              style={[styles.pestana, pestana === opcion.id && styles.pestanaActiva]}
              onPress={() => setPestana(opcion.id)}
            >
              <Text
                style={[
                  styles.pestanaTexto,
                  pestana === opcion.id && styles.pestanaTextoActiva,
                ]}
              >
                {opcion.texto}
              </Text>
            </Pressable>
          ))}
        </View>

        {error && reservas.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.errorTexto}>{error}</Text>
            <Pressable style={styles.reintentar} onPress={() => cargarReservas()}>
              <Text style={styles.reintentarTexto}>Reintentar</Text>
            </Pressable>
          </View>
        ) : reservasFiltradas.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioTitulo}>
              {pestana === 'activas' ? 'No tienes reservas activas' : 'Aún no tienes historial'}
            </Text>
            <Text style={styles.vacioTexto}>
              {pestana === 'activas'
                ? 'Cuando reserves un casillero, aparecerá aquí.'
                : 'Tus reservas finalizadas o canceladas aparecerán aquí.'}
            </Text>
          </View>
        ) : reservasFiltradas.map((reserva) => {
          const esCancelable = puedeCancelarReserva(reserva);
          const cancelacionEnCurso = cancelandoId === reserva.id;
          const iniciable = puedeIniciarUso(reserva);
          const inicioEnCurso = iniciandoId === reserva.id;

          return (
            <View
              key={`${reserva.origen}-${reserva.id}`}
              style={styles.tarjeta}
            >
              <View style={styles.tarjetaEncabezado}>
                <Text style={styles.casillero}>
                  Casillero {reserva.casilleroNumero || reserva.casilleroId}
                </Text>
                <EstadoBadge reserva={reserva} />
              </View>
              <Text style={styles.detalle}>{reserva.zonaNombre || 'Zona'}</Text>
              <Text style={styles.detalle}>{formatearFecha(reserva.fecha)}</Text>
              <Text style={styles.detalle}>
                {reserva.franja}{franjas[reserva.franja] ? ` · ${franjas[reserva.franja]}` : ''}
              </Text>
              {reserva.cancelacionPendiente && (
                <Text style={styles.detallePendiente}>Cancelación pendiente de validación</Text>
              )}
              {reserva.inicioUsoPendiente && (
                <Text style={styles.detallePendiente}>Inicio de uso pendiente de validación</Text>
              )}

              {esCancelable && (
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(cancelandoId)}
                  style={[
                    styles.botonCancelar,
                    Boolean(cancelandoId) && styles.botonDeshabilitado,
                  ]}
                  onPress={() => solicitarCancelacion(reserva)}
                >
                  <Text style={styles.botonCancelarTexto}>
                    {cancelacionEnCurso ? 'Cancelando...' : 'Cancelar reserva'}
                  </Text>
                </Pressable>
              )}

              {iniciable && (
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(iniciandoId)}
                  style={[
                    styles.botonIniciar,
                    Boolean(iniciandoId) && styles.botonDeshabilitado,
                  ]}
                  onPress={() => solicitarInicioUso(reserva)}
                >
                  <Text style={styles.botonIniciarTexto}>
                    {inicioEnCurso ? 'Iniciando...' : 'Iniciar uso'}
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
  descripcion: { color: '#69728e', fontSize: 15, marginTop: 6, marginBottom: 20 },
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
  botonCancelar: {
    alignItems: 'center',
    borderColor: '#e74c3c',
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 46,
    marginTop: 14,
  },
  botonDeshabilitado: { opacity: 0.55 },
  botonCancelarTexto: { color: '#c0392b', fontSize: 15, fontWeight: '700' },
  botonIniciar: {
    alignItems: 'center',
    backgroundColor: '#273c9c',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 46,
    marginTop: 14,
  },
  botonIniciarTexto: { color: '#fff', fontSize: 15, fontWeight: '700' },
  vacio: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
  },
  vacioTitulo: { color: '#172044', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  vacioTexto: { color: '#69728e', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  errorTexto: { color: '#c0392b', fontSize: 15, textAlign: 'center' },
  reintentar: { marginTop: 16, padding: 10 },
  reintentarTexto: { color: '#273c9c', fontSize: 15, fontWeight: '700' },
});