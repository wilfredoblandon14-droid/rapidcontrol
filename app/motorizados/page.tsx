"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type EstadoMotorizado = "Disponible" | "Ocupado" | "Inactivo";

type Motorizado = {
  id: number;
  nombre: string;
  telefono: string | null;
  placa: string | null;
  estado: EstadoMotorizado;
  created_at: string;
};

type PedidoMotorizado = {
  id: number;
  motorizado_id: number | null;
  estado: string;
};

const estados: EstadoMotorizado[] = [
  "Disponible",
  "Ocupado",
  "Inactivo",
];

function estiloEstado(estado: EstadoMotorizado) {
  if (estado === "Disponible") {
    return "border-green-500/40 bg-green-500/15 text-green-300";
  }

  if (estado === "Ocupado") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  }

  return "border-red-500/40 bg-red-500/15 text-red-300";
}

function formatearFecha(fecha: string) {
  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(fecha));
}

export default function ListaMotorizados() {
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [pedidos, setPedidos] = useState<PedidoMotorizado[]>([]);

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [actualizando, setActualizando] = useState<number | null>(null);
  const [eliminando, setEliminando] = useState<number | null>(null);

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true);
      setError("");

      const [respuestaMotorizados, respuestaPedidos] = await Promise.all([
        supabase
          .from("motorizados")
          .select("id, nombre, telefono, placa, estado, created_at")
          .order("nombre", { ascending: true }),

        supabase
          .from("pedidos")
          .select("id, motorizado_id, estado"),
      ]);

      if (respuestaMotorizados.error) {
        console.error(respuestaMotorizados.error);
        setError(
          `No se pudieron cargar los motorizados: ${respuestaMotorizados.error.message}`
        );
        setCargando(false);
        return;
      }

      if (respuestaPedidos.error) {
        console.error(respuestaPedidos.error);
        setError(
          `No se pudieron cargar los pedidos: ${respuestaPedidos.error.message}`
        );
        setCargando(false);
        return;
      }

      setMotorizados(
        (respuestaMotorizados.data ?? []) as Motorizado[]
      );

      setPedidos((respuestaPedidos.data ?? []) as PedidoMotorizado[]);
      setCargando(false);
    }

    void cargarDatos();
  }, []);

  const motorizadosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) {
      return motorizados;
    }

    return motorizados.filter((motorizado) => {
      return (
        motorizado.nombre.toLowerCase().includes(texto) ||
        motorizado.telefono?.toLowerCase().includes(texto) ||
        motorizado.placa?.toLowerCase().includes(texto) ||
        motorizado.estado.toLowerCase().includes(texto)
      );
    });
  }, [busqueda, motorizados]);

  async function cambiarEstado(
    motorizadoId: number,
    nuevoEstado: EstadoMotorizado
  ) {
    const motorizadoAnterior = motorizados.find(
      (motorizado) => motorizado.id === motorizadoId
    );

    if (!motorizadoAnterior || motorizadoAnterior.estado === nuevoEstado) {
      return;
    }

    setActualizando(motorizadoId);
    setError("");
    setMensaje("");

    setMotorizados((motorizadosActuales) =>
      motorizadosActuales.map((motorizado) =>
        motorizado.id === motorizadoId
          ? {
              ...motorizado,
              estado: nuevoEstado,
            }
          : motorizado
      )
    );

    const { error: errorActualizacion } = await supabase
      .from("motorizados")
      .update({ estado: nuevoEstado })
      .eq("id", motorizadoId);

    if (errorActualizacion) {
      console.error(errorActualizacion);

      setMotorizados((motorizadosActuales) =>
        motorizadosActuales.map((motorizado) =>
          motorizado.id === motorizadoId
            ? motorizadoAnterior
            : motorizado
        )
      );

      setError(
        `No se pudo actualizar el estado: ${errorActualizacion.message}`
      );

      setActualizando(null);
      return;
    }

    setMensaje(
      `${motorizadoAnterior.nombre} ahora está "${nuevoEstado}".`
    );

    setActualizando(null);

    window.setTimeout(() => {
      setMensaje("");
    }, 2500);
  }

  async function eliminarMotorizado(motorizado: Motorizado) {
    const pedidosRelacionados = pedidos.filter(
      (pedido) => pedido.motorizado_id === motorizado.id
    );

    if (pedidosRelacionados.length > 0) {
      setError(
        `No puedes eliminar a ${motorizado.nombre} porque tiene ${pedidosRelacionados.length} pedido(s) relacionado(s). Puedes marcarlo como Inactivo.`
      );
      return;
    }

    const confirmado = window.confirm(
      `¿Seguro que deseas eliminar a ${motorizado.nombre}?`
    );

    if (!confirmado) {
      return;
    }

    setEliminando(motorizado.id);
    setError("");
    setMensaje("");

    const { error: errorEliminacion } = await supabase
      .from("motorizados")
      .delete()
      .eq("id", motorizado.id);

    if (errorEliminacion) {
      console.error(errorEliminacion);
      setError(
        `No se pudo eliminar el motorizado: ${errorEliminacion.message}`
      );
      setEliminando(null);
      return;
    }

    setMotorizados((motorizadosActuales) =>
      motorizadosActuales.filter(
        (item) => item.id !== motorizado.id
      )
    );

    setMensaje(
      `Motorizado "${motorizado.nombre}" eliminado correctamente.`
    );

    setEliminando(null);

    window.setTimeout(() => {
      setMensaje("");
    }, 2500);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">
              Gestión del equipo de reparto
            </p>

            <h1 className="mt-1 text-3xl font-black md:text-4xl">
              🛵 Motorizados
            </h1>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="rounded-xl border border-slate-700 px-6 py-3 text-center font-bold transition hover:bg-slate-800"
            >
              ← Dashboard
            </Link>

            <Link
              href="/motorizados/nuevo"
              className="rounded-xl bg-green-600 px-6 py-3 text-center font-bold transition hover:bg-green-500"
            >
              + Nuevo motorizado
            </Link>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
            ❌ {error}
          </div>
        )}

        {mensaje && (
          <div className="mb-5 rounded-xl border border-green-500/40 bg-green-500/10 px-5 py-4 text-green-300">
            ✅ {mensaje}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Total motorizados
            </p>

            <p className="mt-2 text-3xl font-black">
              {motorizados.length}
            </p>
          </article>

          <article className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
            <p className="text-sm text-green-300">
              Disponibles
            </p>

            <p className="mt-2 text-3xl font-black text-green-400">
              {
                motorizados.filter(
                  (motorizado) =>
                    motorizado.estado === "Disponible"
                ).length
              }
            </p>
          </article>

          <article className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-300">
              Ocupados
            </p>

            <p className="mt-2 text-3xl font-black text-amber-400">
              {
                motorizados.filter(
                  (motorizado) => motorizado.estado === "Ocupado"
                ).length
              }
            </p>
          </article>

          <article className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="text-sm text-red-300">
              Inactivos
            </p>

            <p className="mt-2 text-3xl font-black text-red-400">
              {
                motorizados.filter(
                  (motorizado) => motorizado.estado === "Inactivo"
                ).length
              }
            </p>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex flex-col gap-4 border-b border-slate-800 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-slate-400">
                Resultados:{" "}
                <span className="font-bold text-white">
                  {motorizadosFiltrados.length}
                </span>
              </p>
            </div>

            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por nombre, teléfono, placa o estado"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 md:max-w-md"
            />
          </div>

          {cargando && (
            <div className="px-5 py-14 text-center text-slate-400">
              Cargando motorizados...
            </div>
          )}

          {!cargando && motorizados.length === 0 && (
            <div className="px-5 py-14 text-center">
              <p className="text-lg font-semibold text-slate-300">
                No hay motorizados registrados.
              </p>

              <Link
                href="/motorizados/nuevo"
                className="mt-5 inline-block rounded-xl bg-green-600 px-6 py-3 font-bold transition hover:bg-green-500"
              >
                Crear primer motorizado
              </Link>
            </div>
          )}

          {!cargando &&
            motorizados.length > 0 &&
            motorizadosFiltrados.length === 0 && (
              <div className="px-5 py-14 text-center text-slate-400">
                No se encontraron motorizados con esa búsqueda.
              </div>
            )}

          {!cargando && motorizadosFiltrados.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-left">
                <thead className="bg-slate-950/50 text-sm text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Motorizado</th>
                    <th className="px-5 py-4">Teléfono</th>
                    <th className="px-5 py-4">Placa</th>
                    <th className="px-5 py-4">Estado</th>
                    <th className="px-5 py-4">Pedidos</th>
                    <th className="px-5 py-4">Entregados</th>
                    <th className="px-5 py-4">Registrado</th>
                    <th className="px-5 py-4 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {motorizadosFiltrados.map((motorizado) => {
                    const pedidosMotorizado = pedidos.filter(
                      (pedido) =>
                        pedido.motorizado_id === motorizado.id
                    );

                    const pedidosEntregados =
                      pedidosMotorizado.filter(
                        (pedido) =>
                          pedido.estado === "Entregado"
                      ).length;

                    const estaActualizando =
                      actualizando === motorizado.id;

                    const estaEliminando =
                      eliminando === motorizado.id;

                    return (
                      <tr
                        key={motorizado.id}
                        className="border-t border-slate-800 transition hover:bg-slate-800/40"
                      >
                        <td className="px-5 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-xl">
                              🛵
                            </div>

                            <div>
                              <p className="font-bold">
                                {motorizado.nombre}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                Motorizado #{motorizado.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-5 text-slate-300">
                          {motorizado.telefono || "Sin teléfono"}
                        </td>

                        <td className="px-5 py-5 text-slate-300">
                          {motorizado.placa || "Sin placa"}
                        </td>

                        <td className="px-5 py-5">
                          <select
                            value={motorizado.estado}
                            disabled={estaActualizando}
                            onChange={(event) =>
                              void cambiarEstado(
                                motorizado.id,
                                event.target.value as EstadoMotorizado
                              )
                            }
                            className={`rounded-xl border px-3 py-2 text-sm font-bold outline-none disabled:cursor-wait disabled:opacity-60 ${estiloEstado(
                              motorizado.estado
                            )}`}
                          >
                            {estados.map((estado) => (
                              <option
                                key={estado}
                                value={estado}
                                className="bg-slate-900 text-white"
                              >
                                {estado}
                              </option>
                            ))}
                          </select>

                          {estaActualizando && (
                            <p className="mt-2 text-xs text-slate-400">
                              Guardando...
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-5 font-black">
                          {pedidosMotorizado.length}
                        </td>

                        <td className="px-5 py-5 font-black text-green-400">
                          {pedidosEntregados}
                        </td>

                        <td className="whitespace-nowrap px-5 py-5 text-slate-400">
                          {formatearFecha(motorizado.created_at)}
                        </td>

                        <td className="px-5 py-5">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/motorizados/${motorizado.id}`}
                              className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-300 transition hover:bg-green-500/20"
                            >
                              Expediente
                            </Link>

                            <Link
                              href={`/motorizados/${motorizado.id}/editar`}
                              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold transition hover:bg-slate-800"
                            >
                              Editar
                            </Link>

                            <button
                              type="button"
                              disabled={estaEliminando}
                              onClick={() =>
                                void eliminarMotorizado(motorizado)
                              }
                              className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-wait disabled:opacity-60"
                            >
                              {estaEliminando
                                ? "Eliminando..."
                                : "Eliminar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}