import axios, { isAxiosError } from "axios";

import { queryClient } from "./queryClient";

export const api = axios.create({
  // Relativa: la resuelve el proxy de Vite en desarrollo y Nginx en produccion
  baseURL: import.meta.env.VITE_API_URL,
  // Sin esto el navegador no manda la cookie de sesion que emitira AuthX
  withCredentials: true,
});

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

// AuthX deja el CSRF en una cookie legible y lo exige en este header en toda
// peticion que modifique datos.
api.interceptors.request.use((config) => {
  const csrf = getCookie("csrf_access_token");
  if (csrf) {
    config.headers["X-CSRF-TOKEN"] = csrf;
  }
  return config;
});

// Un 401 normalmente significa "la sesion de mas de 30 minutos vencio":
// se intenta renovar con el refresh (su propio CSRF, el de la cookie de
// refresh) y se reintenta la peticion original una sola vez. Si el refresh
// tambien falla, la sesion ya no sirve de verdad: se limpia la cache de
// React Query y se manda al login en vez de mostrar un error.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const noHayQueReintentar =
      !isAxiosError(error) ||
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retried ||
      originalRequest.url === "/auth/login" ||
      originalRequest.url === "/auth/refresh";

    if (noHayQueReintentar) {
      return Promise.reject(error);
    }

    originalRequest._retried = true;
    try {
      await api.post("/auth/refresh", undefined, {
        headers: { "X-CSRF-TOKEN": getCookie("csrf_refresh_token") },
      });
      return api(originalRequest);
    } catch {
      queryClient.clear();
      window.location.href = "/login";
      return Promise.reject(error);
    }
  },
);
