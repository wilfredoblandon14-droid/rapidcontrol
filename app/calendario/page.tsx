"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Pedido = {
  id: number;
  nombre_cliente: string;
  estado: string;
  costo_envio: number | null;
  monto_compra: number | null;
  created_at: string;
};

type Movimiento = {
  id: number;
  tipo: string;
  categoria: string | null;
  monto: number;
  descripcion: string | null;
  created_at: string;
};

type Liquidacion = {
  id: number;
  motorizado_id: number;
  recibido: number;
  diferencia: number;
  created_at: string;
};

function claveFecha(fecha: Date | string) {
  const f = typeof fecha === "string" ? new Date(fecha) : fecha;
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(
    f.getDate()
  ).padStart(2, "0")}`;
}

function dinero(v: number) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
  }).format(v);
}

export default function CalendarioOperativo() {
  const [mes, setMes] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });
  const [seleccionada, setSeleccionada] = useState(claveFecha(new Date()));
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const [rp, rm, rl] = await Promise.all([
        supabase
          .from("pedidos")
          .select("id,nombre_cliente,estado,costo_envio,monto_compra,created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("movimientos_caja")
          .select("id,tipo,categoria,monto,descripcion,created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("liquidaciones_motorizado")
          .select("id,motorizado_id,recibido,diferencia,created_at")
          .order("created_at", { ascending: false }),
      ]);

      setPedidos((rp.data ?? []) as Pedido[]);
      setMovimientos((rm.data ?? []) as Movimiento[]);
      setLiquidaciones((rl.data ?? []) as Liquidacion[]);
      setCargando(false);
    }

    void cargar();
  }, []);

  const dias = useMemo(() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    const relleno = (primero.getDay() + 6) % 7;
    const lista: Array<Date | null> = Array(relleno).fill(null);

    for (let d = 1; d <= ultimo.getDate(); d++) {
      lista.push(new Date(mes.getFullYear(), mes.getMonth(), d));
    }

    while (lista.length % 7 !== 0) lista.push(null);
    return lista;
  }, [mes]);

  const resumenDia = useMemo(() => {
    const p = pedidos.filter((x) => claveFecha(x.created_at) === seleccionada);
    const m = movimientos.filter((x) => claveFecha(x.created_at) === seleccionada);
    const l = liquidaciones.filter((x) => claveFecha(x.created_at) === seleccionada);

    const ingresos = m
      .filter((x) => x.tipo === "Ingreso")
      .reduce((s, x) => s + Number(x.monto ?? 0), 0);
    const egresos = m
      .filter((x) => x.tipo === "Egreso")
      .reduce((s, x) => s + Number(x.monto ?? 0), 0);

    return {
      pedidos: p,
      movimientos: m,
      liquidaciones: l,
      ingresos,
      egresos,
      balance: ingresos - egresos,
      entregados: p.filter((x) => x.estado === "Entregado").length,
      cancelados: p.filter((x) => x.estado === "Cancelado").length,
    };
  }, [liquidaciones, movimientos, pedidos, seleccionada]);

  const conteoFecha = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of pedidos) {
      const k = claveFecha(p.created_at);
      mapa.set(k, (mapa.get(k) ?? 0) + 1);
    }
    return mapa;
  }, [pedidos]);

  function cambiarMes(delta: number) {
    setMes(new Date(mes.getFullYear(), mes.getMonth() + delta, 1));
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-400">
            Consulta histórica
          </p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">
            📅 Calendario operativo
          </h1>
          <p className="mt-2 text-slate-400">
            Selecciona un día para revisar pedidos, caja y liquidaciones.
          </p>
        </header>

        {cargando ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center text-slate-400">
            Cargando calendario...
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => cambiarMes(-1)}
                  className="rounded-xl border border-slate-700 px-4 py-2 font-bold"
                >
                  ←
                </button>
                <h2 className="text-xl font-black capitalize">
                  {new Intl.DateTimeFormat("es-NI", {
                    month: "long",
                    year: "numeric",
                  }).format(mes)}
                </h2>
                <button
                  type="button"
                  onClick={() => cambiarMes(1)}
                  className="rounded-xl border border-slate-700 px-4 py-2 font-bold"
                >
                  →
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase text-slate-500">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                  <div key={d} className="py-2">{d}</div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {dias.map((dia, i) => {
                  if (!dia) return <div key={`vacio-${i}`} className="min-h-20" />;
                  const clave = claveFecha(dia);
                  const cantidad = conteoFecha.get(clave) ?? 0;
                  const activa = clave === seleccionada;

                  return (
                    <button
                      key={clave}
                      type="button"
                      onClick={() => setSeleccionada(clave)}
                      className={`min-h-24 rounded-xl border p-2 text-left transition ${
                        activa
                          ? "border-green-500 bg-green-500/15"
                          : "border-slate-800 bg-slate-950/50 hover:border-slate-600"
                      }`}
                    >
                      <span className="font-black">{dia.getDate()}</span>
                      {cantidad > 0 && (
                        <span className="mt-3 block rounded-lg bg-blue-500/15 px-2 py-1 text-xs font-bold text-blue-300">
                          {cantidad} pedido{cantidad === 1 ? "" : "s"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Fecha seleccionada</p>
                <h2 className="mt-1 text-2xl font-black">
                  {new Intl.DateTimeFormat("es-NI", {
                    dateStyle: "full",
                  }).format(new Date(`${seleccionada}T12:00:00`))}
                </h2>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    ["Pedidos", resumenDia.pedidos.length],
                    ["Entregados", resumenDia.entregados],
                    ["Cancelados", resumenDia.cancelados],
                    ["Liquidaciones", resumenDia.liquidaciones.length],
                  ].map(([titulo, valor]) => (
                    <div key={String(titulo)} className="rounded-xl bg-slate-950/60 p-4">
                      <p className="text-xs text-slate-500">{titulo}</p>
                      <p className="mt-1 text-2xl font-black">{valor}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                  <p className="text-sm text-green-300">Balance del día</p>
                  <p className="mt-1 text-2xl font-black text-green-400">
                    {dinero(resumenDia.balance)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Ingresos {dinero(resumenDia.ingresos)} · Egresos{" "}
                    {dinero(resumenDia.egresos)}
                  </p>
                </div>
              </section>

              <section className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900">
                <div className="sticky top-0 border-b border-slate-800 bg-slate-900 p-5">
                  <h2 className="font-black">Actividad del día</h2>
                </div>

                {resumenDia.pedidos.length === 0 &&
                resumenDia.movimientos.length === 0 ? (
                  <p className="p-6 text-slate-400">Sin actividad registrada.</p>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {resumenDia.pedidos.map((p) => (
                      <div key={`p-${p.id}`} className="p-4">
                        <p className="font-bold">📦 Pedido #{p.id}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {p.nombre_cliente} · {p.estado}
                        </p>
                      </div>
                    ))}
                    {resumenDia.movimientos.map((m) => (
                      <div key={`m-${m.id}`} className="p-4">
                        <p className="font-bold">
                          {m.tipo === "Ingreso" ? "💰" : "💸"} {m.categoria || m.tipo}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {dinero(Number(m.monto ?? 0))} · {m.descripcion || "Sin descripción"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
