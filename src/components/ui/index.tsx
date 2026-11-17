import { useEffect, useRef, useState, createContext, useContext } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { X, ArrowUpDown, ShieldCheck } from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import type { Evidencia } from "../../types";
import { etiqueta, fecha, porcentaje } from "../../lib/formato";
import styles from "./UI.module.css";
export function Button({
  children,
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "danger";
}) {
  return (
    <button
      type="button"
      {...props}
      className={`${styles.button} ${variant ? styles[variant] : ""} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
export function Card({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <section className={styles.card}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  const v = String(children);
  const style = [
    "verificado",
    "aprobada",
    "aprobado",
    "activa",
    "conectada",
    "valido",
    "cliente",
    "aceptado",
    "atendida",
  ].includes(v)
    ? "success"
    : [
          "inferido",
          "pendiente",
          "en_revision",
          "pausada",
          "riesgoso",
          "necesita_revision",
        ].includes(v)
      ? "warning"
      : [
            "excluido",
            "rechazada",
            "invalido",
            "error",
            "baja",
            "perdido",
          ].includes(v)
        ? "error"
        : "info";
  return (
    <span className={`${styles.badge} ${styles[style]}`}>
      {typeof children === "string" ? etiqueta(children) : children}
    </span>
  );
}
export function EvidenceChip({ evidencia: e }: { evidencia: Evidencia }) {
  return (
    <span className="evidence">
      <button
        className={styles.sort}
        aria-label={`Evidencia ${e.campo}: ${e.estado}`}
        type="button"
      >
        <Badge>{e.estado}</Badge>
      </button>
      <span className="tooltip" role="tooltip">
        <strong>{e.campo}</strong>
        <br />
        Fuente: {e.fuente}
        <br />
        {e.url && (
          <>
            <a href={e.url} target="_blank" rel="noreferrer">
              {e.url}
            </a>
            <br />
          </>
        )}
        {e.cita && (
          <>
            «{e.cita}»<br />
          </>
        )}
        Obtenido: {fecha(e.obtenidoEn)}
      </span>
    </span>
  );
}
export function EvidenceList({ items }: { items: Evidencia[] }) {
  return (
    <div className="stack">
      {items.map((e, i) => (
        <div key={i} className="row">
          <strong>{etiqueta(e.campo)}</strong>
          <span>{e.valor ?? "Sin datos"}</span>
          <EvidenceChip evidencia={e} />
        </div>
      ))}
    </div>
  );
}
export function Skeleton() {
  return (
    <div role="status" aria-label="Cargando">
      <div className={styles.skeleton} />
      <div className={styles.skeleton} />
      <span className="srOnly">Cargando…</span>
    </div>
  );
}
export function EmptyState({
  children,
  action,
}: {
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <ShieldCheck size={28} />
      <p>{children ?? "No hay resultados con estos filtros."}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.showModal();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      className={styles.dialog}
      ref={ref}
      onCancel={onClose}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <Button onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </Button>
      </header>
      {children}
    </dialog>
  );
}
export const Drawer = Modal;
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((i) => (
        <button
          key={i}
          role="tab"
          aria-selected={value === i}
          onClick={() => onChange(i)}
        >
          {i}
        </button>
      ))}
    </div>
  );
}
export function KpiTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <small>{label}</small>
      <div className="metric">{value}</div>
      {hint && <small>{hint}</small>}
    </Card>
  );
}
export function FunnelChart({
  items,
}: {
  items: { etapa: string; conteo: number }[];
}) {
  const max = Math.max(...items.map((i) => i.conteo), 1);
  return (
    <div>
      {items.map((item, i) => (
        <div className="funnelRow" key={item.etapa}>
          <span>{etiqueta(item.etapa)}</span>
          <div>
            <div
              className={`funnelBar ${i > 5 ? "commercial" : ""}`}
              style={{
                width: `${(item.conteo / max) * 100}%`,
                minWidth: item.conteo ? 32 : 0,
              }}
            >
              {item.conteo || ""}
            </div>
          </div>
          <small>
            {i === 0 ? "—" : porcentaje(item.conteo, items[i - 1].conteo)}
          </small>
        </div>
      ))}
      <small>
        Distribución actual por etapa; los porcentajes son relaciones entre
        conteos, no conversiones históricas de una cohorte.
      </small>
    </div>
  );
}
export function DiffView({
  before,
  after,
}: {
  before: unknown;
  after: unknown;
}) {
  return (
    <div className="grid">
      <div>
        <small>Versión anterior</small>
        <pre>
          {typeof before === "string"
            ? before
            : JSON.stringify(before, null, 2)}
        </pre>
      </div>
      <div>
        <small>Versión actual</small>
        <pre>
          {typeof after === "string" ? after : JSON.stringify(after, null, 2)}
        </pre>
      </div>
    </div>
  );
}
export function Table<T>({
  data,
  columns,
}: {
  data: T[];
  columns: ColumnDef<T>[];
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  if (!data.length) return <EmptyState />;
  return (
    <>
      <div className="scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => (
                  <th key={h.id}>
                    <button
                      className={styles.sort}
                      onClick={h.column.getToggleSortingHandler()}
                      disabled={!h.column.getCanSort()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}{" "}
                      {h.column.getCanSort() && <ArrowUpDown size={10} />}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id}>
                {r.getVisibleCells().map((c) => (
                  <td key={c.id}>
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.pagination}>
        <small>
          {data.length} registros · Página{" "}
          {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
        </small>
        <div className="row">
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Anterior
          </Button>
          <Button
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </>
  );
}
interface Confirmation {
  title: string;
  summary: ReactNode;
  run: () => Promise<unknown>;
  reason?: boolean;
  onReason?: (s: string) => void;
}
const Feedback = createContext<{
  notify: (s: string) => void;
  confirm: (v: Confirmation) => void;
}>({ notify: () => {}, confirm: () => {} });
export const useFeedback = () => useContext(Feedback);
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 6500);
      return () => clearTimeout(timer);
    }
  }, [message]);
  return (
    <Feedback.Provider
      value={{
        notify: setMessage,
        confirm: (v) => {
          setReason("");
          setError("");
          setConfirmation(v);
        },
      }}
    >
      {children}
      <div aria-live="polite">
        {message && <div className={styles.toast}>{message}</div>}
      </div>
      {confirmation && (
        <Modal
          title={confirmation.title}
          onClose={() => {
            if (!busy) setConfirmation(null);
          }}
        >
          <div>{confirmation.summary}</div>
          {confirmation.reason && (
            <label>
              Motivo obligatorio
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  confirmation.onReason?.(e.target.value);
                }}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="danger">
              {error}
            </p>
          )}
          <footer>
            <Button disabled={busy} onClick={() => setConfirmation(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={
                busy || (confirmation.reason && reason.trim().length < 3)
              }
              onClick={async () => {
                setBusy(true);
                try {
                  await confirmation.run();
                  setConfirmation(null);
                  setMessage("Cambio guardado correctamente.");
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "No se pudo guardar",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Guardando…" : "Confirmar"}
            </Button>
          </footer>
        </Modal>
      )}
    </Feedback.Provider>
  );
}
export function QueryState({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: Error | null;
  retry: () => unknown;
  children: ReactNode;
}) {
  if (loading) return <Skeleton />;
  if (error)
    return (
      <Card>
        <p role="alert">{error.message}</p>
        <Button onClick={retry}>Reintentar</Button>
      </Card>
    );
  return <>{children}</>;
}
