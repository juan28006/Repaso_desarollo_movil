import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContexto } from '../contextos/AuthContexto';
import AvisoOffline from '../componentes/AvisoOffline';
import { ETIQUETAS_ROL, ROLES } from '../constantes/roles';
import {
  actualizarUsuario,
  cambiarRolUsuario,
  eliminarUsuario,
  obtenerUsuarios,
} from '../services/gestionService';

const errorDeRed = (error) => ['network-request-failed', 'unavailable', 'deadline-exceeded']
  .includes(error?.code)
  ? 'Esta acción requiere conexión con el servidor.'
  : error?.message || 'Inténtalo nuevamente.';

export default function UsuariosScreen() {
  const { usuario } = useAuthContexto();
  const [usuarios, setUsuarios] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [cambiandoUid, setCambiandoUid] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('todos');
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [nombreEditado, setNombreEditado] = useState('');
  const [cedulaEditada, setCedulaEditada] = useState('');
  const [errorEdicion, setErrorEdicion] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const usuariosFiltrados = usuarios.filter((item) => {
    if (filtroRol !== 'todos' && item.rol !== filtroRol) return false;
    const texto = busqueda.trim().toLowerCase();
    return !texto || [
      item.nombreCompleto,
      item.email,
      item.cedula,
    ].some((campo) => String(campo || '').toLowerCase().includes(texto));
  });

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

  const abrirEdicion = (objetivo) => {
    setUsuarioEditando(objetivo);
    setNombreEditado(objetivo.nombreCompleto || '');
    setCedulaEditada('');
    setErrorEdicion('');
  };

  const guardarEdicion = async () => {
    const nombreCompleto = nombreEditado.trim();
    const cedula = cedulaEditada.trim();
    if (!nombreCompleto) {
      setErrorEdicion('Escribe el nombre completo.');
      return;
    }
    if (cedula && !/^\d{6,12}$/.test(cedula)) {
      setErrorEdicion('La cédula debe tener entre 6 y 12 dígitos.');
      return;
    }

    setGuardandoEdicion(true);
    setErrorEdicion('');
    try {
      const cambios = { nombreCompleto };
      if (cedula) cambios.cedula = cedula;
      const actualizado = await actualizarUsuario(usuario.uid, usuarioEditando.uid, cambios);
      setUsuarios((actuales) => actuales.map((item) => (
        item.uid === usuarioEditando.uid ? { ...item, ...actualizado } : item
      )));
      setUsuarioEditando(null);
    } catch (err) {
      setErrorEdicion(errorDeRed(err));
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const confirmarEliminacion = (objetivo) => {
    Alert.alert(
      'Eliminar usuario',
      `¿Eliminar la cuenta de ${objetivo.nombreCompleto || objetivo.email}? Esta acción no se puede deshacer.`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setCambiandoUid(objetivo.uid);
            try {
              await eliminarUsuario(usuario.uid, objetivo.uid);
              setUsuarios((actuales) => actuales.filter((item) => item.uid !== objetivo.uid));
            } catch (err) {
              Alert.alert('No se pudo eliminar el usuario', errorDeRed(err));
            } finally {
              setCambiandoUid(null);
            }
          },
        },
      ]
    );
  };

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
                errorDeRed(err)
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
        data={usuariosFiltrados}
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
            <TextInput
              accessibilityLabel="Buscar usuarios"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setBusqueda}
              placeholder="Buscar por nombre, correo o cédula"
              style={styles.buscador}
              value={busqueda}
            />
            <View style={styles.rolesFiltro}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: filtroRol === 'todos' }}
                onPress={() => setFiltroRol('todos')}
                style={[styles.chip, filtroRol === 'todos' && styles.chipActivo]}
              >
                <Text style={[styles.chipTexto, filtroRol === 'todos' && styles.chipTextoActivo]}>Todos</Text>
              </Pressable>
              {Object.values(ROLES).map((rol) => (
                <Pressable
                  key={rol}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filtroRol === rol }}
                  onPress={() => setFiltroRol(rol)}
                  style={[styles.chip, filtroRol === rol && styles.chipActivo]}
                >
                  <Text style={[styles.chipTexto, filtroRol === rol && styles.chipTextoActivo]}>
                    {ETIQUETAS_ROL[rol]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.vacio}>
            <Text style={styles.descripcion}>No hay usuarios que coincidan con la búsqueda.</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const esPropio = item.uid === usuario?.uid;
          return (
            <View style={styles.tarjeta}>
              <Text style={styles.nombre}>{item.nombreCompleto || item.email}</Text>
              <Text style={styles.correo}>{item.email}{esPropio ? ' (tú)' : ''}</Text>
              {!!item.cedula && <Text style={styles.correo}>Cédula: {item.cedula}</Text>}
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
              <View style={styles.acciones}>
                <Pressable
                  accessibilityRole="button"
                  disabled={esPropio || Boolean(cambiandoUid) || guardandoEdicion}
                  onPress={() => abrirEdicion(item)}
                  style={[styles.botonAccion, (esPropio || Boolean(cambiandoUid)) && styles.chipDeshabilitado]}
                >
                  <Text style={styles.botonAccionTexto}>Editar datos</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={esPropio || Boolean(cambiandoUid) || guardandoEdicion}
                  onPress={() => confirmarEliminacion(item)}
                  style={[styles.botonAccion, styles.botonEliminar, (esPropio || Boolean(cambiandoUid)) && styles.chipDeshabilitado]}
                >
                  <Text style={styles.botonEliminarTexto}>
                    {cambiandoUid === item.uid ? 'Eliminando...' : 'Eliminar'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
      <Modal
        animationType="slide"
        onRequestClose={() => {
          if (!guardandoEdicion) setUsuarioEditando(null);
        }}
        transparent
        visible={Boolean(usuarioEditando)}
      >
        <View style={styles.modalFondo}>
          <View style={styles.modalContenido}>
            <Text style={styles.modalTitulo}>Editar usuario</Text>
            <Text style={styles.etiquetaCampo}>Nombre completo</Text>
            <TextInput
              autoCapitalize="words"
              editable={!guardandoEdicion}
              onChangeText={setNombreEditado}
              style={styles.campo}
              value={nombreEditado}
            />
            <Text style={styles.etiquetaCampo}>Cédula (opcional; déjala vacía para conservarla)</Text>
            <TextInput
              editable={!guardandoEdicion}
              keyboardType="number-pad"
              onChangeText={setCedulaEditada}
              style={styles.campo}
              value={cedulaEditada}
            />
            {!!errorEdicion && <Text style={styles.errorTexto}>{errorEdicion}</Text>}
            <View style={styles.acciones}>
              <Pressable
                disabled={guardandoEdicion}
                onPress={() => setUsuarioEditando(null)}
                style={styles.botonAccion}
              >
                <Text style={styles.botonAccionTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                disabled={guardandoEdicion}
                onPress={guardarEdicion}
                style={[styles.botonAccion, styles.botonGuardar, guardandoEdicion && styles.chipDeshabilitado]}
              >
                <Text style={styles.botonGuardarTexto}>
                  {guardandoEdicion ? 'Guardando...' : 'Guardar'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  buscador: {
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 16,
    fontSize: 15,
  },
  rolesFiltro: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 16 },
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
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
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
  botonAccion: {
    alignItems: 'center',
    borderColor: '#273c9c',
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  botonAccionTexto: { color: '#273c9c', fontSize: 14, fontWeight: '700' },
  botonEliminar: { borderColor: '#c0392b' },
  botonEliminarTexto: { color: '#c0392b', fontSize: 14, fontWeight: '700' },
  botonGuardar: { backgroundColor: '#273c9c' },
  botonGuardarTexto: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalFondo: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(23, 32, 68, 0.45)',
    padding: 20,
  },
  modalContenido: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitulo: { color: '#172044', fontSize: 22, fontWeight: '800', marginBottom: 18 },
  etiquetaCampo: { color: '#2e385b', fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  campo: {
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 10,
    color: '#172044',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  vacio: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
  },
});
