import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { vi } from "vitest";

import { CompanyName } from "../../auth";
import { cropImage } from "../../../shared/lib/cropImage";
import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { CompanyPage } from "./CompanyPage";

// jsdom no carga imágenes ni mide nada (no trae ResizeObserver), así que el Cropper real no
// funciona aquí. Se reemplaza solo esta librería de terceros por un componente que, al montarse,
// avisa de un área elegida fija, como haría el real cuando el usuario termina de recortar.
// `avisarArea` en false simula el rato en que el Cropper real todavía está cargando la imagen y
// no ha calculado ningún área.
const cropper = vi.hoisted(() => ({ avisarArea: true }));
beforeEach(() => {
  cropper.avisarArea = true;
});

vi.mock("react-easy-crop", async () => {
  const { useEffect } = await import("react");
  const area = { x: 0, y: 0, width: 100, height: 100 };
  function CropperFalso({
    onCropComplete,
  }: {
    onCropComplete: (a: typeof area, b: typeof area) => void;
  }) {
    useEffect(() => {
      if (cropper.avisarArea) {
        onCropComplete(area, area);
      }
    }, [onCropComplete]);
    return <div />;
  }
  return { default: CropperFalso };
});

// jsdom tampoco dibuja en un <canvas>. El archivo "recortado" que devuelve lleva el texto
// "recortado" dentro, para poder distinguirlo del original en lo que se envía al backend.
vi.mock("../../../shared/lib/cropImage", () => ({
  cropImage: vi.fn(
    async (_src: string, _area: unknown, nombre: string, tipo: string) =>
      new File(["recortado"], nombre, { type: tipo }),
  ),
}));

const URL = "/api/v1/company";

const EMPRESA = {
  nombre: "Panadería Luna",
  documento_fiscal: "9001234567",
  direccion: "Calle 1 # 2-3",
  telefono: "3001234567",
  email: "contacto@luna.com",
};

function renderPage() {
  renderWithProviders([{ path: "/", element: <CompanyPage /> }]);
}

it("muestra en el formulario los datos actuales de la empresa", async () => {
  server.use(http.get(URL, () => HttpResponse.json(EMPRESA)));

  renderPage();

  expect(await screen.findByLabelText(/nombre/i)).toHaveValue("Panadería Luna");
  expect(screen.getByLabelText(/nit/i)).toHaveValue("9001234567");
  expect(screen.getByLabelText(/dirección/i)).toHaveValue("Calle 1 # 2-3");
  expect(screen.getByLabelText(/teléfono/i)).toHaveValue("3001234567");
  expect(screen.getByLabelText(/correo/i)).toHaveValue("contacto@luna.com");
});

it("guarda los cambios, avisa que se guardaron y el encabezado muestra el nombre nuevo", async () => {
  // El nombre vive en un solo lugar, como en el backend: /company y /auth/me lo leen del mismo sitio.
  let empresa = { ...EMPRESA };
  server.use(
    http.get(URL, () => HttpResponse.json(empresa)),
    http.get("/api/v1/auth/me", () =>
      HttpResponse.json({ user_name: "Johan", company_name: empresa.nombre }),
    ),
    http.patch(URL, async ({ request }) => {
      empresa = { ...empresa, ...((await request.json()) as Partial<typeof EMPRESA>) };
      return HttpResponse.json(empresa);
    }),
  );
  const user = userEvent.setup();

  // CompanyName es el nombre del encabezado de la app (lo pinta el Layout).
  renderWithProviders([
    {
      path: "/",
      element: (
        <>
          <CompanyName />
          <CompanyPage />
        </>
      ),
    },
  ]);
  expect(await screen.findByText("Panadería Luna", { selector: "p" })).toBeInTheDocument();

  const nombre = await screen.findByLabelText(/nombre/i);
  await user.clear(nombre);
  await user.type(nombre, "Panadería Sol");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();
  expect(await screen.findByText("Panadería Sol", { selector: "p" })).toBeInTheDocument();
});

it.each([
  { campo: /nit/i, valor: "900.123.456-7", error: "El NIT solo puede tener números" },
  { campo: /teléfono/i, valor: "300 123", error: "El teléfono solo puede tener números" },
  {
    campo: /correo/i,
    valor: "sinarroba",
    error: "Escribe un correo válido, por ejemplo nombre@dominio.com",
  },
])("con $valor muestra el error junto al campo y no envía nada", async ({ campo, valor, error }) => {
  let enviado = false;
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.patch(URL, () => {
      enviado = true;
      return HttpResponse.json(EMPRESA);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const input = await screen.findByLabelText(campo);
  await user.clear(input);
  await user.type(input, valor);
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText(error)).toBeInTheDocument();
  expect(screen.getByLabelText(campo)).toBeInvalid();
  expect(enviado).toBe(false);
});

it("muestra el mensaje del backend cuando rechaza el guardado", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.patch(URL, () =>
      HttpResponse.json(
        { error: "business_error", message: "El nombre de la empresa es obligatorio" },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.clear(await screen.findByLabelText(/nombre/i));
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("El nombre de la empresa es obligatorio")).toBeInTheDocument();
  expect(screen.queryByText(/datos guardados/i)).not.toBeInTheDocument();
});

it("quita el aviso de guardado cuando se intenta guardar de nuevo", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.patch(URL, () => HttpResponse.json(EMPRESA)),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /guardar/i }));
  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();

  // Ahora un NIT invalido: el formulario no envia, y el aviso viejo no debe quedarse.
  const nit = screen.getByLabelText(/nit/i);
  await user.clear(nit);
  await user.type(nit, "abc");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("El NIT solo puede tener números")).toBeInTheDocument();
  expect(screen.queryByText(/datos guardados/i)).not.toBeInTheDocument();
});

it("envía los datos sin espacios alrededor y los muestra así", async () => {
  let recibido: Record<string, string> = {};
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.patch(URL, async ({ request }) => {
      recibido = (await request.json()) as Record<string, string>;
      return HttpResponse.json({ ...EMPRESA, ...recibido });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const nit = await screen.findByLabelText(/nit/i);
  await user.clear(nit);
  await user.type(nit, " 9007654321 ");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();
  expect(recibido.documento_fiscal).toBe("9007654321");
  expect(screen.getByLabelText(/nit/i)).toHaveValue("9007654321");
});

const ME = "/api/v1/auth/me";

// Un archivo de mentira con el tipo y el peso pedidos: el contenido no importa, solo su tipo y peso.
function imagen(nombre = "logo.png", tipo = "image/png", bytes = 100) {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}

// Elige el archivo y confirma el recorte: el camino que ahora sigue un logo hasta quedar elegido.
async function elegirLogo(user: ReturnType<typeof userEvent.setup>, archivo = imagen()) {
  await user.upload(await screen.findByLabelText(/^logo$/i), archivo);
  await user.click(await screen.findByRole("button", { name: /^recortar$/i }));
}

it("al elegir una imagen válida se abre el recorte y todavía no hay vista previa", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.upload(await screen.findByLabelText(/^logo$/i), imagen());

  expect(await screen.findByRole("dialog", { name: /recortar logo/i })).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: /vista previa del logo/i })).not.toBeInTheDocument();
});

it("al confirmar el recorte se cierra el diálogo y se muestra la vista previa", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.upload(await screen.findByLabelText(/^logo$/i), imagen());
  await user.click(await screen.findByRole("button", { name: /^recortar$/i }));

  expect(await screen.findByRole("img", { name: /vista previa del logo/i })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("al guardar tras confirmar el recorte se envía el archivo recortado y no el original", async () => {
  let cuerpoDelLogo = "";
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
    http.patch(URL, () => HttpResponse.json(EMPRESA)),
    http.put(`${URL}/logo`, async ({ request }) => {
      cuerpoDelLogo = await request.text();
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  // El original es PNG y el recorte sale como WebP: el navegador puede devolver otro tipo del
  // pedido. Del archivo que sale de jsdom solo sobrevive su tipo (ni nombre ni contenido), y
  // con él se distingue cuál de los dos viajó.
  vi.mocked(cropImage).mockResolvedValueOnce(
    new File(["recortado"], "logo.png", { type: "image/webp" }),
  );

  renderPage();
  await elegirLogo(user, imagen("logo.png", "image/png"));
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();
  expect(cuerpoDelLogo).toContain("Content-Type: image/webp");
  expect(cuerpoDelLogo).not.toContain("Content-Type: image/png");
});

it("si el archivo recortado pesa más de 5 MB muestra su mensaje y no queda elegido", async () => {
  let subido = false;
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
    http.patch(URL, () => HttpResponse.json(EMPRESA)),
    http.put(`${URL}/logo`, () => {
      subido = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  vi.mocked(cropImage).mockResolvedValueOnce(
    imagen("logo.png", "image/png", 5 * 1024 * 1024 + 1),
  );
  const user = userEvent.setup();

  renderPage();
  await elegirLogo(user);

  expect(await screen.findByText("El logo no puede pesar más de 5 MB")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("img", { name: /vista previa del logo/i })).not.toBeInTheDocument();

  // Guardar los demás datos sigue funcionando, pero sin el logo rechazado.
  await user.click(screen.getByRole("button", { name: /guardar/i }));
  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();
  expect(subido).toBe(false);
});

it("al cancelar el recorte se cierra el diálogo, el campo queda vacío y el logo actual no cambia", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({
        user_name: "Johan",
        company_name: "Panadería Luna",
        logo_version: "empresas/1/logo-abc.png",
      }),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const campo = (await screen.findByLabelText(/^logo$/i)) as HTMLInputElement;
  await user.upload(campo, imagen());
  await user.click(await screen.findByRole("button", { name: /^cancelar$/i }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(campo.value).toBe("");
  expect(screen.queryByRole("img", { name: /vista previa del logo/i })).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: /logo de la empresa/i })).toBeInTheDocument();
});

it("el recorte explica que se arrastra la imagen y que se puede hacer zoom", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.upload(await screen.findByLabelText(/^logo$/i), imagen());

  expect(
    await screen.findByText(
      "Arrastra la imagen para moverla. Usa el deslizador o la rueda del ratón para acercar.",
    ),
  ).toBeInTheDocument();
});

it("el recorte tiene un deslizador de zoom de 1 a 3 que se puede mover", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.upload(await screen.findByLabelText(/^logo$/i), imagen());
  const zoom = await screen.findByRole("slider", { name: /zoom/i });

  expect(zoom).toHaveAttribute("aria-valuemin", "1");
  expect(zoom).toHaveAttribute("aria-valuemax", "3");
  expect(zoom).toHaveAttribute("aria-valuenow", "1");

  zoom.focus();
  await user.keyboard("{ArrowRight}");

  expect(Number(zoom.getAttribute("aria-valuenow"))).toBeGreaterThan(1);
});

it("si el recorte falla muestra un mensaje en el diálogo y se puede cancelar", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
  );
  vi.mocked(cropImage).mockRejectedValueOnce(new Error("No se pudo abrir la imagen"));
  const user = userEvent.setup();

  renderPage();
  await user.upload(await screen.findByLabelText(/^logo$/i), imagen());
  await user.click(await screen.findByRole("button", { name: /^recortar$/i }));

  expect(
    await screen.findByText("No se pudo recortar la imagen. Prueba con otra."),
  ).toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: /recortar logo/i })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /^cancelar$/i }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("mientras se recorta, Recortar queda deshabilitado y un segundo clic no recorta otra vez", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
  );
  // El recorte queda "en curso" hasta que el test lo termine a mano.
  let terminarRecorte!: (archivo: File) => void;
  vi.mocked(cropImage).mockClear();
  vi.mocked(cropImage).mockImplementationOnce(
    () => new Promise<File>((resolve) => (terminarRecorte = resolve)),
  );
  const user = userEvent.setup();

  renderPage();
  await user.upload(await screen.findByLabelText(/^logo$/i), imagen());
  const recortar = await screen.findByRole("button", { name: /^recortar$/i });
  await user.click(recortar);

  expect(recortar).toBeDisabled();
  await user.click(recortar);
  expect(cropImage).toHaveBeenCalledTimes(1);

  await act(async () => terminarRecorte(imagen()));
  expect(await screen.findByRole("img", { name: /vista previa del logo/i })).toBeInTheDocument();
});

it("al pulsar Esc se cierra el recorte igual que al cancelar", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const campo = (await screen.findByLabelText(/^logo$/i)) as HTMLInputElement;
  await user.upload(campo, imagen());
  await screen.findByRole("dialog", { name: /recortar logo/i });
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(campo.value).toBe("");
  expect(screen.queryByRole("img", { name: /vista previa del logo/i })).not.toBeInTheDocument();
});

it("si se elige otro archivo y se cancela el recorte, se conserva el logo ya confirmado", async () => {
  let logosEnviados = 0;
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
    http.patch(URL, () => HttpResponse.json(EMPRESA)),
    http.put(`${URL}/logo`, () => {
      logosEnviados += 1;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await elegirLogo(user); // logo A: recortado y confirmado
  await user.upload(await screen.findByLabelText(/^logo$/i), imagen("otro.png")); // archivo B
  await user.click(await screen.findByRole("button", { name: /^cancelar$/i }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: /vista previa del logo/i })).toBeInTheDocument();

  // Guardar sigue enviando el logo A.
  await user.click(screen.getByRole("button", { name: /guardar/i }));
  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();
  expect(logosEnviados).toBe(1);
});

it("un archivo rechazado por su formato tampoco borra el logo ya confirmado", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
  );
  // Sin applyAccept: ver el comentario del test de archivos rechazados.
  const user = userEvent.setup({ applyAccept: false });

  renderPage();
  await elegirLogo(user);
  await user.upload(
    await screen.findByLabelText(/^logo$/i),
    imagen("logo.gif", "image/gif"),
  );

  expect(screen.getByText("El logo debe ser una imagen PNG, JPG o WebP")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /vista previa del logo/i })).toBeInTheDocument();
});

it("si se sale de la pantalla con el recorte abierto, se libera la imagen original", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
  );
  // `URL` es aquí la ruta de la API, por eso se llega al URL del navegador por globalThis.
  const crear = vi.spyOn(globalThis.URL, "createObjectURL");
  const liberar = vi.spyOn(globalThis.URL, "revokeObjectURL");
  const user = userEvent.setup();

  const { unmount } = renderWithProviders([{ path: "/", element: <CompanyPage /> }]);
  await user.upload(await screen.findByLabelText(/^logo$/i), imagen());
  await screen.findByRole("dialog", { name: /recortar logo/i });
  const direccionDeLaImagen = crear.mock.results[0].value;

  unmount();

  expect(liberar).toHaveBeenCalledWith(direccionDeLaImagen);
  crear.mockRestore();
  liberar.mockRestore();
});

it("Recortar queda deshabilitado hasta que el recorte tiene un área elegida", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
  );
  cropper.avisarArea = false;
  const user = userEvent.setup();

  renderPage();
  await user.upload(await screen.findByLabelText(/^logo$/i), imagen());

  expect(await screen.findByRole("button", { name: /^recortar$/i })).toBeDisabled();
});

it("al confirmar el recorte el campo del archivo queda vacío, para poder elegir el mismo archivo otra vez", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const campo = (await screen.findByLabelText(/^logo$/i)) as HTMLInputElement;
  await user.upload(campo, imagen());
  await user.click(await screen.findByRole("button", { name: /^recortar$/i }));

  expect(await screen.findByRole("img", { name: /vista previa del logo/i })).toBeInTheDocument();
  expect(campo.value).toBe("");
});

it("una foto original de más de 5 MB sí abre el recorte", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  // El peso que se valida es el del recorte, no el de la foto original.
  await user.upload(
    await screen.findByLabelText(/^logo$/i),
    imagen("foto.jpg", "image/jpeg", 5 * 1024 * 1024 + 1),
  );

  expect(await screen.findByRole("dialog", { name: /recortar logo/i })).toBeInTheDocument();
  expect(screen.queryByText(/no puede pesar más de 5 MB/i)).not.toBeInTheDocument();
});

it("al elegir un logo muestra la vista previa y no lo sube hasta pulsar Guardar", async () => {
  let subido = false;
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
    http.put(`${URL}/logo`, () => {
      subido = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await elegirLogo(user);

  expect(screen.getByRole("img", { name: /vista previa del logo/i })).toBeInTheDocument();
  expect(subido).toBe(false);
});

it("al guardar con un logo elegido manda primero los datos y después el logo", async () => {
  const orden: string[] = [];
  let cuerpoDelLogo = "";
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
    http.patch(URL, () => {
      orden.push("datos");
      return HttpResponse.json(EMPRESA);
    }),
    http.put(`${URL}/logo`, async ({ request }) => {
      orden.push("logo");
      // Cuerpo crudo y no `request.formData()`: el File de jsdom no es el de Node y el analizador
      // de multipart de undici lo rechaza. Por la misma razon, al pasar de jsdom a undici el File
      // se vuelve un Blob y pierde su nombre: aqui solo se puede ver el campo y el tipo.
      cuerpoDelLogo = await request.text();
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await elegirLogo(user);
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  // El aviso de éxito espera a que termine todo: cuando aparece, los dos envíos ya ocurrieron.
  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();
  expect(orden).toEqual(["datos", "logo"]);
  expect(cuerpoDelLogo).toContain('name="file"');
  expect(cuerpoDelLogo).toContain("Content-Type: image/png");
});

it.each([
  {
    caso: "no es PNG, JPG ni WebP",
    archivo: () => imagen("logo.gif", "image/gif"),
    mensaje: "El logo debe ser una imagen PNG, JPG o WebP",
  },
])("un archivo que $caso muestra su mensaje y no lo sube", async ({ archivo, mensaje }) => {
  let subido = false;
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
    http.patch(URL, () => HttpResponse.json(EMPRESA)),
    http.put(`${URL}/logo`, () => {
      subido = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  // Sin applyAccept: el selector de archivos del navegador filtra por `accept`, pero el usuario
  // puede elegir "Todos los archivos"; aqui se prueba lo que pasa cuando eso ocurre.
  const user = userEvent.setup({ applyAccept: false });

  renderPage();
  await user.upload(await screen.findByLabelText(/^logo$/i), archivo());

  expect(screen.getByText(mensaje)).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("img", { name: /vista previa del logo/i })).not.toBeInTheDocument();

  // Guardar los demas datos sigue funcionando, pero sin el logo rechazado.
  await user.click(screen.getByRole("button", { name: /guardar/i }));
  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();
  expect(subido).toBe(false);
});

it("si el backend rechaza el logo muestra su mensaje y no avisa que se guardó", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
    http.patch(URL, () => HttpResponse.json(EMPRESA)),
    // Lo que el front no puede revisar solo (los pixeles, una imagen danada) lo dice el backend.
    http.put(`${URL}/logo`, () =>
      HttpResponse.json(
        { message: "La imagen está dañada y no se puede abrir" },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await elegirLogo(user);
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText(/La imagen está dañada y no se puede abrir/)).toBeInTheDocument();
  expect(screen.queryByText(/datos guardados/i)).not.toBeInTheDocument();
});

it("si los datos se guardan pero el logo falla, el aviso dice que los datos sí se guardaron", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
    http.patch(URL, () => HttpResponse.json(EMPRESA)),
    http.put(`${URL}/logo`, () =>
      HttpResponse.json({ message: "La imagen está dañada y no se puede abrir" }, { status: 422 }),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await elegirLogo(user);
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(
    await screen.findByText(
      "Los datos se guardaron, pero el logo no: La imagen está dañada y no se puede abrir",
    ),
  ).toBeInTheDocument();
});

it("quitar el logo actual y guardar manda los datos y luego el borrado del logo", async () => {
  const orden: string[] = [];
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({
        user_name: "Johan",
        company_name: "Panadería Luna",
        logo_version: "empresas/1/logo-abc.png",
      }),
    ),
    http.patch(URL, () => {
      orden.push("datos");
      return HttpResponse.json(EMPRESA);
    }),
    http.delete(`${URL}/logo`, () => {
      orden.push("quitar logo");
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  expect(await screen.findByRole("img", { name: /logo de la empresa/i })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /quitar logo/i }));

  // Quitarlo solo lo marca: sigue sin borrarse nada hasta pulsar Guardar.
  expect(screen.queryByRole("img", { name: /logo de la empresa/i })).not.toBeInTheDocument();
  expect(orden).toEqual([]);

  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();
  expect(orden).toEqual(["datos", "quitar logo"]);
});

it("después de guardar con un logo, guardar otra vez no lo vuelve a enviar", async () => {
  let guardadosDeDatos = 0;
  let logosEnviados = 0;
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
    http.patch(URL, () => {
      guardadosDeDatos += 1;
      return HttpResponse.json(EMPRESA);
    }),
    http.put(`${URL}/logo`, () => {
      logosEnviados += 1;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await elegirLogo(user);
  await user.click(screen.getByRole("button", { name: /guardar/i }));
  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();
  // El logo ya quedo guardado: la vista previa del archivo elegido ya no tiene sentido.
  expect(screen.queryByRole("img", { name: /vista previa del logo/i })).not.toBeInTheDocument();

  // Un cambio cualquiera y otro Guardar: solo viajan los datos.
  const telefono = screen.getByLabelText(/teléfono/i);
  await user.clear(telefono);
  await user.type(telefono, "3009999999");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  await waitFor(() => expect(guardadosDeDatos).toBe(2));
  expect(logosEnviados).toBe(1);
});

it("quitar el logo avisa que se quitará al guardar, y deshacer lo devuelve sin borrar nada", async () => {
  let borrado = false;
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.get(ME, () =>
      HttpResponse.json({
        user_name: "Johan",
        company_name: "Panadería Luna",
        logo_version: "empresas/1/logo-abc.png",
      }),
    ),
    http.patch(URL, () => HttpResponse.json(EMPRESA)),
    http.delete(`${URL}/logo`, () => {
      borrado = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /quitar logo/i }));

  expect(screen.getByText(/el logo se quitará al guardar/i)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /deshacer/i }));

  expect(screen.getByRole("img", { name: /logo de la empresa/i })).toBeInTheDocument();
  expect(screen.queryByText(/el logo se quitará al guardar/i)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /guardar/i }));
  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();
  expect(borrado).toBe(false);
});

it("no muestra el formulario hasta saber cuál es el logo actual", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    // /auth/me tarda: los datos de la empresa llegan antes que el logo.
    http.get(ME, async () => {
      await delay(300);
      return HttpResponse.json({
        user_name: "Johan",
        company_name: "Panadería Luna",
        logo_version: "empresas/1/logo-abc.png",
      });
    }),
  );

  renderPage();

  // En cuanto el formulario aparece, el logo actual ya tiene que estar: si no, se vería un
  // instante "sin logo" y se podría subir uno nuevo a ciegas.
  await screen.findByLabelText(/nombre/i);
  expect(screen.getByRole("img", { name: /logo de la empresa/i })).toBeInTheDocument();
});
