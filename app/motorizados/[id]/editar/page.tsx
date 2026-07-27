"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
type EstadoMotorizado = "Disponible" | "Ocupado" | "Inactivo";

type Motorizado = {
  id: number;
  nombre: string;
  telefono: string | null;
  placa: string | null;
  estado: EstadoMotorizado;
};

const estiloCampo =
  "w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 disabled:cursor-not-allowed disabled:opacity-60";

export default function EditarMotorizado() {
  const params = useParams();
  const router = useRouter();

  const id = Number(params.id);

  const [motorizado, setMotorizado] = useState<Motorizado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    async function cargarMotorizado() {
      if (!Number.isFinite(id)) {
        setError("El identificador del motorizado no es válido.");
        setCargando(false);
        return;
      }

      setCargando(true);
      setError("");

      const { data, error: errorConsulta } = await supabase
        .from("motorizados")
        .select("id, nombre, telefono, placa, estado")
        .eq("id", id)
        .single();

      if (errorConsulta) {
        console.error(errorConsulta);
        setError(
          `No se pudo cargar el motorizado: ${errorConsulta.message}`
        );
        setCargando(false);
        return;
      }

      setMotorizado(data as Motorizado);
      setCargando(false);
    }

    void cargarMotorizado();
  }, [id]);

  async function guardarCambios(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formulario = new FormData(event.currentTarget);

    const nombre = formulario.get("nombre")?.toString().trim() ?? "";
    const telefono = formulario.get("telefono")?.toString().trim() ?? "";
    const placa = formulario.get("placa")?.toString().trim() ?? "";
    const estado =
      (formulario.get("estado")?.toString() as EstadoMotorizado) ??
      "Disponible";

    if (!nombre) {
      setError("Escribe el nombre del motorizado.");
      return;
    }

    setGuardando(true);
    setError("");
    setMensaje("");

    const { error: errorActualizacion } = await supabase
      .from("motorizados")
      .update({
        nombre,
        telefono: telefono || null,
        placa: placa || null,
        estado,
      })
      .eq("id", id);

    if (errorActualizacion) {
      console.error(errorActualizacion);
      setError(
        `No se pudieron guardar los cambios: ${errorActualizacion.message}`
      );
      setGuardando(false);
      return;
    }

    setMensaje("Motorizado actualizado correctamente.");
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
              Gestión del equipo de reparto
            </p>

            <h1 className="mt-1 text-3xl font-black md:text-4xl">
              ✏️ Editar motorizado
            </h1>
          </div>

          <Link
            href="/motorizados"
            className="w-fit rounded-xl border border-slate-700 px-5 py-3 font-semibold transition hover:bg-slate-800"
          >
            ← Volver a motorizados
          </Link>
        </header>

        {cargando && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-14 text-center text-slate-400">
            Cargando motorizado...
          </div>
        )}

        {!cargando && error && !motorizado && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
            ❌ {error}
          </div>
        )}

        {!cargando && motorizado && (
          <form
            onSubmit={guardarCambios}
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
                  defaultValue={motorizado.nombre}
                  disabled={guardando}
                  className={estiloCampo}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-slate-200">
                  Teléfono
                </span>

                <input
                  type="tel"
                  name="telefono"
                  defaultValue={motorizado.telefono ?? ""}
                  disabled={guardando}
                  className={estiloCampo}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-slate-200">
                  Placa
                </span>

                <input
                  type="text"
                  name="placa"
                  defaultValue={motorizado.placa ?? ""}
                  disabled={guardando}
                  className={estiloCampo}
                />
              </label>

              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="font-semibold text-slate-200">
                  Estado
                </span>

                <select
                  name="estado"
                  defaultValue={motorizado.estado}
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
                className="rounded-xl bg-green-600 px-8 py-3 font-bold text-white transition hover:bg-green-500 disabled:cursor-wait disabled:opacity-60"
              >
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}