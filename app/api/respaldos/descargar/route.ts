import { exigirAdministrador, crearClienteServicio } from "@/lib/backups/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await exigirAdministrador();
    const { ruta } = (await request.json()) as { ruta?: string };
    if (!ruta) return Response.json({ error: "Ruta requerida" }, { status: 400 });
    const supabase = crearClienteServicio();
    const { data, error } = await supabase.storage
      .from("rapidcontrol-respaldos")
      .createSignedUrl(ruta, 120, { download: true });
    if (error) throw error;
    return Response.json({ url: data.signedUrl });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
