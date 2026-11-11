import { setupServer } from "msw/node";

// Sin handlers por defecto: cada test declara las respuestas que necesita con
// `server.use(...)`. Si una peticion no tiene handler, el test falla (ver
// `onUnhandledRequest: "error"` en setup.ts) en vez de golpear una red real.
export const server = setupServer();
