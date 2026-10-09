import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContexto } from '../contextos/AuthContexto';
import { useEstadoConexion } from '../contextos/EstadoConexionContexto';
import AvisoOffline from '../componentes/AvisoOffline';
import { obtenerCasilleros } from '../services/zonasService';

const OPCIONES_DISPONIBILIDAD = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'disponibles', etiqueta: 'Disponibles' },
  { valor: 'ocupados', etiqueta: 'Ocupados' },
];

function Chip({ etiqueta, activo, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, activo && styles.chipActivo]}
      onPress={onPress}
    >
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
        {etiqueta}
      </Text>
    </TouchableOpacity>
  );
}

export default function CasillerosScreen({ route, navigation }) {
  const { zonaId, zonaNombre } = route.params;
  const { usuario } = useAuthContexto();
  const { conectado } = useEstadoConexion();
  const [casilleros, setCasilleros] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [tamanoFiltro, setTamanoFiltro] = useState('todos');
  const [disponibilidad, setDisponibilidad] = useState('todos');

  const cargarCasilleros = useCallback(async () => {
    setCargando(true);
    try {
      const resultado = await obtenerCasilleros(usuario.uid, zonaId);
      setCasilleros(resultado.datos);
      setCacheInfo(resultado);
      setError('');
    } catch (err) {
      console.error('Error cargando casilleros:', err);
      setCasilleros([]);
      setCacheInfo(null);
      setError('No se pudieron cargar los casilleros. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [usuario, zonaId]);

  useEffect(() => {
    const temporizador = setTimeout(cargarCasilleros, 0);
    return () => clearTimeout(temporizador);
  }, [cargarCasilleros, conectado]);

  // Los hooks van antes del return condicional de "cargando"
  const tamanos = useMemo(
    () => [...new Set(casilleros.map((c) => c.tamano).filter(Boolean))],
    [casilleros]
  );

  const casillerosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return casilleros.filter((c) => {
      if (texto && !String(c.numero).toLowerCase().includes(texto)) return false;
      if (tamanoFiltro !== 'todos' && c.tamano !== tamanoFiltro) return false;
      if (disponibilidad === 'disponibles' && !c.disponible) return false;
      if (disponibilidad === 'ocupados' && c.disponible) return false;
      return true;
    });
  }, [casilleros, busqueda, tamanoFiltro, disponibilidad]);

  const hayFiltros =
    busqueda !== '' || tamanoFiltro !== 'todos' || disponibilidad !== 'todos';
  const disponibilidadDesactualizada = cacheInfo?.desdeCache || conectado === false;

  const limpiarFiltros = () => {
    setBusqueda('');
    setTamanoFiltro('todos');
    setDisponibilidad('todos');
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#273c9c" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>{zonaNombre}</Text>
      <AvisoOffline
        desdeCache={cacheInfo?.desdeCache}
        actualizadoEn={cacheInfo?.actualizadoEn}
        cacheError={cacheInfo?.cacheError}
      />
      {error && casilleros.length === 0 && (
        <View style={styles.vacio}>
          <Text style={styles.vacioTexto}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setCargando(true);
              cargarCasilleros();
            }}
          >
            <Text style={styles.limpiar}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}
      {error && casilleros.length > 0 && (
        <Text style={styles.vacioTexto}>{error} Se muestran los datos guardados.</Text>
      )}

      <TextInput
        style={styles.buscador}
        placeholder="Buscar por número (ej. A-101)"
        value={busqueda}
        onChangeText={setBusqueda}
        autoCorrect={false}
      />

      <View style={styles.filaChips}>
        <Chip
          etiqueta="Todos los tamaños"
          activo={tamanoFiltro === 'todos'}
          onPress={() => setTamanoFiltro('todos')}
        />
        {tamanos.map((t) => (
          <Chip
            key={t}
            etiqueta={t}
            activo={tamanoFiltro === t}
            onPress={() => setTamanoFiltro(t)}
          />
        ))}
      </View>

      <View style={styles.filaChips}>
        {OPCIONES_DISPONIBILIDAD.map((op) => (
          <Chip
            key={op.valor}
            etiqueta={op.etiqueta}
            activo={disponibilidad === op.valor}
            onPress={() => setDisponibilidad(op.valor)}
          />
        ))}
      </View>

      {(!error || casilleros.length > 0) && (
        <Text style={styles.contador}>
          {casillerosFiltrados.length} de {casilleros.length} casilleros
        </Text>
      )}

      {(!error || casilleros.length > 0) && <FlatList
        style={{ flex: 1 }}
        data={casillerosFiltrados}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Text style={styles.vacioTexto}>
              {hayFiltros
                ? 'No hay casilleros que coincidan con los filtros.'
                : 'Esta zona aún no tiene casilleros.'}
            </Text>
            {hayFiltros && (
              <TouchableOpacity onPress={limpiarFiltros}>
                <Text style={styles.limpiar}>Limpiar filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        }
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
                {
                  backgroundColor: disponibilidadDesactualizada
                    ? '#b7791f'
                    : item.disponible
                      ? '#2ecc71'
                      : '#e74c3c',
                },
              ]}
            >
              <Text style={styles.badgeTexto}>
                {disponibilidadDesactualizada
                  ? `Último estado guardado: ${item.disponible ? 'disponible' : 'ocupado'}`
                  : item.disponible
                    ? 'Disponible'
                    : 'Ocupado'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f5f7ff' },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 24, fontWeight: '800', color: '#273c9c', marginBottom: 16 },
  buscador: {
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  filaChips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d2d8ed',
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActivo: { backgroundColor: '#273c9c', borderColor: '#273c9c' },
  chipTexto: { fontSize: 13, color: '#273c9c', fontWeight: '600' },
  chipTextoActivo: { color: '#fff' },
  contador: { fontSize: 13, color: '#69728e', marginBottom: 8 },
  vacio: { alignItems: 'center', paddingVertical: 32 },
  vacioTexto: { color: '#69728e', fontSize: 14, textAlign: 'center' },
  limpiar: { color: '#273c9c', fontWeight: '700', marginTop: 12 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 12,
  },
  numero: { fontSize: 16, fontWeight: '700', color: '#172044' },
  tamano: { fontSize: 14, color: '#69728e' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, maxWidth: 190 },
  badgeTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
