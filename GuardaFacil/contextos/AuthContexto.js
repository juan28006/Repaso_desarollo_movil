import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';

const AuthContexto = createContext(null);

export function AuthContextoProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => onAuthStateChanged(auth, (usuarioActual) => {
    setUsuario(usuarioActual);
    setCargando(false);
  }), []);

  const iniciarSesion = (correo, contrasena) => signInWithEmailAndPassword(auth, correo.trim(), contrasena);
  const registrarUsuario = (correo, contrasena) => createUserWithEmailAndPassword(auth, correo.trim(), contrasena);
  const cerrarSesion = () => signOut(auth);

  const value = useMemo(() => ({
    usuario,
    cargando,
    iniciarSesion,
    registrarUsuario,
    cerrarSesion,
  }), [usuario, cargando]);

  return <AuthContexto.Provider value={value}>{children}</AuthContexto.Provider>;
}

export function useAuthContexto() {
  return useContext(AuthContexto);
}

export { AuthContexto };
export default AuthContextoProvider;
