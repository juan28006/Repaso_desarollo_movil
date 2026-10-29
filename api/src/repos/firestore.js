// Repositorio sobre Firestore (firebase-admin). Conserva las colecciones que ya usaba
// la app: users, zonas/{id}/casilleros, reservas e historial_reservas.
import { getFirestore } from 'firebase-admin/firestore';

export const crearRepoFirestore = (app) => {
  const db = getFirestore(app);
  const mapear = (doc) => ({ id: doc.id, ...doc.data() });
  const filtrarPorUsuario = (ref, usuarioId) => (usuarioId ? ref.where('usuarioId', '==', usuarioId) : ref);

  return {
    async obtenerUsuario(uid) {
      const doc = await db.collection('users').doc(uid).get();
      return doc.exists ? doc.data() : null;
    },
    async guardarUsuario(uid, datos) {
      await db.collection('users').doc(uid).set(datos);
    },
    async actualizarUsuario(uid, cambios) {
      await db.collection('users').doc(uid).set(cambios, { merge: true });
    },
    async eliminarUsuario(uid) {
      await db.collection('users').doc(uid).delete();
    },
    async buscarUsuarioPorCorreo(correo) {
      const snap = await db.collection('users').where('correo', '==', correo).limit(1).get();
      if (snap.empty) return null;
      return { uid: snap.docs[0].id, ...snap.docs[0].data() };
    },
    async listarUsuarios() {
      const snap = await db.collection('users').get();
      return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    },

    async listarZonas() {
      const snap = await db.collection('zonas').get();
      return snap.docs.map(mapear);
    },
    async obtenerZona(id) {
      const doc = await db.collection('zonas').doc(id).get();
      return doc.exists ? mapear(doc) : null;
    },
    async listarCasilleros(zonaId) {
      const snap = await db.collection('zonas').doc(zonaId).collection('casilleros').get();
      return snap.docs.map(mapear);
    },
    async obtenerCasillero(zonaId, id) {
      const doc = await db.collection('zonas').doc(zonaId).collection('casilleros').doc(id).get();
      return doc.exists ? mapear(doc) : null;
    },

    async obtenerReserva(id) {
      const doc = await db.collection('reservas').doc(id).get();
      return doc.exists ? doc.data() : null;
    },
    async listarReservas({ usuarioId } = {}) {
      const snap = await filtrarPorUsuario(db.collection('reservas'), usuarioId).get();
      return snap.docs.map(mapear);
    },
    async listarHistorial({ usuarioId } = {}) {
      const snap = await filtrarPorUsuario(db.collection('historial_reservas'), usuarioId).get();
      return snap.docs.map(mapear);
    },

    transaccion(trabajo) {
      return db.runTransaction((t) => {
        const ref = (id) => db.collection('reservas').doc(id);
        // Firestore exige hacer todas las lecturas antes de las escrituras; el servicio
        // siempre lee primero (obtenerReserva) y escribe al final.
        return trabajo({
          obtenerReserva: async (id) => {
            const doc = await t.get(ref(id));
            return doc.exists ? doc.data() : null;
          },
          guardarReserva: async (id, datos) => { t.set(ref(id), datos); },
          actualizarReserva: async (id, cambios) => { t.update(ref(id), cambios); },
          archivarReserva: async (datos) => { t.set(db.collection('historial_reservas').doc(), datos); },
        });
      });
    },
  };
};
