import api from "../api/apiClient";

export const loginRequest = async (correo, contrasena) => {

  const { data } = await api.post("/auth/login", {
    correo,
    contrasena
  });
  return data;
};

export const registerRequest = async (payload) => {

  const { data } = await api.post("/auth/registro", payload);
  return data;
};