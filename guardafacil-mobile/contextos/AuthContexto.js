import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { peticion } from '../services/apiClient';
import {
  alExpirarSesion,
  borrarSesion,
  cargarSesion,
  guardarSesion,
  obtenerSesion,
} from '../services/sesion';

const AuthContexto = createContext(null);

const guardarRespuesta = async (respuesta) => {
  await guardarSesion({
    idToken: respuesta.idToken,
    refreshToken: respuesta.refreshToken,
    expiraEn: respuesta.expiraEn,
    usuario: respuesta.usuario,
  });
  return respuesta.usuario;
};

export function AuthContextoProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activa = true;
    const quitarEscucha = alExpirarSesion(() => {
      if (activa) setUsuario(null);
    });

    (async () => {
      const sesion = await cargarSesion();
      if (!activa) return;
      // Se abre con la sesión guardada aunque no haya conexión (modo offline).
      setUsuario(sesion?.usuario ?? null);
      setCargando(false);
      if (!sesion) return;

      try {
        // Actualiza el rol por si un administrador lo cambió mientras la app estaba cerrada.
        const perfil = await peticion('GET', '/auth/me');
        const actual = obtenerSesion();
        if (!activa || !actual) return;
        await guardarSesion({ ...actual, usuario: perfil });
        setUsuario(perfil);
      } catch {
        // Sin conexión o sesión caducada (ya notificada): se conserva lo guardado.
      }
    })();

    return () => {
      activa = false;
      quitarEscucha();
    };
  }, []);

  const value = useMemo(() => ({
    usuario,
    rol: usuario?.rol ?? null,
    cargando,
    iniciarSesion: async (correo, contrasena) => {
      const respuesta = await peticion('POST', '/auth/login', {
        cuerpo: { correo: correo.trim(), contrasena },
        sinAuth: true,
      });
      setUsuario(await guardarRespuesta(respuesta));
    },
    registrarUsuario: async (datos) => {
      const respuesta = await peticion('POST', '/auth/registro', {
        cuerpo: {
          nombreCompleto: datos.nombreCompleto.trim(),
          cedula: datos.cedula.trim(),
          telefono: datos.telefono.trim(),
          correo: datos.correo.trim(),
          direccion: datos.direccion.trim(),
          contrasena: datos.contrasena,
        },
        sinAuth: true,
      });
      setUsuario(await guardarRespuesta(respuesta));
    },
    cerrarSesion: async () => {
      await borrarSesion();
      setUsuario(null);
    },
  }), [usuario, cargando]);

  return <AuthContexto.Provider value={value}>{children}</AuthContexto.Provider>;
}

export function useAuthContexto() {
  return useContext(AuthContexto);
}

export { AuthContexto };
export default AuthContextoProvider;
