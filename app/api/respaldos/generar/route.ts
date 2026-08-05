import { exigirAdministrador } from "@/lib/backups/admin";
import { generarRespaldo } from "@/lib/backups/generator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await exigirAdministrador();
    const body = (await request.json()) as { desde?: string; hasta?: string };
    if (!body.desde || !body.hasta) {
      return Response.json({ error: "Debes indicar desde y hasta." }, { status: 400 });
    }
    const desde = new Date(`${body.desde}T00:00:00`).toISOString();
    const hasta = new Date(`${body.hasta}T23:59:59.999`).toISOString();
    const resultado = await generarRespaldo({
      tipo: "manual",
      rango: { desde, hasta },
      usuarioId: user.id,
    });
    return Response.json({ ok: true, resultado });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    const status = msg === "NO_AUTENTICADO" ? 401 : msg === "NO_AUTORIZADO" ? 403 : 500;
    return Response.json({ error: msg }, { status });
  }
}
