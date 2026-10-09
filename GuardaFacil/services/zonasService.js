import {
  collection,
  getDocsFromServer,
  doc,
  getDocFromServer,
  serverTimestamp,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { guardarCacheUsuario, leerCacheUsuario } from './offlineStorage';
import { esErrorDeRed } from './offlineErrors';

const horasInicioFranjas = {
  Mañana: 6,
  Tarde: 12,
  Noche: 18,
};

export const obtenerInicioUsoReserva = (reserva) => {
  const hora = horasInicioFranjas[reserva.franja];
  const partesFecha = String(reserva.fecha || '').split('-').map(Number);

  if (
    hora === undefined
    || partesFecha.length !== 3
    || partesFecha.some((parte) => !Number.isInteger(parte))
  ) {
    return null;
  }

  const [anio, mes, dia] = partesFecha;
  const inicio = new Date(anio, mes - 1, dia, hora);

  if (
    inicio.getFullYear() !== anio
    || inicio.getMonth() !== mes - 1
    || inicio.getDate() !== dia
  ) {
    return null;
  }

  return inicio;
};

export const puedeCancelarReserva = (reserva, ahora = new Date()) => {
  const inicio = obtenerInicioUsoReserva(reserva);
  return reserva.estado === 'confirmada' && inicio !== null && ahora < inicio;
};

const validarSesion = (usuarioId) => {
  if (!usuarioId || auth.currentUser?.uid !== usuarioId) {
    const error = new Error('La sesión cambió; no se devolverán datos de otra cuenta.');
    error.code = 'uid-mismatch';
    throw error;
  }
};

const leerConCache = async (usuarioId, recurso, consultarServidor) => {
  validarSesion(usuarioId);

  try {
    const datos = await consultarServidor();
    validarSesion(usuarioId);
    let actualizadoEn = Date.now();
    let cacheError = null;
    try {
      const registro = await guardarCacheUsuario(usuarioId, recurso, datos);
      actualizadoEn = registro.actualizadoEn;
    } catch (error) {
      console.error(`No se pudo guardar la caché local (${recurso}):`, error);
      cacheError = 'No se pudo guardar una copia local de estos datos.';
    }
    validarSesion(usuarioId);
    return { datos, actualizadoEn, desdeCache: false, cacheError };
  } catch (error) {
    console.error(`No se pudieron consultar los datos de Firestore (${recurso}):`, error);
    if (error.code === 'uid-mismatch') throw error;
    if (!esErrorDeRed(error)) throw error;
    validarSesion(usuarioId);
    const cache = await leerCacheUsuario(usuarioId, recurso);
    validarSesion(usuarioId);
    if (cache && Array.isArray(cache.datos)) {
      return {
        datos: cache.datos,
        actualizadoEn: cache.actualizadoEn,
        desdeCache: true,
        error: error.message || 'No fue posible actualizar los datos.',
      };
    }
    throw error;
  }
};

export const obtenerZonas = (usuarioId) => (
  leerConCache(usuarioId, 'zonas', async () => {
    const snapshot = await getDocsFromServer(collection(db, 'zonas'));
    return snapshot.docs.map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }));
  })
);

export const obtenerCasilleros = (usuarioId, zonaId) => (
  leerConCache(usuarioId, `casilleros:${zonaId}`, async () => {
    const referencia = collection(db, 'zonas', zonaId, 'casilleros');
    const snapshot = await getDocsFromServer(referencia);
    return snapshot.docs.map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }));
  })
);

export const obtenerCasillero = async (usuarioId, zonaId, casilleroId) => {
  try {
    validarSesion(usuarioId);
    const casilleroRef = doc(db, 'zonas', zonaId, 'casilleros', casilleroId);
    const snapshot = await getDocFromServer(casilleroRef);
    validarSesion(usuarioId);

    if (!snapshot.exists()) {
      const error = new Error('El casillero no existe');
      error.code = 'not-found';
      throw error;
    }

    const casillero = { id: snapshot.id, ...snapshot.data() };
    const recurso = `casilleros:${zonaId}`;
    let cacheError = null;
    try {
      const cache = await leerCacheUsuario(usuarioId, recurso);
      const casilleros = (cache?.datos || []).filter((item) => item.id !== casilleroId);
      await guardarCacheUsuario(usuarioId, recurso, [...casilleros, casillero]);
    } catch (error) {
      console.error(`No se pudo actualizar la caché del casillero ${casilleroId}:`, error);
      cacheError = 'No se pudo guardar una copia local de este casillero.';
    }
    validarSesion(usuarioId);
    return { datos: casillero, actualizadoEn: Date.now(), desdeCache: false, cacheError };
  } catch (error) {
    console.error(`No se pudo consultar el casillero ${casilleroId}:`, error);
    if (error.code === 'uid-mismatch') throw error;
    if (!esErrorDeRed(error)) throw error;
    validarSesion(usuarioId);
    const cache = await leerCacheUsuario(usuarioId, `casilleros:${zonaId}`);
    validarSesion(usuarioId);
    const casillero = cache?.datos?.find((item) => item.id === casilleroId);
    if (casillero) {
      return {
        datos: casillero,
        actualizadoEn: cache.actualizadoEn,
        desdeCache: true,
        error: error.message || 'No fue posible actualizar el casillero.',
      };
    }
    throw error;
  }
};

export const verificarDisponibilidadCasillero = async ({
  casilleroId,
  fecha,
  franja,
}) => {
  try {
    const reservasRef = collection(db, 'reservas');
    const consulta = query(
      reservasRef,
      where('casilleroId', '==', casilleroId),
      where('fecha', '==', fecha),
      where('franja', '==', franja)
    );

    const snapshot = await getDocsFromServer(consulta);
    return snapshot.docs.every((documento) => documento.data().estado === 'cancelada');
  } catch (error) {
    console.error('Error al verificar disponibilidad del casillero:', error);
    throw error;
  }
};

export const reservarCasillero = async ({
  zonaId,
  casilleroId,
  usuarioId,
  usuarioEmail,
  fecha,
  franja,
  zonaNombre,
  casilleroNumero,
}) => {
  try {
    validarSesion(usuarioId);
    const reservaId = `${casilleroId}_${fecha}_${franja}`;
    const reservaRef = doc(db, 'reservas', reservaId);
    const reserva = {
      zonaId,
      casilleroId,
      zonaNombre,
      casilleroNumero,
      usuarioId,
      usuarioEmail,
      fecha,
      franja,
      estado: 'confirmada',
      createdAt: serverTimestamp(),
    };

    const historialRef = doc(collection(db, 'historial_reservas'));

    const resultado = await runTransaction(db, async (transaction) => {
      const reservaExistente = await transaction.get(reservaRef);

      if (reservaExistente.exists()) {
        const datosExistentes = reservaExistente.data();

        if (datosExistentes.estado !== 'cancelada') {
          if (
            datosExistentes.usuarioId === usuarioId
            && datosExistentes.fecha === fecha
            && datosExistentes.franja === franja
          ) {
            return { id: reservaRef.id, ...datosExistentes };
          }

          const error = new Error('Ya existe una reserva para este casillero en la fecha y franja seleccionadas.');
          error.code = 'reservation-conflict';
          throw error;
        }

        transaction.set(historialRef, {
          ...datosExistentes,
          archivedAt: serverTimestamp(),
        });
      }

      transaction.set(reservaRef, reserva);
      return { id: reservaRef.id, ...reserva };
    });

    return resultado;
  } catch (error) {
    console.error('Error al reservar el casillero:', error);
    throw error;
  }
};

export const obtenerReservasUsuario = (usuarioId) => (
  leerConCache(usuarioId, 'reservas', async () => {
    const reservasRef = collection(db, 'reservas');
    const historialRef = collection(db, 'historial_reservas');
    const consultaReservas = query(reservasRef, where('usuarioId', '==', usuarioId));
    const consultaHistorial = query(historialRef, where('usuarioId', '==', usuarioId));
    const [reservas, historial] = await Promise.all([
      getDocsFromServer(consultaReservas),
      getDocsFromServer(consultaHistorial),
    ]);

    return [
      ...reservas.docs.map((documento) => ({
        id: documento.id,
        origen: 'reservas',
        ...documento.data(),
      })),
      ...historial.docs.map((documento) => ({
        id: documento.id,
        origen: 'historial',
        ...documento.data(),
      })),
    ];
  })
);

export const cancelarReserva = async (reservaId, usuarioId) => {
  try {
    validarSesion(usuarioId);
    const reservaRef = doc(db, 'reservas', reservaId);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reservaRef);

      if (!snapshot.exists()) {
        const error = new Error('La reserva ya no existe.');
        error.code = 'operation-conflict';
        throw error;
      }

      const reserva = snapshot.data();

      if (reserva.usuarioId !== usuarioId) {
        const error = new Error('No tienes permiso para cancelar esta reserva.');
        error.code = 'operation-conflict';
        throw error;
      }

      if (reserva.estado === 'cancelada') return;

      if (!puedeCancelarReserva(reserva)) {
        const error = new Error('Ya inició el uso o la reserva no se puede cancelar.');
        error.code = 'operation-conflict';
        throw error;
      }

      transaction.update(reservaRef, {
        estado: 'cancelada',
        cancelledAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error('Error al cancelar la reserva:', error);
    throw error;
  }
};
