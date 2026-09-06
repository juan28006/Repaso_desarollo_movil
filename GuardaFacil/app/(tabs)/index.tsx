import { signOut } from 'firebase/auth';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { auth } from '@/firebase/firebaseConfig';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Sesión activa</Text>
      <Text style={styles.title}>Bienvenido a GuardaFácil</Text>
      <Text style={styles.email}>{auth.currentUser?.email}</Text>
      <Text style={styles.description}>Casilleros inteligentes</Text>
      <Pressable onPress={() => signOut(auth)} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f8f5ec', flex: 1, padding: 28, paddingTop: 80 },
  eyebrow: { color: '#1e4d43', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#26352e', fontSize: 32, fontWeight: '800', marginTop: 14 },
  email: { color: '#1e4d43', fontSize: 16, marginTop: 12 },
  description: { color: '#5d675f', fontSize: 16, lineHeight: 24, marginTop: 34 },
  logoutButton: { alignItems: 'center', borderColor: '#1e4d43', borderRadius: 10, borderWidth: 1, marginTop: 36, minHeight: 48, justifyContent: 'center' },
  logoutText: { color: '#1e4d43', fontSize: 16, fontWeight: '800' },
});
