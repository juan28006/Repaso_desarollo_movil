import React, { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuthContexto } from '../contextos/AuthContexto';

export default function LoginScreen() {
  const { iniciarSesion, registrarUsuario } = useAuthContexto();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const autenticar = async () => {
    if (!correo.trim() || !contrasena) {
      setError('Completa tu correo y contraseña.');
      return;
    }

    try {
      setError('');
      setCargando(true);
      if (registrando) await registrarUsuario(correo, contrasena);
      else await iniciarSesion(correo, contrasena);
    } catch {
      setError('No se pudo completar la autenticación.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GuardaFácil</Text>
      <Text style={styles.subtitle}>{registrando ? 'Crear cuenta' : 'Iniciar sesión'}</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setCorreo}
        placeholder="Correo electrónico"
        style={styles.input}
        value={correo}
      />
      <TextInput
        onChangeText={setContrasena}
        placeholder="Contraseña"
        secureTextEntry
        style={styles.input}
        value={contrasena}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      {cargando ? <ActivityIndicator /> : <Button title={registrando ? 'Crear cuenta' : 'Ingresar'} onPress={autenticar} />}
      <Button
        title={registrando ? 'Ya tengo una cuenta' : 'Crear una cuenta'}
        onPress={() => {
          setRegistrando(!registrando);
          setError('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 14, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 20, marginBottom: 8 },
  input: { borderColor: '#999', borderWidth: 1, padding: 12 },
  error: { color: '#b00020' },
});
