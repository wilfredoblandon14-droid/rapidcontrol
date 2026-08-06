import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { esRolUsuario, rutaInicialPorRol } from "@/lib/auth/roles";

const rutasPublicas = [
  "/login",
  "/recuperar-contrasena",
  "/restablecer-contrasena",
  "/sin-acceso",
];

function esPublica(pathname: string) {
  return rutasPublicas.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  );
}

export async function actualizarSesion(request: NextRequest) {
  let respuestaSupabase = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Faltan las variables públicas de Supabase.");
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        respuestaSupabase = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          respuestaSupabase.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  function redirigir(ruta: string, conservarRedirect = false) {
    const destino = request.nextUrl.clone();
    destino.pathname = ruta;

    if (!conservarRedirect) {
      destino.search = "";
    }

    const respuestaRedireccion = NextResponse.redirect(destino);

    // Muy importante: conservar las cookies generadas o actualizadas
    // por Supabase antes de devolver la redirección.
    respuestaSupabase.cookies.getAll().forEach((cookie) => {
      respuestaRedireccion.cookies.set(cookie);
    });

    return respuestaRedireccion;
  }

  if (!user) {
    if (esPublica(pathname)) {
      return respuestaSupabase;
    }

    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "";
    destino.searchParams.set("redirect", pathname);

    const respuestaRedireccion = NextResponse.redirect(destino);

    respuestaSupabase.cookies.getAll().forEach((cookie) => {
      respuestaRedireccion.cookies.set(cookie);
    });

    return respuestaRedireccion;
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, motorizado_id")
    .eq("id", user.id)
    .maybeSingle();

  const rol = esRolUsuario(perfil?.rol) ? perfil.rol : null;

  if (!rol) {
    if (pathname === "/sin-acceso") {
      return respuestaSupabase;
    }

    return redirigir("/sin-acceso");
  }

  if (esPublica(pathname)) {
    if (pathname === "/restablecer-contrasena") {
      return respuestaSupabase;
    }

    return redirigir(rutaInicialPorRol(rol));
  }

  if (rol === "motorizado") {
    if (!perfil?.motorizado_id) {
      return redirigir("/sin-acceso");
    }

    const esRutaMotorizado =
      pathname === "/motorizado" ||
      pathname.startsWith("/motorizado/");

    if (!esRutaMotorizado) {
      return redirigir("/motorizado");
    }

    return respuestaSupabase;
  }

  if (
    pathname === "/motorizado" ||
    pathname.startsWith("/motorizado/")
  ) {
    return redirigir("/");
  }

  if (
    rol === "despachador" &&
    (pathname === "/configuracion" ||
      pathname.startsWith("/configuracion/"))
  ) {
    return redirigir("/");
  }

  return respuestaSupabase;
}