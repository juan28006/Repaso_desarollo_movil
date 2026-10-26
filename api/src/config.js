const lista = (valor) => String(valor || '')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

export const cargarConfig = (env = process.env) => {
  const modoDatos = String(env.MODO_DATOS || '').trim().toLowerCase();
  if (!['firebase', 'memoria'].includes(modoDatos)) {
    throw new Error('Configura MODO_DATOS explícitamente como "firebase" o "memoria".');
  }
  if (modoDatos === 'memoria' && !['development', 'test'].includes(env.NODE_ENV)) {
    throw new Error('MODO_DATOS=memoria solo está permitido con NODE_ENV=development o test.');
  }

  const firebaseWebApiKey = env.FIREBASE_WEB_API_KEY || '';
  if (modoDatos === 'firebase' && !firebaseWebApiKey) {
    throw new Error('Falta FIREBASE_WEB_API_KEY para usar Firebase Authentication.');
  }

  return {
    puerto: Number(env.PORT) || 3000,
    modoDatos,
    adminEmails: lista(env.ADMIN_EMAILS),
    utcOffsetHoras: env.UTC_OFFSET_HORAS === undefined ? -5 : Number(env.UTC_OFFSET_HORAS),
    jwtSecret: env.JWT_SECRET || 'cambia-esto-en-desarrollo',
    firebaseWebApiKey,
    firebaseServiceAccount: env.FIREBASE_SERVICE_ACCOUNT || '',
  };
};
