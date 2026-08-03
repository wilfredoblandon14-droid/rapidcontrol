"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type EstadoPedido =
  | "Pendiente"
  | "Asignado"
  | "Recogido"
  | "En camino"
  | "Entregado"
  | "Cancelado";

type RelacionMotorizado =
  | { nombre: string }
  | { nombre: string }[]
  | null;

type Pedido = {
  id: number;
  nombre_cliente: string;
  direccion_recogida: string;
  direccion_entrega: string;
  costo_envio: number | null;
  monto_compra: number | null;
  estado: EstadoPedido;
  metodo_pago: string;
  created_at: string;
  motorizado_id: number | null;
  motorizados: RelacionMotorizado;
};

type Motorizado = {
  id: number;
  nombre: string;
};

type TipoMovimiento = "Ingreso" | "Egreso";

type MovimientoCaja = {
  id: number;
  pedido_id: number | null;
  tipo: TipoMovimiento;
  categoria: string;
  monto: number;
  descripcion: string | null;
  created_at: string;
};

const ESTADOS: EstadoPedido[] = [
  "Pendiente",
  "Asignado",
  "Recogido",
  "En camino",
  "Entregado",
  "Cancelado",
];

function obtenerNombreMotorizado(motorizados: RelacionMotorizado) {
  if (!motorizados) return "Sin asignar";
  if (Array.isArray(motorizados)) {
    return motorizados[0]?.nombre ?? "Sin asignar";
  }
  return motorizados.nombre;
}

function colorEstado(estado: string) {
  if (estado === "Entregado") return "bg-emerald-500/15 text-emerald-400";
  if (estado === "En camino" || estado === "En entrega") {
    return "bg-amber-500/15 text-amber-400";
  }
  if (estado === "Recogido") return "bg-violet-500/15 text-violet-400";
  if (estado === "Asignado") return "bg-blue-500/15 text-blue-400";
  if (estado === "Cancelado") return "bg-red-500/15 text-red-400";
  return "bg-slate-500/15 text-slate-300";
}

function colorBarraEstado(estado: EstadoPedido) {
  if (estado === "Entregado") return "bg-emerald-500";
  if (estado === "En camino") return "bg-amber-500";
  if (estado === "Recogido") return "bg-violet-500";
  if (estado === "Asignado") return "bg-blue-500";
  if (estado === "Cancelado") return "bg-red-500";
  return "bg-slate-500";
}

function formatearDinero(valor: number) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
  }).format(valor);
}

function formatearFecha(fecha: string) {
  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(fecha));
}

function claveFecha(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(
    fecha.getDate()
  ).padStart(2, "0")}`;
}

function esMismoDia(fecha: string, objetivo: Date) {
  const valor = new Date(fecha);
  return claveFecha(valor) === claveFecha(objetivo);
}

function inicioDelDia(fecha: Date) {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function diasAtras(cantidad: number) {
  const fecha = inicioDelDia(new Date());
  fecha.setDate(fecha.getDate() - cantidad);
  return fecha;
}

function porcentajeCambio(actual: number, anterior: number) {
  if (anterior === 0) return actual > 0 ? 100 : 0;
  return ((actual - anterior) / anterior) * 100;
}

export default function DashboardClient() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  const cargarDashboard = useCallback(async (silencioso = false) => {
    if (silencioso) setActualizando(true);
    else setCargando(true);
    setError("");

    const [respuestaPedidos, respuestaMotorizados, respuestaMovimientos] =
      await Promise.all([
        supabase
          .from("pedidos")
          .select(`
            id,
            nombre_cliente,
            direccion_recogida,
            direccion_entrega,
            costo_envio,
            monto_compra,
            estado,
            metodo_pago,
            created_at,
            motorizado_id,
            motorizados ( nombre )
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("motorizados")
          .select("id, nombre")
          .order("nombre", { ascending: true }),
        supabase
          .from("movimientos_caja")
          .select("id, pedido_id, tipo, categoria, monto, descripcion, created_at")
          .order("created_at", { ascending: false }),
      ]);

    const primerError =
      respuestaPedidos.error ||
      respuestaMotorizados.error ||
      respuestaMovimientos.error;

    if (primerError) {
      console.error(primerError);
      setError(`No se pudo actualizar el Dashboard: ${primerError.message}`);
      setCargando(false);
      setActualizando(false);
      return;
    }

    setPedidos((respuestaPedidos.data ?? []) as Pedido[]);
    setMotorizados((respuestaMotorizados.data ?? []) as Motorizado[]);
    setMovimientos((respuestaMovimientos.data ?? []) as MovimientoCaja[]);
    setUltimaActualizacion(new Date());
    setCargando(false);
    setActualizando(false);
  }, []);

  useEffect(() => {
    void cargarDashboard();
    const intervalo = window.setInterval(() => {
      void cargarDashboard(true);
    }, 60_000);
    return () => window.clearInterval(intervalo);
  }, [cargarDashboard]);

  const datos = useMemo(() => {
    const hoy = inicioDelDia(new Date());
    const ayer = diasAtras(1);
    const inicioSemana = diasAtras(6);
    const inicioSemanaAnterior = diasAtras(13);
    const finSemanaAnterior = diasAtras(7);

    const pedidosHoy = pedidos.filter((pedido) => esMismoDia(pedido.created_at, hoy));
    const pedidosAyer = pedidos.filter((pedido) => esMismoDia(pedido.created_at, ayer));
    const pedidosSemana = pedidos.filter(
      (pedido) => new Date(pedido.created_at) >= inicioSemana
    );
    const pedidosSemanaAnterior = pedidos.filter((pedido) => {
      const fecha = new Date(pedido.created_at);
      return fecha >= inicioSemanaAnterior && fecha < finSemanaAnterior;
    });

    const movimientosHoy = movimientos.filter((movimiento) =>
      esMismoDia(movimiento.created_at, hoy)
    );
    const movimientosSemana = movimientos.filter(
      (movimiento) => new Date(movimiento.created_at) >= inicioSemana
    );
    const movimientosSemanaAnterior = movimientos.filter((movimiento) => {
      const fecha = new Date(movimiento.created_at);
      return fecha >= inicioSemanaAnterior && fecha < finSemanaAnterior;
    });

    const sumar = (lista: MovimientoCaja[], tipo: TipoMovimiento) =>
      lista
        .filter((movimiento) => movimiento.tipo === tipo)
        .reduce((total, movimiento) => total + Number(movimiento.monto ?? 0), 0);

    const ingresosHoy = sumar(movimientosHoy, "Ingreso");
    const egresosHoy = sumar(movimientosHoy, "Egreso");
    const ingresosSemana = sumar(movimientosSemana, "Ingreso");
    const egresosSemana = sumar(movimientosSemana, "Egreso");
    const ingresosSemanaAnterior = sumar(movimientosSemanaAnterior, "Ingreso");
    const egresosSemanaAnterior = sumar(movimientosSemanaAnterior, "Egreso");
    const balanceTotal = sumar(movimientos, "Ingreso") - sumar(movimientos, "Egreso");

    const porEstado = ESTADOS.map((estado) => ({
      estado,
      cantidad: pedidos.filter((pedido) => pedido.estado === estado).length,
    }));

    const ultimos7Dias = Array.from({ length: 7 }, (_, indice) => {
      const fecha = diasAtras(6 - indice);
      const pedidosDia = pedidos.filter((pedido) => esMismoDia(pedido.created_at, fecha));
      const movimientosDia = movimientos.filter((movimiento) =>
        esMismoDia(movimiento.created_at, fecha)
      );
      return {
        clave: claveFecha(fecha),
        etiqueta: new Intl.DateTimeFormat("es-NI", { weekday: "short" })
          .format(fecha)
          .replace(".", ""),
        pedidos: pedidosDia.length,
        ingresos: sumar(movimientosDia, "Ingreso"),
        egresos: sumar(movimientosDia, "Egreso"),
      };
    });

    const rendimientoMotorizados = motorizados
      .map((motorizado) => {
        const asignados = pedidos.filter(
          (pedido) => pedido.motorizado_id === motorizado.id
        );
        const entregados = asignados.filter(
          (pedido) => pedido.estado === "Entregado"
        );
        return {
          ...motorizado,
          total: asignados.length,
          entregados: entregados.length,
          efectividad:
            asignados.length === 0
              ? 0
              : Math.round((entregados.length / asignados.length) * 100),
        };
      })
      .sort((a, b) => b.entregados - a.entregados || b.total - a.total)
      .slice(0, 5);

    const entregadosHoy = pedidosHoy.filter(
      (pedido) => pedido.estado === "Entregado"
    ).length;
    const activosHoy = pedidosHoy.filter((pedido) =>
      ["Pendiente", "Asignado", "Recogido", "En camino"].includes(pedido.estado)
    ).length;
    const ingresoPromedio = entregadosHoy > 0 ? ingresosHoy / entregadosHoy : 0;
    const tasaEntregaHoy =
      pedidosHoy.length > 0 ? (entregadosHoy / pedidosHoy.length) * 100 : 0;

    return {
      pedidosHoy,
      pedidosAyer,
      pedidosSemana,
      pedidosSemanaAnterior,
      entregadosHoy,
      activosHoy,
      ingresosHoy,
      egresosHoy,
      balanceHoy: ingresosHoy - egresosHoy,
      balanceTotal,
      ingresoPromedio,
      tasaEntregaHoy,
      ingresosSemana,
      egresosSemana,
      balanceSemana: ingresosSemana - egresosSemana,
      cambioPedidos: porcentajeCambio(pedidosSemana.length, pedidosSemanaAnterior.length),
      cambioBalance: porcentajeCambio(
        ingresosSemana - egresosSemana,
        ingresosSemanaAnterior - egresosSemanaAnterior
      ),
      porEstado,
      ultimos7Dias,
      rendimientoMotorizados,
    };
  }, [movimientos, motorizados, pedidos]);

  const maxPedidosDia = Math.max(1, ...datos.ultimos7Dias.map((dia) => dia.pedidos));
  const maxFinanzasDia = Math.max(
    1,
    ...datos.ultimos7Dias.map((dia) => Math.max(dia.ingresos, dia.egresos))
  );
  const maxEstado = Math.max(1, ...datos.porEstado.map((item) => item.cantidad));
  const pedidosRecientes = pedidos.slice(0, 6);
  const movimientosRecientes = movimientos.slice(0, 5);

  return (
    <main className="bg-slate-950 p-5 text-white md:p-8">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Centro de control
            </p>
            <h2 className="mt-2 text-3xl font-black">Resumen operativo</h2>
            <p className="mt-2 text-sm text-slate-400">
              Datos actualizados automáticamente cada minuto.
              {ultimaActualizacion
                ? ` Última actualización: ${ultimaActualizacion.toLocaleTimeString("es-NI", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : ""}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void cargarDashboard(true)}
              disabled={actualizando}
              className="rounded-xl border border-slate-700 px-5 py-3 font-bold transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actualizando ? "Actualizando..." : "↻ Actualizar"}
            </button>
            <Link
              href="/reportes"
              className="rounded-xl border border-slate-700 px-5 py-3 text-center font-bold transition hover:bg-slate-800"
            >
              Ver reportes
            </Link>
            <Link
              href="/pedidos/nuevo"
              className="rounded-xl bg-green-600 px-5 py-3 text-center font-bold transition hover:bg-green-500"
            >
              + Nuevo pedido
            </Link>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
            ❌ {error}
          </div>
        )}

        {cargando && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-16 text-center text-slate-400">
            Cargando información del Dashboard...
          </div>
        )}

        {!cargando && !error && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  titulo: "Pedidos hoy",
                  valor: datos.pedidosHoy.length,
                  detalle: `${datos.pedidosAyer.length} ayer`,
                  icono: "📦",
                  clase: "border-slate-800",
                },
                {
                  titulo: "Pedidos activos",
                  valor: datos.activosHoy,
                  detalle: "Pendientes o en proceso",
                  icono: "🛵",
                  clase: "border-blue-500/30",
                },
                {
                  titulo: "Entregados hoy",
                  valor: datos.entregadosHoy,
                  detalle: `${datos.tasaEntregaHoy.toFixed(1)}% de cumplimiento`,
                  icono: "✅",
                  clase: "border-green-500/30",
                },
                {
                  titulo: "Motorizados",
                  valor: motorizados.length,
                  detalle: "Registrados en el sistema",
                  icono: "👥",
                  clase: "border-violet-500/30",
                },
              ].map((item) => (
                <article
                  key={item.titulo}
                  className={`rounded-2xl border bg-slate-900 p-5 ${item.clase}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-400">{item.titulo}</p>
                      <p className="mt-2 text-4xl font-black">{item.valor}</p>
                      <p className="mt-2 text-sm text-slate-500">{item.detalle}</p>
                    </div>
                    <span className="text-3xl">{item.icono}</span>
                  </div>
                </article>
              ))}
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
                <p className="text-sm text-green-300">Balance de hoy</p>
                <p className="mt-2 text-3xl font-black text-green-400">
                  {formatearDinero(datos.balanceHoy)}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {formatearDinero(datos.ingresosHoy)} ingresos · {formatearDinero(datos.egresosHoy)} egresos
                </p>
              </article>

              <article className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
                <p className="text-sm text-blue-300">Balance últimos 7 días</p>
                <p className="mt-2 text-3xl font-black text-blue-400">
                  {formatearDinero(datos.balanceSemana)}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {datos.cambioBalance >= 0 ? "▲" : "▼"} {Math.abs(datos.cambioBalance).toFixed(1)}% vs. semana anterior
                </p>
              </article>

              <article className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                <p className="text-sm text-amber-300">Ingreso promedio</p>
                <p className="mt-2 text-3xl font-black text-amber-400">
                  {formatearDinero(datos.ingresoPromedio)}
                </p>
                <p className="mt-2 text-sm text-slate-400">Por pedido entregado hoy</p>
              </article>

              <article className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
                <p className="text-sm text-violet-300">Balance histórico</p>
                <p className="mt-2 text-3xl font-black text-violet-400">
                  {formatearDinero(datos.balanceTotal)}
                </p>
                <p className="mt-2 text-sm text-slate-400">Todos los movimientos de Caja</p>
              </article>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Pedidos de los últimos 7 días</h3>
                    <p className="text-sm text-slate-400">Tendencia diaria de actividad</p>
                  </div>
                  <span className={`text-sm font-bold ${datos.cambioPedidos >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {datos.cambioPedidos >= 0 ? "▲" : "▼"} {Math.abs(datos.cambioPedidos).toFixed(1)}%
                  </span>
                </div>

                <div className="mt-8 flex h-56 items-end gap-3">
                  {datos.ultimos7Dias.map((dia) => (
                    <div key={dia.clave} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <span className="text-xs font-bold text-slate-300">{dia.pedidos}</span>
                      <div className="flex h-40 w-full items-end rounded-lg bg-slate-950/60 p-1">
                        <div
                          className="w-full rounded-md bg-green-500 transition-all"
                          style={{ height: `${Math.max(5, (dia.pedidos / maxPedidosDia) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs capitalize text-slate-500">{dia.etiqueta}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div>
                  <h3 className="text-lg font-bold">Ingresos y egresos</h3>
                  <p className="text-sm text-slate-400">Movimiento financiero diario</p>
                </div>

                <div className="mt-8 flex h-56 items-end gap-3">
                  {datos.ultimos7Dias.map((dia) => (
                    <div key={dia.clave} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <div className="flex h-40 w-full items-end justify-center gap-1 rounded-lg bg-slate-950/60 p-1">
                        <div
                          title={`Ingresos: ${formatearDinero(dia.ingresos)}`}
                          className="w-1/2 rounded-sm bg-blue-500"
                          style={{ height: `${Math.max(3, (dia.ingresos / maxFinanzasDia) * 100)}%` }}
                        />
                        <div
                          title={`Egresos: ${formatearDinero(dia.egresos)}`}
                          className="w-1/2 rounded-sm bg-red-500"
                          style={{ height: `${Math.max(3, (dia.egresos / maxFinanzasDia) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs capitalize text-slate-500">{dia.etiqueta}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-5 text-xs text-slate-400">
                  <span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-500" />Ingresos</span>
                  <span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500" />Egresos</span>
                </div>
              </article>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div>
                  <h3 className="text-lg font-bold">Distribución por estado</h3>
                  <p className="text-sm text-slate-400">Todos los pedidos registrados</p>
                </div>
                <div className="mt-6 space-y-4">
                  {datos.porEstado.map((item) => (
                    <div key={item.estado}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-slate-300">{item.estado}</span>
                        <span className="font-bold">{item.cantidad}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${colorBarraEstado(item.estado)}`}
                          style={{ width: `${(item.cantidad / maxEstado) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 p-5">
                  <h3 className="text-lg font-bold">Top motorizados</h3>
                  <p className="text-sm text-slate-400">Rendimiento por entregas</p>
                </div>
                <div className="divide-y divide-slate-800">
                  {datos.rendimientoMotorizados.length === 0 ? (
                    <p className="p-8 text-center text-slate-400">No hay motorizados registrados.</p>
                  ) : (
                    datos.rendimientoMotorizados.map((motorizado, indice) => (
                      <div key={motorizado.id} className="flex items-center gap-4 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 font-black text-green-400">
                          {indice + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{motorizado.nombre}</p>
                          <p className="text-sm text-slate-400">
                            {motorizado.entregados} entregados de {motorizado.total}
                          </p>
                        </div>
                        <span className="rounded-full bg-green-500/15 px-3 py-1 text-sm font-bold text-green-400">
                          {motorizado.efectividad}%
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>

            <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
              <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-800 p-5">
                  <div>
                    <h3 className="text-lg font-bold">Pedidos recientes</h3>
                    <p className="text-sm text-slate-400">Últimos pedidos registrados</p>
                  </div>
                  <Link href="/pedidos" className="text-sm font-semibold text-green-400 hover:text-green-300">
                    Ver todos
                  </Link>
                </div>

                {pedidosRecientes.length === 0 ? (
                  <div className="px-5 py-12 text-center text-slate-400">Todavía no hay pedidos registrados.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left">
                      <thead className="bg-slate-950/50 text-sm text-slate-400">
                        <tr>
                          <th className="px-5 py-4">Pedido</th>
                          <th className="px-5 py-4">Cliente</th>
                          <th className="px-5 py-4">Ruta</th>
                          <th className="px-5 py-4">Motorizado</th>
                          <th className="px-5 py-4">Estado</th>
                          <th className="px-5 py-4">Total</th>
                          <th className="px-5 py-4">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidosRecientes.map((pedido) => {
                          const total = Number(pedido.costo_envio ?? 0) + Number(pedido.monto_compra ?? 0);
                          return (
                            <tr key={pedido.id} className="border-t border-slate-800 text-sm transition hover:bg-slate-800/40">
                              <td className="px-5 py-4 font-bold text-green-400">#{pedido.id}</td>
                              <td className="px-5 py-4 font-semibold">{pedido.nombre_cliente}</td>
                              <td className="px-5 py-4 text-slate-300">
                                <div className="max-w-52">
                                  <p className="truncate">{pedido.direccion_recogida}</p>
                                  <p className="mt-1 truncate text-slate-500">→ {pedido.direccion_entrega}</p>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-slate-300">{obtenerNombreMotorizado(pedido.motorizados)}</td>
                              <td className="px-5 py-4">
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${colorEstado(pedido.estado)}`}>
                                  {pedido.estado}
                                </span>
                              </td>
                              <td className="px-5 py-4 font-semibold">{formatearDinero(total)}</td>
                              <td className="whitespace-nowrap px-5 py-4 text-slate-400">{formatearFecha(pedido.created_at)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-800 p-5">
                  <div>
                    <h3 className="text-lg font-bold">Actividad de Caja</h3>
                    <p className="text-sm text-slate-400">Movimientos recientes</p>
                  </div>
                  <Link href="/caja" className="text-sm font-semibold text-green-400 hover:text-green-300">Ver Caja</Link>
                </div>
                <div className="space-y-3 p-4">
                  {movimientosRecientes.length === 0 && (
                    <p className="py-8 text-center text-slate-400">No hay movimientos registrados.</p>
                  )}
                  {movimientosRecientes.map((movimiento) => {
                    const esIngreso = movimiento.tipo === "Ingreso";
                    return (
                      <article key={movimiento.id} className="rounded-xl bg-slate-800/70 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-1 text-xs font-bold ${esIngreso ? "bg-green-500/15 text-green-300" : "bg-red-500/15 text-red-300"}`}>
                                {movimiento.tipo}
                              </span>
                              <p className="truncate font-semibold">{movimiento.categoria}</p>
                            </div>
                            <p className="mt-2 truncate text-sm text-slate-400">{movimiento.descripcion || "Sin descripción"}</p>
                            <p className="mt-2 text-xs text-slate-500">{formatearFecha(movimiento.created_at)}</p>
                          </div>
                          <p className={`shrink-0 font-black ${esIngreso ? "text-green-400" : "text-red-400"}`}>
                            {esIngreso ? "+" : "-"}{formatearDinero(Number(movimiento.monto))}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
