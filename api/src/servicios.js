import {
  conflictoOperacion,
  conflictoReserva,
  invalido,
  noEncontrado,
  prohibido,
} from './errores.js';
import { ROLES, ROLES_VALIDOS, esPersonal } from './roles.js';
import {
  FRANJAS,
  idReserva,
  puedeCancelar,
  puedeIniciarUso,
  rangoReserva,
  serializarReserva,
} from './reglas.js';

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

export const crearServicios = ({ repo, config, reloj = () => new Date() }) => {
  const off = config.utcOffsetHoras;
  const vista = (actor) => ({ rol: actor.rol, uid: actor.uid, utcOffsetHoras: off, ahora: reloj() });
  const serializar = (actor, id, reserva) => serializarReserva(id, reserva, vista(actor));

  const rolInicial = (correo) => (
    config.adminEmails.includes(String(correo).toLowerCase()) ? ROLES.ADMINISTRADOR : ROLES.ESTUDIANTE
  );

  // Devuelve el usuario con su rol; crea o completa el perfil si hace falta.
  const resolverUsuario = async (uid, correo) => {
    let perfil = await repo.obtenerUsuario(uid);
    const esAdminConfigurado = config.adminEmails.includes(String(correo).toLowerCase());
    if (!perfil) {
      perfil = { correo, rol: rolInicial(correo) };
      await repo.guardarUsuario(uid, perfil);
    } else if (!perfil.rol || (esAdminConfigurado && perfil.rol !== ROLES.ADMINISTRADOR)) {
      perfil = { ...perfil, rol: rolInicial(correo) };
      await repo.actualizarUsuario(uid, { rol: perfil.rol });
    }
    return { uid, correo: perfil.correo || correo, ...perfil };
  };

  const perfilPublico = (u) => ({
    uid: u.uid,
    email: u.correo,
    rol: u.rol,
    nombreCompleto: u.nombreCompleto || null,
  });

  const exigirReservaParams = ({ zonaId, casilleroId, fecha, franja }) => {
    if (!texto(zonaId) || !texto(casilleroId)) throw invalido('Indica la zona y el casillero.');
    if (!FRANJAS.includes(franja)) throw invalido(`La franja debe ser una de: ${FRANJAS.join(', ')}.`);
    const rango = rangoReserva({ fecha, franja }, off);
    if (!rango) throw invalido('La fecha debe tener el formato AAAA-MM-DD y ser válida.');
    return rango;
  };

  const resolverDestino = async (actor, body) => {
    const idPedido = texto(body.usuarioId);
    const correoPedido = texto(body.usuarioEmail).toLowerCase();
    const apuntaAOtro = (idPedido && idPedido !== actor.uid)
      || (correoPedido && correoPedido !== String(actor.correo).toLowerCase());

    if (!apuntaAOtro) return { uid: actor.uid, correo: actor.correo };
    if (!esPersonal(actor.rol)) {
      throw prohibido('Solo un gestor o administrador puede reservar en nombre de otra persona.');
    }

    let destino = null;
    if (idPedido) {
      const perfil = await repo.obtenerUsuario(idPedido);
      if (perfil) destino = { uid: idPedido, correo: perfil.correo };
    } else {
      const encontrado = await repo.buscarUsuarioPorCorreo(correoPedido);
      if (encontrado) destino = { uid: encontrado.uid, correo: encontrado.correo };
    }
    if (!destino) throw noEncontrado('No existe un usuario con ese correo o identificador.');
    return destino;
  };

  return {
    resolverUsuario,
    perfilPublico,

    async listarZonas() {
      return repo.listarZonas();
    },

    async listarCasilleros(zonaId) {
      if (!(await repo.obtenerZona(zonaId))) throw noEncontrado('La zona no existe.');
      return repo.listarCasilleros(zonaId);
    },

    async obtenerCasillero(zonaId, casilleroId) {
      const casillero = await repo.obtenerCasillero(zonaId, casilleroId);
      if (!casillero) throw noEncontrado('El casillero no existe');
      return casillero;
    },

    async disponibilidad({ casilleroId, fecha, franja }) {
      exigirReservaParams({ zonaId: 'x', casilleroId, fecha, franja });
      const reserva = await repo.obtenerReserva(idReserva({ casilleroId, fecha, franja }));
      return { casilleroId, fecha, franja, disponible: !reserva || reserva.estado === 'cancelada' };
    },

    async reservar(actor, body) {
      const { zonaId, casilleroId, fecha, franja } = body;
      const rango = exigirReservaParams(body);
      if (reloj() >= rango.fin) throw invalido('La franja seleccionada ya terminó.');

      const casillero = await repo.obtenerCasillero(zonaId, casilleroId);
      if (!casillero) throw noEncontrado('El casillero no existe');
      const zona = await repo.obtenerZona(zonaId);
      const destino = await resolverDestino(actor, body);

      const id = idReserva({ casilleroId, fecha, franja });
      const resultado = await repo.transaccion(async (tx) => {
        const existente = await tx.obtenerReserva(id);
        if (existente && existente.estado !== 'cancelada') {
          if (existente.usuarioId === destino.uid) return { reserva: existente, creada: false };
          throw conflictoReserva(
            'Ya existe una reserva para este casillero en la fecha y franja seleccionadas.'
          );
        }
        if (existente) await tx.archivarReserva({ ...existente, archivedAt: reloj().toISOString() });

        const nueva = {
          zonaId,
          casilleroId,
          zonaNombre: zona?.nombre ?? body.zonaNombre ?? null,
          casilleroNumero: casillero.numero ?? null,
          usuarioId: destino.uid,
          usuarioEmail: destino.correo,
          fecha,
          franja,
          estado: 'confirmada',
          reservadaPor: actor.uid,
          createdAt: reloj().toISOString(),
        };
        await tx.guardarReserva(id, nueva);
        return { reserva: nueva, creada: true };
      });
      return { reserva: serializar(actor, id, resultado.reserva), creada: resultado.creada };
    },

    
    async cancelar(actor, reservaId) {
      return repo.transaccion(async (tx) => {
        const reserva = await tx.obtenerReserva(reservaId);

        if (!reserva) {
          throw conflictoOperacion('La reserva ya no existe.');
        }

        // El estudiante solamente puede cancelar su propia reserva.
        if (
          !esPersonal(actor.rol) &&
          reserva.usuarioId !== actor.uid
        ) {
          throw prohibido('No tienes permiso para cancelar esta reserva.');
        }

        // Repetir una cancelación no modifica nuevamente la reserva.
        if (reserva.estado === 'cancelada') {
          return serializar(actor, reservaId, reserva);
        }

        if (!puedeCancelar(reserva, actor.rol, off, reloj())) {
          throw conflictoOperacion(
            actor.rol === ROLES.ADMINISTRADOR
              ? 'No se puede cancelar esta reserva.'
              : esPersonal(actor.rol)
                ? 'La reserva ya terminó y no se puede liberar el casillero.'
                : 'La reserva ya comenzó o no se puede cancelar.'
          );
        }

        const ahora = reloj().toISOString();

        const cambios = {
          estado: 'cancelada',
          cancelledAt: ahora,
          canceladaPor: actor.uid,
          gestionadoPor: actor.uid,
          updatedAt: ahora,
        };

        await tx.actualizarReserva(reservaId, cambios);

        return serializar(actor, reservaId, {
          ...reserva,
          ...cambios,
        });
      });
    },


    async iniciarUso(actor, reservaId) {
      return repo.transaccion(async (tx) => {
        const reserva = await tx.obtenerReserva(reservaId);
        if (!reserva) throw conflictoOperacion('La reserva ya no existe.');
        if (reserva.usuarioId !== actor.uid) {
          throw prohibido('No tienes permiso para iniciar esta reserva.');
        }
        if (reserva.estado === 'en_uso') return serializar(actor, reservaId, reserva);
        if (!puedeIniciarUso(reserva, off, reloj())) {
          throw conflictoOperacion('Solo puedes iniciar el uso durante la franja de tu reserva.');
        }
        const cambios = { estado: 'en_uso', usoIniciadoAt: reloj().toISOString() };
        await tx.actualizarReserva(reservaId, cambios);
        return serializar(actor, reservaId, { ...reserva, ...cambios });
      });
    },

    async listarMias(actor) {
      const [reservas, historial] = await Promise.all([
        repo.listarReservas({ usuarioId: actor.uid }),
        repo.listarHistorial({ usuarioId: actor.uid }),
      ]);
      return [
        ...reservas.map(({ id, ...r }) => ({ ...serializar(actor, id, r), origen: 'reservas' })),
        ...historial.map(({ id, ...r }) => ({ ...serializar(actor, id, r), origen: 'historial' })),
      ];
    },

    // Gestor/administrador: todas las reservas, con filtros opcionales.
    async listarTodas(actor, { fecha, estadoVisible, usuarioEmail, zonaId } = {}) {
      const reservas = await repo.listarReservas({});
      const correo = texto(usuarioEmail).toLowerCase();
      return reservas
        .map(({ id, ...r }) => ({ ...serializar(actor, id, r), origen: 'reservas' }))
        .filter((r) => (!fecha || r.fecha === fecha)
          && (!estadoVisible || r.estadoVisible === estadoVisible)
          && (!zonaId || r.zonaId === zonaId)
          && (!correo || String(r.usuarioEmail).toLowerCase().includes(correo)))
        .sort((a, b) => {
          const fechaA = String(a.fecha ?? '');
          const fechaB = String(b.fecha ?? '');
          const franjaA = String(a.franja ?? '');
          const franjaB = String(b.franja ?? '');

          return `${fechaB}_${franjaB}`.localeCompare(
            `${fechaA}_${franjaA}`
          );
        });
    },

    async listarUsuarios() {
      const usuarios = await repo.listarUsuarios();
      return usuarios
        .map((u) => ({
          uid: u.uid,
          email: u.correo,
          nombreCompleto: u.nombreCompleto || null,
          rol: u.rol || rolInicial(u.correo),
        }))
        .sort((a, b) => String(a.email).localeCompare(String(b.email)));
    },

    async cambiarRol(actor, uid, rol) {
      if (!ROLES_VALIDOS.includes(rol)) {
        throw invalido(`El rol debe ser uno de: ${ROLES_VALIDOS.join(', ')}.`);
      }
      if (uid === actor.uid) throw prohibido('No puedes cambiar tu propio rol.');
      const perfil = await repo.obtenerUsuario(uid);
      if (!perfil) throw noEncontrado('El usuario no existe.');
      await repo.actualizarUsuario(uid, { rol });
      return { uid, email: perfil.correo, nombreCompleto: perfil.nombreCompleto || null, rol };
    },
        async actualizarUsuario(actor, uid, body = {}) {
      if (uid === actor.uid) {
        throw prohibido('No puedes editar tu propio perfil desde esta sección.');
      }

      const perfil = await repo.obtenerUsuario(uid);
      if (!perfil) throw noEncontrado('El usuario no existe.');

      const camposPermitidos = [
        'nombreCompleto',
        'cedula',
        'telefono',
        'direccion',
      ];

      const cambios = {};
      for (const campo of camposPermitidos) {
        if (Object.hasOwn(body, campo)) {
          cambios[campo] = texto(body[campo]);
          if (!cambios[campo]) {
            throw invalido(`El campo ${campo} no puede estar vacío.`);
          }
        }
      }

      if (Object.keys(cambios).length === 0) {
        throw invalido('No se proporcionaron datos para actualizar.');
      }

      if (cambios.cedula && !/^\d{6,12}$/.test(cambios.cedula)) {
        throw invalido('La cédula debe tener entre 6 y 12 dígitos.');
      }

      if (cambios.telefono && !/^\d{7,15}$/.test(cambios.telefono)) {
        throw invalido('El teléfono debe tener entre 7 y 15 dígitos.');
      }

      await repo.actualizarUsuario(uid, cambios);

      return {
        uid,
        email: perfil.correo,
        nombreCompleto: cambios.nombreCompleto ?? perfil.nombreCompleto ?? null,
        cedula: cambios.cedula ?? perfil.cedula ?? null,
        telefono: cambios.telefono ?? perfil.telefono ?? null,
        direccion: cambios.direccion ?? perfil.direccion ?? null,
        rol: perfil.rol || rolInicial(perfil.correo),
      };
    },

    async eliminarUsuario(actor, uid, auth) {
      if (uid === actor.uid) {
        throw prohibido('No puedes eliminar tu propia cuenta desde esta sección.');
      }

      const perfil = await repo.obtenerUsuario(uid);
      if (!perfil) throw noEncontrado('El usuario no existe.');

      // Eliminar la cuenta de autenticación y su perfil.
      await auth.eliminarUsuario(uid);
      await repo.eliminarUsuario(uid);

      return { mensaje: 'Usuario eliminado correctamente.', uid };
    },
  };
};
