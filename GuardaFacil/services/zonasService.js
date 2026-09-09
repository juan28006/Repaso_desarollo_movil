import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export const obtenerZonas = async () => {
  try {
    const zonasRef = collection(db, 'zonas');
    const snapshot = await getDocs(zonasRef);
    const zonas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return zonas;
  } catch (error) {
    console.error('Error al obtener zonas:', error);
    throw error;
  }
};

export const obtenerCasilleros = async (zonaId) => {
  try {
    const casillerosRef = collection(db, 'zonas', zonaId, 'casilleros');
    const snapshot = await getDocs(casillerosRef);
    const casilleros = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return casilleros;
  } catch (error) {
    console.error('Error al obtener casilleros:', error);
    throw error;
  }
  };

export const obtenerCasillero = async (zonaId, casilleroId) => {
  try {
    const casilleroRef = doc(db, 'zonas', zonaId, 'casilleros', casilleroId);
    const snapshot = await getDoc(casilleroRef);

    if (!snapshot.exists()) {
      throw new Error('El casillero no existe');
    }

    return { id: snapshot.id, ...snapshot.data() };
  } catch (error) {
    console.error('Error al obtener el casillero:', error);
    throw error;
  }
};
 