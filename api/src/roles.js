export const ROLES = {
  ESTUDIANTE: 'estudiante',
  GESTOR: 'gestor',
  ADMINISTRADOR: 'administrador',
};

export const ROLES_VALIDOS = Object.values(ROLES);

export const esPersonal = (rol) => rol === ROLES.GESTOR || rol === ROLES.ADMINISTRADOR;
