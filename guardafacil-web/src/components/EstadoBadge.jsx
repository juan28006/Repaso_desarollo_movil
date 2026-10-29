const ESTADOS = {
  reservado: {
    texto: "Reservado",
    color: "#273c9c",
  },

  en_uso: {
    texto: "En uso",
    color: "#f39c12",
  },

  finalizado: {
    texto: "Finalizado",
    color: "#27ae60",
  },

  cancelado: {
    texto: "Cancelado",
    color: "#e74c3c",
  },

  vencido: {
    texto: "Vencido",
    color: "#7f8c8d",
  },
};

export default function EstadoBadge({ estado }) {
  const config =
    ESTADOS[estado] || ESTADOS.reservado;

  return (
    <span
      style={{ backgroundColor: config.color, color: "white", padding: "6px 12px",
        borderRadius: "20px", fontSize: "12px", fontWeight: "bold",}}>
      {config.texto}
    </span>
  );
}