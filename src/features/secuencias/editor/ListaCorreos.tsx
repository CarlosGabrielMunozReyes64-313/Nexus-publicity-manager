import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button, Card } from "../../../components/ui";
import { tituloCorreo, type CorreoEditor } from "../util";
import styles from "./Editor.module.css";

export interface EstadoCorreo {
  errores: number;
  avisos: number;
}

function Item({
  correo,
  i,
  total,
  actual,
  estado,
  onElegir,
  onMover,
}: {
  correo: CorreoEditor;
  i: number;
  total: number;
  actual: boolean;
  estado: EstadoCorreo;
  onElegir: () => void;
  onMover: (delta: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: correo.id });
  return (
    <li
      ref={setNodeRef}
      className={styles.correo}
      aria-current={actual}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px,${transform.y}px,0)`
          : undefined,
        transition,
      }}
    >
      <button
        type="button"
        className={styles.asa}
        aria-label={`Mover el correo ${i + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <button type="button" className={styles.elegir} onClick={onElegir}>
        <strong>
          {tituloCorreo(i, correo.esperaDiasHabiles, correo.mismoHilo)}
        </strong>
        <small>
          {correo.asunto?.trim() ||
            (i > 0 && correo.mismoHilo ? "Mismo hilo" : "Sin asunto")}
        </small>
      </button>
      {estado.errores > 0 ? (
        <XCircle
          size={16}
          className={`${styles.icono} ${styles.error}`}
          aria-label={`${estado.errores} errores`}
        />
      ) : estado.avisos > 0 ? (
        <AlertTriangle
          size={16}
          className={`${styles.icono} ${styles.aviso}`}
          aria-label={`${estado.avisos} advertencias`}
        />
      ) : null}
      <span className={styles.mover}>
        <button
          type="button"
          aria-label={`Subir el correo ${i + 1}`}
          disabled={i === 0}
          onClick={() => onMover(-1)}
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          aria-label={`Bajar el correo ${i + 1}`}
          disabled={i === total - 1}
          onClick={() => onMover(1)}
        >
          <ArrowDown size={14} />
        </button>
      </span>
    </li>
  );
}

/** Lista de correos: elegir, reordenar (arrastrar o teclado), agregar, duplicar y eliminar. */
export default function ListaCorreos({
  correos,
  actual,
  estados,
  onElegir,
  onCambiar,
}: {
  correos: CorreoEditor[];
  actual: string;
  estados: Record<string, EstadoCorreo>;
  onElegir: (id: string) => void;
  onCambiar: (correos: CorreoEditor[], elegido?: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const i = Math.max(
    0,
    correos.findIndex((c) => c.id === actual),
  );
  const nuevo = (): CorreoEditor => ({
    id: crypto.randomUUID(),
    orden: correos.length + 1,
    cuerpo:
      "Hola, {{nombre}}:\n\nEscriba aquí el correo.\n\n{{firma}}\n{{baja}}",
    esperaDiasHabiles: 4,
    mismoHilo: true,
    variables: [
      { nombre: "nombre", campoFuente: "nombre", respaldo: "equipo" },
    ],
    formato: "texto",
  });
  return (
    <Card title="Correos">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!over || active.id === over.id) return;
          const de = correos.findIndex((c) => c.id === active.id);
          const a = correos.findIndex((c) => c.id === over.id);
          onCambiar(arrayMove(correos, de, a));
        }}
      >
        <SortableContext
          items={correos.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className={styles.correos} aria-label="Correos de la secuencia">
            {correos.map((c, n) => (
              <Item
                key={c.id}
                correo={c}
                i={n}
                total={correos.length}
                actual={c.id === actual}
                estado={estados[c.id] ?? { errores: 0, avisos: 0 }}
                onElegir={() => onElegir(c.id)}
                onMover={(delta) => onCambiar(arrayMove(correos, n, n + delta))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <div className="row" style={{ marginTop: 12 }}>
        <Button
          onClick={() => {
            const c = nuevo();
            onCambiar([...correos, c], c.id);
          }}
        >
          <Plus size={14} aria-hidden /> Agregar
        </Button>
        <Button
          disabled={!correos.length}
          onClick={() => {
            const base = correos[i];
            const copia = {
              ...structuredClone(base),
              id: crypto.randomUUID(),
              mismoHilo: true,
            };
            const lista = [...correos];
            lista.splice(i + 1, 0, copia);
            onCambiar(lista, copia.id);
          }}
        >
          <Copy size={14} aria-hidden /> Duplicar
        </Button>
        <Button
          variant="danger"
          disabled={correos.length <= 1}
          onClick={() => {
            const lista = correos.filter((_, n) => n !== i);
            onCambiar(lista, lista[Math.min(i, lista.length - 1)]?.id);
          }}
        >
          <Trash2 size={14} aria-hidden /> Eliminar
        </Button>
      </div>
    </Card>
  );
}
