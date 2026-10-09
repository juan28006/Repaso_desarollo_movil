import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { useAuthContexto } from './AuthContexto';
import {
  obtenerColaOffline,
  sincronizarColaOffline,
} from '../services/offlineQueueService';

const EstadoConexionContexto = createContext(null);

export function EstadoConexionProvider({ children }) {
  const { usuario } = useAuthContexto();
  const uid = usuario?.uid || null;
  const [estadoRed, setEstadoRed] = useState(null);
  const [estadoCola, setEstadoCola] = useState({ uid: null, items: [], lista: false });
  const [sincronizando, setSincronizando] = useState(false);
  const bloqueo = useRef(new Set());
  const repetirSincronizacion = useRef(new Set());
  const conectado = estadoRed === null
    ? null
    : estadoRed.isConnected !== true
      ? false
      : estadoRed.isInternetReachable === true
        ? true
        : null;
  const colaLista = !uid || (estadoCola.uid === uid && estadoCola.lista);

  const sincronizar = useCallback(async (reintentarConflictos = false) => {
    if (!uid) return;
    if (bloqueo.current.has(uid)) {
      repetirSincronizacion.current.add(uid);
      return;
    }

    bloqueo.current.add(uid);
    setSincronizando(true);
    try {
      const operaciones = await sincronizarColaOffline(uid, { reintentarConflictos });
      if (uid === usuario?.uid) setEstadoCola({ uid, items: operaciones, lista: true });
    } catch (error) {
      console.error('No se pudo leer o sincronizar la cola offline:', error);
      if (uid === usuario?.uid) {
        setEstadoCola({
          uid,
          items: [{ id: 'error-cola', estado: 'error', ultimoError: error.message }],
          lista: true,
        });
      }
    } finally {
      bloqueo.current.delete(uid);
      setSincronizando(false);
      if (repetirSincronizacion.current.delete(uid) && conectado === true) {
        setTimeout(() => sincronizar(), 0);
      }
    }
  }, [uid, usuario, conectado]);

  const actualizarCola = useCallback(async () => {
    if (!uid) {
      setEstadoCola({ uid: null, items: [], lista: true });
      return [];
    }
    const operaciones = await obtenerColaOffline(uid);
    setEstadoCola({ uid, items: operaciones, lista: true });
    if (conectado === true) setTimeout(sincronizar, 0);
    return operaciones;
  }, [uid, conectado, sincronizar]);

  useEffect(() => {
    let activa = true;
    const actualizarEstado = (estado) => {
      if (activa) setEstadoRed(estado);
    };
    let suscripcion;

    Network.getNetworkStateAsync()
      .then(actualizarEstado)
      .catch((error) => console.error('No se pudo consultar el estado de conexión:', error));

    suscripcion = Network.addNetworkStateListener(actualizarEstado);
    return () => {
      activa = false;
      suscripcion.remove();
    };
  }, []);

  useEffect(() => {
    if (!uid) return undefined;

    let activa = true;
    obtenerColaOffline(uid)
      .then((operaciones) => {
        if (activa) {
          setEstadoCola({ uid, items: operaciones, lista: true });
        }
      })
      .catch((error) => {
        console.error('No se pudo cargar la cola offline:', error);
        if (activa) {
          setEstadoCola({
            uid,
            items: [{ id: 'error-cola', estado: 'error', ultimoError: error.message }],
            lista: true,
          });
        }
      });

    return () => {
      activa = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || !colaLista || !conectado) return undefined;
    const temporizador = setTimeout(sincronizar, 0);
    return () => clearTimeout(temporizador);
  }, [uid, colaLista, conectado, sincronizar]);

  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && uid && conectado) sincronizar();
    });
    return () => suscripcion.remove();
  }, [uid, conectado, sincronizar]);

  const value = useMemo(() => ({
    conectado,
    estadoRed,
    cola: estadoCola.uid === uid ? estadoCola.items : [],
    sincronizando,
    actualizarCola,
    reintentarSincronizacion: () => sincronizar(true),
  }), [conectado, estadoRed, estadoCola, uid, sincronizando, actualizarCola, sincronizar]);

  return (
    <EstadoConexionContexto.Provider value={value}>
      {children}
    </EstadoConexionContexto.Provider>
  );
}

export function useEstadoConexion() {
  const contexto = useContext(EstadoConexionContexto);
  if (!contexto) {
    throw new Error('useEstadoConexion debe usarse dentro de EstadoConexionProvider.');
  }
  return contexto;
}
