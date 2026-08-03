import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { esRolUsuario, rutaInicialPorRol } from "@/lib/auth/roles";

const rutasPublicas = ["/login", "/recuperar-contrasena", "/restablecer-contrasena", "/sin-acceso"];
function esPublica(pathname: string) { return rutasPublicas.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)); }

export async function actualizarSesion(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan las variables públicas de Supabase.");

  const supabase = createServerClient(url, key, { cookies: { getAll:()=>request.cookies.getAll(), setAll(cookies){cookies.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options));} } });
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (!user) {
    if (esPublica(pathname)) return response;
    const destino=request.nextUrl.clone();destino.pathname="/login";destino.searchParams.set("redirect",pathname);return NextResponse.redirect(destino);
  }

  const { data: perfil } = await supabase.from("perfiles").select("rol, motorizado_id").eq("id",user.id).maybeSingle();
  const rol = esRolUsuario(perfil?.rol) ? perfil.rol : null;
  if (!rol) { if(pathname==="/sin-acceso")return response;const d=request.nextUrl.clone();d.pathname="/sin-acceso";d.search="";return NextResponse.redirect(d); }

  if (esPublica(pathname)) {
    if (pathname === "/restablecer-contrasena") return response;
    const d=request.nextUrl.clone();d.pathname=rutaInicialPorRol(rol);d.search="";return NextResponse.redirect(d);
  }

  if (rol === "motorizado") {
    if (!perfil?.motorizado_id) { const d=request.nextUrl.clone();d.pathname="/sin-acceso";d.search="";return NextResponse.redirect(d); }
    if (!(pathname === "/motorizado" || pathname.startsWith("/motorizado/"))) { const d=request.nextUrl.clone();d.pathname="/motorizado";d.search="";return NextResponse.redirect(d); }
    return response;
  }

  if (pathname === "/motorizado" || pathname.startsWith("/motorizado/")) { const d=request.nextUrl.clone();d.pathname="/";d.search="";return NextResponse.redirect(d); }
  if (rol === "despachador" && (pathname === "/configuracion" || pathname.startsWith("/configuracion/"))) { const d=request.nextUrl.clone();d.pathname="/";d.search="";return NextResponse.redirect(d); }
  return response;
}
