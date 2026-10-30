// Operaciones del personal (gestor / administrador). Los permisos los valida la API.
import { peticion } from './apiClient';
import { leerConCache, validarSesion } from './zonasService';

export const obtenerTodasLasReservas = (usuarioId) => (
  leerConCache(usuarioId, 'reservas_gestion', () => peticion('GET', '/reservas'))
);

export const obtenerUsuarios = (usuarioId) => (
  leerConCache(usuarioId, 'usuarios', () => peticion('GET', '/usuarios'))
);

export const cambiarRolUsuario = async (usuarioId, uidObjetivo, rol) => {
  validarSesion(usuarioId);
  return peticion('PATCH', `/usuarios/${encodeURIComponent(uidObjetivo)}/rol`, { cuerpo: { rol } });
};

export const actualizarUsuario = async (usuarioId, uidObjetivo, cambios) => {
  validarSesion(usuarioId);
  return peticion('PATCH', `/usuarios/${encodeURIComponent(uidObjetivo)}`, { cuerpo: cambios });
};

export const eliminarUsuario = async (usuarioId, uidObjetivo) => {
  validarSesion(usuarioId);
  return peticion('DELETE', `/usuarios/${encodeURIComponent(uidObjetivo)}`);
};
