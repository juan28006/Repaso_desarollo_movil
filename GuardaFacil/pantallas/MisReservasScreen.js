import React, { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContexto } from '../contextos/AuthContexto';
import {
  cancelarReserva,
  obtenerReservasUsuario,
  puedeCancelarReserva,
} from '../services/zonasService';

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

const obtenerFechaActual = () => {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

export default function MisReservasScreen() {
  const { usuario } = useAuthContexto();
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState('activas');
  const [cancelandoId, setCancelandoId] = useState(null);

  const cargarReservas = useCallback(async (mostrarCarga = true) => {
    if (!usuario?.uid) {
      setReservas([]);
      setCargando(false);
      return;
    }

    if (mostrarCarga) {
      setCargando(true);
    }
    setError('');

    try {
      setReservas(await obtenerReservasUsuario(usuario.uid));
    } catch (err) {
      console.error('Error cargando mis reservas:', err);
      setError('No se pudieron cargar tus reservas. Inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useFocusEffect(useCallback(() => {
    cargarReservas();
  }, [cargarReservas]));

  const fechaActual = obtenerFechaActual();
  const reservasFiltradas = useMemo(() => {
    const activas = reservas.filter(
      (reserva) => reserva.estado === 'confirmada' && reserva.fecha >= fechaActual
    );
    const historicas = reservas.filter(
      (reserva) => reserva.estado !== 'confirmada' || reserva.fecha < fechaActual
    );
    const seleccionadas = pestana === 'activas' ? activas : historicas;

    return seleccionadas.sort((a, b) => {
      const ordenFecha = String(a.fecha).localeCompare(String(b.fecha));
      const ordenFranja = Object.keys(franjas).indexOf(a.franja)
        - Object.keys(franjas).indexOf(b.franja);
      return pestana === 'activas'
        ? ordenFecha || ordenFranja
        : -(ordenFecha || ordenFranja);
    });
  }, [fechaActual, pestana, reservas]);

  const refrescar = async () => {
    setActualizando(true);
    await cargarReservas(false);
    setActualizando(false);
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
              await cancelarReserva(reserva.id, usuario.uid);
              setReservas((actuales) => actuales.map((actual) => (
                actual.id === reserva.id && actual.origen === reserva.origen
                  ? { ...actual, estado: 'cancelada' }
                  : actual
              )));
              Alert.alert('Reserva cancelada', 'La reserva se agregó a tu historial.');
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

  const renderEstado = (reserva) => {
    if (reserva.estado === 'cancelada') {
      return 'Cancelada';
    }
    if (reserva.fecha < fechaActual) {
      return 'Finalizada';
    }
    if (!puedeCancelarReserva(reserva)) {
      return 'En curso';
    }
    return 'Confirmada';
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

        {error ? (
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

          return (
            <View
              key={`${reserva.origen}-${reserva.id}`}
              style={styles.tarjeta}
            >
              <View style={styles.tarjetaEncabezado}>
                <Text style={styles.casillero}>
                  Casillero {reserva.casilleroNumero || reserva.casilleroId}
                </Text>
                <Text
                  style={[
                    styles.estado,
                    reserva.estado === 'cancelada' && styles.estadoCancelado,
                    reserva.fecha < fechaActual && reserva.estado !== 'cancelada'
                      && styles.estadoFinalizado,
                  ]}
                >
                  {renderEstado(reserva)}
                </Text>
              </View>
              <Text style={styles.detalle}>{reserva.zonaNombre || 'Zona'}</Text>
              <Text style={styles.detalle}>{formatearFecha(reserva.fecha)}</Text>
              <Text style={styles.detalle}>
                {reserva.franja}{franjas[reserva.franja] ? ` · ${franjas[reserva.franja]}` : ''}
              </Text>

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
  estado: { color: '#24804a', fontSize: 13, fontWeight: '700' },
  estadoCancelado: { color: '#e74c3c' },
  estadoFinalizado: { color: '#69728e' },
  detalle: { color: '#69728e', fontSize: 14, marginTop: 4 },
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
