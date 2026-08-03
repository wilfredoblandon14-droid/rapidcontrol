"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const estiloCampo =
  "w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 disabled:cursor-not-allowed disabled:opacity-60";

export default function NuevoCliente() {
  const router = useRouter();

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function guardarCliente(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formularioElemento = event.currentTarget;
    const formulario = new FormData(formularioElemento);

    setGuardando(true);
    setMensaje("");
    setError("");

    const nombre = formulario.get("nombre")?.toString().trim() ?? "";
    const telefono = formulario.get("telefono")?.toString().trim() ?? "";
    const direccion = formulario.get("direccion")?.toString().trim() ?? "";
    const referencia = formulario.get("referencia")?.toString().trim() ?? "";

    if (!nombre || !telefono || !direccion) {
      setError("Completa el nombre, teléfono y dirección.");
      setGuardando(false);
      return;
    }

    const { error: errorSupabase } = await supabase.from("clientes").insert({
      nombre,
      telefono,
      direccion,
      referencia: referencia || null,
    });

    if (errorSupabase) {
      console.error(errorSupabase);
      setError(`No se pudo guardar el cliente: ${errorSupabase.message}`);
      setGuardando(false);
      return;
    }

    formularioElemento.reset();
    setMensaje("Cliente guardado correctamente.");
    setGuardando(false);

    window.setTimeout(() => {
      router.push("/clientes");
      router.refresh();
    }, 1000);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">Registro de clientes</p>

            <h1 className="mt-1 text-3xl font-black md:text-4xl">
              👤 Nuevo cliente
            </h1>
          </div>

          <Link
            href="/clientes"
            className="w-fit rounded-xl border border-slate-700 px-5 py-3 font-semibold transition hover:bg-slate-800"
          >
            ← Volver a clientes
          </Link>
        </header>

        <form
          onSubmit={guardarCliente}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl md:p-8"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="font-semibold text-slate-200">
                Nombre completo
              </span>

              <input
                type="text"
                name="nombre"
                required
                disabled={guardando}
                className={estiloCampo}
                placeholder="Ejemplo: Juan Pérez"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="font-semibold text-slate-200">Teléfono</span>

              <input
                type="tel"
                name="telefono"
                required
                disabled={guardando}
                className={estiloCampo}
                placeholder="Ejemplo: 8888 8888"
              />
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="font-semibold text-slate-200">Dirección</span>

              <textarea
                name="direccion"
                required
                rows={4}
                disabled={guardando}
                className={estiloCampo}
                placeholder="Dirección principal del cliente"
              />
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="font-semibold text-slate-200">
                Referencia
              </span>

              <textarea
                name="referencia"
                rows={3}
                disabled={guardando}
                className={estiloCampo}
                placeholder="Ejemplo: casa azul, frente al parque"
              />
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
              href="/clientes"
              className="rounded-xl border border-slate-700 px-6 py-3 text-center font-bold transition hover:bg-slate-800"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={guardando}
              className="rounded-xl bg-green-600 px-8 py-3 font-bold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? "Guardando..." : "Guardar cliente"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}