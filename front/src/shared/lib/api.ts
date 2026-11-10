import axios from "axios";

export const api = axios.create({
  // Relativa: la resuelve el proxy de Vite en desarrollo y Nginx en produccion
  baseURL: import.meta.env.VITE_API_URL,
  // Sin esto el navegador no manda la cookie de sesion que emitira AuthX
  withCredentials: true,
});

// AuthX deja el CSRF en una cookie legible y lo exige en este header en toda
// peticion que modifique datos. Todavia no hay sesion, asi que esto no hace
// nada; queda puesto para que la historia #1 no se tropiece con ello.
api.interceptors.request.use((config) => {
  const csrf = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrf_access_token="))
    ?.split("=")[1];

  if (csrf) {
    config.headers["X-CSRF-TOKEN"] = csrf;
  }

  return config;
});
