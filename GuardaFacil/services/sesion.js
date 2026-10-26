// Sesión del usuario contra la API: el token se guarda en el almacén seguro del
// dispositivo (Keychain / Keystore). En web no hay almacén seguro y se usa AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CLAVE = 'guardafacil.sesion.v1';
const almacen = Platform.OS === 'web'
  ? {
    leer: () => AsyncStorage.getItem(CLAVE),
    guardar: (valor) => AsyncStorage.setItem(CLAVE, valor),
    borrar: () => AsyncStorage.removeItem(CLAVE),
  }
  : {
    leer: () => SecureStore.getItemAsync(CLAVE),
    guardar: (valor) => SecureStore.setItemAsync(CLAVE, valor),
    borrar: () => SecureStore.deleteItemAsync(CLAVE),
  };

let sesion = null;
const escuchasExpiracion = new Set();

export const obtenerSesion = () => sesion;
export const uidActual = () => sesion?.usuario?.uid ?? null;

export async function cargarSesion() {
  try {
    const valor = await almacen.leer();
    sesion = valor ? JSON.parse(valor) : null;
  } catch (error) {
    console.error('No se pudo leer la sesión guardada:', error);
    sesion = null;
  }
  return sesion;
}

export async function guardarSesion(nueva) {
  sesion = nueva;
  await almacen.guardar(JSON.stringify(nueva));
}

export async function borrarSesion() {
  sesion = null;
  try {
    await almacen.borrar();
  } catch (error) {
    console.error('No se pudo borrar la sesión guardada:', error);
  }
}

export const alExpirarSesion = (escucha) => {
  escuchasExpiracion.add(escucha);
  return () => escuchasExpiracion.delete(escucha);
};

export async function expirarSesion() {
  await borrarSesion();
  escuchasExpiracion.forEach((escucha) => escucha());
}
