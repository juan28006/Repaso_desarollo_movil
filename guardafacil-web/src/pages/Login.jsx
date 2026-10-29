import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Login() {

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const navigate = useNavigate();
  const { iniciarSesion } = useAuth();
  const [enviando, setEnviando] = useState(false);

  async function manejarLogin(evento) {
    evento.preventDefault();
    setMensaje('');
    if (!correo.trim() || !contrasena) {
      setMensaje('Ingresa tu correo y contraseña.');
      return;
    }

    try {
        setEnviando(true);
        const usuario = await iniciarSesion(correo, contrasena);
        if ( usuario.rol === 'estudiante' || usuario.rol === 'gestor' || usuario.rol === 'administrador') {
          navigate('/dashboard', { replace: true });
        } else {
          setMensaje('Tu cuenta no tiene un rol válido.');
        }
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
          <span className="auth-label">TU CAMPUS, MÁS ORGANIZADO</span>
          <h1>
            Tu espacio.
            <br />
            Tu tranquilidad.
          </h1>
          <p> Reserva y administra tus casilleros de forma sencilla, segura y desde un solo lugar. </p>

          <div className="auth-feature-list">
            <div className="auth-feature">
              <span className="auth-feature-icon">✓</span>
              <span>Reserva casilleros disponibles</span>
            </div>

            <div className="auth-feature">
              <span className="auth-feature-icon">✓</span>
              <span>Consulta tus reservas fácilmente</span>
            </div>

            <div className="auth-feature">
              <span className="auth-feature-icon">✓</span>
              <span>Acceso según tu tipo de usuario</span>
            </div>
          </div>
        </div>

        <p className="auth-brand-footer">
          Guardafácil · Gestión inteligente de casilleros
        </p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-container">
          <div className="auth-mobile-brand">
            <span className="auth-brand-icon">G</span>
            <span>Guardafácil</span>
          </div>

          <div className="auth-form-heading">
            <span className="auth-label">BIENVENIDO DE NUEVO</span>
            <h2>Iniciar sesión</h2>
            <p>Ingresa tus datos para continuar.</p>
          </div>

          <form className="auth-form" onSubmit={manejarLogin}>
            <label htmlFor="login-correo">Correo electrónico</label>

            <div className="auth-input-wrapper">
              <span className="auth-input-icon">✉</span>
              <input id="login-correo" type="email" placeholder="nombre@universidad.edu.co"
                autoComplete="email" value={correo} onChange={(evento) => setCorreo(evento.target.value)} required/>
            </div>
            <div className="auth-password-heading">
              <label htmlFor="login-contrasena">Contraseña</label>
            </div>

            <div className="auth-input-wrapper">
              <span className="auth-input-icon">⌑</span>
              <input id="login-contrasena" type={mostrarContrasena ? 'text' : 'password'} placeholder="Ingresa tu contraseña"
                autoComplete="current-password" value={contrasena} onChange={(evento) => setContrasena(evento.target.value)} required/>
              <button type="button" className="auth-password-toggle"
                onClick={() => setMostrarContrasena((valor) => !valor)}
                aria-label={ mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {mostrarContrasena ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            {mensaje && (
              <div className="auth-message" role="status">
                {mensaje}
              </div>
            )}

           <button type="submit" className="auth-submit" disabled={enviando}>
              {enviando ? 'Iniciando sesión...' : 'Iniciar sesión'}
              {!enviando && <span>→</span>}
            </button>
          </form>

          <p className="auth-switch"> ¿Todavía no tienes una cuenta?{' '}
            <Link to="/registro">Crear cuenta</Link>
          </p>

          <p className="auth-legal"> Al continuar, aceptas las políticas de uso de Guardafácil. </p>
        </div>
      </section>
    </main>
  );
}