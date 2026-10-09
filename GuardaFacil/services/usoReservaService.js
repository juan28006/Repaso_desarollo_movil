import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
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
    if (auth.currentUser?.uid !== usuarioId) {
      const error = new Error('La sesión cambió; no se iniciará una operación con otra cuenta.');
      error.code = 'uid-mismatch';
      throw error;
    }
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
        const error = new Error('No tienes permiso para iniciar esta reserva.');
        error.code = 'operation-conflict';
        throw error;
      }

      if (reserva.estado === 'en_uso') return;

      if (!puedeIniciarUso(reserva)) {
        const error = new Error('Solo puedes iniciar el uso durante la franja de tu reserva.');
        error.code = 'operation-conflict';
        throw error;
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