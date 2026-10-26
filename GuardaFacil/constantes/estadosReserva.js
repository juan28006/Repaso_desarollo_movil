export const ESTADOS_RESERVA = {
  reservado: { etiqueta: 'Reservado', color: '#273c9c' },
  en_uso: { etiqueta: 'En uso', color: '#e67e22' },
  finalizado: { etiqueta: 'Finalizado', color: '#16a085' },
  vencido: { etiqueta: 'Vencido', color: '#7f8c8d' },
  cancelado: { etiqueta: 'Cancelado', color: '#e74c3c' },
  pendiente_validacion: { etiqueta: 'Pendiente de validación', color: '#b7791f' },
  conflicto_validacion: { etiqueta: 'Conflicto por resolver', color: '#a12d22' },
};

// La API entrega `finUso` (instante ISO). Con él el estado sigue siendo correcto sin conexión.
export const obtenerFinReserva = (reserva) => (reserva.finUso ? new Date(reserva.finUso) : null);

export const obtenerEstadoReserva = (reserva, ahora = new Date()) => {
  if (reserva.estado === 'pendiente_validacion') return 'pendiente_validacion';
  if (reserva.estado === 'conflicto_validacion') return 'conflicto_validacion';
  if (reserva.estado === 'cancelada') return 'cancelado';
  if (reserva.estado === 'finalizada') return 'finalizado';

  const fin = obtenerFinReserva(reserva);
  if (fin === null) return 'reservado';

  if (reserva.estado === 'en_uso') {
    return ahora < fin ? 'en_uso' : 'finalizado';
  }

  // estado 'confirmada': nunca se inició el uso
  return ahora < fin ? 'reservado' : 'vencido';
};