import { exigirAdministrador, crearClienteServicio } from "@/lib/backups/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const administrador = await exigirAdministrador();
    const body = (await request.json()) as {
      confirmacion?: string;
      borrarClientes?: boolean;
      reiniciarContadores?: boolean;
    };

    if (body.confirmacion !== "REINICIAR OPERACION") {
      return Response.json(
        { error: 'Escribe exactamente "REINICIAR OPERACION".' },
        { status: 400 }
      );
    }

    const supabase = crearClienteServicio();
    const { data, error } = await supabase.rpc("reiniciar_operacion_rapidcontrol", {
      p_borrar_clientes: Boolean(body.borrarClientes),
      p_reiniciar_contadores: Boolean(body.reiniciarContadores),
      p_administrador_id: administrador.id,
    });

    if (error) throw error;

    return Response.json({
      correcto: true,
      resultado: data,
      mensaje: "RapidControl quedó listo para comenzar una prueba nueva.",
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
