import { readFileSync } from 'node:fs';
import { crearApp } from './app.js';
import { cargarConfig } from './config.js';

const config = cargarConfig();
let repo;
let auth;

if (config.modoDatos === 'firebase') {
  const { cert, getApps, initializeApp, applicationDefault } = await import('firebase-admin/app');
  const { crearRepoFirestore } = await import('./repos/firestore.js');
  const { crearAuthFirebase } = await import('./auth/firebase.js');
  const credencial = config.firebaseServiceAccount
    ? cert(JSON.parse(readFileSync(config.firebaseServiceAccount, 'utf8')))
    : applicationDefault();
  const firebaseApp = getApps()[0] ?? initializeApp({ credential: credencial });
  repo = crearRepoFirestore(firebaseApp);
  auth = crearAuthFirebase({ app: firebaseApp, apiKey: config.firebaseWebApiKey });
} else if (config.modoDatos === 'memoria') {
  const { crearRepoMemoria, datosDeEjemplo } = await import('./repos/memoria.js');
  const { crearAuthMemoria } = await import('./auth/memoria.js');
  repo = crearRepoMemoria(datosDeEjemplo());
  auth = crearAuthMemoria({ secreto: config.jwtSecret });
  console.warn('MODO_DATOS=memoria: los datos se pierden al reiniciar (solo desarrollo).');
} else {
  throw new Error(`Proveedor de datos no soportado: ${config.modoDatos}`);
}

crearApp({ repo, auth, config }).listen(config.puerto, () => {
  console.log(`GuardaFácil API escuchando en el puerto ${config.puerto} (${config.modoDatos})`);
});
