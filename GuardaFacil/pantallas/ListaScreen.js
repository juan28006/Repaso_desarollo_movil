import React, { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuthContexto } from '../contextos/AuthContexto';
import { obtenerZonas } from '../services/zonasService';

export default function ListaScreen({ navigation }) {
  const { usuario, cerrarSesion } = useAuthContexto();
  const [zonas, setZonas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarZonas = async () => {
      try {
        const datos = await obtenerZonas();
        setZonas(datos);
      } catch (error) {
        console.error('Error cargando zonas:', error);
      } finally {
        setCargando(false);
      }
    };
    cargarZonas();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenido a GuardaFácil</Text>
      <Text style={styles.email}>{usuario?.email}</Text>
      <Text style={styles.description}>Zonas disponibles:</Text>

      {cargando ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={zonas}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => navigation.navigate('Casilleros', { zonaId: item.id, zonaNombre: item.nombre })}
            >
              <Text style={styles.nombreZona}>{item.nombre}</Text>
              <Text style={styles.ubicacion}>{item.ubicacion}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Button title="Cerrar sesión" onPress={cerrarSesion} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, padding: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  email: { color: '#007AFF', fontSize: 16 },
  description: { color: '#555', fontSize: 16 },
  item: {
    padding: 16,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  nombreZona: { fontSize: 16, fontWeight: '600' },
  ubicacion: { fontSize: 14, color: '#666' },
});