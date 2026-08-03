import { createClient } from "./supabase/client";

/**
 * Compatibilidad con las páginas existentes.
 * Todas las pantallas comparten la misma instancia de Supabase.
 */
export const supabase = createClient();
