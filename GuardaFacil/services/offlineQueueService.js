// Cola de operaciones hechas sin conexión (reservar, cancelar, iniciar uso).
// Se guarda en SQLite (offlineDb) y se envía a la API cuando vuelve la conexión.
import { esErrorDeRed, estadoErrorOperacion } from './offlineErrors';
import {
  actualizarCacheUsuario,
  actualizarOperacionCola,
  eliminarOperacionCola,
  insertarOperacion,
  listarCola,
} from './offlineDb';
import { uidActual } from './sesion';
import { cancelarReserva, obtenerReservasUsuario, reservarCasillero } from './zonasService';
import { iniciarUsoReserva } from './usoReservaService';

const sincronizacionesActivas = new Set();
const cierresSesionEnCurso = new Set();

const errorSesion = (mensaje) => {
  const error = new Error(mensaje);
  error.code = 'uid-mismatch';
  return error;
};

const idReserva = ({ casilleroId, fecha, franja }) => `${casilleroId}_${fecha}_${franja}`;

export async function obtenerColaOffline(uid) {
  return listarCola(uid);
}

export async function cerrarSesionSinSincronizacionActiva(uid, cerrarSesion) {
  if (sincronizacionesActivas.has(uid) || cierresSesionEnCurso.has(uid)) return false;
  cierresSesionEnCurso.add(uid);
  try {
    if (sincronizacionesActivas.has(uid)) return false;
    await cerrarSesion();
    return true;
  } finally {
    cierresSesionEnCurso.delete(uid);
  }
}

export async function descartarOperacionOffline(uid, operacionId) {
  if (uidActual() !== uid) throw errorSesion('La sesión cambió; no se modificó la cola de otra cuenta.');
  const cola = await listarCola(uid);
  const operacion = cola.find((item) => item.id === operacionId);
  if (!operacion || !['conflicto', 'rechazada'].includes(operacion.estado)) {
    throw new Error('Solo se pueden descartar operaciones rechazadas o en conflicto.');
  }
  await eliminarOperacionCola(uid, operacionId);
}

export async function agregarOperacionOffline(uid, tipo, datos) {
  if (uidActual() !== uid) throw errorSesion('La sesión cambió; no se guardó la operación bajo otra cuenta.');

  const id = tipo === 'reservar' ? idReserva(datos) : datos.reservaId;
  const operacion = await insertarOperacion({
    id: `${tipo}:${id}`,
    uid,
    tipo,
    datos,
    creadaEn: Date.now(),
  });

  if (['conflicto', 'rechazada'].includes(operacion.estado)) {
    const error = new Error(
      operacion.estado === 'conflicto'
        ? 'Esta solicitud tiene un conflicto. Resuélvelo desde el aviso de operaciones pendientes.'
        : 'El servidor rechazó esta solicitud. Descártala antes de crear otra.'
    );
    error.code = operacion.estado === 'conflicto' ? 'operation-conflict' : 'operation-rejected';
    throw error;
  }
  return operacion;
}

async function procesarOperacion(operacion, uid) {
  if (operacion.uid !== uid) {
    throw new Error('La operación pertenece a otra cuenta y no se enviará.');
  }
  if (uidActual() !== uid) {
    throw errorSesion('La sesión cambió; la operación permanece vinculada a su cuenta.');
  }

  if (operacion.tipo === 'reservar') {
    return reservarCasillero({ ...operacion.datos, usuarioId: uid });
  }
  if (operacion.tipo === 'cancelar') {
    return cancelarReserva(operacion.datos.reservaId, uid);
  }
  if (operacion.tipo === 'iniciar_uso') {
    return iniciarUsoReserva(operacion.datos.reservaId, uid);
  }

  const error = new Error(`Tipo de operación offline desconocido: ${operacion.tipo}`);
  error.code = 'operation-conflict';
  throw error;
}

// `resultado` es la reserva ya calculada por la API (con estado, flags e instantes).
async function actualizarCacheTrasConfirmacion(uid, operacion, resultado) {
  try {
    await actualizarCacheUsuario(uid, 'reservas', (reservas) => {
      if (!Array.isArray(reservas)) {
        throw new Error('La caché de reservas tiene un formato inválido.');
      }

      if (operacion.tipo === 'reservar') {
        // Si un gestor reservó para otra persona, no pertenece a "Mis reservas".
        if (resultado.usuarioId !== uid) return reservas;
        return [
          ...reservas.filter((item) => item.id !== resultado.id),
          { ...resultado, origen: 'reservas' },
        ];
      }

      return reservas.map((reserva) => (
        reserva.id === operacion.datos.reservaId
          ? { ...reserva, ...resultado, origen: reserva.origen }
          : reserva
      ));
    });
  } catch (error) {
    console.error('La operación se confirmó, pero no se pudo actualizar la caché local:', error);
  }

  try {
    await obtenerReservasUsuario(uid);
  } catch (error) {
    console.error('La operación se confirmó, pero no se pudo refrescar la caché desde la API:', error);
  }
}

export async function ejecutarOEncolar(uid, tipo, datos, conectado) {
  if (!conectado) {
    const operacion = await agregarOperacionOffline(uid, tipo, datos);
    return { pendiente: true, operacion };
  }

  try {
    const resultado = await procesarOperacion({ uid, tipo, datos }, uid);
    await actualizarCacheTrasConfirmacion(uid, { tipo, datos }, resultado);
    return { pendiente: false, resultado };
  } catch (error) {
    if (!esErrorDeRed(error)) throw error;
    console.error(`Se guardará ${tipo} para reintentar tras un error de conexión:`, error);
    const operacion = await agregarOperacionOffline(uid, tipo, datos);
    return { pendiente: true, operacion };
  }
}

export async function sincronizarColaOffline(uid, { reintentarConflictos = false } = {}) {
  if (cierresSesionEnCurso.has(uid)) return listarCola(uid);
  sincronizacionesActivas.add(uid);
  try {
    const inicial = await listarCola(uid);
    const procesables = inicial.filter((operacion) => (
      operacion.estado === 'pendiente'
      || (operacion.estado === 'conflicto' && reintentarConflictos)
    ));

    for (const operacion of procesables) {
      await actualizarOperacionCola(uid, operacion.id, {
        estado: 'sincronizando',
        ultimoError: null,
        sumarIntento: true,
      });

      try {
        const resultado = await procesarOperacion(operacion, uid);
        await actualizarCacheTrasConfirmacion(uid, operacion, resultado);
        await eliminarOperacionCola(uid, operacion.id);
      } catch (error) {
        console.error(`No se pudo sincronizar ${operacion.id}:`, error);
        await actualizarOperacionCola(uid, operacion.id, {
          estado: estadoErrorOperacion(error),
          ultimoError: error.message || 'Error al sincronizar con el servidor.',
        });
        if (esErrorDeRed(error) || error.code === 'uid-mismatch' || error.status === 401) break;
      }
    }
    return listarCola(uid);
  } finally {
    sincronizacionesActivas.delete(uid);
  }
}
