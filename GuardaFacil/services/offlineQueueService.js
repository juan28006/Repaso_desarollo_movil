import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase/firebaseConfig';
import {
  cancelarReserva,
  obtenerReservasUsuario,
  reservarCasillero,
} from './zonasService';
import { iniciarUsoReserva } from './usoReservaService';
import { actualizarCacheUsuario, claveColaUsuario } from './offlineStorage';
import { esErrorDeRed } from './offlineErrors';

const bloqueosCola = new Map();
const sincronizacionesActivas = new Set();
const cierresSesionEnCurso = new Set();

const conBloqueoCola = async (uid, trabajo) => {
  const previo = bloqueosCola.get(uid) || Promise.resolve();
  let liberar;
  const bloqueo = new Promise((resolve) => {
    liberar = resolve;
  });
  bloqueosCola.set(uid, bloqueo);
  await previo;

  try {
    return await trabajo();
  } finally {
    liberar();
    if (bloqueosCola.get(uid) === bloqueo) bloqueosCola.delete(uid);
  }
};

const leerCola = async (uid) => {
  const valor = await AsyncStorage.getItem(claveColaUsuario(uid));
  if (!valor) return [];

  let cola;
  try {
    cola = JSON.parse(valor);
  } catch (error) {
    console.error('No se pudo interpretar la cola offline:', error);
    throw new Error('La cola local está dañada y no se pudo recuperar.');
  }

  if (!Array.isArray(cola)) {
    throw new Error('La cola local tiene un formato inválido.');
  }

  return cola.map((operacion) => (
    operacion.estado === 'sincronizando'
      ? { ...operacion, estado: 'pendiente' }
      : operacion
  ));
};

const guardarCola = (uid, cola) => (
  AsyncStorage.setItem(claveColaUsuario(uid), JSON.stringify(cola))
);

const idReserva = ({ casilleroId, fecha, franja }) => (
  `${casilleroId}_${fecha}_${franja}`
);

export async function obtenerColaOffline(uid) {
  return leerCola(uid);
}

export async function cerrarSesionSinSincronizacionActiva(uid, cerrarSesion) {
  if (sincronizacionesActivas.has(uid) || cierresSesionEnCurso.has(uid)) return false;
  cierresSesionEnCurso.add(uid);
  try {
    if (sincronizacionesActivas.has(uid)) return false;
    await cerrarSesion();
    return true;
  } finally {
    cierresSesionEnCurso.delete(uid);
  }
}

export async function descartarConflictoOffline(uid, operacionId) {
  if (auth.currentUser?.uid !== uid) {
    throw new Error('La sesión cambió; no se modificó la cola de otra cuenta.');
  }
  return conBloqueoCola(uid, async () => {
    if (auth.currentUser?.uid !== uid) {
      throw new Error('La sesión cambió; no se modificó la cola de otra cuenta.');
    }
    const cola = await leerCola(uid);
    const operacion = cola.find((item) => item.id === operacionId);
    if (!operacion || operacion.estado !== 'conflicto') {
      throw new Error('Solo se pueden descartar explícitamente operaciones en conflicto.');
    }
    await guardarCola(uid, cola.filter((item) => item.id !== operacionId));
  });
}

export async function agregarOperacionOffline(uid, tipo, datos) {
  if (auth.currentUser?.uid !== uid) {
    throw new Error('La sesión cambió; no se guardó la operación bajo otra cuenta.');
  }
  return conBloqueoCola(uid, async () => {
    if (auth.currentUser?.uid !== uid) {
      throw new Error('La sesión cambió; no se guardó la operación bajo otra cuenta.');
    }
    const id = tipo === 'reservar'
      ? idReserva(datos)
      : datos.reservaId;
    const operacionId = `${tipo}:${id}`;
    const cola = await leerCola(uid);
    const existente = cola.find((operacion) => operacion.id === operacionId);
    if (existente?.estado === 'conflicto') {
      const error = new Error(
        'Esta solicitud tiene un conflicto. Resuélvelo desde el aviso de operaciones pendientes.'
      );
      error.code = 'operation-conflict';
      throw error;
    }
    if (existente) return existente;

    const operacion = {
      id: operacionId,
      uid,
      tipo,
      datos,
      estado: 'pendiente',
      intentos: 0,
      creadaEn: Date.now(),
    };
    await guardarCola(uid, [...cola, operacion]);
    return operacion;
  });
}

async function procesarOperacion(operacion, uid) {
  if (operacion.uid !== uid) {
    throw new Error('La operación pertenece a otra cuenta y no se enviará.');
  }
  if (auth.currentUser?.uid !== uid) {
    const error = new Error('La sesión cambió; la operación permanece vinculada a su cuenta.');
    error.code = 'uid-mismatch';
    throw error;
  }

  if (operacion.tipo === 'reservar') {
    return reservarCasillero({ ...operacion.datos, usuarioId: uid });
  }
  if (operacion.tipo === 'cancelar') {
    return cancelarReserva(operacion.datos.reservaId, uid);
  }
  if (operacion.tipo === 'iniciar_uso') {
    return iniciarUsoReserva(operacion.datos.reservaId, uid);
  }

  const error = new Error(`Tipo de operación offline desconocido: ${operacion.tipo}`);
  error.code = 'operation-conflict';
  throw error;
}

async function actualizarCacheTrasConfirmacion(uid, operacion, resultado) {
  try {
    await actualizarCacheUsuario(uid, 'reservas', (reservas) => {
      if (!Array.isArray(reservas)) {
        throw new Error('La caché de reservas tiene un formato inválido.');
      }

      if (operacion.tipo === 'reservar') {
        const reserva = { ...resultado };
        delete reserva.createdAt;
        const confirmada = { ...reserva, origen: 'reservas' };
        return [
          ...reservas.filter((item) => item.id !== confirmada.id),
          confirmada,
        ];
      }

      const estado = operacion.tipo === 'cancelar' ? 'cancelada' : 'en_uso';
      return reservas.map((reserva) => (
        reserva.id === operacion.datos.reservaId
          ? { ...reserva, estado }
          : reserva
      ));
    });
  } catch (error) {
    console.error('La operación se confirmó, pero no se pudo actualizar la caché local:', error);
  }

  try {
    await obtenerReservasUsuario(uid);
  } catch (error) {
    console.error('La operación se confirmó, pero no se pudo refrescar la caché desde Firestore:', error);
  }
}

const esConflicto = (error) => (
  error.code === 'reservation-conflict'
  || error.code === 'operation-conflict'
  || error.code === 'permission-denied'
  || error.code === 'failed-precondition'
);

export async function ejecutarOEncolar(uid, tipo, datos, conectado) {
  if (!conectado) {
    const operacion = await agregarOperacionOffline(uid, tipo, datos);
    return { pendiente: true, operacion };
  }

  try {
    const resultado = await procesarOperacion({ uid, tipo, datos }, uid);
    await actualizarCacheTrasConfirmacion(uid, { tipo, datos }, resultado);
    return { pendiente: false, resultado };
  } catch (error) {
    if (!esErrorDeRed(error)) throw error;
    console.error(`Se guardará ${tipo} para reintentar tras un error de conexión:`, error);
    const operacion = await agregarOperacionOffline(uid, tipo, datos);
    return { pendiente: true, operacion };
  }
}

const actualizarOperacion = async (uid, id, actualizar) => {
  return conBloqueoCola(uid, async () => {
    const cola = await leerCola(uid);
    const actualizada = cola.map((operacion) => (
      operacion.id === id ? actualizar(operacion) : operacion
    ));
    await guardarCola(uid, actualizada);
    return actualizada;
  });
};

export async function sincronizarColaOffline(uid, { reintentarConflictos = false } = {}) {
  if (cierresSesionEnCurso.has(uid)) return leerCola(uid);
  sincronizacionesActivas.add(uid);
  try {
    const inicial = await leerCola(uid);
    const procesables = inicial.filter((operacion) => (
      operacion.estado !== 'conflicto' || reintentarConflictos
    ));

    for (const operacion of procesables) {
      const actual = await actualizarOperacion(uid, operacion.id, (item) => ({
        ...item,
        estado: 'sincronizando',
        intentos: item.intentos + 1,
        ultimoError: null,
      }));
      const operacionActual = actual.find((item) => item.id === operacion.id);
      if (!operacionActual) continue;

      try {
        const resultado = await procesarOperacion(operacionActual, uid);
        await actualizarCacheTrasConfirmacion(uid, operacionActual, resultado);

        await conBloqueoCola(uid, async () => {
          const colaActual = await leerCola(uid);
          await guardarCola(uid, colaActual.filter((item) => item.id !== operacion.id));
        });
      } catch (error) {
        console.error(`No se pudo sincronizar ${operacion.id}:`, error);
        await actualizarOperacion(uid, operacion.id, (item) => ({
          ...item,
          estado: esConflicto(error) ? 'conflicto' : 'pendiente',
          ultimoError: error.message || 'Error al sincronizar con Firestore.',
        }));
        if (esErrorDeRed(error) || error.code === 'uid-mismatch') break;
      }
    }
    return leerCola(uid);
  } finally {
    sincronizacionesActivas.delete(uid);
  }
}
