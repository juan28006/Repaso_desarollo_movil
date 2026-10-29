import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {

  const { user, logout } = useAuth();

  return (
    <nav
      style={{ background: "#273c9c", color: "white", padding: "15px 25px", display: "flex",
        justifyContent: "space-between",}}>
      <h3>GuardaFácil</h3>

      {user && (
        <div
          style={{ display: "flex", gap: "16px", alignItems: "center",}}>
          <Link to="/dashboard" style={{ color: "white" }}>
            Dashboard
          </Link>
          <Link to="/zonas" style={{ color: "white" }} >
            Zonas
          </Link>
          <Link to="/mis-reservas" style={{ color: "white" }}>
            Reservas
          </Link>
          <button onClick={logout}
            style={{ padding: "8px 12px", cursor: "pointer", }}>
            Salir
          </button>
        </div>
      )}
    </nav>
  );
}