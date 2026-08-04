"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Motorizado = {
  id: number;
  nombre: string;
  telefono: string | null;
  placa: string | null;
  estado: string;
  created_at: string;
};

type Pedido = {
  id: number;
  estado: string;
  nombre_cliente: string;
  costo_envio: number | null;
  created_at: string;
};

type Fondo = { id: number; monto: number; fecha: string; created_at: string };
type Gasto = { id: number; tipo: string; monto: number; observacion: string | null; created_at: string };
type Liquidacion = {
  id: number;
  fondo_entregado: number;
  envios_generados: number;
  gasolina: number;
  recargas: number;
  otros_gastos: number;
  esperado: number;
  recibido: number;
  diferencia: number;
  created_at: string;
};

function dinero(v: number) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
  }).format(v);
}

function fecha(v: string | null) {
  return v
    ? new Intl.DateTimeFormat("es-NI", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(v))
    : "Sin información";
}

export default function ExpedienteMotorizado() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [motorizado, setMotorizado] = useState<Motorizado | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargar() {
      const [rm, rp, rf, rg, rl] = await Promise.all([
        supabase
          .from("motorizados")
          .select("id,nombre,telefono,placa,estado,created_at")
          .eq("id", id)
          .single(),
        supabase
          .from("pedidos")
          .select("id,estado,nombre_cliente,costo_envio,created_at")
          .eq("motorizado_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("fondos_motorizado")
          .select("id,monto,fecha,created_at")
          .eq("motorizado_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("gastos_motorizado")
          .select("id,tipo,monto,observacion,created_at")
          .eq("motorizado_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("liquidaciones_motorizado")
          .select(
            "id,fondo_entregado,envios_generados,gasolina,recargas,otros_gastos,esperado,recibido,diferencia,created_at"
          )
          .eq("motorizado_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (rm.error || !rm.data) {
        setError(rm.error?.message ?? "Motorizado no encontrado.");
        setCargando(false);
        return;
      }

      setMotorizado(rm.data as Motorizado);
      setPedidos((rp.data ?? []) as Pedido[]);
      setFondos((rf.data ?? []) as Fondo[]);
      setGastos((rg.data ?? []) as Gasto[]);
      setLiquidaciones((rl.data ?? []) as Liquidacion[]);
      setCargando(false);
    }

    if (Number.isFinite(id)) void cargar();
  }, [id]);

  const datos = useMemo(() => {
    const entregados = pedidos.filter((p) => p.estado === "Entregado");
    const cancelados = pedidos.filter((p) => p.estado === "Cancelado");
    const ingresos = entregados.reduce(
      (s, p) => s + Number(p.costo_envio ?? 0),
      0
    );
    const fondosTotal = fondos.reduce((s, f) => s + Number(f.monto ?? 0), 0);
    const porTipo = (tipo: string) =>
      gastos
        .filter((g) => g.tipo === tipo)
        .reduce((s, g) => s + Number(g.monto ?? 0), 0);
    const diferenciaTotal = liquidaciones.reduce(
      (s, l) => s + Number(l.diferencia ?? 0),
      0
    );

    return {
      total: pedidos.length,
      entregados: entregados.length,
      cancelados: cancelados.length,
      cumplimiento:
        pedidos.length > 0
          ? Math.round((entregados.length / pedidos.length) * 100)
          : 0,
      ingresos,
      fondosTotal,
      gasolina: porTipo("Gasolina"),
      recargas: porTipo("Recarga"),
      otros: gastos
        .filter((g) => !["Gasolina", "Recarga"].includes(g.tipo))
        .reduce((s, g) => s + Number(g.monto ?? 0), 0),
      diferenciaTotal,
      primero: pedidos[pedidos.length - 1]?.created_at ?? null,
      ultimo: pedidos[0]?.created_at ?? null,
    };
  }, [fondos, gastos, liquidaciones, pedidos]);

  if (cargando) {
    return <main className="min-h-screen bg-slate-950 p-8 text-center text-slate-400">Cargando expediente...</main>;
  }

  if (error || !motorizado) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
          {error || "Motorizado no encontrado."}
        </div>
      </main>
    );
  }

  const actividad = [
    ...pedidos.map((p) => ({
      fecha: p.created_at,
      icono: "📦",
      titulo: `Pedido #${p.id} · ${p.estado}`,
      detalle: `${p.nombre_cliente} · ${dinero(Number(p.costo_envio ?? 0))}`,
    })),
    ...gastos.map((g) => ({
      fecha: g.created_at,
      icono: g.tipo === "Gasolina" ? "⛽" : g.tipo === "Recarga" ? "📶" : "🧾",
      titulo: `${g.tipo} · ${dinero(Number(g.monto ?? 0))}`,
      detalle: g.observacion || "Sin observación",
    })),
    ...liquidaciones.map((l) => ({
      fecha: l.created_at,
      icono: "💰",
      titulo: `Liquidación · ${dinero(Number(l.recibido ?? 0))}`,
      detalle: `Diferencia ${dinero(Number(l.diferencia ?? 0))}`,
    })),
  ]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 100);

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-400">
              Expediente del motorizado
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              🛵 {motorizado.nombre}
            </h1>
            <p className="mt-2 text-slate-400">
              {motorizado.placa || "Sin placa"} · {motorizado.estado}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/motorizados" className="rounded-xl border border-slate-700 px-5 py-3 font-bold">
              ← Motorizados
            </Link>
            <Link
              href={`/motorizados/${motorizado.id}/editar`}
              className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-5 py-3 font-bold text-blue-300"
            >
              Editar
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Pedidos", datos.total, `${datos.entregados} entregados`],
            ["Cumplimiento", `${datos.cumplimiento}%`, `${datos.cancelados} cancelados`],
            ["Ingresos generados", dinero(datos.ingresos), "Costo de envíos entregados"],
            ["Fondos recibidos", dinero(datos.fondosTotal), `${fondos.length} entregas de fondo`],
            ["Gasolina", dinero(datos.gasolina), "Gasto histórico registrado"],
            ["Recargas", dinero(datos.recargas), "Internet y saldo"],
            ["Otros gastos", dinero(datos.otros), "Gastos adicionales"],
            ["Diferencia acumulada", dinero(datos.diferenciaTotal), `${liquidaciones.length} liquidaciones`],
          ].map(([titulo, valor, detalle]) => (
            <article key={String(titulo)} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">{titulo}</p>
              <p className="mt-2 text-2xl font-black">{valor}</p>
              <p className="mt-2 text-xs text-slate-500">{detalle}</p>
            </article>
          ))}
        </section>

        <section className="mb-6 grid gap-5 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="font-black">Información</h2>
            <dl className="mt-4 space-y-4">
              <div><dt className="text-xs text-slate-500">Teléfono</dt><dd className="mt-1 font-bold">{motorizado.telefono || "Sin teléfono"}</dd></div>
              <div><dt className="text-xs text-slate-500">Registrado</dt><dd className="mt-1 font-bold">{fecha(motorizado.created_at)}</dd></div>
              <div><dt className="text-xs text-slate-500">Primer servicio</dt><dd className="mt-1 font-bold">{fecha(datos.primero)}</dd></div>
              <div><dt className="text-xs text-slate-500">Último servicio</dt><dd className="mt-1 font-bold">{fecha(datos.ultimo)}</dd></div>
            </dl>
          </article>

          <article className="lg:col-span-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 p-6">
              <h2 className="text-xl font-black">Historial cronológico</h2>
              <p className="mt-1 text-sm text-slate-400">Pedidos, gastos y liquidaciones.</p>
            </div>
            <div className="max-h-[650px] divide-y divide-slate-800 overflow-y-auto">
              {actividad.length === 0 ? (
                <p className="p-6 text-slate-400">No hay actividad registrada.</p>
              ) : (
                actividad.map((a, i) => (
                  <div key={`${a.fecha}-${i}`} className="flex gap-4 p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xl">
                      {a.icono}
                    </div>
                    <div>
                      <p className="font-bold">{a.titulo}</p>
                      <p className="mt-1 text-sm text-slate-400">{a.detalle}</p>
                      <p className="mt-2 text-xs text-slate-500">{fecha(a.fecha)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
