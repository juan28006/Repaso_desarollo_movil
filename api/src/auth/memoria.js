// Autenticación en memoria (desarrollo y pruebas): contraseñas con scrypt y tokens JWT.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ApiError } from '../errores.js';

const credencialesInvalidas = () => new ApiError(401, 'auth/invalid-credential', 'Correo o contraseña incorrectos.');

export const crearAuthMemoria = ({ secreto, duracionSegundos = 3600 }) => {
  const usuarios = new Map(); // uid -> { correo, sal, hash }
  const refrescos = new Map(); // token -> uid

  const hash = (contrasena, sal) => crypto.scryptSync(contrasena, sal, 32).toString('hex');
  const emitir = (uid, correo) => {
    const refreshToken = crypto.randomBytes(24).toString('hex');
    refrescos.set(refreshToken, uid);
    return {
      idToken: jwt.sign({ uid, email: correo }, secreto, { expiresIn: duracionSegundos }),
      refreshToken,
      expiraEn: Date.now() + duracionSegundos * 1000,
    };
  };

  return {
    async registrar({ correo, contrasena }) {
      const normal = correo.toLowerCase();
      if ([...usuarios.values()].some((u) => u.correo === normal)) {
        throw new ApiError(409, 'auth/email-already-in-use', 'Ya existe una cuenta con este correo.');
      }
      const uid = crypto.randomUUID();
      const sal = crypto.randomBytes(16).toString('hex');
      usuarios.set(uid, { correo: normal, sal, hash: hash(contrasena, sal) });
      return { uid };
    },
    async iniciarSesion(correo, contrasena) {
      const normal = correo.toLowerCase();
      const entrada = [...usuarios].find(([, u]) => u.correo === normal);
      if (!entrada) throw credencialesInvalidas();
      const [uid, u] = entrada;
      const esperado = Buffer.from(u.hash, 'hex');
      const recibido = Buffer.from(hash(contrasena, u.sal), 'hex');
      if (!crypto.timingSafeEqual(esperado, recibido)) throw credencialesInvalidas();
      return { uid, email: u.correo, ...emitir(uid, u.correo) };
    },
    async refrescar(refreshToken) {
      const uid = refrescos.get(refreshToken);
      const u = uid && usuarios.get(uid);
      if (!u) throw new ApiError(401, 'unauthenticated', 'La sesión expiró. Inicia sesión de nuevo.');
      refrescos.delete(refreshToken);
      return { uid, email: u.correo, ...emitir(uid, u.correo) };
    },
    async verificarToken(idToken) {
      try {
        const { uid, email } = jwt.verify(idToken, secreto);
        if (!usuarios.has(uid)) throw new Error('desconocido');
        return { uid, email };
      } catch {
        throw new ApiError(401, 'unauthenticated', 'La sesión no es válida o expiró.');
      }
    },
    async eliminarUsuario(uid) { usuarios.delete(uid); },
  };
};
