import { useResource, useAction } from "../api/hooks";
import { useFeedback, QueryState } from "../components/ui";
import type { z } from "zod";
import type { ReactNode } from "react";
export function Intro({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="pageIntro">
      <div>
        <div className="eyebrow">Nexus / Gestión de relaciones</div>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function useCommand() {
  const mutation = useAction();
  const { confirm, notify } = useFeedback();
  const run = (path: string, body?: unknown, method = "POST") =>
    mutation.mutateAsync({ path, body, method });
  const ask = (
    title: string,
    summary: ReactNode,
    path: string,
    body?: unknown,
    method = "POST",
  ) => confirm({ title, summary, run: () => run(path, body, method) });
  const save = async (path: string, body?: unknown, method = "POST") => {
    try {
      await run(path, body, method);
      notify("Cambios guardados.");
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error al guardar");
      return false;
    }
  };
  return { run, ask, save, confirm, notify, pending: mutation.isPending };
}
export function Resource<T>({
  path,
  schema,
  children,
}: {
  path: string;
  schema: z.ZodType<T>;
  children: (data: T) => ReactNode;
}) {
  const q = useResource(path, schema);
  return (
    <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
      {q.data && children(q.data)}
    </QueryState>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
  all = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
  all?: boolean;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {all && <option value="">Todos</option>}
        {options.map((o) => {
          const value = typeof o === "string" ? o : o.value;
          return (
            <option key={value} value={value}>
              {typeof o === "string" ? o.replaceAll("_", " ") : o.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
