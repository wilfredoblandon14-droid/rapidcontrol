import { exigirAdministrador, crearClienteServicio } from "@/lib/backups/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    await exigirAdministrador();
    const supabase = crearClienteServicio();
    const { data, error } = await supabase
      .from("respaldos")
      .select("id,grupo_id,tipo,formato,ruta_storage,tamano_bytes,estado,rango_desde,rango_hasta,created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;
    return Response.json({ respaldos: data ?? [] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return Response.json({ error: msg }, { status: msg === "NO_AUTORIZADO" ? 403 : 500 });
  }
}
