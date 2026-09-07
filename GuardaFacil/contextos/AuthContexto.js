import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

const AuthContexto = createContext(null);

export function AuthContextoProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => onAuthStateChanged(auth, (usuarioActual) => {
    setUsuario(usuarioActual);
    setCargando(false);
  }), []);

  const iniciarSesion = (correo, contrasena) => signInWithEmailAndPassword(auth, correo.trim(), contrasena);
  const registrarUsuario = async (datos) => {
    const credencial = await createUserWithEmailAndPassword(auth, datos.correo.trim(), datos.contrasena);
    await setDoc(doc(db, 'users', credencial.user.uid), {
      nombreCompleto: datos.nombreCompleto.trim(),
      cedula: datos.cedula.trim(),
      telefono: datos.telefono.trim(),
      correo: datos.correo.trim(),
      direccion: datos.direccion.trim(),
      createdAt: serverTimestamp(),
    });
    return credencial;
  };
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
