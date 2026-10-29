import {BrowserRouter, Navigate, Route, Routes,} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Casilleros from './pages/Casilleros';
import Reservas from './pages/Reservas';
import Usuarios from './pages/Usuarios';
import Login from './pages/Login';
import Registro from './pages/Registro';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route  path="/" element={<Navigate to="/dashboard" replace />}/>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/casilleros" element={<Casilleros />} />
              <Route path="/reservas" element={<Reservas />} />
              <Route path="/usuarios" element={<Usuarios />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />}/>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}