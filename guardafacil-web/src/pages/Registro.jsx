import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Registro() {

  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();
  const { registrar } = useAuth();

  async function manejarRegistro(evento) {

    evento.preventDefault();
    setMensaje('');
    if ( !nombre.trim() || !documento.trim() || !telefono.trim() || !direccion.trim() || !correo.trim() || !contrasena ||
      !confirmarContrasena) {
      setMensaje('Completa todos los campos.');
      return;
    }
    if (!/^\d{6,12}$/.test(documento.trim())) {
      setMensaje('La cédula debe tener entre 6 y 12 dígitos.');
      return;
    }
    if (!/^\d{7,15}$/.test(telefono.trim())) {
      setMensaje('El teléfono debe tener entre 7 y 15 dígitos.');
      return;
    }
    if (contrasena.length < 8) {
      setMensaje('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (contrasena !== confirmarContrasena) {
      setMensaje('Las contraseñas no coinciden.');
      return;
    }

    try {
        setEnviando(true);
        await registrar({ nombreCompleto: nombre.trim(), cedula: documento.trim(),
        telefono: telefono.trim(), correo: correo.trim(), direccion: direccion.trim(), contrasena,});
        navigate('/dashboard', { replace: true });
    } catch (error) {
        setMensaje(error.message);
    } finally {
        setEnviando(false);
    }
    }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <Link to="/login" className="auth-brand">
          <span className="auth-brand-icon">G</span>
          <span>Guardafácil</span>
        </Link>

        <div className="auth-brand-content">
          <span className="auth-label">EMPIEZA AQUÍ</span>
          <h1>
            Un lugar para
            <br />
            tus cosas.
          </h1>
          <p> Crea tu cuenta y ten el control de tus reservas de casilleros en tu institución. </p>
          <div className="auth-highlight-card">
            <div className="auth-highlight-icon">✦</div>
            <div>
              <strong>Simple y organizado</strong>
              <p> Encuentra espacios disponibles y gestiona tus reservas cuando lo necesites. </p>
            </div>
          </div>
        </div>
        <p className="auth-brand-footer">
          Guardafácil · Gestión inteligente de casilleros
        </p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-container auth-register-container">
          <div className="auth-mobile-brand">
            <span className="auth-brand-icon">G</span>
            <span>Guardafácil</span>
          </div>

          <div className="auth-form-heading">
            <span className="auth-label">ÚNETE A GUARDÁFACIL</span>
            <h2>Crear una cuenta</h2>
            <p>Completa tus datos para registrarte como estudiante.</p>
          </div>

          <form className="auth-form" onSubmit={manejarRegistro}>
            <label htmlFor="registro-nombre">Nombre completo</label>

            <div className="auth-input-wrapper">
              <span className="auth-input-icon">♙</span>
              <input id="registro-nombre" type="text" placeholder="Tu nombre completo" autoComplete="name"
                value={nombre} onChange={(evento) => setNombre(evento.target.value)} required/>
            </div>
            <label htmlFor="registro-documento">Documento de identidad</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">▤</span>
              <input id="registro-documento" type="text" inputMode="numeric" placeholder="Número de documento"
                autoComplete="off" value={documento}
                onChange={(evento) => setDocumento(evento.target.value)} required/>
            </div>
            <label htmlFor="registro-correo">Correo electrónico</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">✉</span>
              <input id="registro-correo" type="email" placeholder="nombre@universidad.edu.co"
                autoComplete="email" value={correo} onChange={(evento) => setCorreo(evento.target.value)} required />
            </div>
            <label htmlFor="registro-telefono">Teléfono</label>
            <div className="auth-input-wrapper">
            <span className="auth-input-icon">☎</span>
            <input id="registro-telefono" type="tel"  inputMode="numeric" placeholder="Tu número de teléfono"
              autoComplete="tel" value={telefono} onChange={(evento) => setTelefono(evento.target.value)} required />
            </div>
            <label htmlFor="registro-direccion">Dirección</label>
            <div className="auth-input-wrapper">
            <span className="auth-input-icon">⌂</span>
            <input id="registro-direccion" type="text" placeholder="Tu dirección de residencia" autoComplete="street-address"
              value={direccion} onChange={(evento) => setDireccion(evento.target.value)} required/>
            </div>
            <label htmlFor="registro-contrasena">Contraseña</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">⌑</span>
              <input id="registro-contrasena" type={mostrarContrasena ? 'text' : 'password'} placeholder="Mínimo 8 caracteres"
                autoComplete="new-password" value={contrasena} onChange={(evento) => setContrasena(evento.target.value)}
                minLength={8} required/>
              <button type="button" className="auth-password-toggle" onClick={() => setMostrarContrasena((valor) => !valor)}>
                {mostrarContrasena ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <label htmlFor="registro-confirmar">
              Confirmar contraseña
            </label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">⌑</span>
              <input id="registro-confirmar" type={mostrarContrasena ? 'text' : 'password'} placeholder="Repite tu contraseña"
                autoComplete="new-password" value={confirmarContrasena}
                onChange={(evento) => setConfirmarContrasena(evento.target.value)}  required/>
            </div>
            <div className="auth-role-note">
              <span>🎓</span>
              <div>
                <strong>Rol de la cuenta: Estudiante</strong>
                <p>Los permisos especiales son asignados por el sistema.</p>
              </div>
            </div>

            {mensaje && (
              <div className="auth-message" role="status">
                {mensaje}
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={enviando} >
              {enviando ? 'Creando cuenta...' : 'Crear cuenta'}
              {!enviando && <span>→</span>}
            </button>
          </form>
          <p className="auth-switch"> ¿Ya tienes una cuenta?{' '}
            <Link to="/login">Iniciar sesión</Link>
          </p>
          <p className="auth-legal">
            Protege tus credenciales y no compartas tu contraseña.
          </p>
        </div>
      </section>
    </main>
  );
}