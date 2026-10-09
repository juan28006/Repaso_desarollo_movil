import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthContexto } from '../contextos/AuthContexto';
import { useEstadoConexion } from '../contextos/EstadoConexionContexto';
import { descartarConflictoOffline } from '../services/offlineQueueService';

const ETIQUETAS_OPERACION = {
  reservar: 'Reserva pendiente de validación',
  cancelar: 'Cancelación pendiente de validación',
  iniciar_uso: 'Inicio de uso pendiente de validación',
};

export default function AvisoOffline({ desdeCache = false, actualizadoEn = null, cacheError = null }) {
  const { usuario } = useAuthContexto();
  const {
    conectado,
    puedeContactarFirestore,
    cola,
    sincronizando,
    reintentarSincronizacion,
    actualizarCola,
  } = useEstadoConexion();
  const mostrarAviso = conectado === false || desdeCache || cola.length > 0 || cacheError;
  if (!mostrarAviso) return null;

  return (
    <View style={styles.contenedor}>
      {conectado === false && (
        <Text style={styles.aviso}>
          Estás sin conexión. La disponibilidad puede estar desactualizada.
        </Text>
      )}
      {desdeCache && (
        <Text style={styles.detalle}>
          Mostrando datos guardados{actualizadoEn
            ? ` · actualizados ${new Date(actualizadoEn).toLocaleString()}`
            : ''}.
        </Text>
      )}
      {cacheError && <Text style={styles.error}>{cacheError}</Text>}
      {cola.map((operacion) => (
        <View key={operacion.id}>
          <Text style={styles.detalle}>
            {ETIQUETAS_OPERACION[operacion.tipo] || 'Operación pendiente'}
            {operacion.datos?.casilleroNumero
              ? ` · Casillero ${operacion.datos.casilleroNumero} · ${operacion.datos.fecha} · ${operacion.datos.franja}`
              : operacion.datos?.reservaId
                ? ` · Reserva ${operacion.datos.reservaId}`
                : ''}
            {operacion.estado === 'conflicto'
              ? ` · Conflicto: ${operacion.ultimoError}`
              : operacion.estado === 'error' || operacion.ultimoError
                ? ` · ${operacion.ultimoError}`
                : ' · esperando sincronización'}
          </Text>
          {operacion.estado === 'conflicto' && usuario?.uid && (
            <Pressable
              accessibilityRole="button"
              onPress={() => Alert.alert(
                'Descartar operación en conflicto',
                'Esto eliminará de este dispositivo la solicitud local no confirmada. Firestore no se modificará.',
                [
                  { text: 'Conservar', style: 'cancel' },
                  {
                    text: 'Descartar solicitud',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await descartarConflictoOffline(usuario.uid, operacion.id);
                        await actualizarCola();
                      } catch (error) {
                        console.error('No se pudo descartar la operación local:', error);
                        Alert.alert('No se pudo descartar', error.message);
                      }
                    },
                  },
                ]
              )}
              style={styles.boton}
            >
              <Text style={styles.botonTexto}>Descartar solicitud local</Text>
            </Pressable>
          )}
        </View>
      ))}
      {puedeContactarFirestore && cola.length > 0 && (
        <Pressable
          accessibilityRole="button"
          disabled={sincronizando}
          onPress={reintentarSincronizacion}
          style={styles.boton}
        >
          <Text style={styles.botonTexto}>
            {sincronizando ? 'Sincronizando…' : 'Reintentar sincronización'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: '#fff4dc',
    borderColor: '#f0ca79',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  aviso: { color: '#704900', fontSize: 13, fontWeight: '700' },
  detalle: { color: '#704900', fontSize: 12, marginTop: 5 },
  error: { color: '#a12d22', fontSize: 12, marginTop: 5 },
  boton: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  botonTexto: { color: '#273c9c', fontSize: 13, fontWeight: '700' },
});
