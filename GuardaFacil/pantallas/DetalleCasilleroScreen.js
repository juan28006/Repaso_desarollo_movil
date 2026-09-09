import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
        <ActivityIndicator size="large" color="#273c9c" />
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.numero}>{casillero.numero}</Text>

        <View style={[ styles.badge,
          { backgroundColor: casillero.disponible ? '#2ecc71' : '#e74c3c' },]}
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
          {Array.isArray(casillero.reglas) ? (
            casillero.reglas.map((regla, index) => (
              <Text key={index} style={styles.valor}>• {regla}</Text>
            ))
          ) : (
            <Text style={styles.valor}>{casillero.reglas}</Text>
          )}
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
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, 
    paddingVertical: 6, borderRadius: 12, marginBottom: 20,},
  badgeTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  seccion: { marginBottom: 18 },
  etiqueta: { fontSize: 14, color: '#273c9c', fontWeight: '600', marginBottom: 6 },
  valor: { fontSize: 16, color: '#172044' },
  errorTexto: { fontSize: 16, color: '#e74c3c', fontWeight: '600' },
});
