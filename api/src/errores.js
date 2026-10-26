export class ApiError extends Error {
  constructor(status, code, mensaje) {
    super(mensaje);
    this.status = status;
    this.code = code;
  }
}

export const noAutenticado = (m = 'Debes iniciar sesión.') => new ApiError(401, 'unauthenticated', m);
export const prohibido = (m = 'No tienes permiso para realizar esta acción.') => new ApiError(403, 'permission-denied', m);
export const noEncontrado = (m = 'No se encontró el recurso.') => new ApiError(404, 'not-found', m);
export const invalido = (m) => new ApiError(400, 'invalid-argument', m);
export const conflictoReserva = (m) => new ApiError(409, 'reservation-conflict', m);
export const conflictoOperacion = (m) => new ApiError(409, 'operation-conflict', m);
