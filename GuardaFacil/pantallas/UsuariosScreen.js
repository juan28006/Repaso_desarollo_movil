import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContexto } from '../contextos/AuthContexto';
import AvisoOffline from '../componentes/AvisoOffline';
import { ETIQUETAS_ROL, ROLES } from '../constantes/roles';
import { cambiarRolUsuario, obtenerUsuarios } from '../services/gestionService';

export default function UsuariosScreen() {
  const { usuario } = useAuthContexto();
  const [usuarios, setUsuarios] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [cambiandoUid, setCambiandoUid] = useState(null);

  const cargar = useCallback(async () => {
    if (!usuario?.uid) return;
    setCargando(true);
    try {
      const resultado = await obtenerUsuarios(usuario.uid);
      setUsuarios(resultado.datos);
      setCacheInfo(resultado);
      setError('');
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      setError('No se pudieron cargar los usuarios. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const confirmarCambio = (objetivo, rol) => {
    if (objetivo.rol === rol) return;
    Alert.alert(
      'Cambiar rol',
      `¿Convertir a ${objetivo.email} en ${ETIQUETAS_ROL[rol].toLowerCase()}?`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cambiar',
          onPress: async () => {
            setCambiandoUid(objetivo.uid);
            try {
              const actualizado = await cambiarRolUsuario(usuario.uid, objetivo.uid, rol);
              setUsuarios((actuales) => actuales.map((item) => (
                item.uid === objetivo.uid ? { ...item, rol: actualizado.rol } : item
              )));
            } catch (err) {
              Alert.alert(
                'No se pudo cambiar el rol',
                err.code === 'network-request-failed' || err.code === 'unavailable'
                  ? 'Cambiar roles requiere conexión con el servidor.'
                  : err.message || 'Inténtalo nuevamente.'
              );
            } finally {
              setCambiandoUid(null);
            }
          },
        },
      ]
    );
  };

  if (cargando && usuarios.length === 0) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#273c9c" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.contenido}
        data={usuarios}
        keyExtractor={(item) => item.uid}
        refreshing={false}
        onRefresh={cargar}
        ListHeaderComponent={(
          <View>
            <Text style={styles.titulo}>Usuarios y roles</Text>
            <Text style={styles.descripcion}>Define quién es estudiante, gestor o administrador.</Text>
            <AvisoOffline
              desdeCache={cacheInfo?.desdeCache}
              actualizadoEn={cacheInfo?.actualizadoEn}
              cacheError={cacheInfo?.cacheError}
            />
            {error ? <Text style={styles.errorTexto}>{error}</Text> : null}
          </View>
        )}
        renderItem={({ item }) => {
          const esPropio = item.uid === usuario.uid;
          return (
            <View style={styles.tarjeta}>
              <Text style={styles.nombre}>{item.nombreCompleto || item.email}</Text>
              <Text style={styles.correo}>{item.email}{esPropio ? ' (tú)' : ''}</Text>
              <View style={styles.roles}>
                {Object.values(ROLES).map((rol) => (
                  <Pressable
                    key={rol}
                    accessibilityRole="button"
                    disabled={esPropio || cambiandoUid === item.uid}
                    style={[
                      styles.chip,
                      item.rol === rol && styles.chipActivo,
                      (esPropio || cambiandoUid === item.uid) && styles.chipDeshabilitado,
                    ]}
                    onPress={() => confirmarCambio(item, rol)}
                  >
                    <Text style={[styles.chipTexto, item.rol === rol && styles.chipTextoActivo]}>
                      {ETIQUETAS_ROL[rol]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7ff' },
  contenido: { padding: 24, paddingBottom: 40 },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 28, fontWeight: '800', color: '#172044' },
  descripcion: { color: '#69728e', fontSize: 15, marginTop: 6, marginBottom: 16 },
  errorTexto: { color: '#c0392b', fontSize: 14, marginBottom: 12 },
  tarjeta: {
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  nombre: { color: '#172044', fontSize: 16, fontWeight: '700' },
  correo: { color: '#69728e', fontSize: 14, marginTop: 2 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActivo: { backgroundColor: '#273c9c', borderColor: '#273c9c' },
  chipDeshabilitado: { opacity: 0.6 },
  chipTexto: { color: '#273c9c', fontSize: 13, fontWeight: '700' },
  chipTextoActivo: { color: '#fff' },
});
