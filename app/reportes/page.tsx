"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx";

type EstadoPedido =
  | "Pendiente"
  | "Asignado"
  | "Recogido"
  | "En camino"
  | "Entregado"
  | "Cancelado";

type TipoMovimiento = "Ingreso" | "Egreso";

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
  created_at: string;
  motorizado_id: number | null;
  motorizados: RelacionMotorizado;
};

type MovimientoCaja = {
  id: number;
  pedido_id: number | null;
  tipo: TipoMovimiento;
  categoria: string;
  monto: number;
  descripcion: string | null;
  created_at: string;
};

type ResumenDiario = {
  fecha: string;
  pedidos: number;
  entregados: number;
  ingresos: number;
  egresos: number;
  balance: number;
};

type RendimientoMotorizado = {
  nombre: string;
  asignados: number;
  entregados: number;
  enProceso: number;
  cancelados: number;
  ingresosEnvios: number;
};

type RendimientoCliente = {
  nombre: string;
  pedidos: number;
  entregados: number;
  totalPedidos: number;
};

const estiloCampo =
  "w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20";

function obtenerNombreMotorizado(motorizados: RelacionMotorizado) {
  if (!motorizados) {
    return "Sin asignar";
  }

  if (Array.isArray(motorizados)) {
    return motorizados[0]?.nombre ?? "Sin asignar";
  }

  return motorizados.nombre;
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

function formatearFechaCorta(fecha: string) {
  return new Intl.DateTimeFormat("es-NI", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${fecha}T12:00:00`));
}

function convertirFechaLocal(fecha: Date) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function obtenerInicioMes() {
  const hoy = new Date();
  return convertirFechaLocal(
    new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  );
}

function obtenerHoy() {
  return convertirFechaLocal(new Date());
}

function estaEnPeriodo(
  fechaRegistro: string,
  fechaInicio: string,
  fechaFin: string
) {
  const fecha = new Date(fechaRegistro);

  const inicio = new Date(`${fechaInicio}T00:00:00`);
  const fin = new Date(`${fechaFin}T23:59:59.999`);

  return fecha >= inicio && fecha <= fin;
}

function obtenerClaveFecha(fecha: string) {
  return convertirFechaLocal(new Date(fecha));
}

function estiloEstado(estado: EstadoPedido) {
  if (estado === "Entregado") {
    return "bg-green-500/15 text-green-300";
  }

  if (estado === "En camino") {
    return "bg-amber-500/15 text-amber-300";
  }

  if (estado === "Recogido") {
    return "bg-violet-500/15 text-violet-300";
  }

  if (estado === "Asignado") {
    return "bg-blue-500/15 text-blue-300";
  }

  if (estado === "Cancelado") {
    return "bg-red-500/15 text-red-300";
  }

  return "bg-slate-500/15 text-slate-300";
}

export default function Reportes() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);

  const [fechaInicio, setFechaInicio] = useState(obtenerInicioMes());
  const [fechaFin, setFechaFin] = useState(obtenerHoy());

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true);
      setError("");

      const [respuestaPedidos, respuestaMovimientos] = await Promise.all([
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
            created_at,
            motorizado_id,
            motorizados (
              nombre
            )
          `)
          .order("created_at", { ascending: false }),

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

      if (respuestaMovimientos.error) {
        console.error(respuestaMovimientos.error);
        setError(
          `No se pudieron cargar los movimientos de Caja: ${respuestaMovimientos.error.message}`
        );
        setCargando(false);
        return;
      }

      setPedidos((respuestaPedidos.data ?? []) as Pedido[]);
      setMovimientos(
        (respuestaMovimientos.data ?? []) as MovimientoCaja[]
      );

      setCargando(false);
    }

    void cargarDatos();
  }, []);

  const reporte = useMemo(() => {
    const pedidosPeriodo = pedidos.filter((pedido) =>
      estaEnPeriodo(pedido.created_at, fechaInicio, fechaFin)
    );

    const movimientosPeriodo = movimientos.filter((movimiento) =>
      estaEnPeriodo(movimiento.created_at, fechaInicio, fechaFin)
    );

    const entregados = pedidosPeriodo.filter(
      (pedido) => pedido.estado === "Entregado"
    );

    const cancelados = pedidosPeriodo.filter(
      (pedido) => pedido.estado === "Cancelado"
    );

    const pendientes = pedidosPeriodo.filter(
      (pedido) => pedido.estado === "Pendiente"
    );

    const enProceso = pedidosPeriodo.filter((pedido) =>
      ["Asignado", "Recogido", "En camino"].includes(pedido.estado)
    );

    const ingresos = movimientosPeriodo
      .filter((movimiento) => movimiento.tipo === "Ingreso")
      .reduce(
        (total, movimiento) =>
          total + Number(movimiento.monto ?? 0),
        0
      );

    const egresos = movimientosPeriodo
      .filter((movimiento) => movimiento.tipo === "Egreso")
      .reduce(
        (total, movimiento) =>
          total + Number(movimiento.monto ?? 0),
        0
      );

    const totalEnviosEntregados = entregados.reduce(
      (total, pedido) => total + Number(pedido.costo_envio ?? 0),
      0
    );

    const totalComprasGestionadas = pedidosPeriodo.reduce(
      (total, pedido) => total + Number(pedido.monto_compra ?? 0),
      0
    );

    const mapaMotorizados = new Map<string, RendimientoMotorizado>();

    pedidosPeriodo.forEach((pedido) => {
      const nombre = obtenerNombreMotorizado(pedido.motorizados);

      const actual =
        mapaMotorizados.get(nombre) ??
        {
          nombre,
          asignados: 0,
          entregados: 0,
          enProceso: 0,
          cancelados: 0,
          ingresosEnvios: 0,
        };

      actual.asignados += 1;

      if (pedido.estado === "Entregado") {
        actual.entregados += 1;
        actual.ingresosEnvios += Number(pedido.costo_envio ?? 0);
      }

      if (
        pedido.estado === "Asignado" ||
        pedido.estado === "Recogido" ||
        pedido.estado === "En camino"
      ) {
        actual.enProceso += 1;
      }

      if (pedido.estado === "Cancelado") {
        actual.cancelados += 1;
      }

      mapaMotorizados.set(nombre, actual);
    });

    const rendimientoMotorizados = Array.from(
      mapaMotorizados.values()
    ).sort((a, b) => b.entregados - a.entregados);

    const mapaClientes = new Map<string, RendimientoCliente>();

    pedidosPeriodo.forEach((pedido) => {
      const nombre = pedido.nombre_cliente || "Sin nombre";

      const actual =
        mapaClientes.get(nombre) ??
        {
          nombre,
          pedidos: 0,
          entregados: 0,
          totalPedidos: 0,
        };

      actual.pedidos += 1;
      actual.totalPedidos +=
        Number(pedido.costo_envio ?? 0) +
        Number(pedido.monto_compra ?? 0);

      if (pedido.estado === "Entregado") {
        actual.entregados += 1;
      }

      mapaClientes.set(nombre, actual);
    });

    const rendimientoClientes = Array.from(
      mapaClientes.values()
    ).sort((a, b) => b.pedidos - a.pedidos);

    const mapaDias = new Map<string, ResumenDiario>();

    pedidosPeriodo.forEach((pedido) => {
      const fecha = obtenerClaveFecha(pedido.created_at);

      const actual =
        mapaDias.get(fecha) ??
        {
          fecha,
          pedidos: 0,
          entregados: 0,
          ingresos: 0,
          egresos: 0,
          balance: 0,
        };

      actual.pedidos += 1;

      if (pedido.estado === "Entregado") {
        actual.entregados += 1;
      }

      mapaDias.set(fecha, actual);
    });

    movimientosPeriodo.forEach((movimiento) => {
      const fecha = obtenerClaveFecha(movimiento.created_at);

      const actual =
        mapaDias.get(fecha) ??
        {
          fecha,
          pedidos: 0,
          entregados: 0,
          ingresos: 0,
          egresos: 0,
          balance: 0,
        };

      const monto = Number(movimiento.monto ?? 0);

      if (movimiento.tipo === "Ingreso") {
        actual.ingresos += monto;
      } else {
        actual.egresos += monto;
      }

      actual.balance = actual.ingresos - actual.egresos;

      mapaDias.set(fecha, actual);
    });

    const resumenDiario = Array.from(mapaDias.values()).sort(
      (a, b) => b.fecha.localeCompare(a.fecha)
    );

    const porcentajeEntrega =
      pedidosPeriodo.length > 0
        ? (entregados.length / pedidosPeriodo.length) * 100
        : 0;

    return {
      pedidosPeriodo,
      movimientosPeriodo,
      entregados,
      cancelados,
      pendientes,
      enProceso,
      ingresos,
      egresos,
      balance: ingresos - egresos,
      totalEnviosEntregados,
      totalComprasGestionadas,
      rendimientoMotorizados,
      rendimientoClientes,
      resumenDiario,
      porcentajeEntrega,
    };
  }, [fechaFin, fechaInicio, movimientos, pedidos]);

  const maximoEntregas = Math.max(
    ...reporte.rendimientoMotorizados.map(
      (motorizado) => motorizado.entregados
    ),
    1
  );

  function usarHoy() {
    const hoy = obtenerHoy();
    setFechaInicio(hoy);
    setFechaFin(hoy);
  }

  function usarMesActual() {
    setFechaInicio(obtenerInicioMes());
    setFechaFin(obtenerHoy());
  }

  function usarUltimosSieteDias() {
    const hoy = new Date();
    const inicio = new Date();

    inicio.setDate(hoy.getDate() - 6);

    setFechaInicio(convertirFechaLocal(inicio));
    setFechaFin(convertirFechaLocal(hoy));
  }

  function nombreArchivo(extension: string) {
    return `RapidControl_reporte_${fechaInicio}_${fechaFin}.${extension}`;
  }

  function exportarExcel() {
    const libro = XLSX.utils.book_new();

    const hojaResumen = XLSX.utils.json_to_sheet([
      {
        "Fecha inicial": fechaInicio,
        "Fecha final": fechaFin,
        Pedidos: reporte.pedidosPeriodo.length,
        Entregados: reporte.entregados.length,
        Cancelados: reporte.cancelados.length,
        Pendientes: reporte.pendientes.length,
        "En proceso": reporte.enProceso.length,
        Ingresos: reporte.ingresos,
        Egresos: reporte.egresos,
        Balance: reporte.balance,
        "Porcentaje entregado": `${reporte.porcentajeEntrega.toFixed(1)}%`,
      },
    ]);

    const hojaPedidos = XLSX.utils.json_to_sheet(
      reporte.pedidosPeriodo.map((pedido) => ({
        Pedido: pedido.id,
        Cliente: pedido.nombre_cliente,
        Motorizado: obtenerNombreMotorizado(pedido.motorizados),
        Estado: pedido.estado,
        "Dirección de recogida": pedido.direccion_recogida,
        "Dirección de entrega": pedido.direccion_entrega,
        "Costo de envío": Number(pedido.costo_envio ?? 0),
        "Monto de compra": Number(pedido.monto_compra ?? 0),
        Total:
          Number(pedido.costo_envio ?? 0) +
          Number(pedido.monto_compra ?? 0),
        Fecha: formatearFecha(pedido.created_at),
      }))
    );

    const hojaCaja = XLSX.utils.json_to_sheet(
      reporte.movimientosPeriodo.map((movimiento) => ({
        Movimiento: movimiento.id,
        Pedido: movimiento.pedido_id ?? "",
        Tipo: movimiento.tipo,
        Categoría: movimiento.categoria,
        Monto: Number(movimiento.monto ?? 0),
        Descripción: movimiento.descripcion ?? "",
        Fecha: formatearFecha(movimiento.created_at),
      }))
    );

    const hojaMotorizados = XLSX.utils.json_to_sheet(
      reporte.rendimientoMotorizados.map((motorizado) => ({
        Motorizado: motorizado.nombre,
        Asignados: motorizado.asignados,
        Entregados: motorizado.entregados,
        "En proceso": motorizado.enProceso,
        Cancelados: motorizado.cancelados,
        "Ingresos por envíos": motorizado.ingresosEnvios,
      }))
    );

    const hojaClientes = XLSX.utils.json_to_sheet(
      reporte.rendimientoClientes.map((cliente) => ({
        Cliente: cliente.nombre,
        Pedidos: cliente.pedidos,
        Entregados: cliente.entregados,
        "Valor total": cliente.totalPedidos,
      }))
    );

    const hojaDiaria = XLSX.utils.json_to_sheet(
      reporte.resumenDiario.map((dia) => ({
        Fecha: dia.fecha,
        Pedidos: dia.pedidos,
        Entregados: dia.entregados,
        Ingresos: dia.ingresos,
        Egresos: dia.egresos,
        Balance: dia.balance,
      }))
    );

    XLSX.utils.book_append_sheet(libro, hojaResumen, "Resumen");
    XLSX.utils.book_append_sheet(libro, hojaPedidos, "Pedidos");
    XLSX.utils.book_append_sheet(libro, hojaCaja, "Caja");
    XLSX.utils.book_append_sheet(libro, hojaMotorizados, "Motorizados");
    XLSX.utils.book_append_sheet(libro, hojaClientes, "Clientes");
    XLSX.utils.book_append_sheet(libro, hojaDiaria, "Resumen diario");

    XLSX.writeFile(libro, nombreArchivo("xlsx"));
  }

  function exportarPDF() {
    const documento = new jsPDF({ orientation: "landscape" });

    documento.setFontSize(18);
    documento.text("RapidControl - Reporte general", 14, 16);
    documento.setFontSize(10);
    documento.text(`Período: ${fechaInicio} al ${fechaFin}`, 14, 23);

    autoTable(documento, {
      startY: 29,
      head: [["Pedidos", "Entregados", "Cancelados", "Ingresos", "Egresos", "Balance"]],
      body: [[
        reporte.pedidosPeriodo.length,
        reporte.entregados.length,
        reporte.cancelados.length,
        formatearDinero(reporte.ingresos),
        formatearDinero(reporte.egresos),
        formatearDinero(reporte.balance),
      ]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 163, 74] },
    });

    autoTable(documento, {
      startY: 52,
      head: [["#", "Cliente", "Motorizado", "Estado", "Envío", "Total", "Fecha"]],
      body: reporte.pedidosPeriodo.map((pedido) => {
        const envio = Number(pedido.costo_envio ?? 0);
        const total = envio + Number(pedido.monto_compra ?? 0);

        return [
          pedido.id,
          pedido.nombre_cliente,
          obtenerNombreMotorizado(pedido.motorizados),
          pedido.estado,
          formatearDinero(envio),
          formatearDinero(total),
          formatearFecha(pedido.created_at),
        ];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 14, right: 14 },
    });

    documento.save(nombreArchivo("pdf"));
  }

  function imprimirReporte() {
    window.print();
  }

  return (
    <main className="bg-slate-950 p-5 text-white md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap justify-end gap-3 print:hidden">
            <button
              type="button"
              onClick={exportarPDF}
              disabled={cargando}
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
            >
              📄 Exportar PDF
            </button>

            <button
              type="button"
              onClick={exportarExcel}
              disabled={cargando}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 font-bold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              📊 Exportar Excel
            </button>

            <button
              type="button"
              onClick={imprimirReporte}
              disabled={cargando}
              className="rounded-xl border border-slate-700 px-5 py-3 font-bold transition hover:bg-slate-800 disabled:opacity-50"
            >
              🖨️ Imprimir
            </button>

            <Link
              href="/caja"
              className="rounded-xl bg-green-600 px-6 py-3 text-center font-bold transition hover:bg-green-500"
            >
              Ver Caja
            </Link>
          </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
            ❌ {error}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6 print:hidden">
          <div className="mb-5">
            <h2 className="text-xl font-black">Período del reporte</h2>

            <p className="mt-1 text-sm text-slate-400">
              Selecciona las fechas que deseas analizar.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2">
              <span className="font-semibold text-slate-300">
                Fecha inicial
              </span>

              <input
                type="date"
                value={fechaInicio}
                max={fechaFin}
                onChange={(event) =>
                  setFechaInicio(event.target.value)
                }
                className={estiloCampo}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="font-semibold text-slate-300">
                Fecha final
              </span>

              <input
                type="date"
                value={fechaFin}
                min={fechaInicio}
                onChange={(event) => setFechaFin(event.target.value)}
                className={estiloCampo}
              />
            </label>

            <button
              type="button"
              onClick={usarHoy}
              className="self-end rounded-xl border border-slate-700 px-5 py-3 font-bold transition hover:bg-slate-800"
            >
              Hoy
            </button>

            <div className="flex self-end gap-3">
              <button
                type="button"
                onClick={usarUltimosSieteDias}
                className="flex-1 rounded-xl border border-slate-700 px-4 py-3 font-bold transition hover:bg-slate-800"
              >
                7 días
              </button>

              <button
                type="button"
                onClick={usarMesActual}
                className="flex-1 rounded-xl border border-slate-700 px-4 py-3 font-bold transition hover:bg-slate-800"
              >
                Este mes
              </button>
            </div>
          </div>
        </section>

        {cargando && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-14 text-center text-slate-400">
            Cargando reportes...
          </div>
        )}

        {!cargando && !error && (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
                <p className="text-sm text-green-300">Balance</p>

                <p className="mt-2 text-3xl font-black text-green-400">
                  {formatearDinero(reporte.balance)}
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Ingresos menos egresos
                </p>
              </article>

              <article className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
                <p className="text-sm text-blue-300">Ingresos</p>

                <p className="mt-2 text-3xl font-black text-blue-400">
                  {formatearDinero(reporte.ingresos)}
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Ingresos del período
                </p>
              </article>

              <article className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                <p className="text-sm text-red-300">Egresos</p>

                <p className="mt-2 text-3xl font-black text-red-400">
                  {formatearDinero(reporte.egresos)}
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Gastos del período
                </p>
              </article>

              <article className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                <p className="text-sm text-amber-300">
                  Porcentaje entregado
                </p>

                <p className="mt-2 text-3xl font-black text-amber-400">
                  {reporte.porcentajeEntrega.toFixed(1)}%
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Pedidos completados
                </p>
              </article>
            </section>

            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Pedidos creados
                </p>

                <p className="mt-2 text-3xl font-black">
                  {reporte.pedidosPeriodo.length}
                </p>
              </article>

              <article className="rounded-2xl border border-green-900/60 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Pedidos entregados
                </p>

                <p className="mt-2 text-3xl font-black text-green-400">
                  {reporte.entregados.length}
                </p>
              </article>

              <article className="rounded-2xl border border-amber-900/60 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Pedidos en proceso
                </p>

                <p className="mt-2 text-3xl font-black text-amber-400">
                  {reporte.enProceso.length}
                </p>
              </article>

              <article className="rounded-2xl border border-red-900/60 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Pedidos cancelados
                </p>

                <p className="mt-2 text-3xl font-black text-red-400">
                  {reporte.cancelados.length}
                </p>
              </article>
            </section>

            <section className="mb-6 grid gap-4 sm:grid-cols-2">
              <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Envíos entregados
                </p>

                <p className="mt-2 text-2xl font-black text-green-400">
                  {formatearDinero(reporte.totalEnviosEntregados)}
                </p>
              </article>

              <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Compras gestionadas
                </p>

                <p className="mt-2 text-2xl font-black text-violet-400">
                  {formatearDinero(
                    reporte.totalComprasGestionadas
                  )}
                </p>
              </article>
            </section>

            <div className="mb-6 grid gap-6 xl:grid-cols-2">
              <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 p-5">
                  <h2 className="text-xl font-black">
                    Rendimiento por motorizado
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    Pedidos asignados y entregados en el período
                  </p>
                </div>

                {reporte.rendimientoMotorizados.length === 0 ? (
                  <div className="px-5 py-12 text-center text-slate-400">
                    No hay información de motorizados.
                  </div>
                ) : (
                  <div className="space-y-4 p-5">
                    {reporte.rendimientoMotorizados.map(
                      (motorizado) => {
                        const porcentajeBarra =
                          (motorizado.entregados / maximoEntregas) *
                          100;

                        return (
                          <article
                            key={motorizado.nombre}
                            className="rounded-xl bg-slate-800/70 p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-bold">
                                  {motorizado.nombre}
                                </p>

                                <p className="mt-1 text-sm text-slate-400">
                                  {motorizado.asignados} pedidos asignados
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="text-2xl font-black text-green-400">
                                  {motorizado.entregados}
                                </p>

                                <p className="text-xs text-slate-500">
                                  entregados
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-700">
                              <div
                                className="h-full rounded-full bg-green-500"
                                style={{
                                  width: `${porcentajeBarra}%`,
                                }}
                              />
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                              <div className="rounded-lg bg-slate-900/60 p-2">
                                <p className="font-bold text-amber-300">
                                  {motorizado.enProceso}
                                </p>
                                <p className="text-xs text-slate-500">
                                  en proceso
                                </p>
                              </div>

                              <div className="rounded-lg bg-slate-900/60 p-2">
                                <p className="font-bold text-red-300">
                                  {motorizado.cancelados}
                                </p>
                                <p className="text-xs text-slate-500">
                                  cancelados
                                </p>
                              </div>

                              <div className="rounded-lg bg-slate-900/60 p-2">
                                <p className="font-bold text-green-300">
                                  {formatearDinero(
                                    motorizado.ingresosEnvios
                                  )}
                                </p>
                                <p className="text-xs text-slate-500">
                                  en envíos
                                </p>
                              </div>
                            </div>
                          </article>
                        );
                      }
                    )}
                  </div>
                )}
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 p-5">
                  <h2 className="text-xl font-black">
                    Clientes frecuentes
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    Clientes con más pedidos en el período
                  </p>
                </div>

                {reporte.rendimientoClientes.length === 0 ? (
                  <div className="px-5 py-12 text-center text-slate-400">
                    No hay información de clientes.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {reporte.rendimientoClientes
                      .slice(0, 8)
                      .map((cliente, indice) => (
                        <article
                          key={cliente.nombre}
                          className="flex items-center justify-between gap-4 p-5"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/15 font-black text-green-400">
                              {indice + 1}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-bold">
                                {cliente.nombre}
                              </p>

                              <p className="mt-1 text-sm text-slate-400">
                                {cliente.entregados} entregados
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-xl font-black">
                              {cliente.pedidos}
                            </p>

                            <p className="text-xs text-slate-500">
                              pedidos
                            </p>
                          </div>
                        </article>
                      ))}
                  </div>
                )}
              </section>
            </div>

            <section className="mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 p-5">
                <h2 className="text-xl font-black">
                  Resumen diario
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Actividad de cada día dentro del período
                </p>
              </div>

              {reporte.resumenDiario.length === 0 ? (
                <div className="px-5 py-12 text-center text-slate-400">
                  No hay actividad en este período.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left">
                    <thead className="bg-slate-950/50 text-sm text-slate-400">
                      <tr>
                        <th className="px-5 py-4">Fecha</th>
                        <th className="px-5 py-4">Pedidos</th>
                        <th className="px-5 py-4">Entregados</th>
                        <th className="px-5 py-4">Ingresos</th>
                        <th className="px-5 py-4">Egresos</th>
                        <th className="px-5 py-4">Balance</th>
                      </tr>
                    </thead>

                    <tbody>
                      {reporte.resumenDiario.map((dia) => (
                        <tr
                          key={dia.fecha}
                          className="border-t border-slate-800"
                        >
                          <td className="px-5 py-5 font-bold">
                            {formatearFechaCorta(dia.fecha)}
                          </td>

                          <td className="px-5 py-5">
                            {dia.pedidos}
                          </td>

                          <td className="px-5 py-5 text-green-300">
                            {dia.entregados}
                          </td>

                          <td className="px-5 py-5 font-bold text-green-400">
                            {formatearDinero(dia.ingresos)}
                          </td>

                          <td className="px-5 py-5 font-bold text-red-400">
                            {formatearDinero(dia.egresos)}
                          </td>

                          <td
                            className={`px-5 py-5 font-black ${
                              dia.balance >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {formatearDinero(dia.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 p-5">
                <h2 className="text-xl font-black">
                  Pedidos del período
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Últimos pedidos incluidos en el reporte
                </p>
              </div>

              {reporte.pedidosPeriodo.length === 0 ? (
                <div className="px-5 py-12 text-center text-slate-400">
                  No hay pedidos en estas fechas.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-left">
                    <thead className="bg-slate-950/50 text-sm text-slate-400">
                      <tr>
                        <th className="px-5 py-4">Pedido</th>
                        <th className="px-5 py-4">Cliente</th>
                        <th className="px-5 py-4">Motorizado</th>
                        <th className="px-5 py-4">Estado</th>
                        <th className="px-5 py-4">Envío</th>
                        <th className="px-5 py-4">Total</th>
                        <th className="px-5 py-4">Fecha</th>
                      </tr>
                    </thead>

                    <tbody>
                      {reporte.pedidosPeriodo
                        .slice(0, 20)
                        .map((pedido) => {
                          const costoEnvio = Number(
                            pedido.costo_envio ?? 0
                          );

                          const total =
                            costoEnvio +
                            Number(pedido.monto_compra ?? 0);

                          return (
                            <tr
                              key={pedido.id}
                              className="border-t border-slate-800"
                            >
                              <td className="px-5 py-5 font-black text-green-400">
                                #{pedido.id}
                              </td>

                              <td className="px-5 py-5 font-bold">
                                {pedido.nombre_cliente}
                              </td>

                              <td className="px-5 py-5 text-slate-300">
                                {obtenerNombreMotorizado(
                                  pedido.motorizados
                                )}
                              </td>

                              <td className="px-5 py-5">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-bold ${estiloEstado(
                                    pedido.estado
                                  )}`}
                                >
                                  {pedido.estado}
                                </span>
                              </td>

                              <td className="px-5 py-5">
                                {formatearDinero(costoEnvio)}
                              </td>

                              <td className="px-5 py-5 font-black">
                                {formatearDinero(total)}
                              </td>

                              <td className="whitespace-nowrap px-5 py-5 text-slate-400">
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
          </>
        )}
        </div>

        <style jsx global>{`
          @media print {
            body {
              background: white !important;
              color: black !important;
            }

            aside, header, nav, button, a {
              display: none !important;
            }

            main, section, article, div {
              background: white !important;
              color: black !important;
              border-color: #d1d5db !important;
              box-shadow: none !important;
            }

            table {
              width: 100% !important;
              color: black !important;
            }

            .print\:hidden {
              display: none !important;
            }
          }
        `}</style>
      </main>
  );
}