/** Lo que devuelve GET /api/v1/health. Refleja la respuesta real del backend. */
export type Health = {
  status: "ok" | "error";
  database: "ok" | "error";
  environment: string;
};
