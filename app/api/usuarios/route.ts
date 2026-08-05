import { exigirAdministrador, crearClienteServicio } from "@/lib/backups/admin";
import { esRolUsuario } from "@/lib/auth/roles";

export const runtime = "nodejs";

type Perfil = {
  id: string;
  nombre: string | null;
  rol: string;
  motorizado_id: number | null;
};

function respuestaError(error: unknown) {
  const mensaje = error instanceof Error ? error.message : "Error desconocido";
  const estado = mensaje === "NO_AUTENTICADO" ? 401 : mensaje === "NO_AUTORIZADO" ? 403 : 400;
  return Response.json({ error: mensaje }, { status: estado });
}

export async function GET() {
  try {
    await exigirAdministrador();
    const supabase = crearClienteServicio();

    const [{ data: authData, error: authError }, { data: perfiles, error: perfilesError }, { data: motorizados, error: motosError }] =
      await Promise.all([
        supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        supabase.from("perfiles").select("id,nombre,rol,motorizado_id"),
        supabase.from("motorizados").select("id,nombre,telefono,estado").order("nombre"),
      ]);

    if (authError) throw authError;
    if (perfilesError) throw perfilesError;
    if (motosError) throw motosError;

    const mapaPerfiles = new Map((perfiles ?? []).map((p: Perfil) => [p.id, p]));

    const usuarios = authData.users.map((usuario) => {
      const perfil = mapaPerfiles.get(usuario.id);
      const bloqueadoHasta = usuario.banned_until ? new Date(usuario.banned_until) : null;
      const activo = !bloqueadoHasta || bloqueadoHasta.getTime() <= Date.now();

      return {
        id: usuario.id,
        email: usuario.email ?? "",
        nombre: perfil?.nombre ?? usuario.user_metadata?.nombre ?? "",
        rol: perfil?.rol ?? usuario.user_metadata?.rol ?? "sin_rol",
        motorizado_id: perfil?.motorizado_id ?? null,
        activo,
        creado_en: usuario.created_at,
        ultimo_acceso: usuario.last_sign_in_at ?? null,
      };
    });

    return Response.json({ usuarios, motorizados: motorizados ?? [] });
  } catch (error) {
    return respuestaError(error);
  }
}

export async function POST(request: Request) {
  let usuarioCreadoId: string | null = null;

  try {
    await exigirAdministrador();
    const body = await request.json();
    const nombre = String(body.nombre ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const rol = String(body.rol ?? "");
    const motorizadoId = body.motorizado_id ? Number(body.motorizado_id) : null;

    if (!nombre) throw new Error("Escribe el nombre del usuario.");
    if (!email || !email.includes("@")) throw new Error("Escribe un correo válido.");
    if (password.length < 8) throw new Error("La contraseña temporal debe tener al menos 8 caracteres.");
    if (!esRolUsuario(rol)) throw new Error("Selecciona un rol válido.");
    if (rol === "motorizado" && !motorizadoId) throw new Error("Selecciona el motorizado que usarán estas credenciales.");
    if (rol !== "motorizado" && motorizadoId) throw new Error("Solo una cuenta con rol Motorizado puede vincularse a un motorizado.");

    const supabase = crearClienteServicio();

    if (motorizadoId) {
      const { data: ocupado, error: errorOcupado } = await supabase
        .from("perfiles")
        .select("id")
        .eq("motorizado_id", motorizadoId)
        .maybeSingle();
      if (errorOcupado) throw errorOcupado;
      if (ocupado) throw new Error("Ese motorizado ya está vinculado a otra cuenta.");
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol },
    });

    if (error) throw error;
    if (!data.user) throw new Error("Supabase no devolvió el usuario creado.");
    usuarioCreadoId = data.user.id;

    const { error: perfilError } = await supabase.from("perfiles").upsert({
      id: data.user.id,
      nombre,
      rol,
      motorizado_id: rol === "motorizado" ? motorizadoId : null,
    });

    if (perfilError) throw perfilError;

    return Response.json({ ok: true, id: data.user.id });
  } catch (error) {
    if (usuarioCreadoId) {
      try {
        await crearClienteServicio().auth.admin.deleteUser(usuarioCreadoId);
      } catch {
        // Evita ocultar el error principal si la limpieza falla.
      }
    }
    return respuestaError(error);
  }
}
