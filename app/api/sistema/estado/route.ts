import { exigirAdministrador, crearClienteServicio } from "@/lib/backups/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    await exigirAdministrador();
    const supabase = crearClienteServicio();

    const inicio = Date.now();

    const [pedidos, clientes, respaldos] = await Promise.all([
      supabase.from("pedidos").select("id", { count: "exact", head: true }),
      supabase.from("clientes").select("id", { count: "exact", head: true }),
      supabase
        .from("respaldos")
        .select("created_at,estado,formato,tipo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const baseCorrecta = !pedidos.error && !clientes.error;

    return Response.json({
      baseDatos: {
        correcto: baseCorrecta,
        pedidos: pedidos.count ?? 0,
        clientes: clientes.count ?? 0,
        tiempoRespuestaMs: Date.now() - inicio,
        error: pedidos.error?.message ?? clientes.error?.message ?? null,
      },
      respaldos: {
        configurado: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        cronConfigurado: Boolean(process.env.CRON_SECRET),
        ultimo: respaldos.data ?? null,
        error: respaldos.error?.message ?? null,
      },
      ia: {
        configurada: Boolean(process.env.OPENAI_API_KEY),
      },
      entorno: process.env.VERCEL ? "Vercel" : "Local",
      timestamp: new Date().toISOString(),
    });
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
