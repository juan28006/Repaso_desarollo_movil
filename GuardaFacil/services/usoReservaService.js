import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { obtenerInicioUsoReserva } from './zonasService';
import { obtenerFinReserva } from '../constantes/estadosReserva';

export const puedeIniciarUso = (reserva, ahora = new Date()) => {
  const inicio = obtenerInicioUsoReserva(reserva);
  const fin = obtenerFinReserva(reserva);

  return (
    reserva.estado === 'confirmada'
    && inicio !== null
    && fin !== null
    && ahora >= inicio
    && ahora < fin
  );
};

export const iniciarUsoReserva = async (reservaId, usuarioId) => {
  try {
    const reservaRef = doc(db, 'reservas', reservaId);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reservaRef);

      if (!snapshot.exists()) {
        throw new Error('La reserva ya no existe.');
      }

      const reserva = snapshot.data();

      if (reserva.usuarioId !== usuarioId) {
        throw new Error('No tienes permiso para iniciar esta reserva.');
      }

      if (!puedeIniciarUso(reserva)) {
        throw new Error('Solo puedes iniciar el uso durante la franja de tu reserva.');
      }

      transaction.update(reservaRef, {
        estado: 'en_uso',
        usoIniciadoAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error('Error al iniciar el uso de la reserva:', error);
    throw error;
  }
};