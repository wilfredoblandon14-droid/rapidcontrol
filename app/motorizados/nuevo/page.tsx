"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type EstadoMotorizado = "Disponible" | "Ocupado" | "Inactivo";

const estiloCampo =
  "w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 disabled:cursor-not-allowed disabled:opacity-60";

export default function NuevoMotorizado() {
  const router = useRouter();

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function guardarMotorizado(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formularioElemento = event.currentTarget;
    const formulario = new FormData(formularioElemento);

    setGuardando(true);
    setMensaje("");
    setError("");

    const nombre = formulario.get("nombre")?.toString().trim() ?? "";
    const telefono = formulario.get("telefono")?.toString().trim() ?? "";
    const placa = formulario.get("placa")?.toString().trim() ?? "";
    const estado =
      (formulario.get("estado")?.toString() as EstadoMotorizado) ??
      "Disponible";

    if (!nombre) {
      setError("Escribe el nombre del motorizado.");
      setGuardando(false);
      return;
    }

    const { error: errorSupabase } = await supabase
      .from("motorizados")
      .insert({
        nombre,
        telefono: telefono || null,
        placa: placa || null,
        estado,
      });

    if (errorSupabase) {
      console.error(errorSupabase);
      setError(
        `No se pudo guardar el motorizado: ${errorSupabase.message}`
      );
      setGuardando(false);
      return;
    }

    formularioElemento.reset();
    setMensaje("Motorizado guardado correctamente.");
    setGuardando(false);

    window.setTimeout(() => {
      router.push("/motorizados");
      router.refresh();
    }, 1000);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">
              Registro del equipo de reparto
            </p>

            <h1 className="mt-1 text-3xl font-black md:text-4xl">
              🛵 Nuevo motorizado
            </h1>
          </div>

          <Link
            href="/motorizados"
            className="w-fit rounded-xl border border-slate-700 px-5 py-3 font-semibold transition hover:bg-slate-800"
          >
            ← Volver a motorizados
          </Link>
        </header>

        <form
          onSubmit={guardarMotorizado}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl md:p-8"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="font-semibold text-slate-200">
                Nombre completo
              </span>

              <input
                type="text"
                name="nombre"
                required
                disabled={guardando}
                className={estiloCampo}
                placeholder="Ejemplo: José Martínez"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="font-semibold text-slate-200">
                Teléfono
              </span>

              <input
                type="tel"
                name="telefono"
                disabled={guardando}
                className={estiloCampo}
                placeholder="Ejemplo: 8888 8888"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="font-semibold text-slate-200">
                Placa
              </span>

              <input
                type="text"
                name="placa"
                disabled={guardando}
                className={estiloCampo}
                placeholder="Ejemplo: M 123456"
              />
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="font-semibold text-slate-200">
                Estado inicial
              </span>

              <select
                name="estado"
                defaultValue="Disponible"
                disabled={guardando}
                className={estiloCampo}
              >
                <option value="Disponible">Disponible</option>
                <option value="Ocupado">Ocupado</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </label>
          </div>

          {error && (
            <div className="mt-8 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
              ❌ {error}
            </div>
          )}

          {mensaje && (
            <div className="mt-8 rounded-xl border border-green-500/40 bg-green-500/10 px-5 py-4 text-green-300">
              ✅ {mensaje}
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/motorizados"
              className="rounded-xl border border-slate-700 px-6 py-3 text-center font-bold transition hover:bg-slate-800"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={guardando}
              className="rounded-xl bg-green-600 px-8 py-3 font-bold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? "Guardando..." : "Guardar motorizado"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}