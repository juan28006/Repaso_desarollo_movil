import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { obtenerCasillero } from '../services/zonasService';

export default function DetalleCasilleroScreen({ route }) {
  const { zonaId, casilleroId, zonaNombre } = route.params;
  const [casillero, setCasillero] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cargarCasillero = async () => {
      try {
        const datos = await obtenerCasillero(zonaId, casilleroId);
        setCasillero(datos);
      } catch (err) {
        setError('No se pudo cargar el casillero.');
      } finally {
        setCargando(false);
      }
    };
    cargarCasillero();
  }, [zonaId, casilleroId]);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !casillero) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.errorTexto}>{error || 'Casillero no encontrado.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.numero}>{casillero.numero}</Text>

      <View
        style={[
          styles.badge,
          { backgroundColor: casillero.disponible ? '#2ecc71' : '#e74c3c' },
        ]}
      >
        <Text style={styles.badgeTexto}>
          {casillero.disponible ? 'Disponible' : 'Ocupado'}
        </Text>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.etiqueta}>Ubicación</Text>
        <Text style={styles.valor}>{zonaNombre}</Text>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.etiqueta}>Tamaño</Text>
        <Text style={styles.valor}>{casillero.tamano}</Text>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.etiqueta}>Estado</Text>
        <Text style={styles.valor}>{casillero.estado}</Text>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.etiqueta}>Reglas de uso</Text>
        <Text style={styles.valor}>{casillero.reglas}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  numero: { fontSize: 26, fontWeight: 'bold', marginBottom: 8 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 20,
  },
  badgeTexto: { color: '#fff', fontWeight: '600', fontSize: 13 },
  seccion: { marginBottom: 16 },
  etiqueta: { fontSize: 13, color: '#888', marginBottom: 4, textTransform: 'uppercase' },
  valor: { fontSize: 16, color: '#222' },
  errorTexto: { fontSize: 16, color: '#e74c3c' },
});