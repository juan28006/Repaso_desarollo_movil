export default function EmptyState({
  title = "No hay datos disponibles"
}) {
  return (
    <div
      style={{ textAlign: "center", padding: "40px",}}>
      <h3>{title}</h3>
    </div>
  );
}