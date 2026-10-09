import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useEstadoConexion } from '../contextos/EstadoConexionContexto';

export default function IndicadorConexion() {
  const { conectado } = useEstadoConexion();
  const etiqueta = conectado === null
    ? 'Comprobando conexión'
    : conectado
      ? 'Conectado'
      : 'Sin conexión';

  return (
    <View
      accessibilityLabel={`Estado de conexión: ${etiqueta}`}
      style={[styles.indicador, conectado ? styles.conectado : styles.desconectado]}
    >
      <Text style={[styles.texto, conectado && styles.textoConectado]}>{etiqueta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  indicador: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  conectado: { backgroundColor: '#e7f7ee' },
  desconectado: { backgroundColor: '#fff1e8' },
  texto: { color: '#9b3c18', fontSize: 11, fontWeight: '700' },
  textoConectado: { color: '#187044' },
});
