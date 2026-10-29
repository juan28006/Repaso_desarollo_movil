import { Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import Login from "../pages/Login";
import Registro from "../pages/Registro";
import Dashboard from "../pages/Dashboard";
import Casilleros from "../pages/Casilleros";
import PrivateRoute from "./PrivateRoute";
import DetalleCasillero from "../pages/DetalleCasillero";

export default function AppRouter() {

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/dashboard" element={ <PrivateRoute> <Dashboard /> </PrivateRoute>} />
      <Route path="/zonas" element={ <PrivateRoute> <Zonas /> </PrivateRoute>} /> 
      <Route path="/zonas/:zonaId" element={ <PrivateRoute> <Casilleros /> </PrivateRoute>}/>
      <Route path="/zonas/:zonaId/casilleros/:casilleroId" element={ <PrivateRoute> <DetalleCasillero /> </PrivateRoute>}/>
    </Routes>
  );
}