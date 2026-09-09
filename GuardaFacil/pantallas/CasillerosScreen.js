import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { obtenerCasilleros } from '../services/zonasService';

export default function CasillerosScreen({ route, navigation }) {
  const { zonaId, zonaNombre } = route.params;
  const [casilleros, setCasilleros] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarCasilleros = async () => {
      try {
        const datos = await obtenerCasilleros(zonaId);
        setCasilleros(datos);
      } catch (error) {
        console.error('Error cargando casilleros:', error);
      } finally {
        setCargando(false);
      }
    };
    cargarCasilleros();
  }, [zonaId]);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>{zonaNombre}</Text>
      <FlatList
        data={casilleros}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              navigation.navigate('DetalleCasillero', {
                zonaId,
                casilleroId: item.id,
                zonaNombre,
              })
            }
          >
            <View>
              <Text style={styles.numero}>{item.numero}</Text>
              <Text style={styles.tamano}>Tamaño: {item.tamano}</Text>
            </View>
            <View
              style={[
                styles.badge,
                { backgroundColor: item.disponible ? '#2ecc71' : '#e74c3c' },
              ]}
            >
              <Text style={styles.badgeTexto}>
                {item.disponible ? 'Disponible' : 'Ocupado'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  numero: { fontSize: 16, fontWeight: '600' },
  tamano: { fontSize: 14, color: '#666' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  badgeTexto: { color: '#fff', fontWeight: '600', fontSize: 12 },
});