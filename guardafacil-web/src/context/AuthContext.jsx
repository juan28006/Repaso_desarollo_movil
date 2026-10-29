import { createContext, useCallback, useContext, useEffect, useState,} from 'react';
import api from '../services/api';
const AuthContext = createContext(null);
const CLAVE_TOKEN = 'guardafacil_id_token';
const CLAVE_REFRESH = 'guardafacil_refresh_token';
const CLAVE_USUARIO = 'guardafacil_usuario';

function guardarSesion(sesion) {
  localStorage.setItem(CLAVE_TOKEN, sesion.idToken);
  localStorage.setItem(CLAVE_REFRESH, sesion.refreshToken);
  localStorage.setItem(CLAVE_USUARIO, JSON.stringify(sesion.usuario));
}

function limpiarSesion() {
  localStorage.removeItem(CLAVE_TOKEN);
  localStorage.removeItem(CLAVE_REFRESH);
  localStorage.removeItem(CLAVE_USUARIO);
}

function obtenerMensajeError(error) {
  return ( error.response?.data?.error?.mensaje || 'No fue posible conectar con el servidor. Verifica que la API esté funcionando.');
}

export function AuthProvider({ children }) {

  const [usuario, setUsuario] = useState(() => {

    try {
      const guardado = localStorage.getItem(CLAVE_USUARIO);
      return guardado ? JSON.parse(guardado) : null;
    } catch {
      return null;
    }
  });

  const [cargando, setCargando] = useState(true);

  const guardarAutenticacion = useCallback((sesion) => {

    guardarSesion(sesion);
    setUsuario(sesion.usuario);
  }, []);

  const cerrarSesion = useCallback(() => {

    limpiarSesion();
    setUsuario(null);
  }, []);

  useEffect(() => {
    let activo = true;
    async function comprobarSesion() {

      const token = localStorage.getItem(CLAVE_TOKEN);
      if (!token) {
        if (activo) setCargando(false);
        return;
      }
      try {
        const respuesta = await api.get('/auth/me');
        if (activo) {
          setUsuario(respuesta.data);
          localStorage.setItem( CLAVE_USUARIO, JSON.stringify(respuesta.data),);
        }
      } catch {
        if (activo) {
          cerrarSesion();
        }
      } finally {
        if (activo) setCargando(false);
      }
    }
    comprobarSesion();
    return () => {
      activo = false;
    };
  }, [cerrarSesion]);

  const iniciarSesion = useCallback(

    async (correo, contrasena) => {
      try {
        const respuesta = await api.post('/auth/login', {
          correo: correo.trim(),
          contrasena,
        });

        guardarAutenticacion(respuesta.data);
        return respuesta.data.usuario;
      } catch (error) {
        throw new Error(obtenerMensajeError(error));
      }
    },
    [guardarAutenticacion],
  );

  const registrar = useCallback(

    async (datos) => {
      try {
        const respuesta = await api.post('/auth/registro', datos);
        guardarAutenticacion(respuesta.data);
        return respuesta.data.usuario;
      } catch (error) {
        throw new Error(obtenerMensajeError(error));
      }
    },
    [guardarAutenticacion],
  );

  const valor = {
    usuario,
    cargando,
    autenticado: Boolean(usuario),
    iniciarSesion,
    registrar,
    cerrarSesion,
  };

  return (
    <AuthContext.Provider value={valor}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {

  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }
  return contexto;
}