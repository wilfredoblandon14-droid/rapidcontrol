import { exigirAdministrador, crearClienteServicio } from "@/lib/backups/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tablas = [
  "pedidos",
  "clientes",
  "movimientos_caja",
  "sesiones_caja",
  "fondos_motorizado",
  "gastos_motorizado",
  "liquidaciones_motorizado",
  "notificaciones",
  "notificaciones_lecturas",
  "ubicaciones_motorizados",
  "auditoria",
  "respaldos",
] as const;

export async function GET() {
  try {
    await exigirAdministrador();
    const supabase = crearClienteServicio();

    const resultados = await Promise.all(
      tablas.map(async (tabla) => {
        const { count, error } = await supabase
          .from(tabla)
          .select("*", { count: "exact", head: true });

        return {
          tabla,
          registros: count ?? 0,
          error: error?.message ?? null,
        };
      })
    );

    const errores = resultados.filter((item) => item.error);

    return Response.json({
      correcto: errores.length === 0,
      conteos: Object.fromEntries(
        resultados.map((item) => [item.tabla, item.registros])
      ),
      errores,
      comprobadoEn: new Date().toISOString(),
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido";
    const status =
      mensaje === "NO_AUTENTICADO"
        ? 401
        : mensaje === "NO_AUTORIZADO"
          ? 403
          : 500;

    return Response.json({ error: mensaje }, { status });
  }
}
