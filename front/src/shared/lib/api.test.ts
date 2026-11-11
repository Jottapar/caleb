import { http, HttpResponse } from "msw";

import { queryClient } from "./queryClient";
import { server } from "../test/server";
import { api } from "./api";

it("ante un 401 intenta refrescar el token y reintenta la petición original", async () => {
  let intentos = 0;
  server.use(
    http.get("/api/v1/protegido", () => {
      intentos += 1;
      if (intentos === 1) {
        return HttpResponse.json({ error: "unauthorized", message: "x" }, { status: 401 });
      }
      return HttpResponse.json({ ok: true });
    }),
    http.post("/api/v1/auth/refresh", () => HttpResponse.json({ message: "Token renovado" })),
  );

  const response = await api.get("/protegido");

  expect(response.data).toEqual({ ok: true });
  expect(intentos).toBe(2);
});

it("si el refresh también falla, limpia la sesión y no deja pasar la petición", async () => {
  queryClient.setQueryData(["me"], { user_name: "Johan", company_name: "Panadería Luna" });
  server.use(
    http.get("/api/v1/protegido", () =>
      HttpResponse.json({ error: "unauthorized", message: "x" }, { status: 401 }),
    ),
    http.post("/api/v1/auth/refresh", () =>
      HttpResponse.json({ error: "unauthorized", message: "x" }, { status: 401 }),
    ),
  );

  await expect(api.get("/protegido")).rejects.toMatchObject({ response: { status: 401 } });
  expect(queryClient.getQueryData(["me"])).toBeUndefined();
});
