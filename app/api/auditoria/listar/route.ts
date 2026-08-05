import { exigirAdministrador, crearClienteServicio } from "@/lib/backups/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await exigirAdministrador();

    const url = new URL(request.url);
    const tabla = url.searchParams.get("tabla");
    const supabase = crearClienteServicio();

    let consulta = supabase
      .from("auditoria")
      .select(
        "id,usuario_id,tabla,operacion,registro_id,datos_anteriores,datos_nuevos,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (tabla && tabla !== "todas") {
      consulta = consulta.eq("tabla", tabla);
    }

    const { data, error } = await consulta;

    if (error) throw error;

    return Response.json({ eventos: data ?? [] });
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : "Error desconocido";

    const estado =
      mensaje === "NO_AUTENTICADO"
        ? 401
        : mensaje === "NO_AUTORIZADO"
          ? 403
          : 500;

    return Response.json({ error: mensaje }, { status: estado });
  }
}
