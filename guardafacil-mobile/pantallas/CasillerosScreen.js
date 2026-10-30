import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContexto } from '../contextos/AuthContexto';
import { useEstadoConexion } from '../contextos/EstadoConexionContexto';
import AvisoOffline from '../componentes/AvisoOffline';
import { obtenerCasilleros, obtenerZonas } from '../services/zonasService';
import {
  colorEstadoCasillero,
  etiquetaEstadoCasillero,
  ESTADOS_CASILLERO,
  normalizarEstadoCasillero,
} from '../constantes/estadosCasillero';

const OPCIONES_ESTADO = [
  { valor: 'todos', etiqueta: 'Todos los estados' },
  { valor: ESTADOS_CASILLERO.DISPONIBLE, etiqueta: 'Disponibles' },
  { valor: ESTADOS_CASILLERO.OCUPADO, etiqueta: 'Ocupados' },
  { valor: ESTADOS_CASILLERO.MANTENIMIENTO, etiqueta: 'Mantenimiento' },
];

const transformarCasilleros = (zona, casilleros) => casilleros.map((casillero) => ({
  ...casillero,
  zonaId: zona.id,
  zonaNombre: zona.nombre || `Zona ${zona.id}`,
  ubicacion: zona.ubicacion || zona.nombre || `Zona ${zona.id}`,
  estadoNormalizado: normalizarEstadoCasillero(casillero),
}));

function Chip({ etiqueta, activo, onPress, accessibilityRole = 'button' }) {
  return (
    <TouchableOpacity
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected: activo }}
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
  const zonaId = route.params?.zonaId;
  const zonaNombre = route.params?.zonaNombre;
  const { usuario } = useAuthContexto();
  const usuarioId = usuario?.uid;
  const { conectado } = useEstadoConexion();
  const [zonas, setZonas] = useState([]);
  const [casilleros, setCasilleros] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [tamanoFiltro, setTamanoFiltro] = useState('todos');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [zonaFiltro, setZonaFiltro] = useState('todas');
  const [vista, setVista] = useState('cuadricula');

  const cargarCasilleros = useCallback(async () => {
    if (!usuarioId) {
      setCargando(false);
      setError('Debes iniciar sesión para consultar los casilleros.');
      return;
    }

    setCargando(true);
    setError('');
    try {
      if (zonaId !== undefined && zonaId !== null) {
        const resultado = await obtenerCasilleros(usuarioId, zonaId);
        const zona = {
          id: zonaId,
          nombre: zonaNombre || `Zona ${zonaId}`,
        };
        setZonas([zona]);
        setCasilleros(transformarCasilleros(zona, resultado.datos));
        setCacheInfo(resultado);
        setZonaFiltro('todas');
        return;
      }

      const resultadoZonas = await obtenerZonas(usuarioId);
      const resultadosCasilleros = await Promise.allSettled(
        resultadoZonas.datos.map(async (zona) => ({
          zona,
          resultado: await obtenerCasilleros(usuarioId, zona.id),
        }))
      );
      const cargados = resultadosCasilleros
        .filter((resultado) => resultado.status === 'fulfilled')
        .map((resultado) => resultado.value);
      const fallidos = resultadosCasilleros.filter((resultado) => resultado.status === 'rejected');
      const datos = cargados.flatMap(({ zona, resultado }) => (
        transformarCasilleros(zona, resultado.datos)
      ));
      const fuentesCache = [resultadoZonas, ...cargados.map(({ resultado }) => resultado)];
      const fechasCache = fuentesCache
        .map((fuente) => fuente.actualizadoEn)
        .filter((fecha) => Number.isFinite(fecha));

      setZonas(resultadoZonas.datos);
      setCasilleros(datos);
      setCacheInfo({
        desdeCache: fuentesCache.some((fuente) => fuente.desdeCache),
        actualizadoEn: fechasCache.length ? Math.min(...fechasCache) : null,
        cacheError: fuentesCache.find((fuente) => fuente.cacheError)?.cacheError || null,
      });

      if (fallidos.length > 0) {
        fallidos.forEach(({ reason }) => console.error('Error cargando una zona de casilleros:', reason));
        setError(`No se pudo cargar el inventario de ${fallidos.length} zona${fallidos.length === 1 ? '' : 's'}. Se muestran los datos disponibles.`);
      }
    } catch (err) {
      console.error('Error cargando casilleros:', err);
      setCasilleros([]);
      setZonas([]);
      setCacheInfo(null);
      setError('No se pudieron cargar los casilleros. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [usuarioId, zonaId, zonaNombre]);

  useEffect(() => {
    const temporizador = setTimeout(cargarCasilleros, 0);
    return () => clearTimeout(temporizador);
  }, [cargarCasilleros, conectado]);

  const tamanos = useMemo(
    () => [...new Set(casilleros.map((casillero) => casillero.tamano).filter(Boolean))],
    [casilleros]
  );
  const casillerosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return casilleros.filter((casillero) => {
      const numero = String(casillero.numero ?? casillero.codigo ?? casillero.id).toLowerCase();
      const coincideBusqueda = !texto
        || numero.includes(texto)
        || casillero.zonaNombre.toLowerCase().includes(texto)
        || casillero.ubicacion.toLowerCase().includes(texto);
      const coincideTamano = tamanoFiltro === 'todos' || casillero.tamano === tamanoFiltro;
      const coincideEstado = estadoFiltro === 'todos'
        || casillero.estadoNormalizado === estadoFiltro;
      const coincideZona = zonaFiltro === 'todas' || casillero.zonaId === zonaFiltro;
      return coincideBusqueda && coincideTamano && coincideEstado && coincideZona;
    });
  }, [casilleros, busqueda, tamanoFiltro, estadoFiltro, zonaFiltro]);

  const hayFiltros = Boolean(busqueda.trim())
    || tamanoFiltro !== 'todos'
    || estadoFiltro !== 'todos'
    || zonaFiltro !== 'todas';
  const disponibilidadDesactualizada = cacheInfo?.desdeCache || conectado === false;

  const limpiarFiltros = () => {
    setBusqueda('');
    setTamanoFiltro('todos');
    setEstadoFiltro('todos');
    setZonaFiltro('todas');
  };

  if (cargando && casilleros.length === 0) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#273c9c" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>{zonaNombre || 'Todos los casilleros'}</Text>
      <AvisoOffline
        desdeCache={cacheInfo?.desdeCache}
        actualizadoEn={cacheInfo?.actualizadoEn}
        cacheError={cacheInfo?.cacheError}
      />
      {error ? (
        <View style={styles.avisoError}>
          <Text style={styles.errorTexto}>{error}</Text>
          <Pressable onPress={cargarCasilleros}>
            <Text style={styles.limpiar}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}

      <TextInput
        accessibilityLabel="Buscar por número, zona o ubicación"
        style={styles.buscador}
        placeholder="Buscar por número, zona o ubicación"
        value={busqueda}
        onChangeText={setBusqueda}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.etiquetaFiltro}>Zona o ubicación</Text>
      <View style={styles.filaChips}>
        <Chip
          etiqueta="Todas las zonas"
          activo={zonaFiltro === 'todas'}
          onPress={() => setZonaFiltro('todas')}
        />
        {zonas.map((zona) => (
          <Chip
            key={zona.id}
            etiqueta={zona.nombre || zona.ubicacion || `Zona ${zona.id}`}
            activo={zonaFiltro === zona.id}
            onPress={() => setZonaFiltro(zona.id)}
          />
        ))}
      </View>

      <Text style={styles.etiquetaFiltro}>Estado</Text>
      <View style={styles.filaChips}>
        {OPCIONES_ESTADO.map((opcion) => (
          <Chip
            key={opcion.valor}
            etiqueta={opcion.etiqueta}
            activo={estadoFiltro === opcion.valor}
            onPress={() => setEstadoFiltro(opcion.valor)}
          />
        ))}
      </View>

      <Text style={styles.etiquetaFiltro}>Tamaño</Text>
      <View style={styles.filaChips}>
        <Chip
          etiqueta="Todos los tamaños"
          activo={tamanoFiltro === 'todos'}
          onPress={() => setTamanoFiltro('todos')}
        />
        {tamanos.map((tamano) => (
          <Chip
            key={tamano}
            etiqueta={tamano}
            activo={tamanoFiltro === tamano}
            onPress={() => setTamanoFiltro(tamano)}
          />
        ))}
      </View>

      <View style={styles.filaVista}>
        <Text style={styles.contador}>
          {casillerosFiltrados.length} de {casilleros.length} casilleros
        </Text>
        <View style={styles.opcionesVista}>
          <Chip
            etiqueta="Cuadrícula"
            activo={vista === 'cuadricula'}
            onPress={() => setVista('cuadricula')}
            accessibilityRole="tab"
          />
          <Chip
            etiqueta="Lista"
            activo={vista === 'lista'}
            onPress={() => setVista('lista')}
            accessibilityRole="tab"
          />
        </View>
      </View>

      <FlatList
        key={vista}
        style={styles.lista}
        data={casillerosFiltrados}
        keyExtractor={(item) => `${item.zonaId}-${item.id}`}
        numColumns={vista === 'cuadricula' ? 2 : 1}
        columnWrapperStyle={vista === 'cuadricula' ? styles.filaCuadricula : undefined}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.contenidoLista}
        ListEmptyComponent={(
          <View style={styles.vacio}>
            <Text style={styles.vacioTexto}>
              {error && casilleros.length === 0
                ? 'No hay casilleros disponibles para mostrar.'
                : hayFiltros
                  ? 'No hay casilleros que coincidan con los filtros.'
                  : 'Esta zona aún no tiene casilleros.'}
            </Text>
            {hayFiltros && (
              <TouchableOpacity onPress={limpiarFiltros}>
                <Text style={styles.limpiar}>Limpiar filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        renderItem={({ item }) => {
          const etiquetaEstado = etiquetaEstadoCasillero(item.estadoNormalizado);
          const estadoVisible = disponibilidadDesactualizada
            ? `Último dato guardado: ${etiquetaEstado}`
            : etiquetaEstado;

          return (
            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.item,
                vista === 'cuadricula' && styles.itemCuadricula,
              ]}
              onPress={() => navigation.navigate('DetalleCasillero', {
                zonaId: item.zonaId,
                casilleroId: item.id,
                zonaNombre: item.zonaNombre,
              })}
            >
              <View style={styles.detalleItem}>
                <Text style={styles.numero}>
                  {item.numero ?? item.codigo ?? item.id}
                </Text>
                <Text style={styles.tamano}>Tamaño: {item.tamano || 'No especificado'}</Text>
                {vista === 'cuadricula' && (
                  <Text style={styles.ubicacionItem}>{item.zonaNombre}</Text>
                )}
              </View>
              <View style={[
                styles.badge,
                { backgroundColor: colorEstadoCasillero(item.estadoNormalizado) },
              ]}>
                <Text style={styles.badgeTexto}>{estadoVisible}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f7ff' },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 24, fontWeight: '800', color: '#273c9c', marginBottom: 10 },
  avisoError: { marginBottom: 8 },
  errorTexto: { color: '#b52f43', fontSize: 14 },
  buscador: {
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 10,
    marginBottom: 8,
  },
  etiquetaFiltro: { color: '#69728e', fontSize: 13, fontWeight: '700', marginTop: 5 },
  filaChips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d2d8ed',
    backgroundColor: '#fff',
    marginRight: 7,
    marginTop: 7,
  },
  chipActivo: { backgroundColor: '#273c9c', borderColor: '#273c9c' },
  chipTexto: { fontSize: 12, color: '#273c9c', fontWeight: '600' },
  chipTextoActivo: { color: '#fff' },
  filaVista: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  opcionesVista: { flexDirection: 'row' },
  contador: { fontSize: 13, color: '#69728e', flexShrink: 1 },
  lista: { flex: 1, marginTop: 4 },
  contenidoLista: { paddingBottom: 32, flexGrow: 1 },
  filaCuadricula: { gap: 10 },
  vacio: { alignItems: 'center', paddingVertical: 32 },
  vacioTexto: { color: '#69728e', fontSize: 14, textAlign: 'center' },
  limpiar: { color: '#273c9c', fontWeight: '700', marginTop: 10 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderColor: '#d2d8ed',
    borderWidth: 1,
    borderRadius: 12,
    gap: 8,
  },
  itemCuadricula: { flex: 1, flexDirection: 'column', alignItems: 'stretch', minHeight: 140 },
  detalleItem: { flex: 1 },
  numero: { fontSize: 16, fontWeight: '700', color: '#172044' },
  tamano: { fontSize: 13, color: '#69728e', marginTop: 4 },
  ubicacionItem: { color: '#69728e', fontSize: 12, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' },
  badgeTexto: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
