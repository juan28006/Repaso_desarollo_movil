// Almacenamiento offline con SQLite (versión reducida: dos tablas).
//   cache -> última respuesta de la API por usuario y recurso (zonas, casilleros, reservas…)
//   cola  -> operaciones hechas sin conexión, pendientes de enviar a la API
import * as SQLite from 'expo-sqlite';

const NOMBRE_BD = 'guardafacil.db';
let promesaBd = null;

const abrirBd = () => {
  if (!promesaBd) {
    promesaBd = (async () => {
      const bd = await SQLite.openDatabaseAsync(NOMBRE_BD);
      await bd.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS cache (
          uid TEXT NOT NULL,
          recurso TEXT NOT NULL,
          datos TEXT NOT NULL,
          actualizado_en INTEGER NOT NULL,
          PRIMARY KEY (uid, recurso)
        );
        CREATE TABLE IF NOT EXISTS cola (
          id TEXT NOT NULL,
          uid TEXT NOT NULL,
          tipo TEXT NOT NULL,
          datos TEXT NOT NULL,
          estado TEXT NOT NULL DEFAULT 'pendiente',
          intentos INTEGER NOT NULL DEFAULT 0,
          ultimo_error TEXT,
          creada_en INTEGER NOT NULL,
          PRIMARY KEY (uid, id)
        );
      `);
      return bd;
    })().catch((error) => {
      promesaBd = null; // permite reintentar la apertura
      throw error;
    });
  }
  return promesaBd;
};

const validarUid = (uid) => {
  if (!uid || typeof uid !== 'string') {
    throw new Error('Se requiere el UID del usuario para acceder a datos locales.');
  }
};

const interpretar = (texto, descripcion) => {
  try {
    return JSON.parse(texto);
  } catch (error) {
    console.error(`No se pudo interpretar ${descripcion}:`, error);
    throw new Error('La base de datos local está dañada y no se pudo recuperar.');
  }
};

// ---------- Caché ----------

export async function leerCacheUsuario(uid, recurso) {
  validarUid(uid);
  const bd = await abrirBd();
  const fila = await bd.getFirstAsync(
    'SELECT datos, actualizado_en FROM cache WHERE uid = ? AND recurso = ?',
    [uid, recurso]
  );
  if (!fila) return null;
  return { datos: interpretar(fila.datos, `la caché local (${recurso})`), actualizadoEn: fila.actualizado_en };
}

export async function guardarCacheUsuario(uid, recurso, datos) {
  validarUid(uid);
  const bd = await abrirBd();
  const registro = { datos, actualizadoEn: Date.now() };
  await bd.runAsync(
    'INSERT OR REPLACE INTO cache (uid, recurso, datos, actualizado_en) VALUES (?, ?, ?, ?)',
    [uid, recurso, JSON.stringify(datos), registro.actualizadoEn]
  );
  return registro;
}

export async function actualizarCacheUsuario(uid, recurso, actualizar) {
  validarUid(uid);
  const bd = await abrirBd();
  let registro;
  await bd.withExclusiveTransactionAsync(async (txn) => {
    const fila = await txn.getFirstAsync(
      'SELECT datos FROM cache WHERE uid = ? AND recurso = ?',
      [uid, recurso]
    );
    const actuales = fila ? interpretar(fila.datos, `la caché local (${recurso})`) : [];
    const datos = await actualizar(actuales);
    registro = { datos, actualizadoEn: Date.now() };
    await txn.runAsync(
      'INSERT OR REPLACE INTO cache (uid, recurso, datos, actualizado_en) VALUES (?, ?, ?, ?)',
      [uid, recurso, JSON.stringify(datos), registro.actualizadoEn]
    );
  });
  return registro;
}

// ---------- Cola de operaciones ----------

const aOperacion = (fila) => ({
  id: fila.id,
  uid: fila.uid,
  tipo: fila.tipo,
  datos: interpretar(fila.datos, 'la cola offline'),
  // Una sincronización interrumpida no deja la operación "colgada".
  estado: fila.estado === 'sincronizando' ? 'pendiente' : fila.estado,
  intentos: fila.intentos,
  ultimoError: fila.ultimo_error,
  creadaEn: fila.creada_en,
});

export async function listarCola(uid) {
  validarUid(uid);
  const bd = await abrirBd();
  const filas = await bd.getAllAsync(
    'SELECT * FROM cola WHERE uid = ? ORDER BY creada_en, rowid',
    [uid]
  );
  return filas.map(aOperacion);
}

// Inserta si no existe y devuelve la operación guardada (existente o nueva).
export async function insertarOperacion(operacion) {
  validarUid(operacion.uid);
  const bd = await abrirBd();
  let guardada;
  await bd.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT OR IGNORE INTO cola (id, uid, tipo, datos, estado, intentos, creada_en)
       VALUES (?, ?, ?, ?, 'pendiente', 0, ?)`,
      [operacion.id, operacion.uid, operacion.tipo, JSON.stringify(operacion.datos), operacion.creadaEn]
    );
    guardada = await txn.getFirstAsync(
      'SELECT * FROM cola WHERE uid = ? AND id = ?',
      [operacion.uid, operacion.id]
    );
  });
  return aOperacion(guardada);
}

export async function actualizarOperacionCola(uid, id, cambios) {
  validarUid(uid);
  const bd = await abrirBd();
  const columnas = [];
  const valores = [];
  if (cambios.estado !== undefined) { columnas.push('estado = ?'); valores.push(cambios.estado); }
  if (cambios.ultimoError !== undefined) { columnas.push('ultimo_error = ?'); valores.push(cambios.ultimoError); }
  if (cambios.sumarIntento) columnas.push('intentos = intentos + 1');
  if (!columnas.length) return;
  await bd.runAsync(`UPDATE cola SET ${columnas.join(', ')} WHERE uid = ? AND id = ?`, [...valores, uid, id]);
}

export async function eliminarOperacionCola(uid, id) {
  validarUid(uid);
  const bd = await abrirBd();
  await bd.runAsync('DELETE FROM cola WHERE uid = ? AND id = ?', [uid, id]);
}
