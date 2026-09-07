import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useAuthContexto } from '../contextos/AuthContexto';

export default function ListaScreen() {
  const { usuario, cerrarSesion } = useAuthContexto();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenido a GuardaFácil</Text>
      <Text style={styles.email}>{usuario?.email}</Text>
      <Text style={styles.description}>Este es el inicio de la aplicación.</Text>
      <Button title="Cerrar sesión" onPress={cerrarSesion} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  email: { color: '#007AFF', fontSize: 16 },
  description: { color: '#555', fontSize: 16 },
});
