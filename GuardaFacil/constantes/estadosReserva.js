export const ESTADOS_RESERVA = {
  reservado: { etiqueta: 'Reservado', color: '#273c9c' },
  en_uso: { etiqueta: 'En uso', color: '#e67e22' },
  finalizado: { etiqueta: 'Finalizado', color: '#16a085' },
  vencido: { etiqueta: 'Vencido', color: '#7f8c8d' },
  cancelado: { etiqueta: 'Cancelado', color: '#e74c3c' },
  pendiente_validacion: { etiqueta: 'Pendiente de validación', color: '#b7791f' },
  conflicto_validacion: { etiqueta: 'Conflicto por resolver', color: '#a12d22' },
  rechazada: { etiqueta: 'Rechazada por el servidor', color: '#a12d22' },
};

// Los estados de negocio vienen calculados por la API. Solo las operaciones locales
// aún no confirmadas reciben un estado visual propio.
export const obtenerEstadoReserva = (reserva) => {
  if (reserva.estadoOperacionLocal) return reserva.estadoOperacionLocal;
  if (reserva.estado === 'pendiente_validacion') return 'pendiente_validacion';
  if (reserva.estado === 'conflicto_validacion') return 'conflicto_validacion';
  if (reserva.estado === 'rechazada') return 'rechazada';
  if (ESTADOS_RESERVA[reserva.estadoVisible]) return reserva.estadoVisible;
  if (reserva.estado === 'cancelada') return 'cancelado';
  if (reserva.estado === 'finalizada') return 'finalizado';
  if (reserva.estado === 'en_uso') return 'en_uso';
  return 'reservado';
};