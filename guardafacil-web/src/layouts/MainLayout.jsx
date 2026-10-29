
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Grid2X2, CalendarCheck, Users, KeyRound, Bell, LogOut, Menu, X,} from 'lucide-react';
import { useState } from 'react';
import './MainLayout.css';
import { useAuth } from '../context/AuthContext';

const navegacion = [
  {
    nombre: 'Panel principal',
    ruta: '/dashboard',
    icono: LayoutDashboard,
    roles: ['estudiante', 'gestor', 'administrador'],
  },
  {
    nombre: 'Casilleros',
    ruta: '/casilleros',
    icono: Grid2X2,
    roles: ['estudiante', 'gestor', 'administrador'],
  },
  {
    nombre: 'Reservas',
    ruta: '/reservas',
    icono: CalendarCheck,
    roles: ['gestor', 'administrador'],
  },
  {
    nombre: 'Usuarios',
    ruta: '/usuarios',
    icono: Users,
    roles: ['administrador'],
  },
];

export default function MainLayout() {

  const [menuOpen, setMenuOpen] = useState(false);
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const rol = usuario?.rol;
  const opcionesVisibles = navegacion.filter((opcion) =>
    opcion.roles.includes(rol)
  );

  function manejarCerrarSesion() {
    cerrarSesion();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      {menuOpen && (
        <button className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}/>
      )}

      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <KeyRound size={25} />
          </div>
          <div>
            <h2>Guardafácil</h2>
            <span>GESTIÓN DE CASILLEROS</span>
          </div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
            <X size={21} />
          </button>
        </div>

        <div className="sidebar-section-label">MENÚ PRINCIPAL</div>

        <nav className="sidebar-nav">
          {opcionesVisibles.map((opcion) => {
            const Icono = opcion.icono;

            return (
              <NavLink key={opcion.ruta} to={opcion.ruta} onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
                <Icono size={20} strokeWidth={1.9} />
                <span>{opcion.nombre}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-icon">
              <KeyRound size={19} />
            </div>
            <strong>Todo en su lugar</strong>
            <p>Administra tus casilleros fácilmente.</p>
          </div>

          <button type="button" className="logout-button" onClick={manejarCerrarSesion}>
            <LogOut size={20} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            <Menu size={23} />
          </button>

          <div className="breadcrumb">
            <span>Guardafácil</span>
            <span className="breadcrumb-divider">/</span>
            <strong>Panel de control</strong>
          </div>

          <div className="topbar-actions">
            <button className="notification-button" aria-label="Notificaciones">
              <Bell size={20} />
              <span className="notification-dot" />
            </button>

            <div className="user-profile">
              <div className="avatar">
                {(usuario?.nombreCompleto || usuario?.nombre || 'U') .charAt(0) .toUpperCase()}
              </div>
              <div>
                <span>
                  {usuario?.nombreCompleto || usuario?.nombre || 'Usuario'}
                </span>
                <span>
                  {rol ? rol.charAt(0).toUpperCase() + rol.slice(1) : 'Sin rol'}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>

        <footer className="app-footer">
          <span>© 2026 Guardafácil</span>
          <span>Gestión inteligente de casilleros</span>
        </footer>
      </div>
    </div>
  );
}
