import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import s from "./MultiSelect.module.css";

export interface OptionGroup {
  label: string;
  options: string[];
}

interface Props {
  label: string;
  groups: OptionGroup[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  /** Muestra el cuadro «Agregar +» al final de la lista. */
  allowAdd?: boolean;
  /** Clave de localStorage para recordar las opciones agregadas por el usuario. */
  storageKey?: string;
}

const norm = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function readCustom(key?: string): string[] {
  if (!key) return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeCustom(key: string | undefined, items: string[]) {
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* almacenamiento no disponible: las opciones duran solo esta sesión */
  }
}

export function MultiSelect({
  label,
  groups,
  value,
  onChange,
  placeholder = "Seleccionar",
  allowAdd = false,
  storageKey,
}: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [custom, setCustom] = useState<string[]>(() => readCustom(storageKey));
  const root = useRef<HTMLDivElement>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const listId = useId();

  const allGroups = useMemo(() => {
    const known = new Set(groups.flatMap((g) => g.options.map(norm)));
    // Seleccionados que no están en la lista (p. ej. de una versión anterior) siguen visibles.
    const extra = [...custom, ...value].filter((v, i, arr) => {
      const n = norm(v);
      return !known.has(n) && arr.findIndex((x) => norm(x) === n) === i;
    });
    return extra.length
      ? [{ label: "Agregadas por ti", options: extra }, ...groups]
      : groups;
  }, [groups, custom, value]);

  const visible = allGroups
    .map((g) => ({
      ...g,
      options: g.options.filter((o) => norm(o).includes(norm(filter))),
    }))
    .filter((g) => g.options.length);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (adding) addInput.current?.focus();
  }, [adding]);

  const selected = new Set(value.map(norm));
  const toggle = (opt: string) =>
    onChange(
      selected.has(norm(opt))
        ? value.filter((v) => norm(v) !== norm(opt))
        : [...value, opt],
    );

  const add = () => {
    const text = draft.trim().replace(/\s+/g, " ");
    if (!text) return;
    const existing = allGroups
      .flatMap((g) => g.options)
      .find((o) => norm(o) === norm(text));
    if (!existing) {
      const next = [...custom, text];
      setCustom(next);
      writeCustom(storageKey, next);
    }
    const final = existing ?? text;
    if (!selected.has(norm(final))) onChange([...value, final]);
    setDraft("");
    setAdding(false);
  };

  const removeCustom = (opt: string) => {
    const next = custom.filter((c) => norm(c) !== norm(opt));
    setCustom(next);
    writeCustom(storageKey, next);
    onChange(value.filter((v) => norm(v) !== norm(opt)));
  };

  const summary =
    value.length === 0
      ? placeholder
      : value.length <= 2
        ? value.join(", ")
        : `${value.slice(0, 2).join(", ")} +${value.length - 2}`;

  return (
    <div
      className={s.root}
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          setAdding(false);
        }
      }}
    >
      <span className={s.label}>{label}</span>
      <div className={s.anchor}>
        <button
          type="button"
          className={s.trigger}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${label}: ${value.length ? value.join(", ") : "ninguno"}`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={value.length ? s.value : s.placeholder}>
            {summary}
          </span>
          <ChevronDown size={16} aria-hidden />
        </button>
        {open && (
          <div className={s.panel}>
            <input
              className={s.search}
              placeholder="Buscar…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label={`Filtrar ${label}`}
              autoFocus
            />
            <div className={s.actions}>
              <span>
                {value.length} seleccionad{value.length === 1 ? "a" : "as"}
              </span>
              {value.length > 0 && (
                <button
                  type="button"
                  className={s.link}
                  onClick={() => onChange([])}
                >
                  Limpiar
                </button>
              )}
            </div>
            <div
              className={s.list}
              id={listId}
              role="listbox"
              aria-multiselectable
            >
              {visible.map((g) => (
                <div key={g.label} role="group" aria-label={g.label}>
                  <div className={s.group}>{g.label}</div>
                  {g.options.map((opt) => {
                    const on = selected.has(norm(opt));
                    const isCustom = custom.some((c) => norm(c) === norm(opt));
                    return (
                      <div key={opt} className={s.optionRow}>
                        <label
                          className={s.option}
                          role="option"
                          aria-selected={on}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(opt)}
                          />
                          <span className={s.box} aria-hidden>
                            {on && <Check size={12} strokeWidth={3} />}
                          </span>
                          <span>{opt}</span>
                        </label>
                        {isCustom && (
                          <button
                            type="button"
                            className={s.remove}
                            aria-label={`Quitar ${opt} de la lista`}
                            title="Quitar de la lista"
                            onClick={() => removeCustom(opt)}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {!visible.length && !allowAdd && (
                <p className={s.empty}>Sin coincidencias.</p>
              )}
            </div>
            {allowAdd &&
              (adding ? (
                <div className={s.addForm}>
                  <input
                    ref={addInput}
                    value={draft}
                    placeholder="Ej.: Fabricantes de muebles"
                    aria-label="Nueva opción"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        add();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={s.addConfirm}
                    disabled={!draft.trim()}
                    onClick={add}
                  >
                    Agregar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={s.addBox}
                  onClick={() => {
                    setDraft(filter);
                    setAdding(true);
                  }}
                >
                  Agregar <Plus size={15} aria-hidden />
                </button>
              ))}
          </div>
        )}
      </div>
      {value.length > 0 && (
        <div className={s.chips}>
          {value.map((v) => (
            <span key={v} className={s.chip}>
              {v}
              <button
                type="button"
                aria-label={`Quitar ${v}`}
                onClick={() => toggle(v)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
