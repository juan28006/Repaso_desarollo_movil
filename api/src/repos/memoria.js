// Repositorio en memoria: sirve para desarrollar sin Firebase y para las pruebas.
const clonar = (valor) => (valor === undefined ? valor : structuredClone(valor));

export const crearRepoMemoria = ({ zonas = [], casilleros = {} } = {}) => {
  const usuarios = new Map();
  const reservas = new Map();
  const historial = [];
  const zonasMap = new Map(zonas.map((z) => [z.id, z]));
  const casillerosMap = new Map(
    Object.entries(casilleros).map(([zonaId, lista]) => [zonaId, new Map(lista.map((c) => [c.id, c]))])
  );
  let cola = Promise.resolve();
  let contadorHistorial = 0;

  return {
    async obtenerUsuario(uid) { return clonar(usuarios.get(uid)) ?? null; },
    async guardarUsuario(uid, datos) { usuarios.set(uid, clonar(datos)); },
    async actualizarUsuario(uid, cambios) {
      usuarios.set(uid, { ...usuarios.get(uid), ...clonar(cambios) });
    },
    async buscarUsuarioPorCorreo(correo) {
      const objetivo = String(correo).toLowerCase();
      for (const [uid, datos] of usuarios) {
        if (String(datos.correo).toLowerCase() === objetivo) return { uid, ...clonar(datos) };
      }
      return null;
    },
    async listarUsuarios() {
      return [...usuarios].map(([uid, datos]) => ({ uid, ...clonar(datos) }));
    },

    async listarZonas() { return clonar([...zonasMap.values()]); },
    async obtenerZona(id) { return clonar(zonasMap.get(id)) ?? null; },
    async listarCasilleros(zonaId) { return clonar([...(casillerosMap.get(zonaId)?.values() ?? [])]); },
    async obtenerCasillero(zonaId, id) { return clonar(casillerosMap.get(zonaId)?.get(id)) ?? null; },

    async obtenerReserva(id) { return clonar(reservas.get(id)) ?? null; },
    async listarReservas({ usuarioId } = {}) {
      return [...reservas]
        .filter(([, r]) => !usuarioId || r.usuarioId === usuarioId)
        .map(([id, r]) => ({ id, ...clonar(r) }));
    },
    async listarHistorial({ usuarioId } = {}) {
      return historial
        .filter((r) => !usuarioId || r.usuarioId === usuarioId)
        .map((r) => clonar(r));
    },

    // Serializa las transacciones para imitar el aislamiento de Firestore.
    transaccion(trabajo) {
      const ejecutar = cola.then(() => trabajo({
        obtenerReserva: async (id) => clonar(reservas.get(id)) ?? null,
        guardarReserva: async (id, datos) => { reservas.set(id, clonar(datos)); },
        actualizarReserva: async (id, cambios) => {
          reservas.set(id, { ...reservas.get(id), ...clonar(cambios) });
        },async eliminarUsuario(uid) {
          usuarios.delete(uid);
        },
        archivarReserva: async (datos) => {
          contadorHistorial += 1;
          historial.push({ id: `h${contadorHistorial}`, ...clonar(datos) });
        },
      }));
      cola = ejecutar.catch(() => {});
      return ejecutar;
    },
  };
};

export const datosDeEjemplo = () => ({
  zonas: [
    { id: 'zona-norte', nombre: 'Bloque Norte', ubicacion: 'Primer piso' },
    { id: 'zona-sur', nombre: 'Bloque Sur', ubicacion: 'Sótano' },
  ],
  casilleros: {
    'zona-norte': [
      { id: 'n1', numero: 'A-101', tamano: 'Pequeño', disponible: true },
      { id: 'n2', numero: 'A-102', tamano: 'Grande', disponible: true },
    ],
    'zona-sur': [
      { id: 's1', numero: 'B-201', tamano: 'Mediano', disponible: true },
    ],
  },
});
