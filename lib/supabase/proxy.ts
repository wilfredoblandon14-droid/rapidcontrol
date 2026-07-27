import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function actualizarSesion(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Faltan las variables NEXT_PUBLIC_SUPABASE_URL y la clave pública de Supabase."
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rutaActual = request.nextUrl.pathname;
  const esRutaLogin = rutaActual.startsWith("/login");

  if (!user && !esRutaLogin) {
    const urlLogin = request.nextUrl.clone();

    urlLogin.pathname = "/login";
    urlLogin.searchParams.set("redirect", rutaActual);

    return NextResponse.redirect(urlLogin);
  }

  if (user && esRutaLogin) {
    const urlInicio = request.nextUrl.clone();

    urlInicio.pathname = "/";
    urlInicio.search = "";

    return NextResponse.redirect(urlInicio);
  }

  return response;
}