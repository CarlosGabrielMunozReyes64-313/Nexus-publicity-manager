/**
 * Modo activo de la interfaz. Con VITE_USE_MOCKS=true todo es una demostración
 * en memoria (MSW); en cualquier otro caso las acciones llegan a la API real y
 * pueden revocar permisos, pausar campañas, enviar correos o consumir presupuesto.
 */
export const MODO_DEMO = import.meta.env.VITE_USE_MOCKS === "true";
