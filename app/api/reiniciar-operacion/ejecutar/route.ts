import { exigirAdministrador, crearClienteServicio } from "@/lib/backups/admin";

export const runtime = "nodejs";

type ErrorSupabase = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

function obtenerMensajeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const errorSupabase = error as ErrorSupabase;

    return [
      errorSupabase.message,
      errorSupabase.details,
      errorSupabase.hint,
      errorSupabase.code ? `Código: ${errorSupabase.code}` : null,
    ]
      .filter(Boolean)
      .join(" — ");
  }

  return String(error || "Error desconocido");
}

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
        { status: 400 },
      );
    }

    const supabase = crearClienteServicio();

    const { data, error } = await supabase.rpc(
      "reiniciar_operacion_rapidcontrol",
      {
        p_borrar_clientes: Boolean(body.borrarClientes),
        p_reiniciar_contadores: Boolean(body.reiniciarContadores),
        p_administrador_id: administrador.id,
      },
    );

    if (error) {
      console.error("Error al reiniciar RapidControl:", error);

      return Response.json(
        {
          error: obtenerMensajeError(error),
          codigo: error.code,
          detalle: error.details,
          sugerencia: error.hint,
        },
        { status: 500 },
      );
    }

    return Response.json({
      correcto: true,
      resultado: data,
      mensaje: "RapidControl quedó listo para comenzar una prueba nueva.",
    });
  } catch (error) {
    console.error("Error inesperado al reiniciar RapidControl:", error);

    const mensaje = obtenerMensajeError(error);

    const status =
      mensaje === "NO_AUTENTICADO"
        ? 401
        : mensaje === "NO_AUTORIZADO"
          ? 403
          : 500;

    return Response.json({ error: mensaje }, { status });
  }
}