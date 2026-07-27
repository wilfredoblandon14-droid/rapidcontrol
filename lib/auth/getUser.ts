import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type RolUsuario = "administrador" | "motorizado";

export type PerfilUsuario = {
  id: string;
  nombre: string | null;
  rol: RolUsuario;
  motorizado_id: number | null;
  email: string;
};

export async function obtenerUsuarioActual(): Promise<PerfilUsuario> {
  const supabase = await createClient();

  const {
    data: { user },
    error: errorUsuario,
  } = await supabase.auth.getUser();

  if (errorUsuario || !user) {
    redirect("/login");
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, motorizado_id")
    .eq("id", user.id)
    .single();

  if (errorPerfil || !perfil) {
    throw new Error(
      "El usuario inició sesión, pero no tiene un perfil registrado en la tabla perfiles."
    );
  }

  if (
    perfil.rol !== "administrador" &&
    perfil.rol !== "motorizado"
  ) {
    throw new Error("El perfil tiene un rol no válido.");
  }

  return {
    id: perfil.id,
    nombre: perfil.nombre,
    rol: perfil.rol,
    motorizado_id: perfil.motorizado_id,
    email: user.email ?? "",
  };
}

export async function exigirAdministrador(): Promise<PerfilUsuario> {
  const usuario = await obtenerUsuarioActual();

  if (usuario.rol !== "administrador") {
    redirect("/motorizado");
  }

  return usuario;
}

export async function exigirMotorizado(): Promise<PerfilUsuario> {
  const usuario = await obtenerUsuarioActual();

  if (usuario.rol !== "motorizado") {
    redirect("/");
  }

  if (!usuario.motorizado_id) {
    throw new Error(
      "Este usuario motorizado no está vinculado con un registro de motorizados."
    );
  }

  return usuario;
}