"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Pedido = {
  id: number;
  cliente_id: number | null;
  nombre_cliente: string;
  estado: string;
  costo_envio: number | null;
  origen_pedido: string | null;
  created_at: string;
  motorizados: { nombre: string } | { nombre: string }[] | null;
};

type Cliente = {
  id: number;
  nombre: string;
  created_at: string;
};

function moto(rel: Pedido["motorizados"]) {
  if (!rel) return "Sin asignar";
  if (Array.isArray(rel)) return rel[0]?.nombre ?? "Sin asignar";
  return rel.nombre;
}

function dinero(v: number) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
  }).format(v);
}

export default function CentroInteligencia() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const [rp, rc] = await Promise.all([
        supabase
          .from("pedidos")
          .select(
            "id,cliente_id,nombre_cliente,estado,costo_envio,origen_pedido,created_at,motorizados(nombre)"
          )
          .order("created_at", { ascending: false }),
        supabase.from("clientes").select("id,nombre,created_at"),
      ]);
      setPedidos((rp.data ?? []) as Pedido[]);
      setClientes((rc.data ?? []) as Cliente[]);
      setCargando(false);
    }
    void cargar();
  }, []);

  const inteligencia = useMemo(() => {
    const hoy = new Date();
    const inicioActual = new Date(hoy);
    inicioActual.setHours(0, 0, 0, 0);
    inicioActual.setDate(inicioActual.getDate() - 29);
    const inicioAnterior = new Date(inicioActual);
    inicioAnterior.setDate(inicioAnterior.getDate() - 30);

    const actuales = pedidos.filter((p) => new Date(p.created_at) >= inicioActual);
    const anteriores = pedidos.filter((p) => {
      const f = new Date(p.created_at);
      return f >= inicioAnterior && f < inicioActual;
    });

    const entregados = actuales.filter((p) => p.estado === "Entregado");
    const ingresos = entregados.reduce(
      (s, p) => s + Number(p.costo_envio ?? 0),
      0
    );

    const porCanal = new Map<string, number>();
    const porDia = new Map<string, number>();
    const porHora = new Map<number, number>();
    const porMoto = new Map<string, number>();
    const porCliente = new Map<string, number>();

    for (const p of actuales) {
      const canal = p.origen_pedido || "Sin registrar";
      porCanal.set(canal, (porCanal.get(canal) ?? 0) + 1);

      const f = new Date(p.created_at);
      const dia = new Intl.DateTimeFormat("es-NI", { weekday: "long" }).format(f);
      porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
      porHora.set(f.getHours(), (porHora.get(f.getHours()) ?? 0) + 1);

      const nombreMoto = moto(p.motorizados);
      if (p.estado === "Entregado" && nombreMoto !== "Sin asignar") {
        porMoto.set(nombreMoto, (porMoto.get(nombreMoto) ?? 0) + 1);
      }

      porCliente.set(
        p.nombre_cliente,
        (porCliente.get(p.nombre_cliente) ?? 0) + 1
      );
    }

    const top = <T,>(mapa: Map<T, number>) =>
      [...mapa.entries()].sort((a, b) => b[1] - a[1])[0];

    const variacion =
      anteriores.length > 0
        ? Math.round(((actuales.length - anteriores.length) / anteriores.length) * 100)
        : actuales.length > 0
          ? 100
          : 0;

    const clientesActivos = new Set(
      actuales.map((p) => p.cliente_id).filter(Boolean)
    ).size;

    const inactivos = clientes.filter((c) => {
      const ultimo = pedidos.find((p) => p.cliente_id === c.id);
      if (!ultimo) return false;
      const dias =
        (Date.now() - new Date(ultimo.created_at).getTime()) / 86_400_000;
      const totalCliente = pedidos.filter((p) => p.cliente_id === c.id).length;
      return totalCliente >= 3 && dias >= 30;
    });

    return {
      actuales,
      entregados,
      ingresos,
      variacion,
      canal: top(porCanal),
      dia: top(porDia),
      hora: top(porHora),
      motorizado: top(porMoto),
      cliente: top(porCliente),
      clientesActivos,
      inactivos: inactivos.slice(0, 8),
    };
  }, [clientes, pedidos]);

  const recomendaciones = [
    inteligencia.hora
      ? `La hora de mayor demanda fue alrededor de las ${String(
          inteligencia.hora[0]
        ).padStart(2, "0")}:00.`
      : null,
    inteligencia.canal
      ? `${inteligencia.canal[0]} fue el principal origen de pedidos (${inteligencia.canal[1]}).`
      : null,
    inteligencia.inactivos.length > 0
      ? `${inteligencia.inactivos.length} clientes recurrentes llevan al menos 30 días sin pedir.`
      : "No se detectaron clientes recurrentes inactivos en la muestra.",
    inteligencia.variacion < 0
      ? `El volumen cayó ${Math.abs(inteligencia.variacion)}% frente al período anterior.`
      : `El volumen creció ${inteligencia.variacion}% frente al período anterior.`,
  ].filter(Boolean) as string[];

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-violet-400">
              Análisis basado en datos
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              🧠 Centro de inteligencia
            </h1>
            <p className="mt-2 text-slate-400">
              Conclusiones calculadas; no modifica ningún registro.
            </p>
          </div>
          <Link
            href="/rendimiento"
            className="w-fit rounded-xl border border-green-500/40 bg-green-500/10 px-5 py-3 font-bold text-green-300"
          >
            Abrir rendimiento
          </Link>
        </header>

        {cargando ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center text-slate-400">
            Analizando información...
          </div>
        ) : (
          <>
            <section className="mb-6 rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-slate-900 p-6 shadow-2xl md:p-8">
              <h2 className="text-2xl font-black">Resumen de los últimos 30 días</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Pedidos", inteligencia.actuales.length],
                  ["Entregados", inteligencia.entregados.length],
                  ["Ingresos de envíos", dinero(inteligencia.ingresos)],
                  ["Clientes activos", inteligencia.clientesActivos],
                ].map(([titulo, valor]) => (
                  <div key={String(titulo)} className="rounded-2xl bg-slate-950/60 p-5">
                    <p className="text-sm text-slate-400">{titulo}</p>
                    <p className="mt-2 text-3xl font-black">{valor}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-6 grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-xl font-black">Hallazgos principales</h2>
                <div className="mt-5 space-y-3">
                  {[
                    inteligencia.dia
                      ? `El día con más pedidos fue ${inteligencia.dia[0]} (${inteligencia.dia[1]}).`
                      : "No hay suficientes datos por día.",
                    inteligencia.motorizado
                      ? `${inteligencia.motorizado[0]} fue el motorizado con más entregas (${inteligencia.motorizado[1]}).`
                      : "No hay suficientes entregas asignadas.",
                    inteligencia.cliente
                      ? `${inteligencia.cliente[0]} fue el cliente más activo (${inteligencia.cliente[1]} pedidos).`
                      : "No hay suficientes datos de clientes.",
                    inteligencia.canal
                      ? `${inteligencia.canal[0]} concentró la mayor cantidad de solicitudes.`
                      : "Falta registrar el origen de más pedidos.",
                  ].map((texto) => (
                    <div key={texto} className="rounded-xl bg-slate-950/60 p-4 leading-6 text-slate-300">
                      ✓ {texto}
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
                <h2 className="text-xl font-black text-amber-300">
                  Recomendaciones operativas
                </h2>
                <div className="mt-5 space-y-3">
                  {recomendaciones.map((texto) => (
                    <div key={texto} className="rounded-xl border border-amber-500/15 bg-slate-950/50 p-4 leading-6 text-slate-300">
                      💡 {texto}
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 p-6">
                <h2 className="text-xl font-black">
                  Clientes recurrentes inactivos
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Tienen al menos 3 pedidos y llevan 30 días o más sin actividad.
                </p>
              </div>
              {inteligencia.inactivos.length === 0 ? (
                <p className="p-6 text-slate-400">No se encontraron clientes en esta condición.</p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {inteligencia.inactivos.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-4 p-5">
                      <div>
                        <p className="font-bold">{c.nombre}</p>
                        <p className="mt-1 text-xs text-slate-500">Cliente #{c.id}</p>
                      </div>
                      <Link
                        href={`/clientes/${c.id}`}
                        className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold"
                      >
                        Ver expediente
                      </Link>
                    </div>
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
