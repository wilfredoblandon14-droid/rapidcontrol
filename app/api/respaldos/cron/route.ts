import { generarRespaldo, rangoMesAnterior, rangoQuincenaAnterior } from "@/lib/backups/generator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const ahora = new Date();
    const resultados: unknown[] = [];
    resultados.push(await generarRespaldo({ tipo: "diario" }));

    if (ahora.getUTCDate() === 1 || ahora.getUTCDate() === 16) {
      resultados.push(
        await generarRespaldo({ tipo: "quincenal", rango: rangoQuincenaAnterior(ahora) })
      );
    }
    if (ahora.getUTCDate() === 1) {
      resultados.push(
        await generarRespaldo({ tipo: "mensual", rango: rangoMesAnterior(ahora) })
      );
    }

    return Response.json({ ok: true, resultados });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
