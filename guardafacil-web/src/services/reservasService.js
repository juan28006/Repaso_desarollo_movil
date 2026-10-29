import api from "../api/apiClient";

export const crearReserva = async ({ zonaId, casilleroId, fecha, franja, usuarioEmail,}) => {

  const { data } = await api.post("/reservas", { zonaId, casilleroId, fecha, franja, usuarioEmail,});
  return data;
};

export const obtenerMisReservas = async () => {

  const { data } = await api.get("/reservas/mias");
  return data;
};

export const cancelarReserva = async (reservaId) => {

  const { data } = await api.post( `/reservas/${reservaId}/cancelar`);
  return data;
};

export const iniciarUsoReserva = async (reservaId) => {

  const { data } = await api.post( `/reservas/${reservaId}/iniciar-uso`);
  return data;
};