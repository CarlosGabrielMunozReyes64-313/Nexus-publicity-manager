import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { request } from "../../api/client";
import * as S from "../../api/schemas";
import { Button, Modal, useFeedback } from "../../components/ui";
import type { Empresa } from "../../types";

type Coincidencia = z.infer<typeof S.coincidenciaEmpresaSchema>;
const normal = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Nuevo contacto con su empresa en la misma pantalla.
 *
 * La empresa se busca entre las existentes o se crea aquí mismo. Todo se guarda en una
 * sola operación del servidor: si el contacto falla, no queda una empresa creada a medias.
 * Ante un error los campos escritos se conservan. */
export default function NuevoContacto({
  empresas,
  onClose,
}: {
  empresas: Empresa[];
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const [contacto, setContacto] = useState({
    nombre: "",
    correo: "",
    cargo: "",
    telefono: "",
  });
  const [modo, setModo] = useState<"existente" | "nueva">("existente");
  const [buscar, setBuscar] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [nueva, setNueva] = useState({
    razonSocial: "",
    municipio: "",
    sector: "",
    sitioWeb: "",
    nit: "",
  });
  const [parecidas, setParecidas] = useState<Coincidencia[] | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const activas = empresas.filter(
    (e) => !("fusionadaEnId" in e && e.fusionadaEnId),
  );
  const resultados = buscar.trim()
    ? activas
        .filter((e) =>
          normal(`${e.razonSocial} ${e.municipio} ${e.dominio ?? ""}`).includes(
            normal(buscar),
          ),
        )
        .slice(0, 8)
    : [];
  const elegida = activas.find((e) => e.id === empresaId);

  const guardar = async (confirmarNueva = false) => {
    setError("");
    setOcupado(true);
    try {
      if (modo === "nueva" && !confirmarNueva) {
        const c = await request(
          "/empresas/coincidencias",
          S.coincidenciaEmpresaSchema.array(),
          "POST",
          nueva,
        );
        if (c.length) {
          setParecidas(c);
          return;
        }
      }
      const r = await request(
        "/contactos/con-empresa",
        S.contactoCreadoSchema,
        "POST",
        {
          contacto: {
            nombre: contacto.nombre,
            correo: contacto.correo || undefined,
            cargo: contacto.cargo || undefined,
            telefono: contacto.telefono || undefined,
            origen: "manual",
            baseLegal: { tipo: "pendiente" },
          },
          ...(modo === "existente"
            ? { empresaId }
            : {
                empresaNueva: Object.fromEntries(
                  Object.entries(nueva).filter(([, v]) => v.trim()),
                ),
                confirmarEmpresaNueva: confirmarNueva,
              }),
        },
      );
      await cache.invalidateQueries();
      notify(
        r.empresaCreada ? "Contacto y empresa creados." : "Contacto creado.",
      );
      onClose();
      navigate(`/contactos/${r.id}`);
    } catch (e) {
      // Los campos se conservan: solo se muestra el motivo.
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setOcupado(false);
    }
  };

  const puedeGuardar =
    contacto.nombre.trim() &&
    (modo === "existente"
      ? Boolean(empresaId)
      : Boolean(nueva.razonSocial.trim()));
  return (
    <Modal title="Nuevo contacto" onClose={() => !ocupado && onClose()}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          setParecidas(null);
          void guardar();
        }}
      >
        <fieldset className="stack">
          <legend>Contacto</legend>
          <label>
            Nombre
            <input
              required
              value={contacto.nombre}
              onChange={(e) =>
                setContacto({ ...contacto, nombre: e.target.value })
              }
            />
          </label>
          <label>
            Correo
            <input
              type="email"
              value={contacto.correo}
              onChange={(e) =>
                setContacto({ ...contacto, correo: e.target.value })
              }
            />
          </label>
          <label>
            Cargo
            <input
              value={contacto.cargo}
              onChange={(e) =>
                setContacto({ ...contacto, cargo: e.target.value })
              }
            />
          </label>
          <label>
            Teléfono
            <input
              inputMode="tel"
              value={contacto.telefono}
              onChange={(e) =>
                setContacto({ ...contacto, telefono: e.target.value })
              }
            />
          </label>
        </fieldset>
        <fieldset className="stack">
          <legend>Empresa</legend>
          <div className="row" role="radiogroup" aria-label="Empresa">
            <label className="row">
              <input
                type="radio"
                checked={modo === "existente"}
                onChange={() => setModo("existente")}
              />{" "}
              Buscar empresa existente
            </label>
            <label className="row">
              <input
                type="radio"
                checked={modo === "nueva"}
                onChange={() => {
                  setModo("nueva");
                  if (!nueva.razonSocial && buscar)
                    setNueva({ ...nueva, razonSocial: buscar });
                }}
              />{" "}
              Crear empresa
            </label>
          </div>
          {modo === "existente" ? (
            <>
              <label>
                Buscar empresa
                <input
                  value={buscar}
                  placeholder="Razón social, municipio o dominio"
                  onChange={(e) => setBuscar(e.target.value)}
                />
              </label>
              {elegida && (
                <p>
                  Elegida: <strong>{elegida.razonSocial}</strong> (
                  {elegida.municipio || "sin municipio"}){" "}
                  <Button onClick={() => setEmpresaId("")}>Cambiar</Button>
                </p>
              )}
              {!elegida && resultados.length > 0 && (
                <ul className="list" aria-label="Empresas encontradas">
                  {resultados.map((e) => (
                    <li key={e.id}>
                      <Button onClick={() => setEmpresaId(e.id)}>
                        {e.razonSocial} · {e.municipio || "sin municipio"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {!elegida && buscar.trim() && !resultados.length && (
                <p className="muted">
                  No hay empresas con ese nombre.{" "}
                  <Button
                    onClick={() => {
                      setModo("nueva");
                      setNueva({ ...nueva, razonSocial: buscar });
                    }}
                  >
                    Crear empresa «{buscar}»
                  </Button>
                </p>
              )}
            </>
          ) : (
            <>
              <label>
                Razón social
                <input
                  required
                  value={nueva.razonSocial}
                  onChange={(e) =>
                    setNueva({ ...nueva, razonSocial: e.target.value })
                  }
                />
              </label>
              <label>
                Municipio
                <input
                  value={nueva.municipio}
                  onChange={(e) =>
                    setNueva({ ...nueva, municipio: e.target.value })
                  }
                />
              </label>
              <label>
                Sector
                <input
                  value={nueva.sector}
                  onChange={(e) =>
                    setNueva({ ...nueva, sector: e.target.value })
                  }
                />
              </label>
              <label>
                Sitio web
                <input
                  value={nueva.sitioWeb}
                  onChange={(e) =>
                    setNueva({ ...nueva, sitioWeb: e.target.value })
                  }
                />
              </label>
              <label>
                NIT
                <input
                  value={nueva.nit}
                  onChange={(e) => setNueva({ ...nueva, nit: e.target.value })}
                />
              </label>
            </>
          )}
        </fieldset>
        {parecidas && (
          <div className="notice warning" role="alert">
            <p>Ya existen empresas parecidas. ¿Es alguna de estas?</p>
            <ul className="list">
              {parecidas.map((p) => (
                <li key={p.id}>
                  {p.razonSocial} ({p.municipio || "sin municipio"}) ·{" "}
                  {p.motivo}{" "}
                  <Button
                    onClick={() => {
                      setModo("existente");
                      setEmpresaId(p.id);
                      setParecidas(null);
                    }}
                  >
                    Usar esta
                  </Button>
                </li>
              ))}
            </ul>
            {!parecidas.some((p) => p.exacta) && (
              <Button
                onClick={() => {
                  setParecidas(null);
                  void guardar(true);
                }}
              >
                Es otra empresa: crearla
              </Button>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="danger">
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={ocupado || !puedeGuardar}
        >
          {ocupado
            ? "Guardando…"
            : modo === "nueva"
              ? "Crear contacto y empresa"
              : "Crear contacto"}
        </Button>
      </form>
    </Modal>
  );
}
