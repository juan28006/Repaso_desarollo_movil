export const esErrorDeRed = (error) => (
  ['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(error?.code)
  || /network|offline|internet|unavailable|timed out/i.test(error?.message || '')
);
