"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { RolUsuario } from "@/lib/auth/roles";
import { esRolUsuario } from "@/lib/auth/roles";
import AdminShell from "./AdminShell";
import { createClient } from "@/lib/supabase/client";

type Perfil = { nombre: string | null; rol: string | null };

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<User | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);
  const [rol, setRol] = useState<RolUsuario | null>(null);

  const esRutaSinPanel =
    pathname === "/login" ||
    pathname === "/recuperar-contrasena" ||
    pathname === "/restablecer-contrasena" ||
    pathname === "/sin-acceso" ||
    pathname === "/motorizado" ||
    pathname.startsWith("/motorizado/");

  useEffect(() => {
    if (esRutaSinPanel) return;
    let activo = true;
    const supabase = createClient();

    async function cargarUsuario() {
      const { data } = await supabase.auth.getUser();
      if (!activo) return;
      setUsuario(data.user ?? null);
      if (!data.user) return;

      const { data: perfil } = await supabase
        .from("perfiles")
        .select("nombre, rol")
        .eq("id", data.user.id)
        .maybeSingle<Perfil>();

      if (!activo) return;
      setNombre(perfil?.nombre ?? null);
      setRol(esRolUsuario(perfil?.rol) ? perfil.rol : null);
    }

    void cargarUsuario();
    return () => { activo = false; };
  }, [esRutaSinPanel]);

  if (esRutaSinPanel) return <>{children}</>;

  return (
    <AdminShell nombreUsuario={nombre} correoUsuario={usuario?.email ?? null} rolUsuario={rol}>
      {children}
    </AdminShell>
  );
}
