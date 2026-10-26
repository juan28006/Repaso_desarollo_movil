// Acceso a zonas, casilleros y reservas. Todo pasa por la API; aquí solo se
// coordina la caché local (SQLite) para poder consultar sin conexión.
import { peticion } from './apiClient';
import { guardarCacheUsuario, leerCacheUsuario } from './offlineDb';
import { esErrorDeRed } from './offlineErrors';
import { uidActual } from './sesion';

const enc = encodeURIComponent;

export const validarSesion = (usuarioId) => {
  if (!usuarioId || uidActual() !== usuarioId) {
    const error = new Error('La sesión cambió; no se devolverán datos de otra cuenta.');
    error.code = 'uid-mismatch';
    throw error;
  }
};

export const leerConCache = async (usuarioId, recurso, consultarServidor) => {
  validarSesion(usuarioId);

  try {
    const datos = await consultarServidor();
    validarSesion(usuarioId);
    let actualizadoEn = Date.now();
    let cacheError = null;
    try {
      const registro = await guardarCacheUsuario(usuarioId, recurso, datos);
      actualizadoEn = registro.actualizadoEn;
    } catch (error) {
      console.error(`No se pudo guardar la caché local (${recurso}):`, error);
      cacheError = 'No se pudo guardar una copia local de estos datos.';
    }
    validarSesion(usuarioId);
    return { datos, actualizadoEn, desdeCache: false, cacheError };
  } catch (error) {
    console.error(`No se pudieron consultar los datos de la API (${recurso}):`, error);
    if (error.code === 'uid-mismatch') throw error;
    if (!esErrorDeRed(error)) throw error;
    validarSesion(usuarioId);
    const cache = await leerCacheUsuario(usuarioId, recurso);
    validarSesion(usuarioId);
    if (cache && Array.isArray(cache.datos)) {
      return {
        datos: cache.datos,
        actualizadoEn: cache.actualizadoEn,
        desdeCache: true,
        error: error.message || 'No fue posible actualizar los datos.',
      };
    }
    throw error;
  }
};

export const obtenerZonas = (usuarioId) => (
  leerConCache(usuarioId, 'zonas', () => peticion('GET', '/zonas'))
);

export const obtenerCasilleros = (usuarioId, zonaId) => (
  leerConCache(usuarioId, `casilleros:${zonaId}`, () => (
    peticion('GET', `/zonas/${enc(zonaId)}/casilleros`)
  ))
);

export const obtenerCasillero = async (usuarioId, zonaId, casilleroId) => {
  try {
    validarSesion(usuarioId);
    const casillero = await peticion('GET', `/zonas/${enc(zonaId)}/casilleros/${enc(casilleroId)}`);
    validarSesion(usuarioId);

    const recurso = `casilleros:${zonaId}`;
    let cacheError = null;
    try {
      const cache = await leerCacheUsuario(usuarioId, recurso);
      const casilleros = (cache?.datos || []).filter((item) => item.id !== casilleroId);
      await guardarCacheUsuario(usuarioId, recurso, [...casilleros, casillero]);
    } catch (error) {
      console.error(`No se pudo actualizar la caché del casillero ${casilleroId}:`, error);
      cacheError = 'No se pudo guardar una copia local de este casillero.';
    }
    validarSesion(usuarioId);
    return { datos: casillero, actualizadoEn: Date.now(), desdeCache: false, cacheError };
  } catch (error) {
    console.error(`No se pudo consultar el casillero ${casilleroId}:`, error);
    if (error.code === 'uid-mismatch') throw error;
    if (!esErrorDeRed(error)) throw error;
    validarSesion(usuarioId);
    const cache = await leerCacheUsuario(usuarioId, `casilleros:${zonaId}`);
    validarSesion(usuarioId);
    const casillero = cache?.datos?.find((item) => item.id === casilleroId);
    if (casillero) {
      return {
        datos: casillero,
        actualizadoEn: cache.actualizadoEn,
        desdeCache: true,
        error: error.message || 'No fue posible actualizar el casillero.',
      };
    }
    throw error;
  }
};

export const verificarDisponibilidadCasillero = async ({ casilleroId, fecha, franja }) => {
  const consulta = `fecha=${enc(fecha)}&franja=${enc(franja)}`;
  const respuesta = await peticion('GET', `/casilleros/${enc(casilleroId)}/disponibilidad?${consulta}`);
  return respuesta.disponible;
};

// Un estudiante reserva para sí mismo. Un gestor o administrador puede indicar
// `usuarioEmail` para reservar en nombre de un estudiante.
export const reservarCasillero = async ({
  zonaId,
  casilleroId,
  usuarioId,
  usuarioEmail,
  fecha,
  franja,
}) => {
  validarSesion(usuarioId);
  return peticion('POST', '/reservas', {
    cuerpo: { zonaId, casilleroId, fecha, franja, usuarioEmail },
  });
};

export const obtenerReservasUsuario = (usuarioId) => (
  leerConCache(usuarioId, 'reservas', () => peticion('GET', '/reservas/mias'))
);

export const cancelarReserva = async (reservaId, usuarioId) => {
  validarSesion(usuarioId);
  return peticion('POST', `/reservas/${enc(reservaId)}/cancelar`);
};
