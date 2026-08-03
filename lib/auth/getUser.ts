import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esRolUsuario, type RolUsuario } from "./roles";

export type PerfilUsuario = {
  id: string;
  nombre: string | null;
  rol: RolUsuario;
  motorizado_id: number | null;
  email: string;
};

export async function obtenerUsuarioActual(): Promise<PerfilUsuario> {
  const supabase = await createClient();
  const { data: { user }, error: errorUsuario } = await supabase.auth.getUser();

  if (errorUsuario || !user) redirect("/login");

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, motorizado_id")
    .eq("id", user.id)
    .single();

  if (errorPerfil || !perfil || !esRolUsuario(perfil.rol)) {
    redirect("/sin-acceso");
  }

  return {
    id: perfil.id,
    nombre: perfil.nombre,
    rol: perfil.rol,
    motorizado_id: perfil.motorizado_id,
    email: user.email ?? "",
  };
}

export async function exigirAdministrador() {
  const usuario = await obtenerUsuarioActual();
  if (usuario.rol !== "administrador") redirect(usuario.rol === "motorizado" ? "/motorizado" : "/");
  return usuario;
}

export async function exigirPersonalAdministrativo() {
  const usuario = await obtenerUsuarioActual();
  if (usuario.rol === "motorizado") redirect("/motorizado");
  return usuario;
}

export async function exigirMotorizado() {
  const usuario = await obtenerUsuarioActual();
  if (usuario.rol !== "motorizado") redirect("/");
  if (!usuario.motorizado_id) redirect("/sin-acceso");
  return usuario;
}
