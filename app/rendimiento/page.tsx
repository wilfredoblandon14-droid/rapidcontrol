"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Pedido = {
  id: number;
  cliente_id: number | null;
  nombre_cliente: string;
  costo_envio: number | null;
  monto_compra: number | null;
  estado: string;
  origen_pedido: string | null;
  created_at: string;
  motorizado_id: number | null;
  motorizados: { nombre: string } | { nombre: string }[] | null;
};

type Movimiento = {
  id: number;
  tipo: string;
  categoria: string | null;
  monto: number;
  created_at: string;
};

type Cliente = {
  id: number;
  created_at: string;
};

function dinero(valor: number) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
  }).format(valor);
}

function nombreMoto(rel: Pedido["motorizados"]) {
  if (!rel) return "Sin asignar";
  if (Array.isArray(rel)) return rel[0]?.nombre ?? "Sin asignar";
  return rel.nombre;
}

function inicioPeriodo(dias: number) {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  fecha.setDate(fecha.getDate() - (dias - 1));
  return fecha;
}

export default function CentroRendimiento() {
  const [periodo, setPeriodo] = useState("30");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setError("");

      const [rp, rm, rc] = await Promise.all([
        supabase
          .from("pedidos")
          .select(
            "id,cliente_id,nombre_cliente,costo_envio,monto_compra,estado,origen_pedido,created_at,motorizado_id,motorizados(nombre)"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("movimientos_caja")
          .select("id,tipo,categoria,monto,created_at")
          .order("created_at", { ascending: false }),
        supabase.from("clientes").select("id,created_at"),
      ]);

      if (rp.error || rm.error || rc.error) {
        setError(
          rp.error?.message ??
            rm.error?.message ??
            rc.error?.message ??
            "No se pudieron cargar las estadísticas."
        );
        setCargando(false);
        return;
      }

      setPedidos((rp.data ?? []) as Pedido[]);
      setMovimientos((rm.data ?? []) as Movimiento[]);
      setClientes((rc.data ?? []) as Cliente[]);
      setCargando(false);
    }

    void cargar();
  }, []);

  const datos = useMemo(() => {
    const dias = Number(periodo);
    const inicio = inicioPeriodo(dias);
    const inicioAnterior = new Date(inicio);
    inicioAnterior.setDate(inicioAnterior.getDate() - dias);

    const actuales = pedidos.filter(
      (p) => new Date(p.created_at) >= inicio
    );
    const anteriores = pedidos.filter((p) => {
      const f = new Date(p.created_at);
      return f >= inicioAnterior && f < inicio;
    });

    const movActuales = movimientos.filter(
      (m) => new Date(m.created_at) >= inicio
    );

    const entregados = actuales.filter((p) => p.estado === "Entregado");
    const cancelados = actuales.filter((p) => p.estado === "Cancelado");
    const ingresos = movActuales
      .filter((m) => m.tipo === "Ingreso")
      .reduce((s, m) => s + Number(m.monto ?? 0), 0);
    const egresos = movActuales
      .filter((m) => m.tipo === "Egreso")
      .reduce((s, m) => s + Number(m.monto ?? 0), 0);

    const clientesNuevos = clientes.filter(
      (c) => new Date(c.created_at) >= inicio
    ).length;

    const porDia = new Map<string, number>();
    const porHora = new Map<number, number>();
    const porCanal = new Map<string, number>();
    const porMoto = new Map<string, { pedidos: number; entregados: number; ingresos: number }>();

    for (const p of actuales) {
      const f = new Date(p.created_at);
      const dia = new Intl.DateTimeFormat("es-NI", {
        weekday: "short",
      }).format(f);
      porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
      porHora.set(f.getHours(), (porHora.get(f.getHours()) ?? 0) + 1);

      const canal = p.origen_pedido || "Sin registrar";
      porCanal.set(canal, (porCanal.get(canal) ?? 0) + 1);

      const moto = nombreMoto(p.motorizados);
      const actual = porMoto.get(moto) ?? { pedidos: 0, entregados: 0, ingresos: 0 };
      actual.pedidos += 1;
      if (p.estado === "Entregado") {
        actual.entregados += 1;
        actual.ingresos += Number(p.costo_envio ?? 0);
      }
      porMoto.set(moto, actual);
    }

    const variacion =
      anteriores.length > 0
        ? Math.round(((actuales.length - anteriores.length) / anteriores.length) * 100)
        : actuales.length > 0
          ? 100
          : 0;

    return {
      total: actuales.length,
      entregados: entregados.length,
      cancelados: cancelados.length,
      pendientes: actuales.filter(
        (p) => !["Entregado", "Cancelado"].includes(p.estado)
      ).length,
      ingresos,
      egresos,
      balance: ingresos - egresos,
      ticket:
        entregados.length > 0
          ? entregados.reduce(
              (s, p) =>
                s +
                Number(p.costo_envio ?? 0) +
                Number(p.monto_compra ?? 0),
              0
            ) / entregados.length
          : 0,
      clientesNuevos,
      variacion,
      dias: [...porDia.entries()].sort((a, b) => b[1] - a[1]),
      horas: [...porHora.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      canales: [...porCanal.entries()].sort((a, b) => b[1] - a[1]),
      motos: [...porMoto.entries()]
        .filter(([nombre]) => nombre !== "Sin asignar")
        .sort((a, b) => b[1].entregados - a[1].entregados),
    };
  }, [clientes, movimientos, pedidos, periodo]);

  const maxDia = Math.max(1, ...datos.dias.map(([, n]) => n));
  const maxCanal = Math.max(1, ...datos.canales.map(([, n]) => n));

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-400">
              Dirección del negocio
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              📊 Centro de rendimiento
            </h1>
            <p className="mt-2 text-slate-400">
              Indicadores operativos y financieros con datos reales.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-bold outline-none"
            >
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="365">Último año</option>
            </select>
            <Link
              href="/inteligencia/centro"
              className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-5 py-3 font-bold text-violet-300"
            >
              Ver inteligencia
            </Link>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {cargando ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center text-slate-400">
            Cargando rendimiento...
          </div>
        ) : (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Pedidos", datos.total.toString(), `${datos.variacion >= 0 ? "+" : ""}${datos.variacion}% vs. período anterior`],
                ["Entregados", datos.entregados.toString(), `${datos.pendientes} activos · ${datos.cancelados} cancelados`],
                ["Ingresos", dinero(datos.ingresos), `Egresos ${dinero(datos.egresos)}`],
                ["Balance", dinero(datos.balance), `Ticket promedio ${dinero(datos.ticket)}`],
                ["Clientes nuevos", datos.clientesNuevos.toString(), "Registrados en el período"],
              ].map(([titulo, valor, detalle]) => (
                <article
                  key={titulo}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl"
                >
                  <p className="text-sm text-slate-400">{titulo}</p>
                  <p className="mt-2 text-3xl font-black">{valor}</p>
                  <p className="mt-2 text-xs text-slate-500">{detalle}</p>
                </article>
              ))}
            </section>

            <section className="mb-6 grid gap-5 xl:grid-cols-2">
              <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-xl font-black">Demanda por día</h2>
                <div className="mt-5 space-y-4">
                  {datos.dias.map(([dia, cantidad]) => (
                    <div key={dia}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="capitalize text-slate-300">{dia}</span>
                        <span className="font-black">{cantidad}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-green-500"
                          style={{ width: `${(cantidad / maxDia) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-xl font-black">Canales de pedidos</h2>
                <div className="mt-5 space-y-4">
                  {datos.canales.length === 0 ? (
                    <p className="text-slate-400">Sin canales registrados.</p>
                  ) : (
                    datos.canales.map(([canal, cantidad]) => (
                      <div key={canal}>
                        <div className="mb-2 flex justify-between text-sm">
                          <span className="text-slate-300">{canal}</span>
                          <span className="font-black">{cantidad}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${(cantidad / maxCanal) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-xl font-black">Horas con más pedidos</h2>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {datos.horas.map(([hora, cantidad]) => (
                    <div key={hora} className="rounded-xl bg-slate-950/60 p-4 text-center">
                      <p className="text-lg font-black text-amber-300">
                        {String(hora).padStart(2, "0")}:00
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {cantidad} pedidos
                      </p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 p-6">
                  <h2 className="text-xl font-black">Rendimiento por motorizado</h2>
                </div>
                <div className="divide-y divide-slate-800">
                  {datos.motos.length === 0 ? (
                    <p className="p-6 text-slate-400">Sin datos de motorizados.</p>
                  ) : (
                    datos.motos.slice(0, 10).map(([nombre, info], indice) => (
                      <div
                        key={nombre}
                        className="grid grid-cols-[40px_1fr_auto] items-center gap-3 p-5"
                      >
                        <span className="text-xl font-black text-green-400">
                          #{indice + 1}
                        </span>
                        <div>
                          <p className="font-bold">{nombre}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {info.entregados}/{info.pedidos} entregados
                          </p>
                        </div>
                        <p className="font-black">{dinero(info.ingresos)}</p>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
