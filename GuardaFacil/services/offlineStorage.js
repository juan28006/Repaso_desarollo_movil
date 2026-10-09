import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIJO = 'guardafacil:offline:v1';
const bloqueosCache = new Map();

const validarUid = (uid) => {
  if (!uid || typeof uid !== 'string') {
    throw new Error('Se requiere el UID del usuario para acceder a datos locales.');
  }
};

const claveCache = (uid, recurso) => {
  validarUid(uid);
  return `${PREFIJO}:${encodeURIComponent(uid)}:cache:${encodeURIComponent(recurso)}`;
};

export const claveColaUsuario = (uid) => {
  validarUid(uid);
  return `${PREFIJO}:${encodeURIComponent(uid)}:queue`;
};

export async function leerCacheUsuario(uid, recurso) {
  const valor = await AsyncStorage.getItem(claveCache(uid, recurso));
  if (!valor) return null;

  try {
    return JSON.parse(valor);
  } catch (error) {
    console.error(`No se pudo interpretar la caché local (${recurso}):`, error);
    throw new Error('La caché local está dañada y no se pudo recuperar.');
  }
}

export async function guardarCacheUsuario(uid, recurso, datos) {
  const registro = {
    datos,
    actualizadoEn: Date.now(),
  };
  const clave = claveCache(uid, recurso);
  const previo = bloqueosCache.get(clave) || Promise.resolve();
  let liberar;
  const bloqueo = new Promise((resolve) => {
    liberar = resolve;
  });
  bloqueosCache.set(clave, bloqueo);
  await previo;

  try {
    await AsyncStorage.setItem(clave, JSON.stringify(registro));
  } finally {
    liberar();
    if (bloqueosCache.get(clave) === bloqueo) bloqueosCache.delete(clave);
  }

  return registro;
}

export async function actualizarCacheUsuario(uid, recurso, actualizar) {
  const clave = claveCache(uid, recurso);
  const previo = bloqueosCache.get(clave) || Promise.resolve();
  let liberar;
  const bloqueo = new Promise((resolve) => {
    liberar = resolve;
  });
  bloqueosCache.set(clave, bloqueo);
  await previo;

  try {
    const valor = await AsyncStorage.getItem(clave);
    let registro = null;
    if (valor) {
      try {
        registro = JSON.parse(valor);
      } catch (error) {
        console.error(`No se pudo interpretar la caché local (${recurso}):`, error);
        throw new Error('La caché local está dañada y no se pudo recuperar.');
      }
    }

    const datos = await actualizar(registro?.datos ?? []);
    const nuevoRegistro = {
      datos,
      actualizadoEn: Date.now(),
    };
    await AsyncStorage.setItem(clave, JSON.stringify(nuevoRegistro));
    return nuevoRegistro;
  } finally {
    liberar();
    if (bloqueosCache.get(clave) === bloqueo) bloqueosCache.delete(clave);
  }
}
