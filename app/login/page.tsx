"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function iniciarSesion(
    evento: React.FormEvent<HTMLFormElement>,
  ) {
    evento.preventDefault();
    setError("");
    setCargando(true);

    try {
      const respuesta = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          correo: correo.trim(),
          password,
          redirect: searchParams.get("redirect"),
        }),
      });

      const resultado = (await respuesta.json()) as {
        correcto?: boolean;
        destino?: string;
        error?: string;
      };

      if (
        !respuesta.ok ||
        !resultado.correcto ||
        !resultado.destino
      ) {
        setError(
          resultado.error ??
            "No se pudo iniciar sesión.",
        );
        setCargando(false);
        return;
      }

      window.location.replace(resultado.destino);
    } catch (errorDesconocido) {
      console.error(
        "Error al conectar con el servidor:",
        errorDesconocido,
      );

      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "Error al conectar con el servidor.",
      );

      setCargando(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-6 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-green-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col items-center justify-center border-b border-slate-800 bg-black p-8 text-center lg:border-b-0 lg:border-r lg:p-12">
          <Image
            src="/logo-mandados-rapid.png"
            alt="Mandados Rapid"
            width={520}
            height={520}
            className="h-auto w-full max-w-sm object-contain"
            priority
          />

          <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">
            Plataforma administrativa para gestionar pedidos,
            clientes, motorizados, caja y reportes.
          </p>
        </section>

        <section className="flex items-center p-8 lg:p-12">
          <div className="w-full">
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-green-400">
                RapidControl
              </p>

              <h1 className="mt-3 text-3xl font-black">
                Iniciar sesión
              </h1>

              <p className="mt-2 text-slate-400">
                Acceso seguro al sistema de Mandados Rapid
              </p>
            </div>

            <form
              onSubmit={iniciarSesion}
              className="space-y-5"
            >
              <label className="block">
                <span className="mb-2 block font-semibold">
                  Correo
                </span>

                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={correo}
                  onChange={(evento) =>
                    setCorreo(evento.target.value)
                  }
                  placeholder="correo@empresa.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
              </label>

              <label className="block">
                <span className="mb-2 block font-semibold">
                  Contraseña
                </span>

                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(evento) =>
                    setPassword(evento.target.value)
                  }
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
              </label>

              {error && (
                <div
                  className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="w-full rounded-xl bg-green-600 py-3 font-bold transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cargando
                  ? "Verificando..."
                  : "Iniciar sesión"}
              </button>

              <Link
                href="/recuperar-contrasena"
                className="block text-center text-sm font-semibold text-green-400 hover:text-green-300"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </form>

            <p className="mt-8 text-center text-xs text-slate-500">
              Tus mandados, más rapid que nunca.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          Cargando…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}