// Reglas de negocio de GuardaFácil. Antes vivían en el cliente; ahora solo las
// ejecuta la API y el cliente recibe el resultado ya calculado.
import { esPersonal } from './roles.js';

// [hora de inicio, hora de fin] de cada franja, en hora local del negocio.
const FRANJAS_HORAS = {
  Mañana: [6, 12],
  Tarde: [12, 18],
  Noche: [18, 24],
};

export const FRANJAS = Object.keys(FRANJAS_HORAS);

export const idReserva = ({ casilleroId, fecha, franja }) => `${casilleroId}_${fecha}_${franja}`;

export const fechaValida = (fecha) => {
  const partes = String(fecha || '').split('-');
  if (partes.length !== 3 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [a, m, d] = partes.map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
};

// Devuelve { inicio, fin } como Date (instantes UTC) o null si fecha/franja no son válidas.
export const rangoReserva = ({ fecha, franja }, utcOffsetHoras = -5) => {
  const horas = FRANJAS_HORAS[franja];
  if (!horas || !fechaValida(fecha)) return null;
  const [a, m, d] = fecha.split('-').map(Number);
  const aUtc = (hora) => new Date(Date.UTC(a, m - 1, d, hora - utcOffsetHoras));
  return { inicio: aUtc(horas[0]), fin: aUtc(horas[1]) };
};

export const estadoVisible = (reserva, utcOffsetHoras, ahora = new Date()) => {
  if (reserva.estado === 'cancelada') return 'cancelado';
  if (reserva.estado === 'finalizada') return 'finalizado';
  const rango = rangoReserva(reserva, utcOffsetHoras);
  if (!rango) return 'reservado';
  if (reserva.estado === 'en_uso') return ahora < rango.fin ? 'en_uso' : 'finalizado';
  return ahora < rango.fin ? 'reservado' : 'vencido';
};

export const puedeIniciarUso = (reserva, utcOffsetHoras, ahora = new Date()) => {
  const rango = rangoReserva(reserva, utcOffsetHoras);
  return reserva.estado === 'confirmada' && rango !== null && ahora >= rango.inicio && ahora < rango.fin;
};

// Estudiante: solo su reserva, antes de que empiece la franja.
// Gestor/administrador: pueden liberar el casillero mientras la reserva siga vigente
// (confirmada o en uso), aunque la franja ya haya empezado.
export const puedeCancelar = (reserva, rol, utcOffsetHoras, ahora = new Date()) => {
  const rango = rangoReserva(reserva, utcOffsetHoras);
  if (rango === null) return false;
  if (esPersonal(rol)) {
    return ['confirmada', 'en_uso'].includes(reserva.estado) && ahora < rango.fin;
  }
  return reserva.estado === 'confirmada' && ahora < rango.inicio;
};

const aIso = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'string') return valor;
  if (typeof valor.toDate === 'function') return valor.toDate().toISOString();
  if (valor instanceof Date) return valor.toISOString();
  return null;
};

export const serializarReserva = (id, reserva, { rol, uid, utcOffsetHoras, ahora = new Date() }) => {
  const rango = rangoReserva(reserva, utcOffsetHoras);
  const propia = reserva.usuarioId === uid;
  return {
    id,
    zonaId: reserva.zonaId,
    casilleroId: reserva.casilleroId,
    zonaNombre: reserva.zonaNombre,
    casilleroNumero: reserva.casilleroNumero,
    usuarioId: reserva.usuarioId,
    usuarioEmail: reserva.usuarioEmail,
    fecha: reserva.fecha,
    franja: reserva.franja,
    estado: reserva.estado,
    estadoVisible: estadoVisible(reserva, utcOffsetHoras, ahora),
    inicioUso: rango ? rango.inicio.toISOString() : null,
    finUso: rango ? rango.fin.toISOString() : null,
    // Instante hasta el cual quien consulta puede cancelar; el cliente lo usa para ocultar el
    // botón sin conexión. La API vuelve a validar siempre al ejecutar la cancelación.
    cancelableHasta: rango ? (esPersonal(rol) ? rango.fin : rango.inicio).toISOString() : null,
    puedeCancelar: (propia || esPersonal(rol)) && puedeCancelar(reserva, rol, utcOffsetHoras, ahora),
    puedeIniciarUso: propia && puedeIniciarUso(reserva, utcOffsetHoras, ahora),
    reservadaPor: reserva.reservadaPor || reserva.usuarioId,
    canceladaPor: reserva.canceladaPor || null,
    createdAt: aIso(reserva.createdAt),
    cancelledAt: aIso(reserva.cancelledAt),
    usoIniciadoAt: aIso(reserva.usoIniciadoAt),
  };
};
