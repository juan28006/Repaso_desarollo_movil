export const esErrorDeRed = (error) => {
  if (error?.status >= 400 && error.status < 500) return false;
  return (
    ['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(error?.code)
    || /network|offline|internet|unavailable|timed out/i.test(error?.message || '')
  );
};

export const estadoErrorOperacion = (error) => {
  if (error?.status === 401 || error?.code === 'unauthenticated') return 'pendiente';
  if (
    error?.status === 409
    || ['reservation-conflict', 'operation-conflict', 'failed-precondition'].includes(error?.code)
  ) {
    return 'conflicto';
  }
  if (error?.status >= 400 && error.status < 500) return 'rechazada';
  return 'pendiente';
};
