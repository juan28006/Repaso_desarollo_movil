// Ayudas de presentación. Las reglas reales (quién puede cancelar, cuándo se puede iniciar
// el uso…) las aplica la API; aquí solo se comparan los instantes que ella entrega, para que
// los botones sigan siendo coherentes con la hora aunque no haya conexión.
const instante = (iso) => (iso ? new Date(iso) : null);

export const puedeCancelarReserva = (reserva, ahora = new Date()) => {
  const hasta = instante(reserva.cancelableHasta);
  return reserva.puedeCancelar === true && hasta !== null && ahora < hasta;
};

export const puedeIniciarUso = (reserva, ahora = new Date()) => {
  const inicio = instante(reserva.inicioUso);
  const fin = instante(reserva.finUso);
  return reserva.estado === 'confirmada' && inicio !== null && fin !== null && ahora >= inicio && ahora < fin;
};
