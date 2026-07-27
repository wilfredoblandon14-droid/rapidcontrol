"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

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

const estiloCampo =
  "w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 disabled:cursor-not-allowed disabled:opacity-60";

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
  const fechaMovimiento = new Date(fecha);
  const hoy = new Date();

  return (
    fechaMovimiento.getFullYear() === hoy.getFullYear() &&
    fechaMovimiento.getMonth() === hoy.getMonth() &&
    fechaMovimiento.getDate() === hoy.getDate()
  );
}

export default function Caja() {
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<
    "Todos" | TipoMovimiento
  >("Todos");

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargarMovimientos() {
    setCargando(true);
    setError("");

    const { data, error: errorMovimientos } = await supabase
      .from("movimientos_caja")
      .select(
        "id, pedido_id, tipo, categoria, monto, descripcion, created_at"
      )
      .order("created_at", { ascending: false });

    if (errorMovimientos) {
      console.error(errorMovimientos);
      setError(
        `No se pudieron cargar los movimientos: ${errorMovimientos.message}`
      );
      setCargando(false);
      return;
    }

    setMovimientos((data ?? []) as MovimientoCaja[]);
    setCargando(false);
  }

  useEffect(() => {
    void cargarMovimientos();
  }, []);

  const resumen = useMemo(() => {
    const movimientosHoy = movimientos.filter((movimiento) =>
      esDeHoy(movimiento.created_at)
    );

    const ingresosTotales = movimientos
      .filter((movimiento) => movimiento.tipo === "Ingreso")
      .reduce(
        (acumulado, movimiento) =>
          acumulado + Number(movimiento.monto ?? 0),
        0
      );

    const egresosTotales = movimientos
      .filter((movimiento) => movimiento.tipo === "Egreso")
      .reduce(
        (acumulado, movimiento) =>
          acumulado + Number(movimiento.monto ?? 0),
        0
      );

    const ingresosHoy = movimientosHoy
      .filter((movimiento) => movimiento.tipo === "Ingreso")
      .reduce(
        (acumulado, movimiento) =>
          acumulado + Number(movimiento.monto ?? 0),
        0
      );

    const egresosHoy = movimientosHoy
      .filter((movimiento) => movimiento.tipo === "Egreso")
      .reduce(
        (acumulado, movimiento) =>
          acumulado + Number(movimiento.monto ?? 0),
        0
      );

    return {
      balanceTotal: ingresosTotales - egresosTotales,
      ingresosTotales,
      egresosTotales,
      balanceHoy: ingresosHoy - egresosHoy,
      ingresosHoy,
      egresosHoy,
      movimientosHoy: movimientosHoy.length,
    };
  }, [movimientos]);

  const movimientosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return movimientos.filter((movimiento) => {
      const coincideTipo =
        filtroTipo === "Todos" || movimiento.tipo === filtroTipo;

      const coincideBusqueda =
        !texto ||
        movimiento.categoria.toLowerCase().includes(texto) ||
        movimiento.descripcion?.toLowerCase().includes(texto) ||
        movimiento.pedido_id?.toString().includes(texto);

      return coincideTipo && coincideBusqueda;
    });
  }, [busqueda, filtroTipo, movimientos]);

  async function guardarMovimiento(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const formularioElemento = event.currentTarget;
    const formulario = new FormData(formularioElemento);

    setGuardando(true);
    setError("");
    setMensaje("");

    const tipo =
      formulario.get("tipo")?.toString() === "Egreso"
        ? "Egreso"
        : "Ingreso";

    const categoria =
      formulario.get("categoria")?.toString().trim() ?? "";

    const monto = Number(formulario.get("monto") ?? 0);

    const descripcion =
      formulario.get("descripcion")?.toString().trim() ?? "";

    if (!categoria) {
      setError("Escribe una categoría para el movimiento.");
      setGuardando(false);
      return;
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      setError("El monto debe ser mayor que cero.");
      setGuardando(false);
      return;
    }

    const { data, error: errorGuardado } = await supabase
      .from("movimientos_caja")
      .insert({
        pedido_id: null,
        tipo,
        categoria,
        monto,
        descripcion: descripcion || null,
      })
      .select(
        "id, pedido_id, tipo, categoria, monto, descripcion, created_at"
      )
      .single();

    if (errorGuardado) {
      console.error(errorGuardado);
      setError(
        `No se pudo guardar el movimiento: ${errorGuardado.message}`
      );
      setGuardando(false);
      return;
    }

    setMovimientos((movimientosActuales) => [
      data as MovimientoCaja,
      ...movimientosActuales,
    ]);

    formularioElemento.reset();
    setMostrarFormulario(false);
    setGuardando(false);

    setMensaje(
      `${tipo} de ${formatearDinero(monto)} registrado correctamente.`
    );

    window.setTimeout(() => {
      setMensaje("");
    }, 3000);
  }

  async function eliminarMovimiento(movimiento: MovimientoCaja) {
    if (movimiento.pedido_id !== null) {
      setError(
        "Los movimientos generados por pedidos no se pueden eliminar desde Caja."
      );
      return;
    }

    const confirmado = window.confirm(
      `¿Seguro que deseas eliminar este ${movimiento.tipo.toLowerCase()} de ${formatearDinero(
        Number(movimiento.monto)
      )}?`
    );

    if (!confirmado) {
      return;
    }

    setError("");
    setMensaje("");

    const { error: errorEliminacion } = await supabase
      .from("movimientos_caja")
      .delete()
      .eq("id", movimiento.id);

    if (errorEliminacion) {
      console.error(errorEliminacion);
      setError(
        `No se pudo eliminar el movimiento: ${errorEliminacion.message}`
      );
      return;
    }

    setMovimientos((movimientosActuales) =>
      movimientosActuales.filter(
        (item) => item.id !== movimiento.id
      )
    );

    setMensaje("Movimiento eliminado correctamente.");

    window.setTimeout(() => {
      setMensaje("");
    }, 2500);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">Control financiero</p>

            <h1 className="mt-1 text-3xl font-black md:text-4xl">
              💰 Caja
            </h1>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="rounded-xl border border-slate-700 px-6 py-3 text-center font-bold transition hover:bg-slate-800"
            >
              ← Dashboard
            </Link>

            <button
              type="button"
              onClick={() =>
                setMostrarFormulario((estadoActual) => !estadoActual)
              }
              className="rounded-xl bg-green-600 px-6 py-3 font-bold transition hover:bg-green-500"
            >
              {mostrarFormulario
                ? "Cerrar formulario"
                : "+ Nuevo movimiento"}
            </button>
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

        {mostrarFormulario && (
          <form
            onSubmit={guardarMovimiento}
            className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl md:p-6"
          >
            <div className="mb-5">
              <h2 className="text-xl font-black">
                Registrar movimiento manual
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Úsalo para gastos, combustible, adelantos u otros ingresos.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-slate-200">
                  Tipo
                </span>

                <select
                  name="tipo"
                  defaultValue="Egreso"
                  disabled={guardando}
                  className={estiloCampo}
                >
                  <option value="Ingreso">Ingreso</option>
                  <option value="Egreso">Egreso</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-slate-200">
                  Categoría
                </span>

                <input
                  type="text"
                  name="categoria"
                  required
                  disabled={guardando}
                  className={estiloCampo}
                  placeholder="Ejemplo: Combustible"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-slate-200">
                  Monto
                </span>

                <input
                  type="number"
                  name="monto"
                  min="0.01"
                  step="0.01"
                  required
                  disabled={guardando}
                  className={estiloCampo}
                  placeholder="Ejemplo: 250"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-slate-200">
                  Descripción
                </span>

                <input
                  type="text"
                  name="descripcion"
                  disabled={guardando}
                  className={estiloCampo}
                  placeholder="Información adicional"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setMostrarFormulario(false)}
                disabled={guardando}
                className="rounded-xl border border-slate-700 px-6 py-3 font-bold transition hover:bg-slate-800"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={guardando}
                className="rounded-xl bg-green-600 px-8 py-3 font-bold transition hover:bg-green-500 disabled:cursor-wait disabled:opacity-60"
              >
                {guardando
                  ? "Guardando..."
                  : "Guardar movimiento"}
              </button>
            </div>
          </form>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
            <p className="text-sm text-green-300">
              Balance total
            </p>

            <p className="mt-2 text-3xl font-black text-green-400">
              {formatearDinero(resumen.balanceTotal)}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Ingresos menos egresos
            </p>
          </article>

          <article className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
            <p className="text-sm text-blue-300">
              Ingresos totales
            </p>

            <p className="mt-2 text-3xl font-black text-blue-400">
              {formatearDinero(resumen.ingresosTotales)}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Todos los ingresos registrados
            </p>
          </article>

          <article className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="text-sm text-red-300">
              Egresos totales
            </p>

            <p className="mt-2 text-3xl font-black text-red-400">
              {formatearDinero(resumen.egresosTotales)}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Todos los gastos registrados
            </p>
          </article>

          <article className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-300">
              Balance de hoy
            </p>

            <p className="mt-2 text-3xl font-black text-amber-400">
              {formatearDinero(resumen.balanceHoy)}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              {resumen.movimientosHoy} movimientos hoy
            </p>
          </article>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Ingresos de hoy</p>

            <p className="mt-2 text-2xl font-black text-green-400">
              {formatearDinero(resumen.ingresosHoy)}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Egresos de hoy</p>

            <p className="mt-2 text-2xl font-black text-red-400">
              {formatearDinero(resumen.egresosHoy)}
            </p>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex flex-col gap-4 border-b border-slate-800 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black">
                Movimientos de Caja
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                {movimientosFiltrados.length} movimientos mostrados
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={filtroTipo}
                onChange={(event) =>
                  setFiltroTipo(
                    event.target.value as
                      | "Todos"
                      | TipoMovimiento
                  )
                }
                className={estiloCampo}
              >
                <option value="Todos">Todos los tipos</option>
                <option value="Ingreso">Ingresos</option>
                <option value="Egreso">Egresos</option>
              </select>

              <input
                type="search"
                value={busqueda}
                onChange={(event) =>
                  setBusqueda(event.target.value)
                }
                className={estiloCampo}
                placeholder="Buscar categoría, descripción o pedido"
              />
            </div>
          </div>

          {cargando && (
            <div className="px-5 py-14 text-center text-slate-400">
              Cargando movimientos...
            </div>
          )}

          {!cargando && movimientos.length === 0 && (
            <div className="px-5 py-14 text-center">
              <p className="text-lg font-bold text-slate-300">
                No hay movimientos registrados.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Los pedidos entregados aparecerán automáticamente aquí.
              </p>
            </div>
          )}

          {!cargando &&
            movimientos.length > 0 &&
            movimientosFiltrados.length === 0 && (
              <div className="px-5 py-14 text-center text-slate-400">
                No se encontraron movimientos con esos filtros.
              </div>
            )}

          {!cargando && movimientosFiltrados.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left">
                <thead className="bg-slate-950/50 text-sm text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Movimiento</th>
                    <th className="px-5 py-4">Tipo</th>
                    <th className="px-5 py-4">Categoría</th>
                    <th className="px-5 py-4">Descripción</th>
                    <th className="px-5 py-4">Pedido</th>
                    <th className="px-5 py-4 text-right">Monto</th>
                    <th className="px-5 py-4">Fecha</th>
                    <th className="px-5 py-4 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {movimientosFiltrados.map((movimiento) => {
                    const esIngreso =
                      movimiento.tipo === "Ingreso";

                    return (
                      <tr
                        key={movimiento.id}
                        className="border-t border-slate-800 transition hover:bg-slate-800/40"
                      >
                        <td className="px-5 py-5 font-bold text-slate-300">
                          #{movimiento.id}
                        </td>

                        <td className="px-5 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              esIngreso
                                ? "bg-green-500/15 text-green-300"
                                : "bg-red-500/15 text-red-300"
                            }`}
                          >
                            {movimiento.tipo}
                          </span>
                        </td>

                        <td className="px-5 py-5 font-semibold">
                          {movimiento.categoria}
                        </td>

                        <td className="px-5 py-5 text-slate-400">
                          <p className="max-w-80 truncate">
                            {movimiento.descripcion ||
                              "Sin descripción"}
                          </p>
                        </td>

                        <td className="px-5 py-5">
                          {movimiento.pedido_id ? (
                            <Link
                              href="/pedidos"
                              className="font-bold text-green-400 hover:text-green-300"
                            >
                              #{movimiento.pedido_id}
                            </Link>
                          ) : (
                            <span className="text-slate-500">
                              Manual
                            </span>
                          )}
                        </td>

                        <td
                          className={`px-5 py-5 text-right text-lg font-black ${
                            esIngreso
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {esIngreso ? "+" : "-"}
                          {formatearDinero(
                            Number(movimiento.monto)
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-5 text-slate-400">
                          {formatearFecha(
                            movimiento.created_at
                          )}
                        </td>

                        <td className="px-5 py-5 text-right">
                          {movimiento.pedido_id === null ? (
                            <button
                              type="button"
                              onClick={() =>
                                void eliminarMovimiento(
                                  movimiento
                                )
                              }
                              className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20"
                            >
                              Eliminar
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">
                              Automático
                            </span>
                          )}
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