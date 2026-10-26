// La API es la autoridad para decidir si una acción está disponible.
// Estos helpers solo leen sus indicadores para presentar la interfaz.
export const puedeCancelarReserva = (reserva) => reserva.puedeCancelar === true;

export const puedeIniciarUso = (reserva) => reserva.puedeIniciarUso === true;
