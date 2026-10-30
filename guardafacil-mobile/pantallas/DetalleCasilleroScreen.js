import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContexto } from '../contextos/AuthContexto';
import { useEstadoConexion } from '../contextos/EstadoConexionContexto';
import AvisoOffline from '../componentes/AvisoOffline';
import {
  obtenerCasillero,
  verificarDisponibilidadCasillero,
} from '../services/zonasService';
import { ejecutarOEncolar } from '../services/offlineQueueService';
import { esPersonal } from '../constantes/roles';
import {
  colorEstadoCasillero,
  etiquetaEstadoCasillero,
  normalizarEstadoCasillero,
} from '../constantes/estadosCasillero';

const franjasDisponibles = ['Mañana', 'Tarde', 'Noche'];

const formatearFecha = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DetalleCasilleroScreen({ route, navigation }) {
  const { zonaId, casilleroId, zonaNombre } = route.params;
  const { usuario, rol } = useAuthContexto();
  const { conectado, puedeContactarApi, actualizarCola } = useEstadoConexion();
  const [casillero, setCasillero] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [fecha, setFecha] = useState('');
  const [mostrarListaFechas, setMostrarListaFechas] = useState(false);
  const [franjaSeleccionada, setFranjaSeleccionada] = useState('Mañana');
  const [guardando, setGuardando] = useState(false);
  // Solo gestor/administrador: reservar en nombre de un estudiante.
  const [correoEstudiante, setCorreoEstudiante] = useState('');
  const [disponibilidad, setDisponibilidad] = useState({
    disponible: null,
    cargando: false,
    solicitud: null,
    error: null,
  });
  const [intentoDisponibilidad, setIntentoDisponibilidad] = useState(0);
  const solicitudDisponibilidad = fecha
    ? `${casilleroId}:${fecha}:${franjaSeleccionada}:${intentoDisponibilidad}`
    : null;
  const disponibilidadActual = solicitudDisponibilidad
    && disponibilidad.solicitud === solicitudDisponibilidad
    ? disponibilidad
    : null;
  const disponibilidadCargando = Boolean(
    puedeContactarApi
    && solicitudDisponibilidad
    && (!disponibilidadActual || disponibilidadActual.cargando)
  );
  const disponibilidadValor = puedeContactarApi
    ? disponibilidadActual?.disponible ?? null
    : null;
  const errorDisponibilidad = puedeContactarApi
    ? disponibilidadActual?.error
    : null;
  const disponibilidadConfirmada = Boolean(
    disponibilidadValor === true && !disponibilidadCargando
  );

  const opcionesFechas = React.useMemo(() => {
    const fechaBase = new Date();
    const lista = [];

    for (let index = 0; index < 10; index += 1) {
      const fechaActual = new Date(fechaBase);
      fechaActual.setDate(fechaBase.getDate() + index);

      lista.push({
        valor: formatearFecha(fechaActual),
        etiqueta: new Intl.DateTimeFormat('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(fechaActual),
      });
    }

    return lista;
  }, []);

  const cargarCasillero = useCallback(async () => {
    try {
      const resultado = await obtenerCasillero(usuario.uid, zonaId, casilleroId);
      setCasillero(resultado.datos);
      setCacheInfo(resultado);
      setError(null);
    } catch (err) {
      console.error('Error cargando el casillero:', err);
      setCasillero(null);
      setCacheInfo(null);
      setError('No se pudo cargar el casillero. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [usuario, zonaId, casilleroId]);

  useEffect(() => {
    if (!usuario?.uid) return undefined;
    const temporizador = setTimeout(cargarCasillero, 0);
    return () => clearTimeout(temporizador);
  }, [usuario?.uid, conectado, cargarCasillero]);

  useEffect(() => {
    let activa = true;

    if (!fecha || !puedeContactarApi) {
      return () => { activa = false; };
    }

    Promise.resolve().then(() => {
      if (!activa) return null;
      setDisponibilidad({
        disponible: null,
        cargando: true,
        solicitud: solicitudDisponibilidad,
        error: null,
      });
      return verificarDisponibilidadCasillero({
        casilleroId,
        fecha,
        franja: franjaSeleccionada,
      });
    }).then((disponible) => {
      if (!activa) return;
      if (typeof disponible !== 'boolean') {
        throw new Error('El servidor devolvió una respuesta de disponibilidad inválida.');
      }

      setDisponibilidad({
        disponible,
        cargando: false,
        solicitud: solicitudDisponibilidad,
        error: null,
      });
    }).catch((err) => {
      console.error('No se pudo validar la disponibilidad en el servidor:', err);
      if (activa) {
        setDisponibilidad({
          disponible: null,
          cargando: false,
          solicitud: solicitudDisponibilidad,
          error: err.message || 'No se pudo comprobar la disponibilidad.',
        });
      }
    });

    return () => { activa = false; };
  }, [casilleroId, fecha, franjaSeleccionada, puedeContactarApi, solicitudDisponibilidad]);

  const manejarReserva = async () => {
    if (!usuario) {
      Alert.alert('Debes iniciar sesión para reservar un casillero.');
      return;
    }

    if (!fecha.trim()) {
      Alert.alert('Selecciona una fecha para la reserva.');
      return;
    }

    if (!franjaSeleccionada) {
      Alert.alert('Selecciona una franja de tiempo.');
      return;
    }

    if (puedeContactarApi && !disponibilidadConfirmada) {
      Alert.alert(
        'Disponibilidad pendiente',
        disponibilidadValor === false
          ? 'El casillero no está disponible para la fecha y franja seleccionadas.'
          : 'Espera a que se compruebe la disponibilidad antes de reservar.'
      );
      return;
    }

    try {
      setGuardando(true);

      const payloadReserva = {
        zonaId,
        casilleroId,
        usuarioId: usuario.uid,
        usuarioEmail: (esPersonal(rol) && correoEstudiante.trim()) || usuario.email,
        fecha: fecha.trim(),
        franja: franjaSeleccionada,
        zonaNombre,
        casilleroNumero: casillero.numero,
      };
      const respuesta = await ejecutarOEncolar(
        usuario.uid,
        'reservar',
        payloadReserva,
        puedeContactarApi
      );
      try {
        await actualizarCola();
      } catch (error) {
        console.error('No se pudo refrescar el indicador de operaciones pendientes:', error);
      }

      if (respuesta.pendiente) {
        Alert.alert(
          'Reserva pendiente de validación',
          'La solicitud se guardó en este dispositivo. No está confirmada y se comprobará con el servidor cuando vuelva la conexión.',
          [{ text: 'Aceptar', onPress: () => navigation.goBack() }]
        );
        return;
      }

      setCasillero((casilleroActual) => ({
        ...casilleroActual,
        disponible: false,
        estado: 'reservado',
        reservaFecha: respuesta.resultado.fecha,
        reservaFranja: respuesta.resultado.franja,
      }));

      Alert.alert(
        'Reserva guardada',
        `El casillero ${casillero.numero} quedó reservado para ${respuesta.resultado.fecha} en la franja ${respuesta.resultado.franja}.`,
        [
          {
            text: 'Aceptar',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err) {
      Alert.alert('No se pudo guardar la reserva', err.message || 'Inténtalo nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  const onSeleccionarFecha = (valorFecha) => {
    setFecha(valorFecha);
    setMostrarListaFechas(false);
  };

  const onSeleccionarFranja = (nuevaFranja) => {
    setFranjaSeleccionada(nuevaFranja);
  };

  const estadoActual = normalizarEstadoCasillero(casillero || {});
  const botonReservaDeshabilitado = guardando
    || (puedeContactarApi && !disponibilidadConfirmada);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#273c9c" />
      </View>
    );
  }

  if (!casillero) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.errorTexto}>{error || 'Casillero no encontrado.'}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setCargando(true);
            cargarCasillero();
          }}
        >
          <Text style={styles.reintentar}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.numero}>{casillero.numero}</Text>
        {error && <Text style={styles.errorTexto}>{error} Se muestran los datos guardados.</Text>}
        <AvisoOffline
          desdeCache={cacheInfo?.desdeCache}
          actualizadoEn={cacheInfo?.actualizadoEn}
          cacheError={cacheInfo?.cacheError}
        />

        <View style={[styles.estadoActual, { backgroundColor: colorEstadoCasillero(estadoActual) }]}>
          <Text style={styles.estadoActualTexto}>
            Estado del casillero: {etiquetaEstadoCasillero(estadoActual)}
          </Text>
        </View>

        <View
          style={[
            styles.badge,
            {
              backgroundColor: disponibilidadCargando
                ? '#f39c12'
                : disponibilidadValor === true
                  ? '#2ecc71'
                  : disponibilidadValor === false
                    ? '#e74c3c'
                    : '#7f8c8d',
            },
          ]}
        >
          <Text style={styles.badgeTexto}>
            {disponibilidadCargando
              ? 'Comprobando...'
              : disponibilidadValor === true
                ? 'Disponible para esta fecha y franja'
                : disponibilidadValor === false
                  ? 'No disponible para esta fecha y franja'
                  : 'Sin validar'}
          </Text>
        </View>
        {!!errorDisponibilidad && (
          <View>
            <Text style={styles.errorTexto}>
              No se pudo comprobar la disponibilidad. {errorDisponibilidad}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIntentoDisponibilidad((intento) => intento + 1)}
            >
              <Text style={styles.reintentar}>Reintentar comprobación</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.seccion}>
          <Text style={styles.etiqueta}>Ubicación</Text>
          <Text style={styles.valor}>{zonaNombre}</Text>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.etiqueta}>Tamaño</Text>
          <Text style={styles.valor}>{casillero.tamano}</Text>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.etiqueta}>
            {cacheInfo?.desdeCache || conectado === false ? 'Último estado guardado' : 'Estado actual'}
          </Text>
          <Text style={styles.valor}>{etiquetaEstadoCasillero(estadoActual)}</Text>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.etiqueta}>Reglas de uso</Text>
          {Array.isArray(casillero.reglas) ? (
            casillero.reglas.map((regla, index) => (
              <Text key={index} style={styles.valor}>• {regla}</Text>
            ))
          ) : (
            <Text style={styles.valor}>{casillero.reglas}</Text>
          )}
        </View>

        <View style={styles.seccion}>
          <Text style={styles.etiqueta}>Reservar casillero</Text>

          {esPersonal(rol) && (
            <TextInput
              style={styles.input}
              placeholder="Correo del estudiante (vacío = reservar para ti)"
              value={correoEstudiante}
              onChangeText={setCorreoEstudiante}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          )}

          <Pressable
            style={styles.input}
            onPress={() => setMostrarListaFechas((valorActual) => !valorActual)}
          >
            <View style={styles.inputContent}>
              <Text style={[styles.inputTexto, !fecha && styles.inputTextoPlaceholder]}>
                {fecha || 'Selecciona una fecha'}
              </Text>
              <Text style={styles.inputArrow}>{mostrarListaFechas ? '▲' : '▼'}</Text>
            </View>
          </Pressable>

          {mostrarListaFechas && (
            <View style={styles.dropdown}>
              {opcionesFechas.map((opcion) => (
                <Pressable
                  key={opcion.valor}
                  style={[
                    styles.dropdownItem,
                    fecha === opcion.valor && styles.dropdownItemActivo,
                  ]}
                  onPress={() => onSeleccionarFecha(opcion.valor)}
                >
                  <Text
                    style={[
                      styles.dropdownItemTexto,
                      fecha === opcion.valor && styles.dropdownItemTextoActivo,
                    ]}
                  >
                    {opcion.etiqueta}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.franjasContainer}>
            {franjasDisponibles.map((franja) => (
              <Pressable
                key={franja}
                style={[
                  styles.franjaBoton,
                  franjaSeleccionada === franja && styles.franjaBotonActivo,
                ]}
                onPress={() => onSeleccionarFranja(franja)}
              >
                <Text
                  style={[
                    styles.franjaBotonTexto,
                    franjaSeleccionada === franja && styles.franjaBotonTextoActivo,
                  ]}
                >
                  {franja}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[
              styles.primaryButton,
              botonReservaDeshabilitado && styles.primaryButtonDisabled,
            ]}
            onPress={manejarReserva}
            disabled={botonReservaDeshabilitado}
          >
            <Text style={styles.primaryButtonText}>
              {guardando
                ? 'Guardando reserva...'
                : puedeContactarApi && disponibilidadCargando
                  ? 'Comprobando disponibilidad...'
                  : 'Reservar casillero'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7ff' },
  scrollContent: { padding: 24, paddingBottom: 40 },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  numero: { fontSize: 28, fontWeight: '800', color: '#172044', marginBottom: 8 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 20,
  },
  badgeTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  estadoActual: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    marginBottom: 12,
  },
  estadoActualTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  seccion: { marginBottom: 18 },
  etiqueta: { fontSize: 14, color: '#273c9c', fontWeight: '600', marginBottom: 6 },
  valor: { fontSize: 16, color: '#172044' },
  input: {
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    justifyContent: 'center',
    minHeight: 48,
  },
  inputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputTexto: {
    fontSize: 16,
    color: '#172044',
  },
  inputTextoPlaceholder: {
    color: '#69728e',
  },
  inputArrow: {
    fontSize: 16,
    color: '#273c9c',
    fontWeight: '700',
    marginLeft: 12,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#edf1fb',
  },
  dropdownItemActivo: {
    backgroundColor: '#eef4ff',
  },
  dropdownItemTexto: {
    fontSize: 15,
    color: '#172044',
  },
  dropdownItemTextoActivo: {
    color: '#273c9c',
    fontWeight: '700',
  },
  franjasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  franjaBoton: {
    borderWidth: 1,
    borderColor: '#d2d8ed',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  franjaBotonActivo: {
    backgroundColor: '#273c9c',
    borderColor: '#273c9c',
  },
  franjaBotonTexto: { color: '#172044', fontWeight: '700' },
  franjaBotonTextoActivo: { color: '#fff' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#273c9c',
    borderRadius: 12,
    minHeight: 54,
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#a5afd4',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorTexto: { fontSize: 16, color: '#e74c3c', fontWeight: '600' },
  reintentar: { color: '#273c9c', fontSize: 14, fontWeight: '700', marginTop: 12 },
});
