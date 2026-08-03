"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Pedido = {
  id: number;
  nombre_cliente: string;
  estado: string;
  costo_envio: number | null;
  created_at: string;
};

type Motorizado = {
  id: number;
  nombre: string;
  estado: string;
};

type SesionCaja = {
  id: number;
  estado: string;
  monto_inicial: number;
  opened_at: string;
};

type MovimientoCaja = {
  tipo: "Ingreso" | "Egreso";
  monto: number;
  created_at: string;
};

type Fondo = {
  motorizado_id: number;
  fecha: string;
};

type Liquidacion = {
  motorizado_id: number;
  fecha: string;
};

function inicioDia() {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  return fecha.toISOString();
}

function fechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

function dinero(valor: number) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
  }).format(valor || 0);
}

function colorEstado(estado: string) {
  if (estado === "Entregado") return "bg-green-500/15 text-green-300";
  if (estado === "En camino") return "bg-amber-500/15 text-amber-300";
  if (estado === "Recogido") return "bg-violet-500/15 text-violet-300";
  if (estado === "Asignado") return "bg-blue-500/15 text-blue-300";
  if (estado === "Cancelado") return "bg-red-500/15 text-red-300";
  return "bg-slate-500/15 text-slate-300";
}

export default function OperacionesPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [sesionCaja, setSesionCaja] = useState<SesionCaja | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargar() {
    setCargando(true);
    setError("");

    const hoy = fechaHoy();
    const [rPedidos, rMotorizados, rCaja, rMovimientos, rFondos, rLiquidaciones] =
      await Promise.all([
        supabase
          .from("pedidos")
          .select("id,nombre_cliente,estado,costo_envio,created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("motorizados")
          .select("id,nombre,estado")
          .order("nombre"),
        supabase
          .from("sesiones_caja")
          .select("id,estado,monto_inicial,opened_at")
          .eq("estado", "Abierta")
          .maybeSingle(),
        supabase
          .from("movimientos_caja")
          .select("tipo,monto,created_at")
          .gte("created_at", inicioDia()),
        supabase
          .from("fondos_motorizado")
          .select("motorizado_id,fecha")
          .eq("fecha", hoy),
        supabase
          .from("liquidaciones_motorizado")
          .select("motorizado_id,fecha")
          .eq("fecha", hoy),
      ]);

    const respuestas = [
      rPedidos.error,
      rMotorizados.error,
      rCaja.error,
      rMovimientos.error,
      rFondos.error,
      rLiquidaciones.error,
    ].filter(Boolean);

    if (respuestas.length > 0) {
      setError(respuestas[0]?.message ?? "No se pudo cargar el panel operativo.");
      setCargando(false);
      return;
    }

    setPedidos((rPedidos.data ?? []) as Pedido[]);
    setMotorizados((rMotorizados.data ?? []) as Motorizado[]);
    setSesionCaja((rCaja.data as SesionCaja | null) ?? null);
    setMovimientos((rMovimientos.data ?? []) as MovimientoCaja[]);
    setFondos((rFondos.data ?? []) as Fondo[]);
    setLiquidaciones((rLiquidaciones.data ?? []) as Liquidacion[]);
    setCargando(false);
  }

  useEffect(() => {
    void cargar();

    const canal = supabase
      .channel("operaciones-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        () => void cargar()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, []);

  const resumen = useMemo(() => {
    const pedidosPendientes = pedidos.filter((pedido) =>
      ["Pendiente", "Asignado", "Recogido", "En camino"].includes(pedido.estado)
    ).length;
    const disponibles = motorizados.filter(
      (motorizado) => motorizado.estado === "Disponible"
    ).length;
    const ingresos = movimientos
      .filter((movimiento) => movimiento.tipo === "Ingreso")
      .reduce((total, movimiento) => total + Number(movimiento.monto || 0), 0);
    const egresos = movimientos
      .filter((movimiento) => movimiento.tipo === "Egreso")
      .reduce((total, movimiento) => total + Number(movimiento.monto || 0), 0);
    const liquidados = new Set(liquidaciones.map((item) => item.motorizado_id));
    const pendientesLiquidar = new Set(
      fondos
        .map((item) => item.motorizado_id)
        .filter((motorizadoId) => !liquidados.has(motorizadoId))
    ).size;

    return {
      pedidosPendientes,
      disponibles,
      balanceHoy: ingresos - egresos,
      pendientesLiquidar,
    };
  }, [fondos, liquidaciones, motorizados, movimientos, pedidos]);

  const pedidosRecientes = pedidos.slice(0, 6);

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">Operación diaria</p>
            <h2 className="mt-1 text-3xl font-black">Panel del operador</h2>
            <p className="mt-2 text-slate-400">
              Pedidos, motorizados, Caja y liquidaciones en una sola pantalla.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void cargar()}
            className="w-fit rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 font-bold transition hover:bg-slate-800"
          >
            🔄 Actualizar
          </button>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
            ❌ {error}
          </div>
        )}

        {cargando ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-14 text-center text-slate-400">
            Cargando operaciones…
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
                <p className="text-sm text-blue-200">Pedidos activos</p>
                <p className="mt-2 text-4xl font-black text-blue-300">
                  {resumen.pedidosPendientes}
                </p>
              </article>

              <article className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
                <p className="text-sm text-green-200">Motorizados disponibles</p>
                <p className="mt-2 text-4xl font-black text-green-300">
                  {resumen.disponibles}
                </p>
              </article>

              <article className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                <p className="text-sm text-amber-200">Caja</p>
                <p className="mt-2 text-2xl font-black text-amber-300">
                  {sesionCaja ? "ABIERTA" : "CERRADA"}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Balance de hoy: {dinero(resumen.balanceHoy)}
                </p>
              </article>

              <article className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
                <p className="text-sm text-violet-200">Pendientes de liquidar</p>
                <p className="mt-2 text-4xl font-black text-violet-300">
                  {resumen.pendientesLiquidar}
                </p>
              </article>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Link
                href="/pedidos/nuevo"
                className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 transition hover:bg-green-500/20"
              >
                <span className="text-3xl">➕</span>
                <h3 className="mt-3 font-black">Nuevo pedido</h3>
                <p className="mt-1 text-sm text-slate-400">Registrar una solicitud.</p>
              </Link>

              <Link
                href="/pedidos"
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:bg-slate-800"
              >
                <span className="text-3xl">📦</span>
                <h3 className="mt-3 font-black">Gestionar pedidos</h3>
                <p className="mt-1 text-sm text-slate-400">Asignar y seguir entregas.</p>
              </Link>

              <Link
                href="/caja"
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:bg-slate-800"
              >
                <span className="text-3xl">💰</span>
                <h3 className="mt-3 font-black">Operar Caja</h3>
                <p className="mt-1 text-sm text-slate-400">Abrir, registrar y cerrar Caja.</p>
              </Link>

              <Link
                href="/liquidaciones"
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:bg-slate-800"
              >
                <span className="text-3xl">🧾</span>
                <h3 className="mt-3 font-black">Liquidaciones</h3>
                <p className="mt-1 text-sm text-slate-400">Fondos, gastos y cierres.</p>
              </Link>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-800 p-5">
                <div>
                  <h3 className="text-lg font-black">Pedidos recientes</h3>
                  <p className="text-sm text-slate-400">Última actividad operativa.</p>
                </div>
                <Link href="/pedidos" className="font-bold text-green-400 hover:text-green-300">
                  Ver todos
                </Link>
              </div>

              {pedidosRecientes.length === 0 ? (
                <p className="px-5 py-12 text-center text-slate-400">
                  No hay pedidos registrados.
                </p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {pedidosRecientes.map((pedido) => (
                    <article
                      key={pedido.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-black text-green-400">Pedido #{pedido.id}</p>
                        <p className="mt-1 font-semibold">{pedido.nombre_cliente}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Intl.DateTimeFormat("es-NI", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(pedido.created_at))}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${colorEstado(
                            pedido.estado
                          )}`}
                        >
                          {pedido.estado}
                        </span>
                        <span className="font-black">{dinero(Number(pedido.costo_envio || 0))}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
