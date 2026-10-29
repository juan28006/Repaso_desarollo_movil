export default function ErrorMessage({ message }) {

  if (!message) return null;

  return (
    <div
      style={{ backgroundColor: "#ffe5e5", color: "#c62828", padding: "12px",
        borderRadius: "8px", marginBottom: "15px",}}>
      {message}
    </div>
  );
}