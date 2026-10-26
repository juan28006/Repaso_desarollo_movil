import cors from 'cors';
import express from 'express';
import { ApiError, invalido, noAutenticado, prohibido } from './errores.js';
import { ROLES, esPersonal } from './roles.js';
import { crearServicios } from './servicios.js';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const texto = (v) => (typeof v === 'string' ? v.trim() : '');

const validarRegistro = (b) => {
  const datos = {
    nombreCompleto: texto(b.nombreCompleto),
    cedula: texto(b.cedula),
    telefono: texto(b.telefono),
    correo: texto(b.correo),
    direccion: texto(b.direccion),
    contrasena: typeof b.contrasena === 'string' ? b.contrasena : '',
  };
  if (!datos.nombreCompleto) throw invalido('Escribe tu nombre completo.');
  if (!/^\d{6,12}$/.test(datos.cedula)) throw invalido('La cédula debe tener entre 6 y 12 dígitos.');
  if (!/^\d{7,15}$/.test(datos.telefono)) throw invalido('El teléfono debe tener entre 7 y 15 dígitos.');
  if (!REGEX_CORREO.test(datos.correo)) throw invalido('Escribe un correo válido.');
  if (!datos.direccion) throw invalido('Escribe tu dirección.');
  if (datos.contrasena.length < 6) throw invalido('La contraseña debe tener al menos 6 caracteres.');
  return datos;
};

export const crearApp = ({ repo, auth, config, reloj }) => {
  const servicios = crearServicios({ repo, config, reloj });
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50kb' }));

  const ruta = (manejador) => (req, res, next) => Promise.resolve(manejador(req, res)).catch(next);

  const autenticar = async (req) => {
    const encabezado = req.headers.authorization || '';
    const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : '';
    if (!token) throw noAutenticado();
    const { uid, email } = await auth.verificarToken(token);
    req.actor = await servicios.resolverUsuario(uid, email);
  };
  const protegida = (...roles) => [
    (req, _res, next) => autenticar(req).then(() => next(), next),
    (req, _res, next) => {
      if (roles.length && !roles.includes(req.actor.rol)) return next(prohibido());
      return next();
    },
  ];

  app.get('/salud', (_req, res) => res.json({ ok: true }));

  // ---------- Autenticación ----------
  app.post('/auth/registro', ruta(async (req, res) => {
    const datos = validarRegistro(req.body || {});
    const { uid } = await auth.registrar({ correo: datos.correo, contrasena: datos.contrasena });
    try {
      await repo.guardarUsuario(uid, {
        nombreCompleto: datos.nombreCompleto,
        cedula: datos.cedula,
        telefono: datos.telefono,
        correo: datos.correo,
        direccion: datos.direccion,
        // El rol nunca viene del cliente: todo registro público es estudiante
        // (salvo los correos de ADMIN_EMAILS, que se resuelven en resolverUsuario).
        rol: ROLES.ESTUDIANTE,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      try { await auth.eliminarUsuario(uid); } catch { /* sin perfil no hay registro válido */ }
      throw error;
    }
    const sesion = await auth.iniciarSesion(datos.correo, datos.contrasena);
    const usuario = await servicios.resolverUsuario(uid, datos.correo);
    res.status(201).json({ ...sesion, usuario: servicios.perfilPublico(usuario) });
  }));

  app.post('/auth/login', ruta(async (req, res) => {
    const correo = texto(req.body?.correo);
    const contrasena = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';
    if (!REGEX_CORREO.test(correo) || !contrasena) throw invalido('Escribe tu correo y contraseña.');
    const sesion = await auth.iniciarSesion(correo, contrasena);
    const usuario = await servicios.resolverUsuario(sesion.uid, sesion.email);
    res.json({ ...sesion, usuario: servicios.perfilPublico(usuario) });
  }));

  app.post('/auth/refresh', ruta(async (req, res) => {
    const refreshToken = texto(req.body?.refreshToken);
    if (!refreshToken) throw invalido('Falta el token de renovación.');
    const sesion = await auth.refrescar(refreshToken);
    const usuario = await servicios.resolverUsuario(sesion.uid, sesion.email);
    res.json({ ...sesion, usuario: servicios.perfilPublico(usuario) });
  }));

  app.get('/auth/me', ...protegida(), (req, res) => res.json(servicios.perfilPublico(req.actor)));

  // ---------- Catálogo ----------
  app.get('/zonas', ...protegida(), ruta(async (_req, res) => res.json(await servicios.listarZonas())));
  app.get('/zonas/:zonaId/casilleros', ...protegida(), ruta(async (req, res) => (
    res.json(await servicios.listarCasilleros(req.params.zonaId))
  )));
  app.get('/zonas/:zonaId/casilleros/:casilleroId', ...protegida(), ruta(async (req, res) => (
    res.json(await servicios.obtenerCasillero(req.params.zonaId, req.params.casilleroId))
  )));
  app.get('/casilleros/:casilleroId/disponibilidad', ...protegida(), ruta(async (req, res) => (
    res.json(await servicios.disponibilidad({ casilleroId: req.params.casilleroId, ...req.query }))
  )));

  // ---------- Reservas ----------
  app.post('/reservas', ...protegida(), ruta(async (req, res) => {
    const { reserva, creada } = await servicios.reservar(req.actor, req.body || {});
    res.status(creada ? 201 : 200).json(reserva);
  }));
  app.get('/reservas/mias', ...protegida(), ruta(async (req, res) => (
    res.json(await servicios.listarMias(req.actor))
  )));
  app.get('/reservas', ...protegida(ROLES.GESTOR, ROLES.ADMINISTRADOR), ruta(async (req, res) => (
    res.json(await servicios.listarTodas(req.actor, req.query))
  )));
  app.post('/reservas/:reservaId/cancelar', ...protegida(), ruta(async (req, res) => (
    res.json(await servicios.cancelar(req.actor, req.params.reservaId))
  )));
  app.post('/reservas/:reservaId/iniciar-uso', ...protegida(), ruta(async (req, res) => (
    res.json(await servicios.iniciarUso(req.actor, req.params.reservaId))
  )));

  // ---------- Administración ----------
  app.get('/usuarios', ...protegida(ROLES.ADMINISTRADOR), ruta(async (_req, res) => (
    res.json(await servicios.listarUsuarios())
  )));
  app.patch('/usuarios/:uid/rol', ...protegida(ROLES.ADMINISTRADOR), ruta(async (req, res) => (
    res.json(await servicios.cambiarRol(req.actor, req.params.uid, req.body?.rol))
  )));

  app.use((_req, _res, next) => next(new ApiError(404, 'not-found', 'Ruta no encontrada.')));
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    if (error instanceof ApiError) {
      return res.status(error.status).json({ error: { code: error.code, mensaje: error.message } });
    }
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'invalid-argument', mensaje: 'JSON inválido.' } });
    }
    console.error('Error no controlado:', error);
    return res.status(500).json({ error: { code: 'internal', mensaje: 'Error interno del servidor.' } });
  });

  return app;
};

export { esPersonal };
