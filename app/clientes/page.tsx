"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Cliente = {
  id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  referencia: string | null;
  created_at: string;
  pedidos: number;
  entregados: number;
  cancelados: number;
  totalEnvios: number;
  ultimoPedido: string | null;
  nivel: "Nuevo" | "Recurrente" | "Frecuente" | "VIP" | "Diamante";
  puntuacion: number;
};

type PedidoCliente = {
  cliente_id: number | null;
  telefono: string;
  estado: string;
  costo_envio: number | null;
  created_at: string;
};

function calcularPuntuacion(
  pedidos: number,
  entregados: number,
  cancelados: number,
  totalEnvios: number,
  ultimoPedido: string | null,
  creadoEn: string
) {
  const puntosVolumen = Math.min(40, pedidos * 1.2);
  const tasaEntrega = pedidos > 0 ? entregados / pedidos : 0;
  const puntosCumplimiento = tasaEntrega * 25;
  const puntosValor = Math.min(15, totalEnvios / 500);

  const diasSinPedir = ultimoPedido
    ? Math.max(
        0,
        (Date.now() - new Date(ultimoPedido).getTime()) / 86_400_000
      )
    : 365;
  const puntosRecencia = Math.max(0, 12 - diasSinPedir / 10);

  const mesesComoCliente = Math.max(
    0,
    (Date.now() - new Date(creadoEn).getTime()) / (30.44 * 86_400_000)
  );
  const puntosAntiguedad = Math.min(8, mesesComoCliente / 3);
  const penalizacionCancelaciones = Math.min(15, cancelados * 2);

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        puntosVolumen +
          puntosCumplimiento +
          puntosValor +
          puntosRecencia +
          puntosAntiguedad -
          penalizacionCancelaciones
      )
    )
  );
}

function nivelCliente(pedidos: number, puntuacion: number): Cliente["nivel"] {
  if (pedidos >= 50 && puntuacion >= 80) return "Diamante";
  if (pedidos >= 25 && puntuacion >= 60) return "VIP";
  if (pedidos >= 10) return "Frecuente";
  if (pedidos >= 3) return "Recurrente";
  return "Nuevo";
}

function dinero(valor: number) {
  return new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" }).format(valor);
}

function formatearFecha(fecha: string) {
  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(fecha));
}

export default function ListaClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [clienteEliminando, setClienteEliminando] = useState<number | null>(
    null
  );

  useEffect(() => {
    async function cargarClientes() {
      setCargando(true);
      setError("");

      const [respuestaClientes, respuestaPedidos] = await Promise.all([
        supabase.from("clientes").select("id, nombre, telefono, direccion, referencia, created_at").order("created_at", { ascending: false }),
        supabase.from("pedidos").select("cliente_id, telefono, estado, costo_envio, created_at"),
      ]);

      if (respuestaClientes.error) {
        console.error(respuestaClientes.error);
        setError(`No se pudieron cargar los clientes: ${respuestaClientes.error.message}`);
        setCargando(false);
        return;
      }
      if (respuestaPedidos.error) {
        console.error(respuestaPedidos.error);
        setError(`No se pudieron calcular las estadísticas: ${respuestaPedidos.error.message}`);
        setCargando(false);
        return;
      }

      const pedidos = (respuestaPedidos.data ?? []) as PedidoCliente[];
      const enriquecidos = (respuestaClientes.data ?? []).map((cliente) => {
        const propios = pedidos.filter((pedido) => pedido.cliente_id === cliente.id || (!pedido.cliente_id && pedido.telefono.replace(/\D/g, "") === cliente.telefono.replace(/\D/g, "")));
        const entregados = propios.filter((pedido) => pedido.estado === "Entregado");
        const cancelados = propios.filter((pedido) => pedido.estado === "Cancelado");
        const ultimoPedido = propios.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0]?.created_at ?? null;
        const totalEnvios = entregados.reduce(
          (suma, pedido) => suma + Number(pedido.costo_envio ?? 0),
          0
        );
        const puntuacion = calcularPuntuacion(
          propios.length,
          entregados.length,
          cancelados.length,
          totalEnvios,
          ultimoPedido,
          cliente.created_at
        );

        return {
          ...cliente,
          pedidos: propios.length,
          entregados: entregados.length,
          cancelados: cancelados.length,
          totalEnvios,
          ultimoPedido,
          puntuacion,
          nivel: nivelCliente(propios.length, puntuacion),
        } as Cliente;
      });

      setClientes(enriquecidos);
      setCargando(false);
    }

    void cargarClientes();
  }, []);

  const clientesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) {
      return clientes;
    }

    return clientes.filter((cliente) => {
      return (
        cliente.nombre.toLowerCase().includes(texto) ||
        cliente.telefono.toLowerCase().includes(texto) ||
        cliente.direccion.toLowerCase().includes(texto) ||
        cliente.referencia?.toLowerCase().includes(texto)
      );
    });
  }, [busqueda, clientes]);

  async function eliminarCliente(cliente: Cliente) {
    const confirmado = window.confirm(
      `¿Seguro que deseas eliminar a ${cliente.nombre}?`
    );

    if (!confirmado) {
      return;
    }

    setClienteEliminando(cliente.id);
    setError("");
    setMensaje("");

    const { error: errorEliminar } = await supabase
      .from("clientes")
      .delete()
      .eq("id", cliente.id);

    if (errorEliminar) {
      console.error(errorEliminar);
      setError(`No se pudo eliminar el cliente: ${errorEliminar.message}`);
      setClienteEliminando(null);
      return;
    }

    setClientes((clientesActuales) =>
      clientesActuales.filter((item) => item.id !== cliente.id)
    );

    setMensaje(`Cliente "${cliente.nombre}" eliminado correctamente.`);
    setClienteEliminando(null);

    window.setTimeout(() => {
      setMensaje("");
    }, 2500);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">Gestión de clientes</p>

            <h1 className="mt-1 text-3xl font-black md:text-4xl">
              👥 Clientes
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
              href="/inteligencia"
              className="rounded-xl border border-green-500/40 bg-green-500/10 px-6 py-3 text-center font-bold text-green-300 transition hover:bg-green-500/20"
            >
              🧠 Ver inteligencia
            </Link>

            <Link
              href="/clientes/nuevo"
              className="rounded-xl bg-green-600 px-6 py-3 text-center font-bold transition hover:bg-green-500"
            >
              + Nuevo cliente
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

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex flex-col gap-4 border-b border-slate-800 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-slate-400">
                Total de clientes:{" "}
                <span className="font-bold text-white">{clientes.length}</span>
              </p>

              {busqueda && (
                <p className="mt-1 text-sm text-slate-500">
                  Resultados encontrados: {clientesFiltrados.length}
                </p>
              )}
            </div>

            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por nombre, teléfono o dirección"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 md:max-w-md"
            />
          </div>

          {cargando && (
            <div className="px-5 py-14 text-center text-slate-400">
              Cargando clientes...
            </div>
          )}

          {!cargando && clientes.length === 0 && (
            <div className="px-5 py-14 text-center">
              <p className="text-lg font-semibold text-slate-300">
                No hay clientes registrados.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Registra el primer cliente para comenzar.
              </p>

              <Link
                href="/clientes/nuevo"
                className="mt-5 inline-block rounded-xl bg-green-600 px-6 py-3 font-bold transition hover:bg-green-500"
              >
                Crear primer cliente
              </Link>
            </div>
          )}

          {!cargando &&
            clientes.length > 0 &&
            clientesFiltrados.length === 0 && (
              <div className="px-5 py-14 text-center text-slate-400">
                No se encontraron clientes con esa búsqueda.
              </div>
            )}

          {!cargando && clientesFiltrados.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1450px] border-collapse text-left">
                <thead className="bg-slate-950/50 text-sm text-slate-400">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Cliente</th>
                    <th className="px-5 py-4 font-semibold">Teléfono</th>
                    <th className="px-5 py-4 font-semibold">Dirección</th>
                    <th className="px-5 py-4 font-semibold">Referencia</th>
                    <th className="px-5 py-4 font-semibold">Pedidos</th>
                    <th className="px-5 py-4 font-semibold">Nivel</th>
                    <th className="px-5 py-4 font-semibold">Puntuación</th>
                    <th className="px-5 py-4 font-semibold">Generado</th>
                    <th className="px-5 py-4 font-semibold">Último pedido</th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {clientesFiltrados.map((cliente) => {
                    const eliminando = clienteEliminando === cliente.id;

                    return (
                      <tr
                        key={cliente.id}
                        className="border-t border-slate-800 transition hover:bg-slate-800/40"
                      >
                        <td className="px-5 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-lg font-black text-green-400">
                              {cliente.nombre.charAt(0).toUpperCase()}
                            </div>

                            <div>
                              <p className="font-bold text-white">
                                {cliente.nombre}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                Cliente #{cliente.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-5 text-slate-300">
                          {cliente.telefono}
                        </td>

                        <td className="px-5 py-5 text-slate-300">
                          <p className="max-w-72 truncate">
                            {cliente.direccion}
                          </p>
                        </td>

                        <td className="px-5 py-5 text-slate-400">
                          {cliente.referencia || "Sin referencia"}
                        </td>

                        <td className="px-5 py-5"><p className="text-xl font-black">{cliente.pedidos}</p><p className="text-xs text-slate-500">{cliente.entregados} entregados · {cliente.cancelados} cancelados</p></td>
                        <td className="px-5 py-5"><span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-black text-green-300">{cliente.nivel}</span></td>
                        <td className="px-5 py-5">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-700">
                              <div
                                className="h-full rounded-full bg-green-500"
                                style={{ width: `${cliente.puntuacion}%` }}
                              />
                            </div>
                            <span className="font-black text-white">
                              {cliente.puntuacion}/100
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-5 font-bold text-green-400">{dinero(cliente.totalEnvios)}</td>
                        <td className="whitespace-nowrap px-5 py-5 text-slate-400">{cliente.ultimoPedido ? formatearFecha(cliente.ultimoPedido) : "Sin pedidos"}</td>

                        <td className="px-5 py-5">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/clientes/${cliente.id}`}
                              className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-500/20"
                            >
                              Expediente
                            </Link>

                            <Link
                              href={`/clientes/${cliente.id}/editar`}
                              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold transition hover:bg-slate-800"
                            >
                              Editar
                            </Link>

                            <button
                              type="button"
                              disabled={eliminando}
                              onClick={() => void eliminarCliente(cliente)}
                              className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-wait disabled:opacity-60"
                            >
                              {eliminando ? "Eliminando..." : "Eliminar"}
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