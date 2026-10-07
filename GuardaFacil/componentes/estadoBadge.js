import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ESTADOS_RESERVA } from '../constantes/estadosReserva';

export default function EstadoBadge({ estado }) {
  const config = ESTADOS_RESERVA[estado] || ESTADOS_RESERVA.reservado;

  return (
    <View style={[styles.badge, { backgroundColor: config.color }]}>
      <Text style={styles.texto}>{config.etiqueta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' },
  texto: { color: '#fff', fontWeight: '700', fontSize: 13 },
});