const ESTADOS = {
  DISPONIBLE: 'disponible',
  OCUPADO: 'ocupado',
  MANTENIMIENTO: 'mantenimiento',
  DESCONOCIDO: 'desconocido',
};

export function normalizarEstadoCasillero(casillero) {
  const estado = String(casillero.estado ?? casillero.status ?? '').trim().toLowerCase();

  if (
    casillero.mantenimiento === true
    || estado.includes('mantenimiento')
    || estado.includes('maintenance')
  ) {
    return ESTADOS.MANTENIMIENTO;
  }

  if (['disponible', 'available', 'libre'].includes(estado)) {
    return ESTADOS.DISPONIBLE;
  }

  if (
    ['reservado', 'reservada', 'ocupado', 'ocupada', 'reserved', 'occupied', 'no disponible']
      .includes(estado)
  ) {
    return ESTADOS.OCUPADO;
  }

  if (typeof casillero.disponible === 'boolean') {
    return casillero.disponible ? ESTADOS.DISPONIBLE : ESTADOS.OCUPADO;
  }

  return ESTADOS.DESCONOCIDO;
}

export function tieneEstadoCasillero(casillero) {
  return normalizarEstadoCasillero(casillero) !== ESTADOS.DESCONOCIDO;
}

export function tieneDatoMantenimiento(casillero) {
  return typeof casillero.mantenimiento === 'boolean'
    || typeof casillero.estado === 'string'
    || typeof casillero.status === 'string';
}

export function etiquetaEstadoCasillero(estado) {
  return {
    [ESTADOS.DISPONIBLE]: 'Disponible',
    [ESTADOS.OCUPADO]: 'Ocupado',
    [ESTADOS.MANTENIMIENTO]: 'En mantenimiento',
    [ESTADOS.DESCONOCIDO]: 'Estado no disponible',
  }[estado] || 'Estado no disponible';
}

export function colorEstadoCasillero(estado) {
  return {
    [ESTADOS.DISPONIBLE]: '#2e9b62',
    [ESTADOS.OCUPADO]: '#c0392b',
    [ESTADOS.MANTENIMIENTO]: '#b7791f',
    [ESTADOS.DESCONOCIDO]: '#69728e',
  }[estado] || '#69728e';
}

export { ESTADOS as ESTADOS_CASILLERO };
