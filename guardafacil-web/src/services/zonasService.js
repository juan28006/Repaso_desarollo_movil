import api from "../api/apiClient";

export const obtenerZonas = async () => {
  const { data } = await api.get("/zonas");
  return data;
};

export const obtenerCasilleros = async (zonaId) => {

  const { data } = await api.get( `/zonas/${zonaId}/casilleros`);
  return data;
};

export const obtenerCasillero = async ( zonaId, casilleroId) => {

  const { data } = await api.get( `/zonas/${zonaId}/casilleros/${casilleroId}`);
  return data;
};

export const verificarDisponibilidad = async ( casilleroId, fecha, franja) => {

  const { data } = await api.get( `/casilleros/${casilleroId}/disponibilidad`, { params: { fecha, franja, }, });
  return data;
};