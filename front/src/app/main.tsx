import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { Providers } from "./providers";
import { router } from "./router";

const root = document.getElementById("root");

if (!root) {
  throw new Error("No existe el elemento #root en index.html");
}

createRoot(root).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
