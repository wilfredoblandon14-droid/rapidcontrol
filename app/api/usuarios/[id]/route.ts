import { exigirAdministrador, crearClienteServicio } from "@/lib/backups/admin";
import { esRolUsuario } from "@/lib/auth/roles";

export const runtime = "nodejs";

function respuestaError(error: unknown) {
  const mensaje = error instanceof Error ? error.message : "Error desconocido";
  const estado = mensaje === "NO_AUTENTICADO" ? 401 : mensaje === "NO_AUTORIZADO" ? 403 : 400;
  return Response.json({ error: mensaje }, { status: estado });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const administrador = await exigirAdministrador();
    const { id } = await context.params;
    const body = await request.json();
    const supabase = crearClienteServicio();

    const { data: perfilActual, error: perfilActualError } = await supabase
      .from("perfiles")
      .select("id,nombre,rol,motorizado_id")
      .eq("id", id)
      .maybeSingle();

    if (perfilActualError) throw perfilActualError;
    if (!perfilActual) throw new Error("No se encontró el perfil del usuario.");

    const nombre = body.nombre !== undefined ? String(body.nombre).trim() : perfilActual.nombre;
    const rol = body.rol !== undefined ? String(body.rol) : perfilActual.rol;
    const motorizadoId = body.motorizado_id ? Number(body.motorizado_id) : null;
    const activo = body.activo === undefined ? undefined : Boolean(body.activo);
    const password = body.password ? String(body.password) : "";

    if (!nombre) throw new Error("El nombre no puede quedar vacío.");
    if (!esRolUsuario(rol)) throw new Error("El rol seleccionado no es válido.");
    if (rol === "motorizado" && !motorizadoId) throw new Error("Selecciona el motorizado vinculado.");
    if (rol !== "motorizado" && motorizadoId) throw new Error("Solo el rol Motorizado puede tener un vínculo.");
    if (password && password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");

    if (id === administrador.id) {
      if (rol !== "administrador") throw new Error("No puedes quitarte tu propio rol de administrador.");
      if (activo === false) throw new Error("No puedes desactivar tu propia cuenta.");
    }

    if (motorizadoId) {
      const { data: ocupado, error: ocupadoError } = await supabase
        .from("perfiles")
        .select("id")
        .eq("motorizado_id", motorizadoId)
        .neq("id", id)
        .maybeSingle();
      if (ocupadoError) throw ocupadoError;
      if (ocupado) throw new Error("Ese motorizado ya está vinculado a otra cuenta.");
    }

    const atributosAuth: { password?: string; ban_duration?: string; user_metadata?: Record<string, unknown> } = {
      user_metadata: { nombre, rol },
    };
    if (password) atributosAuth.password = password;
    if (activo === true) atributosAuth.ban_duration = "none";
    if (activo === false) atributosAuth.ban_duration = "876000h";

    const { error: authError } = await supabase.auth.admin.updateUserById(id, atributosAuth);
    if (authError) throw authError;

    const { error: perfilError } = await supabase
      .from("perfiles")
      .update({ nombre, rol, motorizado_id: rol === "motorizado" ? motorizadoId : null })
      .eq("id", id);

    if (perfilError) throw perfilError;

    return Response.json({ ok: true });
  } catch (error) {
    return respuestaError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const administrador = await exigirAdministrador();
    const { id } = await context.params;
    if (id === administrador.id) throw new Error("No puedes eliminar tu propia cuenta.");

    const supabase = crearClienteServicio();
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;

    await supabase.from("perfiles").delete().eq("id", id);
    return Response.json({ ok: true });
  } catch (error) {
    return respuestaError(error);
  }
}
