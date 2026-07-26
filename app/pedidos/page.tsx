"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Pedido = {
  id: number;
  nombre_cliente: string;
  telefono: string;
  direccion_recogida: string;
  direccion_entrega: string;
  costo_envio: number;
  monto_compra: number;
  estado: string;
  metodo_pago: string;
  created_at: string;
  motorizados:
    | {
        nombre: string;
      }[]
    | null;
};

function estiloEstado(estado: string) {
  if (estado === "Entregado") {
    return "bg-green-500/15 text-green-400";
  }

  if (estado === "En camino") {
    return "bg-amber-500/15 text-amber-400";
  }

  if (estado === "Asignado") {
    return "bg-blue-500/15 text-blue-400";
  }

  if (estado === "Cancelado") {
    return "bg-red-500/15 text-red-400";
  }

  return "bg-slate-500/15 text-slate-300";
}

function formatearFecha(fecha: string) {
  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(fecha));
}

function formatearDinero(valor: number) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
  }).format(valor);
}

export default function ListaPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargarPedidos() {
      setCargando(true);
      setError("");

      const { data, error: errorSupabase } = await supabase
        .from("pedidos")
        .select(`
          id,
          nombre_cliente,
          telefono,
          direccion_recogida,
          direccion_entrega,
          costo_envio,
          monto_compra,
          estado,
          metodo_pago,
          created_at,
          motorizados (
            nombre
          )
        `)
        .order("created_at", { ascending: false });

      if (errorSupabase) {
        console.error(errorSupabase);
        setError(errorSupabase.message);
        setCargando(false);
        return;
      }

      setPedidos((data ?? []) as Pedido[]);
      setCargando(false);
    }

    cargarPedidos();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">Gestión de pedidos</p>

            <h1 className="text-3xl font-black md:text-4xl">
              📦 Pedidos
            </h1>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="rounded-xl border border-slate-700 px-5 py-3 text-center font-semibold hover:bg-slate-800"
            >
              ← Dashboard
            </Link>

            <Link
              href="/pedidos/nuevo"
              className="rounded-xl bg-green-600 px-5 py-3 text-center font-bold hover:bg-green-700"
            >
              + Nuevo pedido
            </Link>
          </div>
        </header>

        {cargando && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-300">
            Cargando pedidos...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-6 text-red-300">
            No se pudieron cargar los pedidos: {error}
          </div>
        )}

        {!cargando && !error && pedidos.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <p className="text-xl font-bold">
              Todavía no hay pedidos
            </p>

            <p className="mt-2 text-slate-400">
              Registra el primer pedido para verlo aquí.
            </p>
          </div>
        )}

        {!cargando && !error && pedidos.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 p-5">
              <p className="text-sm text-slate-400">
                Total de pedidos: {pedidos.length}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Pedido</th>
                    <th className="px-5 py-4">Cliente</th>
                    <th className="px-5 py-4">Teléfono</th>
                    <th className="px-5 py-4">Ruta</th>
                    <th className="px-5 py-4">Motorizado</th>
                    <th className="px-5 py-4">Pago</th>
                    <th className="px-5 py-4">Estado</th>
                    <th className="px-5 py-4">Envío</th>
                    <th className="px-5 py-4">Total</th>
                    <th className="px-5 py-4">Fecha</th>
                  </tr>
                </thead>

                <tbody>
                  {pedidos.map((pedido) => {
                    const total =
                      Number(pedido.costo_envio) +
                      Number(pedido.monto_compra);

                    return (
                      <tr
                        key={pedido.id}
                        className="border-t border-slate-800"
                      >
                        <td className="px-5 py-4 font-bold text-green-400">
                          #{pedido.id}
                        </td>

                        <td className="px-5 py-4 font-semibold">
                          {pedido.nombre_cliente}
                        </td>

                        <td className="px-5 py-4 text-slate-300">
                          {pedido.telefono}
                        </td>

                        <td className="max-w-72 px-5 py-4 text-slate-300">
                          <p className="truncate">
                            {pedido.direccion_recogida}
                          </p>

                          <p className="mt-1 truncate text-slate-500">
                            → {pedido.direccion_entrega}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-slate-300">
                          {pedido.motorizados?.[0]?.nombre ??
                            "Sin asignar"}
                        </td>

                        <td className="px-5 py-4 text-slate-300">
                          {pedido.metodo_pago}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${estiloEstado(
                              pedido.estado
                            )}`}
                          >
                            {pedido.estado}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {formatearDinero(
                            Number(pedido.costo_envio)
                          )}
                        </td>

                        <td className="px-5 py-4 font-bold">
                          {formatearDinero(total)}
                        </td>

                        <td className="px-5 py-4 text-slate-400">
                          {formatearFecha(pedido.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}