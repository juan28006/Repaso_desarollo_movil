// Autenticación con Firebase Auth: la cuenta se crea con firebase-admin y el login
// valida correo/contraseña contra la API REST de Firebase (el cliente ya no usa el SDK).
import { getAuth } from 'firebase-admin/auth';
import { ApiError } from '../errores.js';

const REST = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
const REFRESH = 'https://securetoken.googleapis.com/v1/token';

export const traducirErrorFirebase = (mensaje = '') => {
  if (/EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS/.test(mensaje)) {
    return new ApiError(401, 'auth/invalid-credential', 'Correo o contraseña incorrectos.');
  }
  if (/API_KEY_INVALID|API key not valid|PROJECT_NOT_FOUND|CONFIGURATION_NOT_FOUND/i.test(mensaje)) {
    return new ApiError(503, 'auth/configuration-error', 'Verifica la configuración de Firebase Authentication y FIREBASE_WEB_API_KEY.');
  }
  if (/OPERATION_NOT_ALLOWED|EMAIL_PASSWORD_SIGN_IN_DISABLED/.test(mensaje)) {
    return new ApiError(503, 'auth/provider-disabled', 'Habilita el proveedor Correo/contraseña en Firebase Authentication.');
  }
  if (/USER_DISABLED/.test(mensaje)) return new ApiError(403, 'permission-denied', 'La cuenta está deshabilitada.');
  if (/TOKEN_EXPIRED|INVALID_REFRESH_TOKEN|USER_NOT_FOUND/.test(mensaje)) {
    return new ApiError(401, 'unauthenticated', 'La sesión expiró. Inicia sesión de nuevo.');
  }
  return new ApiError(502, 'unavailable', 'No fue posible contactar el servicio de autenticación.');
};

export const crearAuthFirebase = ({ app, apiKey }) => {
  const auth = getAuth(app);

  const llamar = async (url, cuerpo, formulario = false) => {
    let respuesta;
    try {
      respuesta = await fetch(`${url}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': formulario ? 'application/x-www-form-urlencoded' : 'application/json' },
        body: formulario ? new URLSearchParams(cuerpo).toString() : JSON.stringify(cuerpo),
      });
    } catch {
      throw new ApiError(503, 'unavailable', 'No fue posible conectar con Firebase Authentication.');
    }
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw traducirErrorFirebase(datos?.error?.message);
    return datos;
  };

  return {
    async registrar({ correo, contrasena }) {
      try {
        const u = await auth.createUser({ email: correo, password: contrasena });
        return { uid: u.uid };
      } catch (error) {
        if (error.code === 'auth/email-already-exists') {
          throw new ApiError(409, 'auth/email-already-in-use', 'Ya existe una cuenta con este correo.');
        }
        throw error;
      }
    },
    async iniciarSesion(correo, contrasena) {
      const d = await llamar(REST, { email: correo, password: contrasena, returnSecureToken: true });
      return {
        uid: d.localId,
        email: d.email,
        idToken: d.idToken,
        refreshToken: d.refreshToken,
        expiraEn: Date.now() + Number(d.expiresIn) * 1000,
      };
    },
    async refrescar(refreshToken) {
      const d = await llamar(REFRESH, { grant_type: 'refresh_token', refresh_token: refreshToken }, true);
      const decodificado = await auth.verifyIdToken(d.id_token);
      return {
        uid: d.user_id,
        email: decodificado.email,
        idToken: d.id_token,
        refreshToken: d.refresh_token,
        expiraEn: Date.now() + Number(d.expires_in) * 1000,
      };
    },
    async verificarToken(idToken) {
      try {
        const d = await auth.verifyIdToken(idToken);
        return { uid: d.uid, email: d.email };
      } catch {
        throw new ApiError(401, 'unauthenticated', 'La sesión no es válida o expiró.');
      }
    },
    async eliminarUsuario(uid) { await auth.deleteUser(uid); },
  };
};
