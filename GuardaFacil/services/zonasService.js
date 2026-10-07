import {
  collection,
  getDocs,
  doc,
  getDoc,
  serverTimestamp,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

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

export const obtenerZonas = async () => {
  try {
    const zonasRef = collection(db, 'zonas');
    const snapshot = await getDocs(zonasRef);
    const zonas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return zonas;
  } catch (error) {
    console.error('Error al obtener zonas:', error);
    throw error;
  }
};

export const obtenerCasilleros = async (zonaId) => {
  try {
    const casillerosRef = collection(db, 'zonas', zonaId, 'casilleros');
    const snapshot = await getDocs(casillerosRef);
    const casilleros = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return casilleros;
  } catch (error) {
    console.error('Error al obtener casilleros:', error);
    throw error;
  }
};

export const obtenerCasillero = async (zonaId, casilleroId) => {
  try {
    const casilleroRef = doc(db, 'zonas', zonaId, 'casilleros', casilleroId);
    const snapshot = await getDoc(casilleroRef);

    if (!snapshot.exists()) {
      throw new Error('El casillero no existe');
    }

    return { id: snapshot.id, ...snapshot.data() };
  } catch (error) {
    console.error('Error al obtener el casillero:', error);
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

    const snapshot = await getDocs(consulta);
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

    await runTransaction(db, async (transaction) => {
      const reservaExistente = await transaction.get(reservaRef);

      if (reservaExistente.exists()) {
        const datosExistentes = reservaExistente.data();

        if (datosExistentes.estado !== 'cancelada') {
          throw new Error('Ya existe una reserva para este casillero en la fecha y franja seleccionadas.');
        }

        transaction.set(historialRef, {
          ...datosExistentes,
          archivedAt: serverTimestamp(),
        });
      }

      transaction.set(reservaRef, reserva);
    });

    return { id: reservaRef.id, ...reserva };
  } catch (error) {
    console.error('Error al reservar el casillero:', error);
    throw error;
  }
};

export const obtenerReservasUsuario = async (usuarioId) => {
  try {
    const reservasRef = collection(db, 'reservas');
    const historialRef = collection(db, 'historial_reservas');
    const consultaReservas = query(reservasRef, where('usuarioId', '==', usuarioId));
    const consultaHistorial = query(historialRef, where('usuarioId', '==', usuarioId));
    const [reservas, historial] = await Promise.all([
      getDocs(consultaReservas),
      getDocs(consultaHistorial),
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
  } catch (error) {
    console.error('Error al obtener las reservas del usuario:', error);
    throw error;
  }
};

export const cancelarReserva = async (reservaId, usuarioId) => {
  try {
    const reservaRef = doc(db, 'reservas', reservaId);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reservaRef);

      if (!snapshot.exists()) {
        throw new Error('La reserva ya no existe.');
      }

      const reserva = snapshot.data();

      if (reserva.usuarioId !== usuarioId) {
        throw new Error('No tienes permiso para cancelar esta reserva.');
      }

      if (!puedeCancelarReserva(reserva)) {
        throw new Error('Ya inició el uso o la reserva no se puede cancelar.');
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
