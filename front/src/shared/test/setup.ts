import "@testing-library/jest-dom/vitest";

import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server";

// jsdom no trae PointerEvent y el Checkbox de Chakra (zag-js) lo construye al
// perder el foco. Con MouseEvent como base, el evento llega con los mismos datos.
if (!window.PointerEvent) {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
