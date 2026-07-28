"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type EstadoPedido =
  | "Pendiente"
  | "Asignado"
  | "Recogido"
  | "En camino"
  | "Entregado"
  | "Cancelado";

type RelacionMotorizado =
  | {
      nombre: string;
    }
  | {
      nombre: string;
    }[]
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

function obtenerNombreMotorizado(motorizados: RelacionMotorizado) {
  if (!motorizados) {
    return "Sin asignar";
  }

  if (Array.isArray(motorizados)) {
    return motorizados[0]?.nombre ?? "Sin asignar";
  }

  return motorizados.nombre;
}

function colorEstado(estado: string) {
  if (estado === "Entregado") {
    return "bg-emerald-500/15 text-emerald-400";
  }

  if (estado === "En camino" || estado === "En entrega") {
    return "bg-amber-500/15 text-amber-400";
  }

  if (estado === "Recogido") {
    return "bg-violet-500/15 text-violet-400";
  }

  if (estado === "Asignado") {
    return "bg-blue-500/15 text-blue-400";
  }

  if (estado === "Cancelado") {
    return "bg-red-500/15 text-red-400";
  }

  if (estado === "Disponible") {
    return "bg-blue-500/15 text-blue-400";
  }

  return "bg-slate-500/15 text-slate-300";
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

function esDeHoy(fecha: string) {
  const fechaRegistro = new Date(fecha);
  const hoy = new Date();

  return (
    fechaRegistro.getFullYear() === hoy.getFullYear() &&
    fechaRegistro.getMonth() === hoy.getMonth() &&
    fechaRegistro.getDate() === hoy.getDate()
  );
}

export default function DashboardClient() {
  const supabase = useMemo(() => createClient(), []);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [usuario, setUsuario] = useState<User | null>(null);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  useEffect(() => {
    async function cargarUsuario() {
      const { data, error: errorUsuario } = await supabase.auth.getUser();

      if (errorUsuario) {
        console.error(errorUsuario);
        return;
      }

      setUsuario(data.user);
    }

    void cargarUsuario();
  }, [supabase]);

  async function cerrarSesion() {
    setCerrandoSesion(true);
    setError("");

    const { error: errorCerrarSesion } = await supabase.auth.signOut();

    if (errorCerrarSesion) {
      console.error(errorCerrarSesion);
      setError(`No se pudo cerrar la sesión: ${errorCerrarSesion.message}`);
      setCerrandoSesion(false);
      return;
    }

    window.location.href = "/login";
  }

  useEffect(() => {
    async function cargarDashboard() {
      setCargando(true);
      setError("");

      const [
        respuestaPedidos,
        respuestaMotorizados,
        respuestaMovimientos,
      ] = await Promise.all([
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
            motorizados (
              nombre
            )
          `)
          .order("created_at", { ascending: false }),

        supabase
          .from("motorizados")
          .select("id, nombre")
          .order("nombre", { ascending: true }),

        supabase
          .from("movimientos_caja")
          .select(
            "id, pedido_id, tipo, categoria, monto, descripcion, created_at"
          )
          .order("created_at", { ascending: false }),
      ]);

      if (respuestaPedidos.error) {
        console.error(respuestaPedidos.error);
        setError(
          `No se pudieron cargar los pedidos: ${respuestaPedidos.error.message}`
        );
        setCargando(false);
        return;
      }

      if (respuestaMotorizados.error) {
        console.error(respuestaMotorizados.error);
        setError(
          `No se pudieron cargar los motorizados: ${respuestaMotorizados.error.message}`
        );
        setCargando(false);
        return;
      }

      if (respuestaMovimientos.error) {
        console.error(respuestaMovimientos.error);
        setError(
          `No se pudo cargar la Caja: ${respuestaMovimientos.error.message}`
        );
        setCargando(false);
        return;
      }

      setPedidos((respuestaPedidos.data ?? []) as Pedido[]);
      setMotorizados((respuestaMotorizados.data ?? []) as Motorizado[]);
      setMovimientos(
        (respuestaMovimientos.data ?? []) as MovimientoCaja[]
      );

      setCargando(false);
    }

    void cargarDashboard();
  }, [supabase]);

  const datosDashboard = useMemo(() => {
    const pedidosHoy = pedidos.filter((pedido) =>
      esDeHoy(pedido.created_at)
    );

    const pendientes = pedidosHoy.filter(
      (pedido) => pedido.estado === "Pendiente"
    ).length;

    const asignados = pedidosHoy.filter(
      (pedido) => pedido.estado === "Asignado"
    ).length;

    const recogidos = pedidosHoy.filter(
      (pedido) => pedido.estado === "Recogido"
    ).length;

    const enCamino = pedidosHoy.filter(
      (pedido) => pedido.estado === "En camino"
    ).length;

    const entregados = pedidosHoy.filter(
      (pedido) => pedido.estado === "Entregado"
    ).length;

    const cancelados = pedidosHoy.filter(
      (pedido) => pedido.estado === "Cancelado"
    ).length;

    const movimientosHoy = movimientos.filter((movimiento) =>
      esDeHoy(movimiento.created_at)
    );

    const ingresosTotales = movimientos
      .filter((movimiento) => movimiento.tipo === "Ingreso")
      .reduce(
        (total, movimiento) =>
          total + Number(movimiento.monto ?? 0),
        0
      );

    const egresosTotales = movimientos
      .filter((movimiento) => movimiento.tipo === "Egreso")
      .reduce(
        (total, movimiento) =>
          total + Number(movimiento.monto ?? 0),
        0
      );

    const ingresosHoy = movimientosHoy
      .filter((movimiento) => movimiento.tipo === "Ingreso")
      .reduce(
        (total, movimiento) =>
          total + Number(movimiento.monto ?? 0),
        0
      );

    const egresosHoy = movimientosHoy
      .filter((movimiento) => movimiento.tipo === "Egreso")
      .reduce(
        (total, movimiento) =>
          total + Number(movimiento.monto ?? 0),
        0
      );

    return {
      pedidosHoy,
      pendientes,
      asignados,
      recogidos,
      enCamino,
      entregados,
      cancelados,
      ingresosTotales,
      egresosTotales,
      balanceTotal: ingresosTotales - egresosTotales,
      ingresosHoy,
      egresosHoy,
      balanceHoy: ingresosHoy - egresosHoy,
      movimientosHoy: movimientosHoy.length,
    };
  }, [movimientos, pedidos]);

  const resumen = [
    {
      titulo: "Pedidos hoy",
      valor: datosDashboard.pedidosHoy.length,
      detalle: "Total registrados",
      icono: "📦",
    },
    {
      titulo: "Pendientes",
      valor: datosDashboard.pendientes,
      detalle: "Esperando atención",
      icono: "⏳",
    },
    {
      titulo: "En camino",
      valor: datosDashboard.enCamino,
      detalle: "Pedidos activos",
      icono: "🛵",
    },
    {
      titulo: "Entregados",
      valor: datosDashboard.entregados,
      detalle: "Completados hoy",
      icono: "✅",
    },
  ];

  const pedidosRecientes = pedidos.slice(0, 6);
  const movimientosRecientes = movimientos.slice(0, 5);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-slate-800 bg-slate-900 lg:flex lg:flex-col">
          <div className="border-b border-slate-800 p-6">
            <h1 className="text-2xl font-black">
              MANDADOS <span className="text-green-500">RAPID</span>
            </h1>

            <p className="mt-1 text-sm text-slate-400">RapidControl</p>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl bg-green-600 px-4 py-3 font-semibold"
            >
              🏠 Dashboard
            </Link>

            <Link
              href="/pedidos"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 transition hover:bg-slate-800"
            >
              📦 Pedidos
            </Link>

            <Link
              href="/clientes"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 transition hover:bg-slate-800"
            >
              👥 Clientes
            </Link>

            <Link
              href="/motorizado"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 transition hover:bg-slate-800"
            >
              🛵 Motorizados
            </Link>

            <Link
              href="/caja"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 transition hover:bg-slate-800"
            >
              💰 Caja
            </Link>

            <span className="flex cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-slate-500">
              📊 Reportes
            </span>

            <span className="flex cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-slate-500">
              ⚙️ Configuración
            </span>
          </nav>

          <div className="border-t border-slate-800 p-4">
            <div className="rounded-xl bg-slate-800 p-4">
              <p className="truncate font-semibold">
                {usuario?.email ?? "Administrador"}
              </p>

              <p className="mt-1 text-sm text-slate-400">Sesión iniciada</p>

              <button
                type="button"
                onClick={cerrarSesion}
                disabled={cerrandoSesion}
                className="mt-4 w-full rounded-lg bg-red-600 py-2 text-sm font-semibold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cerrandoSesion ? "Cerrando..." : "Cerrar sesión"}
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex flex-col gap-4 border-b border-slate-800 bg-slate-900/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div>
              <p className="text-sm text-slate-400">
                Panel administrativo
              </p>

              <h2 className="text-2xl font-bold">Dashboard</h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/caja"
                className="rounded-xl border border-slate-700 px-5 py-3 text-center font-bold transition hover:bg-slate-800"
              >
                Ver Caja
              </Link>

              <Link
                href="/pedidos/nuevo"
                className="rounded-xl bg-green-600 px-5 py-3 text-center font-bold transition hover:bg-green-500"
              >
                + Nuevo pedido
              </Link>
            </div>
          </header>

          <div className="space-y-8 p-5 md:p-8">
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
                ❌ {error}
              </div>
            )}

            {cargando && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-12 text-center text-slate-400">
                Cargando información del dashboard...
              </div>
            )}

            {!cargando && !error && (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {resumen.map((item) => (
                    <article
                      key={item.titulo}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-slate-400">
                            {item.titulo}
                          </p>

                          <p className="mt-2 text-4xl font-black">
                            {item.valor}
                          </p>

                          <p className="mt-2 text-sm text-slate-500">
                            {item.detalle}
                          </p>
                        </div>

                        <span className="text-3xl">{item.icono}</span>
                      </div>
                    </article>
                  ))}
                </section>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
                    <p className="text-sm text-green-300">
                      Balance de hoy
                    </p>

                    <p className="mt-2 text-3xl font-black text-green-400">
                      {formatearDinero(datosDashboard.balanceHoy)}
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
                      Ingresos menos egresos
                    </p>
                  </article>

                  <article className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
                    <p className="text-sm text-blue-300">
                      Ingresos de hoy
                    </p>

                    <p className="mt-2 text-3xl font-black text-blue-400">
                      {formatearDinero(datosDashboard.ingresosHoy)}
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
                      Ingresos registrados en Caja
                    </p>
                  </article>

                  <article className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                    <p className="text-sm text-red-300">
                      Egresos de hoy
                    </p>

                    <p className="mt-2 text-3xl font-black text-red-400">
                      {formatearDinero(datosDashboard.egresosHoy)}
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
                      Gastos registrados en Caja
                    </p>
                  </article>

                  <article className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                    <p className="text-sm text-amber-300">
                      Balance total
                    </p>

                    <p className="mt-2 text-3xl font-black text-amber-400">
                      {formatearDinero(datosDashboard.balanceTotal)}
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
                      Histórico completo de Caja
                    </p>
                  </article>
                </section>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-2xl border border-blue-900/60 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">
                      Pedidos asignados
                    </p>

                    <p className="mt-2 text-3xl font-black text-blue-400">
                      {datosDashboard.asignados}
                    </p>
                  </article>

                  <article className="rounded-2xl border border-violet-900/60 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">
                      Pedidos recogidos
                    </p>

                    <p className="mt-2 text-3xl font-black text-violet-400">
                      {datosDashboard.recogidos}
                    </p>
                  </article>

                  <article className="rounded-2xl border border-red-900/60 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">
                      Pedidos cancelados
                    </p>

                    <p className="mt-2 text-3xl font-black text-red-400">
                      {datosDashboard.cancelados}
                    </p>
                  </article>

                  <article className="rounded-2xl border border-green-900/60 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">
                      Motorizados registrados
                    </p>

                    <p className="mt-2 text-3xl font-black text-green-400">
                      {motorizados.length}
                    </p>
                  </article>
                </section>

                <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
                  <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-800 p-5">
                      <div>
                        <h3 className="text-lg font-bold">
                          Pedidos recientes
                        </h3>

                        <p className="text-sm text-slate-400">
                          Últimos pedidos registrados
                        </p>
                      </div>

                      <Link
                        href="/pedidos"
                        className="text-sm font-semibold text-green-400 hover:text-green-300"
                      >
                        Ver todos
                      </Link>
                    </div>

                    {pedidosRecientes.length === 0 ? (
                      <div className="px-5 py-12 text-center text-slate-400">
                        Todavía no hay pedidos registrados.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[850px] text-left">
                          <thead className="bg-slate-950/50 text-sm text-slate-400">
                            <tr>
                              <th className="px-5 py-4">Pedido</th>
                              <th className="px-5 py-4">Cliente</th>
                              <th className="px-5 py-4">Dirección</th>
                              <th className="px-5 py-4">Motorizado</th>
                              <th className="px-5 py-4">Estado</th>
                              <th className="px-5 py-4">Total</th>
                              <th className="px-5 py-4">Fecha</th>
                            </tr>
                          </thead>

                          <tbody>
                            {pedidosRecientes.map((pedido) => {
                              const total =
                                Number(pedido.costo_envio ?? 0) +
                                Number(pedido.monto_compra ?? 0);

                              return (
                                <tr
                                  key={pedido.id}
                                  className="border-t border-slate-800 text-sm transition hover:bg-slate-800/40"
                                >
                                  <td className="px-5 py-4 font-bold text-green-400">
                                    #{pedido.id}
                                  </td>

                                  <td className="px-5 py-4 font-semibold">
                                    {pedido.nombre_cliente}
                                  </td>

                                  <td className="px-5 py-4 text-slate-300">
                                    <div className="max-w-52">
                                      <p className="truncate">
                                        {pedido.direccion_recogida}
                                      </p>

                                      <p className="mt-1 truncate text-slate-500">
                                        → {pedido.direccion_entrega}
                                      </p>
                                    </div>
                                  </td>

                                  <td className="px-5 py-4 text-slate-300">
                                    {obtenerNombreMotorizado(
                                      pedido.motorizados
                                    )}
                                  </td>

                                  <td className="px-5 py-4">
                                    <span
                                      className={`rounded-full px-3 py-1 text-xs font-bold ${colorEstado(
                                        pedido.estado
                                      )}`}
                                    >
                                      {pedido.estado}
                                    </span>
                                  </td>

                                  <td className="px-5 py-4 font-semibold">
                                    {formatearDinero(total)}
                                  </td>

                                  <td className="whitespace-nowrap px-5 py-4 text-slate-400">
                                    {formatearFecha(pedido.created_at)}
                                  </td>
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
                        <h3 className="text-lg font-bold">
                          Movimientos de Caja
                        </h3>

                        <p className="text-sm text-slate-400">
                          Actividad financiera reciente
                        </p>
                      </div>

                      <Link
                        href="/caja"
                        className="text-sm font-semibold text-green-400 hover:text-green-300"
                      >
                        Ver Caja
                      </Link>
                    </div>

                    <div className="space-y-3 p-4">
                      {movimientosRecientes.length === 0 && (
                        <p className="py-8 text-center text-slate-400">
                          No hay movimientos registrados.
                        </p>
                      )}

                      {movimientosRecientes.map((movimiento) => {
                        const esIngreso =
                          movimiento.tipo === "Ingreso";

                        return (
                          <article
                            key={movimiento.id}
                            className="rounded-xl bg-slate-800/70 p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs font-bold ${
                                      esIngreso
                                        ? "bg-green-500/15 text-green-300"
                                        : "bg-red-500/15 text-red-300"
                                    }`}
                                  >
                                    {movimiento.tipo}
                                  </span>

                                  <p className="truncate font-semibold">
                                    {movimiento.categoria}
                                  </p>
                                </div>

                                <p className="mt-2 truncate text-sm text-slate-400">
                                  {movimiento.descripcion ||
                                    "Sin descripción"}
                                </p>

                                <p className="mt-2 text-xs text-slate-500">
                                  {formatearFecha(
                                    movimiento.created_at
                                  )}
                                </p>
                              </div>

                              <p
                                className={`shrink-0 font-black ${
                                  esIngreso
                                    ? "text-green-400"
                                    : "text-red-400"
                                }`}
                              >
                                {esIngreso ? "+" : "-"}
                                {formatearDinero(
                                  Number(movimiento.monto)
                                )}
                              </p>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Link
                    href="/pedidos/nuevo"
                    className="rounded-2xl border border-green-900 bg-green-950/30 p-5 transition hover:bg-green-950/60"
                  >
                    <span className="text-3xl">➕</span>

                    <h3 className="mt-3 font-bold">Nuevo pedido</h3>

                    <p className="mt-1 text-sm text-slate-400">
                      Registrar una nueva entrega
                    </p>
                  </Link>

                  <Link
                    href="/pedidos"
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:bg-slate-800"
                  >
                    <span className="text-3xl">📦</span>

                    <h3 className="mt-3 font-bold">Ver pedidos</h3>

                    <p className="mt-1 text-sm text-slate-400">
                      Consultar y cambiar estados
                    </p>
                  </Link>

                  <Link
                    href="/clientes"
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:bg-slate-800"
                  >
                    <span className="text-3xl">👥</span>

                    <h3 className="mt-3 font-bold">Clientes</h3>

                    <p className="mt-1 text-sm text-slate-400">
                      Administrar clientes registrados
                    </p>
                  </Link>

                  <Link
                    href="/caja"
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:bg-slate-800"
                  >
                    <span className="text-3xl">💰</span>

                    <h3 className="mt-3 font-bold">Caja</h3>

                    <p className="mt-1 text-sm text-slate-400">
                      Ver ingresos, egresos y balance
                    </p>
                  </Link>
                </section>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}