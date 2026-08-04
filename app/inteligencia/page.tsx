"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Pedido = {
  id: number;
  cliente_id: number | null;
  nombre_cliente: string;
  telefono: string;
  direccion_entrega: string;
  costo_envio: number | null;
  monto_compra: number | null;
  estado: string;
  metodo_pago: string | null;
  origen_pedido: string | null;
  created_at: string;
  motorizado_id: number | null;
  motorizados: { nombre: string } | { nombre: string }[] | null;
};

type Cliente = {
  id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  created_at: string;
};

type ResumenCliente = {
  id: number | null;
  nombre: string;
  telefono: string;
  pedidos: number;
  entregados: number;
  cancelados: number;
  totalEnvios: number;
  promedio: number;
  ultimoPedido: string;
  direccionFavorita: string;
  metodoPago: string;
  nivel: "Nuevo" | "Recurrente" | "Frecuente" | "VIP";
};

function dinero(valor: number) {
  return new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" }).format(valor);
}

function nivelCliente(pedidos: number): ResumenCliente["nivel"] {
  if (pedidos >= 25) return "VIP";
  if (pedidos >= 10) return "Frecuente";
  if (pedidos >= 3) return "Recurrente";
  return "Nuevo";
}

function nombreMotorizado(valor: Pedido["motorizados"]) {
  if (!valor) return "Sin asignar";
  if (Array.isArray(valor)) return valor[0]?.nombre ?? "Sin asignar";
  return valor.nombre;
}

export default function InteligenciaPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [periodo, setPeriodo] = useState<"7" | "30" | "90" | "todo">("30");

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setError("");
      const [rp, rc] = await Promise.all([
        supabase.from("pedidos").select(`id, cliente_id, nombre_cliente, telefono, direccion_entrega, costo_envio, monto_compra, estado, metodo_pago, origen_pedido, created_at, motorizado_id, motorizados(nombre)`).order("created_at", { ascending: false }),
        supabase.from("clientes").select("id, nombre, telefono, direccion, created_at").order("nombre"),
      ]);
      if (rp.error) { setError(`No se pudieron cargar los pedidos: ${rp.error.message}`); setCargando(false); return; }
      if (rc.error) { setError(`No se pudieron cargar los clientes: ${rc.error.message}`); setCargando(false); return; }
      setPedidos((rp.data ?? []) as Pedido[]);
      setClientes((rc.data ?? []) as Cliente[]);
      setCargando(false);
    }
    void cargar();
    const canal = supabase.channel("inteligencia-realtime").on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => void cargar()).subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, []);

  const pedidosPeriodo = useMemo(() => {
    if (periodo === "todo") return pedidos;
    const limite = new Date();
    limite.setDate(limite.getDate() - Number(periodo));
    return pedidos.filter((p) => new Date(p.created_at) >= limite);
  }, [pedidos, periodo]);

  const resumen = useMemo(() => {
    const entregados = pedidosPeriodo.filter((p) => p.estado === "Entregado");
    const cancelados = pedidosPeriodo.filter((p) => p.estado === "Cancelado");
    const ingresos = entregados.reduce((s, p) => s + Number(p.costo_envio ?? 0), 0);
    const ticket = entregados.length ? ingresos / entregados.length : 0;
    const clientesUnicos = new Set(pedidosPeriodo.map((p) => p.cliente_id ?? p.telefono)).size;
    return { total: pedidosPeriodo.length, entregados: entregados.length, cancelados: cancelados.length, ingresos, ticket, clientesUnicos };
  }, [pedidosPeriodo]);

  const rankingClientes = useMemo<ResumenCliente[]>(() => {
    const mapa = new Map<string, ResumenCliente & { direcciones: Map<string, number>; pagos: Map<string, number> }>();
    for (const pedido of pedidos) {
      const clave = pedido.cliente_id ? `id:${pedido.cliente_id}` : `tel:${pedido.telefono}`;
      const existente = mapa.get(clave) ?? {
        id: pedido.cliente_id,
        nombre: pedido.nombre_cliente,
        telefono: pedido.telefono,
        pedidos: 0,
        entregados: 0,
        cancelados: 0,
        totalEnvios: 0,
        promedio: 0,
        ultimoPedido: pedido.created_at,
        direccionFavorita: pedido.direccion_entrega,
        metodoPago: pedido.metodo_pago ?? "Sin definir",
        nivel: "Nuevo" as const,
        direcciones: new Map<string, number>(),
        pagos: new Map<string, number>(),
      };
      existente.pedidos += 1;
      if (pedido.estado === "Entregado") { existente.entregados += 1; existente.totalEnvios += Number(pedido.costo_envio ?? 0); }
      if (pedido.estado === "Cancelado") existente.cancelados += 1;
      if (new Date(pedido.created_at) > new Date(existente.ultimoPedido)) existente.ultimoPedido = pedido.created_at;
      existente.direcciones.set(pedido.direccion_entrega, (existente.direcciones.get(pedido.direccion_entrega) ?? 0) + 1);
      const pago = pedido.metodo_pago ?? "Sin definir";
      existente.pagos.set(pago, (existente.pagos.get(pago) ?? 0) + 1);
      mapa.set(clave, existente);
    }
    return Array.from(mapa.values()).map((c) => {
      const dir = [...c.direcciones.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "Sin datos";
      const pago = [...c.pagos.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "Sin datos";
      return { ...c, promedio: c.entregados ? c.totalEnvios / c.entregados : 0, direccionFavorita: dir, metodoPago: pago, nivel: nivelCliente(c.pedidos) };
    }).sort((a,b)=>b.pedidos-a.pedidos);
  }, [pedidos]);

  const canales = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const pedido of pedidosPeriodo) {
      const canal = pedido.origen_pedido || "No definido";
      mapa.set(canal, (mapa.get(canal) ?? 0) + 1);
    }
    return [...mapa.entries()].sort((a,b)=>b[1]-a[1]);
  }, [pedidosPeriodo]);

  const motorizados = useMemo(() => {
    const mapa = new Map<string, { pedidos: number; entregados: number; ingresos: number }>();
    for (const pedido of pedidosPeriodo) {
      const nombre = nombreMotorizado(pedido.motorizados);
      const actual = mapa.get(nombre) ?? { pedidos: 0, entregados: 0, ingresos: 0 };
      actual.pedidos += 1;
      if (pedido.estado === "Entregado") { actual.entregados += 1; actual.ingresos += Number(pedido.costo_envio ?? 0); }
      mapa.set(nombre, actual);
    }
    return [...mapa.entries()].filter(([n])=>n!=="Sin asignar").sort((a,b)=>b[1].entregados-a[1].entregados);
  }, [pedidosPeriodo]);

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <Link href="/rendimiento" className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 font-black text-green-300 transition hover:bg-green-500/20">
            📊 Centro de rendimiento
          </Link>
          <Link href="/calendario" className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 font-black text-blue-300 transition hover:bg-blue-500/20">
            📅 Calendario operativo
          </Link>
          <Link href="/inteligencia/centro" className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5 font-black text-violet-300 transition hover:bg-violet-500/20">
            🧠 Centro de inteligencia
          </Link>
        </section>
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><p className="text-sm text-slate-400">Business Intelligence</p><h1 className="mt-1 text-3xl font-black md:text-4xl">🧠 Inteligencia de negocio</h1></div>
          <select value={periodo} onChange={(e)=>setPeriodo(e.target.value as typeof periodo)} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-bold outline-none focus:border-green-500">
            <option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="todo">Todo el historial</option>
          </select>
        </header>
        {error && <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">❌ {error}</div>}
        {cargando ? <div className="rounded-2xl border border-slate-800 bg-slate-900 p-14 text-center text-slate-400">Calculando estadísticas…</div> : <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {[["Pedidos", resumen.total, "📦"],["Entregados", resumen.entregados, "✅"],["Cancelados", resumen.cancelados, "❌"],["Ingresos envíos", dinero(resumen.ingresos), "💰"],["Ticket promedio", dinero(resumen.ticket), "🎟️"],["Clientes activos", resumen.clientesUnicos, "👥"]].map(([t,v,i])=><article key={String(t)} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-2xl">{i}</p><p className="mt-3 text-sm text-slate-400">{t}</p><p className="mt-1 text-2xl font-black">{v}</p></article>)}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm text-slate-400">Ranking histórico</p><h2 className="text-2xl font-black">⭐ Clientes más frecuentes</h2></div><Link href="/clientes" className="text-sm font-bold text-green-400">Ver clientes →</Link></div><div className="space-y-3">{rankingClientes.slice(0,10).map((c,idx)=><div key={`${c.id}-${c.telefono}`} className="flex items-center justify-between rounded-xl bg-slate-800/70 p-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/15 font-black text-green-400">{idx+1}</span><div className="min-w-0"><p className="truncate font-bold">{c.nombre}</p><p className="text-xs text-slate-400">{c.nivel} · {c.entregados} entregados</p></div></div><div className="text-right"><p className="text-xl font-black">{c.pedidos}</p><p className="text-xs text-slate-500">pedidos · {dinero(c.totalEnvios)}</p></div></div>)}</div></article>

            <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Origen de pedidos</p><h2 className="text-2xl font-black">💬 Canales de venta</h2><div className="mt-5 space-y-4">{canales.map(([canal,cantidad])=>{const pct=resumen.total?Math.round(cantidad/resumen.total*100):0;return <div key={canal}><div className="mb-2 flex justify-between text-sm"><span className="font-bold">{canal}</span><span className="text-slate-400">{cantidad} · {pct}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-green-500" style={{width:`${pct}%`}} /></div></div>})}</div></article>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Productividad</p><h2 className="text-2xl font-black">🛵 Rendimiento de motorizados</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[520px] text-left"><thead className="text-sm text-slate-400"><tr><th className="py-3">Motorizado</th><th>Pedidos</th><th>Entregados</th><th>Ingresos</th></tr></thead><tbody>{motorizados.slice(0,10).map(([nombre,d])=><tr key={nombre} className="border-t border-slate-800"><td className="py-4 font-bold">{nombre}</td><td>{d.pedidos}</td><td>{d.entregados}</td><td className="font-bold text-green-400">{dinero(d.ingresos)}</td></tr>)}</tbody></table></div></article>
            <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Ficha rápida</p><h2 className="text-2xl font-black">👤 Top 5 clientes</h2><div className="mt-5 space-y-4">{rankingClientes.slice(0,5).map(c=><div key={`${c.id}-${c.telefono}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><div className="flex justify-between gap-4"><div><p className="font-black">{c.nombre}</p><p className="text-sm text-slate-400">{c.telefono} · {c.nivel}</p></div><p className="text-xl font-black text-green-400">{c.pedidos}</p></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-slate-500">Promedio:</span> {dinero(c.promedio)}</p><p><span className="text-slate-500">Pago habitual:</span> {c.metodoPago}</p><p className="sm:col-span-2 truncate"><span className="text-slate-500">Dirección habitual:</span> {c.direccionFavorita}</p></div></div>)}</div></article>
          </section>
        </>}
      </div>
    </main>
  );
}
