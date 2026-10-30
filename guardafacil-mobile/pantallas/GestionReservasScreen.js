import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { ejecutarOEncolar, obtenerColaOffline } from '../services/offlineQueueService';
import { aplicarColaAReservas, etiquetaOperacionLocal } from '../services/estadoColaReserva';
import { puedeCancelarReserva } from '../services/reglasReserva';
import { ESTADOS_RESERVA, obtenerEstadoReserva } from '../constantes/estadosReserva';

const FILTROS = [
  { id: 'vigentes', texto: 'Vigentes' },
  { id: 'todas', texto: 'Todas' },
];

const claveFechaValida = (valor) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T12:00:00`);
  const mes = Number(valor.slice(5, 7));
  const dia = Number(valor.slice(8, 10));
  return !Number.isNaN(fecha.getTime())
    && fecha.getFullYear() === Number(valor.slice(0, 4))
    && fecha.getMonth() + 1 === mes
    && fecha.getDate() === dia;
};

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
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('todos');
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [reservaDetalle, setReservaDetalle] = useState(null);
  const [liberandoId, setLiberandoId] = useState(null);

  const cargar = useCallback(async (mostrarCarga = true) => {
    if (!usuario?.uid) return;
    if (mostrarCarga) setCargando(true);
    try {
      const [resultado, operaciones] = await Promise.all([
        obtenerTodasLasReservas(usuario.uid),
        obtenerColaOffline(usuario.uid),
      ]);
      setReservas(aplicarColaAReservas(resultado.datos, operaciones));
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
      if (
        filtro === 'vigentes'
        && estadoSeleccionado === 'todos'
        && !['reservado', 'en_uso'].includes(estado)
      ) return false;
      if (estadoSeleccionado !== 'todos' && estado !== estadoSeleccionado) return false;
      if (fechaFiltro && !claveFechaValida(fechaFiltro)) return false;
      if (fechaFiltro && reserva.fecha !== fechaFiltro) return false;
      if (!texto) return true;
      return [
        reserva.usuarioEmail,
        reserva.casilleroNumero,
        reserva.casilleroId,
        reserva.zonaNombre,
        reserva.zonaId,
      ]
        .some((campo) => String(campo || '').toLowerCase().includes(texto));
    });
  }, [reservas, busqueda, filtro, estadoSeleccionado, fechaFiltro]);

  const estadisticas = useMemo(() => Object.entries(ESTADOS_RESERVA).map(([estado, datos]) => ({
    estado,
    etiqueta: datos.etiqueta,
    total: reservas.filter((reserva) => obtenerEstadoReserva(reserva) === estado).length,
  })), [reservas]);

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
                  ? {
                    ...item,
                    cancelacionPendiente: true,
                    estadoOperacionLocal: 'pendiente_validacion',
                    tipoOperacionLocal: 'cancelar',
                    errorOperacionLocal: null,
                  }
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

        <Text style={styles.etiquetaFiltro}>Fecha</Text>
        <View style={styles.filaFecha}>
          <TextInput
            accessibilityLabel="Filtrar reservas por fecha"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            onChangeText={setFechaFiltro}
            placeholder="AAAA-MM-DD"
            style={styles.fechaInput}
            value={fechaFiltro}
          />
          {!!fechaFiltro && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setFechaFiltro('')}
              style={styles.limpiarFecha}
            >
              <Text style={styles.limpiarFechaTexto}>Limpiar</Text>
            </Pressable>
          )}
        </View>
        {fechaFiltro && !claveFechaValida(fechaFiltro) ? (
          <Text style={styles.errorFiltro}>Usa el formato AAAA-MM-DD.</Text>
        ) : null}

        <Text style={styles.etiquetaFiltro}>Estado</Text>
        <View style={styles.filtrosEstado}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: estadoSeleccionado === 'todos' }}
            onPress={() => setEstadoSeleccionado('todos')}
            style={[styles.chipEstado, estadoSeleccionado === 'todos' && styles.chipEstadoActivo]}
          >
            <Text style={[styles.chipEstadoTexto, estadoSeleccionado === 'todos' && styles.chipEstadoTextoActivo]}>
              Todos
            </Text>
          </Pressable>
          {Object.entries(ESTADOS_RESERVA).map(([estado, datos]) => (
            <Pressable
              key={estado}
              accessibilityRole="button"
              accessibilityState={{ selected: estadoSeleccionado === estado }}
              onPress={() => setEstadoSeleccionado(estado)}
              style={[styles.chipEstado, estadoSeleccionado === estado && styles.chipEstadoActivo]}
            >
              <Text style={[styles.chipEstadoTexto, estadoSeleccionado === estado && styles.chipEstadoTextoActivo]}>
                {datos.etiqueta}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.etiquetaFiltro}>Totales por estado</Text>
        <View style={styles.estadisticas}>
          {estadisticas.map(({ estado, etiqueta, total }) => (
            <View key={estado} style={styles.estadistica}>
              <Text style={styles.estadisticaNumero}>{total}</Text>
              <Text style={styles.estadisticaEtiqueta}>{etiqueta}</Text>
            </View>
          ))}
        </View>

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
          const liberable = puedeCancelarReserva(reserva)
            && !reserva.cancelacionPendiente
            && !reserva.estadoOperacionLocal;
          return (
            <View key={reserva.id} style={styles.tarjeta}>
              <View style={styles.tarjetaEncabezado}>
                <Text style={styles.casillero}>Casillero {reserva.casilleroNumero || reserva.casilleroId}</Text>
                <EstadoBadge reserva={reserva} />
              </View>
              <Text style={styles.detalle}>{reserva.zonaNombre || 'Zona'}</Text>
              <Text style={styles.detalle}>{reserva.fecha} · {reserva.franja}</Text>
              <Text style={styles.detalle}>Reservado por: {reserva.usuarioEmail}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setReservaDetalle(reserva)}
                style={styles.botonVerDetalle}
              >
                <Text style={styles.botonVerDetalleTexto}>Ver detalle</Text>
              </Pressable>
              {!!etiquetaOperacionLocal(reserva) && (
                <Text style={styles.detallePendiente}>{etiquetaOperacionLocal(reserva)}</Text>
              )}
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
      <Modal
        animationType="slide"
        onRequestClose={() => setReservaDetalle(null)}
        transparent
        visible={Boolean(reservaDetalle)}
      >
        <View style={styles.modalFondo}>
          <View style={styles.modalContenido}>
            <ScrollView>
              <Text style={styles.modalTitulo}>Detalle de reserva</Text>
              {reservaDetalle && (
                <>
                  <Text style={styles.modalDato}>
                    Estado: {ESTADOS_RESERVA[obtenerEstadoReserva(reservaDetalle)]?.etiqueta || 'Reservado'}
                  </Text>
                  <Text style={styles.modalDato}>Casillero: {reservaDetalle.casilleroNumero || reservaDetalle.casilleroId}</Text>
                  <Text style={styles.modalDato}>Zona: {reservaDetalle.zonaNombre || reservaDetalle.zonaId || 'No disponible'}</Text>
                  <Text style={styles.modalDato}>Fecha: {reservaDetalle.fecha || 'No disponible'}</Text>
                  <Text style={styles.modalDato}>Franja: {reservaDetalle.franja || 'No disponible'}</Text>
                  <Text style={styles.modalDato}>Correo: {reservaDetalle.usuarioEmail || 'No disponible'}</Text>
                  <Text style={styles.modalDato}>ID de reserva: {reservaDetalle.id}</Text>
                  {!!reservaDetalle.createdAt && (
                    <Text style={styles.modalDato}>Creada: {reservaDetalle.createdAt}</Text>
                  )}
                  {!!etiquetaOperacionLocal(reservaDetalle) && (
                    <Text style={styles.detallePendiente}>{etiquetaOperacionLocal(reservaDetalle)}</Text>
                  )}
                  {reservaDetalle.cancelacionPendiente && (
                    <Text style={styles.detallePendiente}>Liberación pendiente de validación</Text>
                  )}
                </>
              )}
            </ScrollView>
            <Pressable onPress={() => setReservaDetalle(null)} style={styles.botonCerrarModal}>
              <Text style={styles.botonCerrarTexto}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  etiquetaFiltro: { color: '#2e385b', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  filaFecha: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  limpiarFecha: { padding: 10 },
  limpiarFechaTexto: { color: '#273c9c', fontSize: 14, fontWeight: '700' },
  fechaInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  errorFiltro: { color: '#c0392b', fontSize: 13, marginTop: -10, marginBottom: 12 },
  filtrosEstado: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chipEstado: {
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipEstadoActivo: { backgroundColor: '#273c9c', borderColor: '#273c9c' },
  chipEstadoTexto: { color: '#273c9c', fontSize: 13, fontWeight: '700' },
  chipEstadoTextoActivo: { color: '#fff' },
  estadisticas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  estadistica: {
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 10,
    minWidth: '30%',
    padding: 10,
  },
  estadisticaNumero: { color: '#273c9c', fontSize: 18, fontWeight: '800' },
  estadisticaEtiqueta: { color: '#69728e', fontSize: 12, marginTop: 2 },
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
  botonVerDetalle: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 6 },
  botonVerDetalleTexto: { color: '#273c9c', fontSize: 14, fontWeight: '700' },
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
  modalFondo: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(23, 32, 68, 0.45)',
    padding: 20,
  },
  modalContenido: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '85%', padding: 20 },
  modalTitulo: { color: '#172044', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  modalDato: { color: '#2e385b', fontSize: 15, marginBottom: 10 },
  botonCerrarModal: {
    alignItems: 'center',
    backgroundColor: '#273c9c',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 46,
    marginTop: 16,
  },
  botonCerrarTexto: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
