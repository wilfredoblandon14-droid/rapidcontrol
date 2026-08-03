"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { RolUsuario } from "@/lib/auth/roles";
import { esRolUsuario } from "@/lib/auth/roles";
import AdminShell from "./AdminShell";
import { createClient } from "@/lib/supabase/client";

type Perfil = { nombre: string | null; rol: string | null };

const rutasSoloAdministrador = ["/reportes", "/configuracion"];

function esRutaPublica(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/recuperar-contrasena" ||
    pathname === "/restablecer-contrasena" ||
    pathname === "/sin-acceso" ||
    pathname === "/solicitar" ||
    pathname === "/rastrear" ||
    pathname.startsWith("/seguimiento/") ||
    pathname === "/motorizado" ||
    pathname.startsWith("/motorizado/")
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<User | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);
  const [rol, setRol] = useState<RolUsuario | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const rutaPublica = esRutaPublica(pathname);

  useEffect(() => {
    if (rutaPublica) {
      setCargandoPerfil(false);
      return;
    }

    let activo = true;
    const supabase = createClient();

    async function cargarUsuario() {
      setCargandoPerfil(true);
      const { data } = await supabase.auth.getUser();
      if (!activo) return;

      setUsuario(data.user ?? null);
      if (!data.user) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      const { data: perfil } = await supabase
        .from("perfiles")
        .select("nombre, rol")
        .eq("id", data.user.id)
        .maybeSingle<Perfil>();

      if (!activo) return;

      const rolValido = esRolUsuario(perfil?.rol) ? perfil.rol : null;
      setNombre(perfil?.nombre ?? null);
      setRol(rolValido);
      setCargandoPerfil(false);

      if (!rolValido) {
        router.replace("/sin-acceso");
        return;
      }

      if (rolValido === "motorizado") {
        router.replace("/motorizado");
        return;
      }

      if (rolValido === "despachador") {
        const rutaRestringida =
          pathname === "/" ||
          rutasSoloAdministrador.some(
            (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
          );

        if (rutaRestringida) {
          router.replace("/operaciones");
        }
      }

      if (rolValido === "administrador" && pathname === "/operaciones") {
        router.replace("/");
      }
    }

    void cargarUsuario();
    return () => {
      activo = false;
    };
  }, [pathname, router, rutaPublica]);

  if (rutaPublica) return <>{children}</>;

  if (cargandoPerfil || !rol) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Verificando acceso…
      </main>
    );
  }

  return (
    <AdminShell
      nombreUsuario={nombre}
      correoUsuario={usuario?.email ?? null}
      rolUsuario={rol}
    >
      {children}
    </AdminShell>
  );
}
