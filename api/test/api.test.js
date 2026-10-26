import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { crearApp } from '../src/app.js';
import { crearAuthMemoria } from '../src/auth/memoria.js';
import { cargarConfig } from '../src/config.js';
import { crearRepoMemoria, datosDeEjemplo } from '../src/repos/memoria.js';

// Lunes 2026-10-26 10:00 hora Colombia (UTC-5): la franja Mañana está en curso.
let ahora = new Date('2026-10-26T15:00:00Z');
const config = cargarConfig({
  ADMIN_EMAILS: 'admin@uni.edu',
  JWT_SECRET: 'prueba',
  MODO_DATOS: 'memoria',
  NODE_ENV: 'test',
});

let servidor;
let base;
const tokens = {};
const refreshTokens = {};
const uids = {};

const api = async (metodo, ruta, { token, cuerpo } = {}) => {
  const respuesta = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: respuesta.status, datos: await respuesta.json() };
};

const registrar = async (nombre, correo) => {
  const { status, datos } = await api('POST', '/auth/registro', {
    cuerpo: {
      nombreCompleto: nombre,
      cedula: '1234567890',
      telefono: '3001234567',
      correo,
      direccion: 'Calle 1',
      contrasena: 'secreto1',
    },
  });
  assert.equal(status, 201);
  tokens[nombre] = datos.idToken;
  refreshTokens[nombre] = datos.refreshToken;
  uids[nombre] = datos.usuario.uid;
  return datos;
};

const reserva = (zonaId, casilleroId, fecha, franja, extra = {}) => ({ zonaId, casilleroId, fecha, franja, ...extra });

before(async () => {
  const repo = crearRepoMemoria(datosDeEjemplo());
  const auth = crearAuthMemoria({ secreto: config.jwtSecret });
  const app = crearApp({ repo, auth, config, reloj: () => ahora });
  await new Promise((resolve) => { servidor = app.listen(0, resolve); });
  base = `http://127.0.0.1:${servidor.address().port}`;
  await registrar('ana', 'ana@uni.edu');
  await registrar('beto', 'beto@uni.edu');
  await registrar('gestor', 'gestor@uni.edu');
  await registrar('admin', 'admin@uni.edu');
  // El administrador del entorno asciende al primer gestor.
  const r = await api('PATCH', `/usuarios/${uids.gestor}/rol`, { token: tokens.admin, cuerpo: { rol: 'gestor' } });
  assert.equal(r.status, 200);
});

after(() => servidor.close());

describe('autenticación y roles', () => {
  it('rechaza registros con campos inválidos', async () => {
    const invalido = await api('POST', '/auth/registro', {
      cuerpo: {
        nombreCompleto: 'Usuario de prueba',
        cedula: '123',
        telefono: '3001234567',
        correo: 'registro-invalido@uni.edu',
        direccion: 'Calle 1',
        contrasena: 'secreto1',
      },
    });
    assert.equal(invalido.status, 400);
    assert.equal(invalido.datos.error.code, 'invalid-argument');
  });

  it('el registro público siempre crea estudiantes y ADMIN_EMAILS crea administrador', async () => {
    const ana = await api('GET', '/auth/me', { token: tokens.ana });
    assert.equal(ana.datos.rol, 'estudiante');
    const admin = await api('GET', '/auth/me', { token: tokens.admin });
    assert.equal(admin.datos.rol, 'administrador');
  });

  it('ignora un rol enviado por el cliente al registrarse', async () => {
    const { datos } = await api('POST', '/auth/registro', {
      cuerpo: {
        nombreCompleto: 'Hacker', cedula: '1234567890', telefono: '3001234567',
        correo: 'h@uni.edu', direccion: 'x', contrasena: 'secreto1', rol: 'administrador',
      },
    });
    assert.equal(datos.usuario.rol, 'estudiante');
  });

  it('rechaza peticiones sin token y credenciales incorrectas', async () => {
    assert.equal((await api('GET', '/zonas')).status, 401);
    const malo = await api('POST', '/auth/login', { cuerpo: { correo: 'ana@uni.edu', contrasena: 'otra123' } });
    assert.equal(malo.status, 401);
    assert.equal(malo.datos.error.code, 'auth/invalid-credential');
    const bueno = await api('POST', '/auth/login', { cuerpo: { correo: 'ana@uni.edu', contrasena: 'secreto1' } });
    assert.equal(bueno.status, 200);
  });

  it('renueva sesiones y rechaza tokens de renovación inválidos o reutilizados', async () => {
    const renovada = await api('POST', '/auth/refresh', {
      cuerpo: { refreshToken: refreshTokens.ana },
    });
    assert.equal(renovada.status, 200);
    assert.equal((await api('GET', '/auth/me', { token: renovada.datos.idToken })).status, 200);

    const reutilizada = await api('POST', '/auth/refresh', {
      cuerpo: { refreshToken: refreshTokens.ana },
    });
    assert.equal(reutilizada.status, 401);
    const inexistente = await api('POST', '/auth/refresh', {
      cuerpo: { refreshToken: 'token-invalido' },
    });
    assert.equal(inexistente.status, 401);
  });

  it('solo gestor/administrador ven todas las reservas y solo el administrador gestiona usuarios', async () => {
    assert.equal((await api('GET', '/reservas', { token: tokens.ana })).status, 403);
    assert.equal((await api('GET', '/reservas', { token: tokens.gestor })).status, 200);
    assert.equal((await api('GET', '/usuarios', { token: tokens.gestor })).status, 403);
    assert.equal((await api('GET', '/usuarios', { token: tokens.admin })).status, 200);
    const propio = await api('PATCH', `/usuarios/${uids.admin}/rol`, { token: tokens.admin, cuerpo: { rol: 'estudiante' } });
    assert.equal(propio.status, 403);
    const invalido = await api('PATCH', `/usuarios/${uids.ana}/rol`, { token: tokens.admin, cuerpo: { rol: 'dios' } });
    assert.equal(invalido.status, 400);
  });
});

describe('estudiante: reservar y cancelar', () => {
  it('reserva un casillero libre y marca la franja como no disponible', async () => {
    const r = await api('POST', '/reservas', { token: tokens.ana, cuerpo: reserva('zona-norte', 'n1', '2026-10-27', 'Tarde') });
    assert.equal(r.status, 201);
    assert.equal(r.datos.id, 'n1_2026-10-27_Tarde');
    assert.equal(r.datos.casilleroNumero, 'A-101');
    assert.equal(r.datos.usuarioId, uids.ana);
    assert.equal(r.datos.puedeCancelar, true);
    // Un estudiante puede cancelar hasta que empieza la franja (12:00 hora Colombia = 17:00 UTC).
    assert.equal(r.datos.cancelableHasta, '2026-10-27T17:00:00.000Z');
    assert.equal(r.datos.finUso, '2026-10-27T23:00:00.000Z');
    const d = await api('GET', '/casilleros/n1/disponibilidad?fecha=2026-10-27&franja=Tarde', { token: tokens.beto });
    assert.equal(d.datos.disponible, false);
  });

  it('es idempotente para el mismo usuario y rechaza a otro estudiante', async () => {
    const mismo = await api('POST', '/reservas', { token: tokens.ana, cuerpo: reserva('zona-norte', 'n1', '2026-10-27', 'Tarde') });
    assert.equal(mismo.status, 200);
    const otro = await api('POST', '/reservas', { token: tokens.beto, cuerpo: reserva('zona-norte', 'n1', '2026-10-27', 'Tarde') });
    assert.equal(otro.status, 409);
    assert.equal(otro.datos.error.code, 'reservation-conflict');
  });

  it('no permite reservar en nombre de otro ni franjas que ya terminaron', async () => {
    const ajeno = await api('POST', '/reservas', {
      token: tokens.beto,
      cuerpo: reserva('zona-norte', 'n2', '2026-10-28', 'Mañana', { usuarioEmail: 'ana@uni.edu' }),
    });
    assert.equal(ajeno.status, 403);
    const pasada = await api('POST', '/reservas', { token: tokens.beto, cuerpo: reserva('zona-norte', 'n2', '2026-10-25', 'Noche') });
    assert.equal(pasada.status, 400);
    const mala = await api('POST', '/reservas', { token: tokens.beto, cuerpo: reserva('zona-norte', 'n2', '2026-13-40', 'Noche') });
    assert.equal(mala.status, 400);
    const sinCasillero = await api('POST', '/reservas', { token: tokens.beto, cuerpo: reserva('zona-norte', 'nope', '2026-10-28', 'Noche') });
    assert.equal(sinCasillero.status, 404);
  });

  it('cancela su reserva futura y el casillero queda libre; otro estudiante puede reservarlo', async () => {
    const ajena = await api('POST', '/reservas/n1_2026-10-27_Tarde/cancelar', { token: tokens.beto });
    assert.equal(ajena.status, 403);
    const c = await api('POST', '/reservas/n1_2026-10-27_Tarde/cancelar', { token: tokens.ana });
    assert.equal(c.status, 200);
    assert.equal(c.datos.estadoVisible, 'cancelado');
    const repetida = await api('POST', '/reservas/n1_2026-10-27_Tarde/cancelar', { token: tokens.ana });
    assert.equal(repetida.status, 200);
    const d = await api('GET', '/casilleros/n1/disponibilidad?fecha=2026-10-27&franja=Tarde', { token: tokens.ana });
    assert.equal(d.datos.disponible, true);
    const nueva = await api('POST', '/reservas', { token: tokens.beto, cuerpo: reserva('zona-norte', 'n1', '2026-10-27', 'Tarde') });
    assert.equal(nueva.status, 201);
    const mias = await api('GET', '/reservas/mias', { token: tokens.ana });
    assert.ok(mias.datos.some((x) => x.origen === 'historial' && x.estado === 'cancelada'));
  });

  it('no puede cancelar una reserva cuya franja ya empezó, pero sí iniciar su uso', async () => {
    const r = await api('POST', '/reservas', { token: tokens.ana, cuerpo: reserva('zona-sur', 's1', '2026-10-26', 'Mañana') });
    assert.equal(r.status, 201);
    assert.equal(r.datos.puedeCancelar, false);
    assert.equal(r.datos.puedeIniciarUso, true);
    const cancelar = await api('POST', '/reservas/s1_2026-10-26_Mañana/cancelar', { token: tokens.ana });
    assert.equal(cancelar.status, 409);
    const ajeno = await api('POST', '/reservas/s1_2026-10-26_Mañana/iniciar-uso', { token: tokens.beto });
    assert.equal(ajeno.status, 403);
    const iniciar = await api('POST', '/reservas/s1_2026-10-26_Mañana/iniciar-uso', { token: tokens.ana });
    assert.equal(iniciar.status, 200);
    assert.equal(iniciar.datos.estadoVisible, 'en_uso');
  });
});

describe('gestor', () => {
  it('reserva un casillero en nombre de un estudiante', async () => {
    const r = await api('POST', '/reservas', {
      token: tokens.gestor,
      cuerpo: reserva('zona-norte', 'n2', '2026-10-29', 'Noche', { usuarioEmail: 'BETO@uni.edu' }),
    });
    assert.equal(r.status, 201);
    assert.equal(r.datos.usuarioId, uids.beto);
    assert.equal(r.datos.reservadaPor, uids.gestor);
    const mias = await api('GET', '/reservas/mias', { token: tokens.beto });
    assert.ok(mias.datos.some((x) => x.id === 'n2_2026-10-29_Noche'));
    const desconocido = await api('POST', '/reservas', {
      token: tokens.gestor,
      cuerpo: reserva('zona-norte', 'n2', '2026-10-30', 'Noche', { usuarioEmail: 'nadie@uni.edu' }),
    });
    assert.equal(desconocido.status, 404);
  });

  it('también puede reservar para sí mismo', async () => {
    const r = await api('POST', '/reservas', { token: tokens.gestor, cuerpo: reserva('zona-norte', 'n2', '2026-10-30', 'Mañana') });
    assert.equal(r.status, 201);
    assert.equal(r.datos.usuarioId, uids.gestor);
  });

  it('cancela reservas de cualquiera, incluso en uso, y libera el casillero', async () => {
    const lista = await api('GET', '/reservas?fecha=2026-10-26', { token: tokens.gestor });
    const enUso = lista.datos.find((x) => x.id === 's1_2026-10-26_Mañana');
    assert.equal(enUso.estadoVisible, 'en_uso');
    assert.equal(enUso.puedeCancelar, true);
    const c = await api('POST', '/reservas/s1_2026-10-26_Mañana/cancelar', { token: tokens.gestor });
    assert.equal(c.status, 200);
    assert.equal(c.datos.canceladaPor, uids.gestor);
    const d = await api('GET', '/casilleros/s1/disponibilidad?fecha=2026-10-26&franja=Mañana', { token: tokens.beto });
    assert.equal(d.datos.disponible, true);
  });

  it('no puede cancelar una reserva cuya franja ya terminó', async () => {
    ahora = new Date('2026-10-26T18:00:00Z'); // 13:00 local
    const r = await api('POST', '/reservas/n2_2026-10-30_Mañana/cancelar', { token: tokens.gestor });
    assert.equal(r.status, 200); // futura: sí
    ahora = new Date('2026-10-31T18:00:00Z');
    const vieja = await api('POST', '/reservas/n2_2026-10-29_Noche/cancelar', { token: tokens.gestor });
    assert.equal(vieja.status, 409);
  });
});
