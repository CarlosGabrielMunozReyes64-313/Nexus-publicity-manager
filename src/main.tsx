import React from "react";
import ReactDOM from "react-dom/client";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import App from "./app/App";
import { ApiError, esSesionVencida } from "./api/client";
import { MODO_DEMO } from "./lib/modo";
import "./styles/global.css";
function mostrarError(mensaje: string) {
  const root = document.getElementById("root")!;
  root.textContent = "";
  const caja = document.createElement("div");
  caja.setAttribute("role", "alert");
  caja.style.cssText =
    "max-width:36rem;margin:15vh auto;padding:0 1rem;font-family:system-ui,sans-serif;line-height:1.5";
  const titulo = document.createElement("h1");
  titulo.textContent = "No se pudo iniciar la aplicación";
  const texto = document.createElement("p");
  texto.textContent = mensaje;
  caja.append(titulo, texto);
  root.append(caja);
}
async function start() {
  if (MODO_DEMO) {
    try {
      const { worker } = await import("./mocks/browser");
      await worker.start({ onUnhandledRequest: "bypass" });
    } catch {
      throw new Error(
        "El modo demostración usa un service worker y necesita abrirse con «npm run dev», «npm run preview» o un servidor HTTPS/localhost. No abra dist/index.html directamente.",
      );
    }
  }
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      // Una sesión vencida en cualquier pantalla vuelve a comprobar la sesión;
      // la ruta protegida decide entonces si se debe iniciar sesión de nuevo.
      onError: (error, query) => {
        if (esSesionVencida(error) && query.queryKey[0] !== "/auth/session")
          void client.invalidateQueries({ queryKey: ["/auth/session"] });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (esSesionVencida(error))
          void client.invalidateQueries({ queryKey: ["/auth/session"] });
      },
    }),
    defaultOptions: {
      queries: {
        // Un 4xx no mejora reintentando; un fallo de red o del servidor sí.
        retry: (fallos, error) =>
          !(
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) && fallos < 2,
        refetchOnWindowFocus: false,
        staleTime: 15000,
      },
    },
  });
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
start().catch((error: unknown) => {
  mostrarError(
    error instanceof Error && error.message
      ? error.message
      : "Revise la configuración (archivo .env) y recargue la página.",
  );
});
