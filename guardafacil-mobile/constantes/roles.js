export const ROLES = {
  ESTUDIANTE: 'estudiante',
  GESTOR: 'gestor',
  ADMINISTRADOR: 'administrador',
};

export const ETIQUETAS_ROL = {
  estudiante: 'Estudiante',
  gestor: 'Gestor',
  administrador: 'Administrador',
};

// Solo para decidir qué opciones mostrar: la API es quien hace cumplir los permisos.
export const esPersonal = (rol) => rol === ROLES.GESTOR || rol === ROLES.ADMINISTRADOR;
export const esAdministrador = (rol) => rol === ROLES.ADMINISTRADOR;
