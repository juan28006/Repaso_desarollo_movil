const estadoVisibleOperacion = (estado) => {
  if (estado === 'conflicto') return 'conflicto_validacion';
  if (estado === 'rechazada') return 'rechazada';
  return 'pendiente_validacion';
};

const idReservaOperacion = (operacion) => (
  operacion.tipo === 'reservar'
    ? `${operacion.datos.casilleroId}_${operacion.datos.fecha}_${operacion.datos.franja}`
    : operacion.datos.reservaId
);

export const aplicarColaAReservas = (reservas, operaciones) => {
  const operacionesPorReserva = new Map(
    operaciones.map((operacion) => [idReservaOperacion(operacion), operacion])
  );

  return reservas.map((reserva) => {
    const operacion = operacionesPorReserva.get(reserva.id);
    if (!operacion) return reserva;

    return {
      ...reserva,
      estadoOperacionLocal: estadoVisibleOperacion(operacion.estado),
      tipoOperacionLocal: operacion.tipo,
      errorOperacionLocal: operacion.ultimoError || null,
    };
  });
};

export const etiquetaOperacionLocal = (reserva) => {
  const tipo = ({
    reservar: 'Reserva',
    cancelar: 'Cancelación',
    iniciar_uso: 'Inicio de uso',
  })[reserva.tipoOperacionLocal];
  const estado = ({
    pendiente_validacion: 'pendiente de validación',
    conflicto_validacion: 'en conflicto',
    rechazada: 'rechazada por el servidor',
  })[reserva.estadoOperacionLocal];

  if (!tipo || !estado) return null;
  return `${tipo} ${estado}${reserva.errorOperacionLocal ? `: ${reserva.errorOperacionLocal}` : ''}`;
};
