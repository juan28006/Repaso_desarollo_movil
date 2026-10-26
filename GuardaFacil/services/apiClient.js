// Único punto de contacto del cliente con el servidor: toda la lógica de negocio vive en la API.
import { expirarSesion, guardarSesion, obtenerSesion } from './sesion';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
const TIEMPO_MAXIMO_MS = 15000;
const MARGEN_RENOVACION_MS = 30000;

let renovacion = null;

const crearError = (mensaje, code, status) => {
  const error = new Error(mensaje);
  error.code = code;
  if (status) error.status = status;
  return error;
};

const enviar = async (metodo, ruta, { cuerpo, token } = {}) => {
  if (!BASE_URL) {
    throw crearError('Falta configurar EXPO_PUBLIC_API_URL.', 'config');
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);
  let respuesta;
  try {
    respuesta = await fetch(`${BASE_URL}${ruta}`, {
      method: metodo,
      signal: controlador.signal,
      headers: {
        Accept: 'application/json',
        ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw crearError('El servidor tardó demasiado en responder.', 'deadline-exceeded');
    }
    throw crearError('No se pudo conectar con el servidor.', 'network-request-failed');
  } finally {
    clearTimeout(temporizador);
  }

  const datos = await respuesta.json().catch(() => null);
  if (respuesta.ok) return datos;

  if ([502, 503, 504].includes(respuesta.status)) {
    throw crearError('El servidor no está disponible.', 'unavailable', respuesta.status);
  }
  throw crearError(
    datos?.error?.mensaje || 'No se pudo completar la solicitud.',
    datos?.error?.code || 'internal',
    respuesta.status
  );
};

const renovarSesion = () => {
  if (!renovacion) {
    renovacion = (async () => {
      const actual = obtenerSesion();
      if (!actual?.refreshToken) throw crearError('Debes iniciar sesión.', 'unauthenticated', 401);
      const nueva = await enviar('POST', '/auth/refresh', { cuerpo: { refreshToken: actual.refreshToken } });
      await guardarSesion({
        idToken: nueva.idToken,
        refreshToken: nueva.refreshToken,
        expiraEn: nueva.expiraEn,
        usuario: nueva.usuario,
      });
    })().finally(() => { renovacion = null; });
  }
  return renovacion;
};

// `sinAuth` se usa solo en login y registro.
export async function peticion(metodo, ruta, { cuerpo, sinAuth = false } = {}) {
  if (sinAuth) return enviar(metodo, ruta, { cuerpo });

  const sesion = obtenerSesion();
  if (!sesion?.idToken) throw crearError('Debes iniciar sesión.', 'unauthenticated', 401);

  const renovar = async () => {
    try {
      await renovarSesion();
    } catch (error) {
      // Solo se cierra la sesión si el servidor rechazó la renovación; un fallo de red la conserva.
      if (error.status === 401) await expirarSesion();
      throw error;
    }
  };

  if (sesion.expiraEn && sesion.expiraEn - MARGEN_RENOVACION_MS < Date.now()) await renovar();

  try {
    return await enviar(metodo, ruta, { cuerpo, token: obtenerSesion().idToken });
  } catch (error) {
    if (error.status !== 401) throw error;
    await renovar();
    return enviar(metodo, ruta, { cuerpo, token: obtenerSesion().idToken });
  }
}
