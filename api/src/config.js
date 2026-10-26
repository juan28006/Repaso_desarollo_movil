const lista = (valor) => String(valor || '')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

export const cargarConfig = (env = process.env) => ({
  puerto: Number(env.PORT) || 3000,
  modoDatos: env.MODO_DATOS || 'memoria',
  adminEmails: lista(env.ADMIN_EMAILS),
  utcOffsetHoras: env.UTC_OFFSET_HORAS === undefined ? -5 : Number(env.UTC_OFFSET_HORAS),
  jwtSecret: env.JWT_SECRET || 'cambia-esto-en-desarrollo',
  firebaseWebApiKey: env.FIREBASE_WEB_API_KEY || '',
  firebaseServiceAccount: env.FIREBASE_SERVICE_ACCOUNT || '',
});
