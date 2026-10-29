import { useEffect, useMemo, useState } from 'react';
import './Usuarios.css';

const formularioVacio = {
  nombre: '',
  correo: '',
  documento: '',
  rol: 'Estudiante',
  estado: 'Activo',
};

export default function Usuarios() {

  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('Todos');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {

    const cargarUsuarios = async () => {
      try {
        setCargando(true);
        setErrorCarga('');
        const token = localStorage.getItem('guardafacil_id_token');
        if (!token) {
          throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente.');
        }
        const respuesta = await fetch( `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/usuarios`,
          {
            headers: { Authorization: `Bearer ${token}`, },
          },
        );
        const datos = await respuesta.json();
        if (!respuesta.ok) {
          throw new Error( datos?.error?.mensaje || 'No se pudieron cargar los usuarios.',);
        }
        const usuariosReales = datos.map((usuario) => ({
          id: usuario.uid,
          uid: usuario.uid,
          nombre: usuario.nombreCompleto || 'Sin nombre',
          correo: usuario.email || '',
          documento: usuario.cedula || '—',
          telefono: usuario.telefono || '',
          direccion: usuario.direccion || '',
          rol: { estudiante: 'Estudiante', gestor: 'Gestor', administrador: 'Administrador',
          }[String(usuario.rol || '').toLowerCase()] || 'Estudiante',
          estado: 'Activo',
        }));
        setUsuarios(usuariosReales);
      } catch (error) {
        setErrorCarga(error.message || 'Ocurrió un error al cargar los usuarios.');
      } finally {
        setCargando(false);
      }
    };
    cargarUsuarios();
  }, []);

  const usuariosFiltrados = useMemo(() => {

    const texto = busqueda.toLowerCase().trim();
    return usuarios.filter((usuario) => {
      const coincideBusqueda = usuario.nombre.toLowerCase().includes(texto) || usuario.correo.toLowerCase().includes(texto) ||
        usuario.documento.includes(texto);
      const coincideRol = filtroRol === 'Todos' || usuario.rol === filtroRol;
      const coincideEstado = filtroEstado === 'Todos' || usuario.estado === filtroEstado;
      return coincideBusqueda && coincideRol && coincideEstado;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  const totalEstudiantes = usuarios.filter( (usuario) => usuario.rol === 'Estudiante',).length;
  const totalGestores = usuarios.filter( (usuario) => usuario.rol === 'Gestor',).length;
  const totalAdministradores = usuarios.filter( (usuario) => usuario.rol === 'Administrador',).length;

  function abrirCrear() {
    setUsuarioEditando(null);
    setFormulario(formularioVacio);
    setMensaje('');
    setModalAbierto(true);
  }

  function abrirEditar(usuario) {
    setUsuarioEditando(usuario);
    setFormulario({ nombre: usuario.nombre, correo: usuario.correo, documento: usuario.documento,
      rol: usuario.rol, estado: usuario.estado,});
    setMensaje('');
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setUsuarioEditando(null);
    setFormulario(formularioVacio);
    setMensaje('');
  }

  function manejarCambio(evento) {
    const { name, value } = evento.target;
    setFormulario((anterior) => ({ ...anterior, [name]: value }));
  }

  
  async function guardarUsuario(evento) {

    evento.preventDefault();
    setMensaje('');
    if (!usuarioEditando) {
      setMensaje( 'La creación de usuarios desde esta pantalla todavía no está conectada al backend.');
      return;
    }
    const token = localStorage.getItem('guardafacil_id_token');
    if (!token) {
      setMensaje('Tu sesión ha expirado. Inicia sesión nuevamente.');
      return;
    }
    const nombre = formulario.nombre.trim();
    const documento = formulario.documento.trim();
    if (!nombre || !documento) {
      setMensaje('Completa el nombre y el documento.');
      return;
    }
    if (!/^\d{6,12}$/.test(documento)) {
      setMensaje('La cédula debe tener entre 6 y 12 dígitos.');
      return;
    }
    const rolApi = { Estudiante: 'estudiante', Gestor: 'gestor', Administrador: 'administrador',};
    const rolAnterior = usuarioEditando.rol;
    const rolNuevo = formulario.rol;
    setGuardando(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const respuestaPerfil = await fetch( `${baseUrl}/usuarios/${usuarioEditando.uid}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',},
          body: JSON.stringify({ nombreCompleto: nombre, cedula: documento,}),
        }
      );
      const datosPerfil = await respuestaPerfil.json().catch(() => ({}));
      if (!respuestaPerfil.ok) {
        throw new Error(  datosPerfil?.error?.mensaje || 'No se pudieron actualizar los datos personales.');
      }
      if (rolNuevo !== rolAnterior) {
        const respuestaRol = await fetch( `${baseUrl}/usuarios/${usuarioEditando.uid}/rol`, {
          method: 'PATCH', 
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',},
          body: JSON.stringify({ rol: rolApi[rolNuevo],}),}
        );
        const datosRol = await respuestaRol.json().catch(() => ({}));
        if (!respuestaRol.ok) {
          throw new Error( datosRol?.error?.mensaje || 'Los datos se guardaron, pero no se pudo cambiar el rol. Vuelve a cargar la página.');
        }
      }
      setUsuarios((anteriores) =>
        anteriores.map((usuario) =>
          usuario.uid === usuarioEditando.uid ? { ...usuario, nombre, documento,  rol: rolNuevo,} : usuario
        )
      );
      cerrarModal();
    } catch (error) {
      setMensaje(error.message || 'Ocurrió un error al guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  }

  function cambiarEstado(usuario) {
    setUsuarios((anteriores) =>
      anteriores.map((elemento) => elemento.id === usuario.id ? { ...elemento,
        estado: elemento.estado === 'Activo' ? 'Inactivo' : 'Activo', } : elemento,),
    );
  }

  async function eliminarUsuario(usuario) {

    const confirmar = window.confirm( `¿Seguro que deseas eliminar a ${usuario.nombre}? Esta acción eliminará su cuenta.`);
    if (!confirmar) return;
    const token = localStorage.getItem('guardafacil_id_token');
    if (!token) {
      window.alert('Tu sesión ha expirado. Inicia sesión nuevamente.');
      return;
    }
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const respuesta = await fetch( `${baseUrl}/usuarios/${usuario.uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`,}, }
      );
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        throw new Error( datos?.error?.mensaje || 'No se pudo eliminar el usuario.');
      }
      setUsuarios((anteriores) =>
        anteriores.filter((elemento) => elemento.uid !== usuario.uid)
      );
      setMensaje('');
    } catch (error) {
      window.alert(error.message || 'Ocurrió un error al eliminar el usuario.');
    }
  }

  return (
    <main className="usuarios-page">
      <header className="usuarios-header">
        <div>
          <span className="usuarios-eyebrow">ADMINISTRACIÓN</span>
          <h1>Usuarios</h1>
          <p>Gestiona las cuentas y los permisos de Guardafácil.</p>
        </div>

        <button className="usuarios-primary-button" onClick={abrirCrear}>
          <span>＋</span> Nuevo usuario
        </button>
      </header>

      <section className="usuarios-stats">
        <article className="usuario-stat-card">
          <div className="usuario-stat-icon icon-total">♙</div>
          <div>
            <span>Total de usuarios</span>
            <strong>{usuarios.length}</strong>
            <small>Cuentas registradas</small>
          </div>
        </article>

        <article className="usuario-stat-card">
          <div className="usuario-stat-icon icon-estudiante">🎓</div>
          <div>
            <span>Estudiantes</span>
            <strong>{totalEstudiantes}</strong>
            <small>Usuarios estudiantes</small>
          </div>
        </article>

        <article className="usuario-stat-card">
          <div className="usuario-stat-icon icon-gestor">🛠</div>
          <div>
            <span>Gestores</span>
            <strong>{totalGestores}</strong>
            <small>Gestión de casilleros</small>
          </div>
        </article>

        <article className="usuario-stat-card">
          <div className="usuario-stat-icon icon-admin">⚙</div>
          <div>
            <span>Administradores</span>
            <strong>{totalAdministradores}</strong>
            <small>Control del sistema</small>
          </div>
        </article>
      </section>

      <section className="usuarios-panel">
        <div className="usuarios-panel-heading">
          <div>
            <h2>Directorio de usuarios</h2>
            <p>Consulta, crea y administra las cuentas registradas.</p>
          </div>
          <span className="usuarios-count">
            {usuariosFiltrados.length} resultados
          </span>
        </div>

        <div className="usuarios-toolbar">
          <div className="usuarios-search">
            <span>⌕</span>
            <input type="search" placeholder="Buscar por nombre, correo o documento..."
              value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)}/>
          </div>

          <select aria-label="Filtrar por rol" value={filtroRol} onChange={(evento) => setFiltroRol(evento.target.value)}>
            <option value="Todos">Todos los roles</option>
            <option value="Estudiante">Estudiante</option>
            <option value="Gestor">Gestor</option>
            <option value="Administrador">Administrador</option>
          </select>

          <select aria-label="Filtrar por estado" value={filtroEstado} onChange={(evento) => setFiltroEstado(evento.target.value)}>
            <option value="Todos">Todos los estados</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </div>

        <div className="usuarios-table-wrapper">
          <table className="usuarios-table">
            <thead>
              <tr>
                <th>USUARIO</th>
                <th>DOCUMENTO</th>
                <th>ROL</th>
                <th>ESTADO</th>
                <th className="usuarios-actions-heading">ACCIONES</th>
              </tr>
            </thead>

            <tbody>
              {cargando && (
                <tr>
                  <td colSpan="5">Cargando usuarios de Firebase...</td>
                </tr>
              )}
              {!cargando && errorCarga && (
                <tr>
                  <td colSpan="5">{errorCarga}</td>
                </tr>
              )}
              {!cargando && !errorCarga && usuariosFiltrados.map((usuario) =>  (
                <tr key={usuario.id}>
                  <td>
                    <div className="usuario-identity">
                      <div className="usuario-avatar">
                        {usuario.nombre .split(' ') .slice(0, 2) .map((parte) => parte[0]) .join('') .toUpperCase()}
                      </div>
                      <div className="usuario-identity-text">
                        <strong>{usuario.nombre}</strong>
                        <span>{usuario.correo}</span>
                      </div>
                    </div>
                  </td>
                  <td className="usuario-documento">{usuario.documento}</td>
                  <td>
                    <span className={`usuario-role role-${usuario.rol .toLowerCase() .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')}`}>
                      {usuario.rol}
                    </span>
                  </td>
                  <td>
                    <span className={`usuario-status ${ usuario.estado === 'Activo' ? 'status-active' : 'status-inactive'}`}>
                      <span className="usuario-status-dot" />
                      {usuario.estado}
                    </span>
                  </td>

                  <td>
                    <div className="usuario-actions">
                      <button className="usuario-action-button" onClick={() => abrirEditar(usuario)}title="Editar usuario"
                        aria-label={`Editar a ${usuario.nombre}`}>
                        ✎
                      </button>
                      <button className="usuario-action-button"  onClick={() => cambiarEstado(usuario)}
                        title={ usuario.estado === 'Activo' ? 'Desactivar usuario' : 'Activar usuario'}
                        aria-label={`Cambiar estado de ${usuario.nombre}`} >
                        {usuario.estado === 'Activo' ? '⊘' : '✓'}
                      </button>
                      <button className="usuario-action-button action-delete" onClick={() => eliminarUsuario(usuario)}
                        title="Eliminar usuario" aria-label={`Eliminar a ${usuario.nombre}`}>
                        ♲
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {usuariosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="5" className="usuarios-empty">
                    <span>⌕</span>
                    <strong>No se encontraron usuarios</strong>
                    <p>Prueba con otra búsqueda o cambia los filtros.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="usuarios-modal-backdrop" onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) cerrarModal();
          }}>
          <section className="usuarios-modal" role="dialog" aria-modal="true" aria-labelledby="usuarios-modal-title">
            <div className="usuarios-modal-header">
              <div>
                <span className="usuarios-eyebrow">
                  {usuarioEditando ? 'ACTUALIZAR CUENTA' : 'NUEVA CUENTA'}
                </span>
                <h2 id="usuarios-modal-title">
                  {usuarioEditando ? 'Editar usuario' : 'Crear usuario'}
                </h2>
                <p>Ingresa los datos de la cuenta.</p>
              </div>
              <button type="button" className="usuarios-modal-close" onClick={cerrarModal} aria-label="Cerrar formulario">
                ×
              </button>
            </div>

            <form onSubmit={guardarUsuario}>
              <label>
                Nombre completo
                <input name="nombre" value={formulario.nombre} onChange={manejarCambio} placeholder="Ej. Ana María Torres" required/>
              </label>

              <label>
                Correo electrónico
                <input name="correo" type="email" value={formulario.correo} onChange={manejarCambio}
                 placeholder="usuario@universidad.edu.co" required/>
              </label>

              <label>
                Número de documento
                <input name="documento" value={formulario.documento} onChange={manejarCambio} placeholder="Ingresa el documento"
                  required/>
              </label>

              <div className="usuarios-form-row">
                <label>
                  Rol
                  <select name="rol" value={formulario.rol} onChange={manejarCambio}>
                    <option value="Estudiante">Estudiante</option>
                    <option value="Gestor">Gestor</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                </label>

                <label>
                  Estado
                  <select name="estado" value={formulario.estado} onChange={manejarCambio}>
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </label>
              </div>

              {mensaje && <p className="usuarios-form-error">{mensaje}</p>}

              <div className="usuarios-modal-actions">
                <button type="button" className="usuarios-secondary-button" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" className="usuarios-primary-button" disabled={guardando}>
                  {guardando ? 'Guardando...' : usuarioEditando ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}