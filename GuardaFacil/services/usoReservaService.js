import { peticion } from './apiClient';
import { validarSesion } from './zonasService';

export const iniciarUsoReserva = async (reservaId, usuarioId) => {
  validarSesion(usuarioId);
  return peticion('POST', `/reservas/${encodeURIComponent(reservaId)}/iniciar-uso`);
};
