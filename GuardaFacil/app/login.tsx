import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { auth } from '@/firebase/firebaseConfig';

const firebaseMessages: Record<string, string> = {
  'auth/email-already-in-use': 'Este correo ya tiene una cuenta.',
  'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
  'auth/invalid-email': 'Escribe un correo válido.',
  'auth/network-request-failed': 'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
  'auth/operation-not-allowed': 'El acceso por correo aún no está habilitado en Firebase.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setError('Completa tu correo y contraseña.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, normalizedEmail, password);
      }
    } catch (firebaseError) {
      if (firebaseError instanceof FirebaseError) {
        setError(firebaseMessages[firebaseError.code] ?? 'No pudimos completar la autenticación.');
      } else {
        setError('No pudimos completar la autenticación.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>GF</Text>
        </View>
        <Text style={styles.title}>GuardaFácil</Text>
        <Text style={styles.subtitle}>
          {isRegistering ? 'Crea tu cuenta para comenzar.' : 'Casilleros inteligentes'}
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            placeholderTextColor="#8a928c"
            style={styles.input}
            value={email}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor="#8a928c"
            secureTextEntry
            style={styles.input}
            value={password}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, isSubmitting && styles.disabled]}>
            {isSubmitting ? (
              <ActivityIndicator color="#f8f5ec" />
            ) : (
              <Text style={styles.submitText}>{isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setIsRegistering(!isRegistering);
              setError('');
            }}
            style={styles.switchButton}>
            <Text style={styles.switchText}>
              {isRegistering ? 'Ya tengo una cuenta' : 'Crear una cuenta nueva'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5ec' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  brandMark: { alignItems: 'center', backgroundColor: '#1e4d43', borderRadius: 18, height: 64, justifyContent: 'center', marginBottom: 18, width: 64 },
  brandMarkText: { color: '#f8f5ec', fontSize: 22, fontWeight: '800' },
  title: { color: '#1e4d43', fontSize: 38, fontWeight: '800', letterSpacing: 0 },
  subtitle: { color: '#5d675f', fontSize: 16, marginTop: 8 },
  form: { marginTop: 36 },
  label: { color: '#26352e', fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 18 },
  input: { backgroundColor: '#fffdf8', borderColor: '#d7ddd4', borderRadius: 10, borderWidth: 1, color: '#26352e', fontSize: 16, paddingHorizontal: 16, paddingVertical: 14 },
  error: { color: '#b33b35', fontSize: 14, marginTop: 14 },
  submitButton: { alignItems: 'center', backgroundColor: '#1e4d43', borderRadius: 10, justifyContent: 'center', marginTop: 24, minHeight: 52 },
  submitText: { color: '#f8f5ec', fontSize: 16, fontWeight: '800' },
  switchButton: { alignItems: 'center', marginTop: 22, padding: 8 },
  switchText: { color: '#1e4d43', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.65 },
});