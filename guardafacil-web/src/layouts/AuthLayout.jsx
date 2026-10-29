import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f7ff",
      display: "flex", justifyContent: "center", alignItems: "center", padding: "20px",}}>
      <div style={{ width: "100%", maxWidth: "500px", backgroundColor: "#fff", padding: "30px",
        borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,.08)",}}>
        <Outlet />
      </div>
    </div>
  );
}