export default function Card({ children }) {
  return (
    <div
      style={{ background: "#ffffff", border: "1px solid #d9d9d9",
        borderRadius: "12px", padding: "16px", marginBottom: "15px", boxShadow: "0px 2px 8px rgba(0,0,0,.05)",}}>
      {children}
    </div>
  );
}