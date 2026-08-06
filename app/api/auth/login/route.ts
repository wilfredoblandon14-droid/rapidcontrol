import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  esRolUsuario,
  rutaInicialPorRol,
} from "@/lib/auth/roles";

type CookiePendiente = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      correo?: string;
      password?: string;
      redirect?: string | null;
    };

    const correo = body.correo?.trim();
    const password = body.password;

    if (!correo || !password) {
      return NextResponse.json(
        { error: "Escribe el correo y la contraseña." },
        { status: 400 },
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { error: "Faltan las variables públicas de Supabase." },
        { status: 500 },
      );
    }

    const cookiesPendientes: CookiePendiente[] = [];

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach((cookie) => {
            cookiesPendientes.push(cookie);
          });
        },
      },
    });

    const {
      data: inicio,
      error: errorInicio,
    } = await supabase.auth.signInWithPassword({
      email: correo,
      password,
    });

    if (errorInicio || !inicio.user || !inicio.session) {
      return NextResponse.json(
        {
          error:
            errorInicio?.message ??
            "No se pudo iniciar sesión.",
        },
        { status: 401 },
      );
    }

    const { data: perfil, error: errorPerfil } =
      await supabase
        .from("perfiles")
        .select("rol, motorizado_id")
        .eq("id", inicio.user.id)
        .single();

    if (
      errorPerfil ||
      !perfil ||
      !esRolUsuario(perfil.rol)
    ) {
      return NextResponse.json(
        {
          error:
            "La cuenta no tiene un perfil o rol válido.",
        },
        { status: 403 },
      );
    }

    if (
      perfil.rol === "motorizado" &&
      !perfil.motorizado_id
    ) {
      return NextResponse.json(
        {
          error:
            "Esta cuenta no está vinculada a un motorizado.",
        },
        { status: 403 },
      );
    }

    const solicitado = body.redirect;

    const destino =
      solicitado &&
      solicitado.startsWith("/") &&
      perfil.rol !== "motorizado"
        ? solicitado
        : rutaInicialPorRol(perfil.rol);

    const response = NextResponse.json({
      correcto: true,
      destino,
    });

    cookiesPendientes.forEach(
      ({ name, value, options }) => {
        response.cookies.set(
          name,
          value,
          options as Parameters<
            typeof response.cookies.set
          >[2],
        );
      },
    );

    return response;
  } catch (error) {
    console.error("Error en el inicio de sesión:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error inesperado al iniciar sesión.",
      },
      { status: 500 },
    );
  }
}