"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx";

type TipoMovimiento = "Ingreso" | "Egreso";
type EstadoSesion = "Abierta" | "Cerrada";

type MovimientoCaja = {
  id: number;
  pedido_id: number | null;
  tipo: TipoMovimiento;
  categoria: string;
  monto: number;
  descripcion: string | null;
  created_at: string;
};

type SesionCaja = {
  id: number;
  estado: EstadoSesion;
  monto_inicial: number;
  efectivo_contado: number | null;
  saldo_esperado: number | null;
  diferencia: number | null;
  notas_apertura: string | null;
  notas_cierre: string | null;
  opened_at: string;
  closed_at: string | null;
  usuario_id: string | null;
};

type FondoMotorizadoCaja = {
  sesion_caja_id: number | null;
  monto: number;
};

type LiquidacionMotorizadoCaja = {
  sesion_caja_id: number | null;
  fondo_entregado: number;
};

type GastoMotorizadoCaja = {
  id: number;
  sesion_caja_id: number | null;
  tipo: "Gasolina" | "Recarga" | "Otro";
  monto: number;
  fecha: string;
  created_at: string;
};

type PedidoTransferenciaCaja = {
  id: number;
  metodo_pago: string | null;
  costo_envio: number | null;
  monto_compra: number | null;
  estado: string | null;
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

function formatearFecha(fecha: string | null) {
  if (!fecha) return "—";
  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(fecha));
}

function inicioDelDia(fecha = new Date()) {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function normalizarCategoria(categoria: string) {
  return categoria.trim().toLowerCase();
}

function esFondoEntregado(movimiento: MovimientoCaja) {
  const categoria = normalizarCategoria(movimiento.categoria);
  return (
    categoria.includes("fondo motorizado") ||
    categoria.includes("fondo entregado a motorizado")
  );
}

function esRetornoLiquidacion(movimiento: MovimientoCaja) {
  const categoria = normalizarCategoria(movimiento.categoria);
  return (
    categoria.includes("liquidación motorizado") ||
    categoria.includes("liquidacion motorizado") ||
    categoria.includes("retorno de liquidación") ||
    categoria.includes("retorno de liquidacion")
  );
}

function esTransferencia(metodo: string | null | undefined) {
  return (metodo ?? "").trim().toLowerCase().includes("transfer");
}

function esPedidoEntregado(estado: string | null | undefined) {
  return (estado ?? "").trim().toLowerCase() === "entregado";
}

export default function Caja() {
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [sesiones, setSesiones] = useState<SesionCaja[]>([]);
  const [fondosMotorizados, setFondosMotorizados] = useState<FondoMotorizadoCaja[]>([]);
  const [liquidacionesMotorizados, setLiquidacionesMotorizados] = useState<LiquidacionMotorizadoCaja[]>([]);
  const [gastosMotorizados, setGastosMotorizados] = useState<GastoMotorizadoCaja[]>([]);
  const [pedidosTransferencia, setPedidosTransferencia] = useState<PedidoTransferenciaCaja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mostrarMovimiento, setMostrarMovimiento] = useState(false);
  const [mostrarApertura, setMostrarApertura] = useState(false);
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"Todos" | TipoMovimiento>("Todos");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargarCaja() {
    setCargando(true);
    setError("");

    const [
      respuestaMovimientos,
      respuestaSesiones,
      respuestaFondos,
      respuestaLiquidaciones,
      respuestaGastosMotorizados,
      respuestaPedidosTransferencia,
    ] = await Promise.all([
      supabase
        .from("movimientos_caja")
        .select("id, pedido_id, tipo, categoria, monto, descripcion, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("sesiones_caja")
        .select(
          "id, estado, monto_inicial, efectivo_contado, saldo_esperado, diferencia, notas_apertura, notas_cierre, opened_at, closed_at, usuario_id"
        )
        .order("opened_at", { ascending: false }),
      supabase
        .from("fondos_motorizado")
        .select("sesion_caja_id,monto"),
      supabase
        .from("liquidaciones_motorizado")
        .select("sesion_caja_id,fondo_entregado"),
      supabase
        .from("gastos_motorizado")
        .select("id,sesion_caja_id,tipo,monto,fecha,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("pedidos")
        .select("id,metodo_pago,costo_envio,monto_compra,estado,created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (respuestaMovimientos.error) {
      setError(`No se pudieron cargar los movimientos: ${respuestaMovimientos.error.message}`);
      setCargando(false);
      return;
    }

    if (respuestaSesiones.error) {
      setError(
        `No se pudo cargar la apertura y cierre de Caja: ${respuestaSesiones.error.message}. Ejecuta primero el archivo SQL incluido.`
      );
      setCargando(false);
      return;
    }

    if (respuestaFondos.error || respuestaLiquidaciones.error || respuestaGastosMotorizados.error) {
      setError(
        `No se pudo calcular el dinero en poder de motorizados y sus gastos: ${
          respuestaFondos.error?.message ??
          respuestaLiquidaciones.error?.message ??
          respuestaGastosMotorizados.error?.message
        }`
      );
      setCargando(false);
      return;
    }

    if (respuestaPedidosTransferencia.error) {
      setError(
        `No se pudieron calcular las transferencias de los pedidos: ${respuestaPedidosTransferencia.error.message}`
      );
      setCargando(false);
      return;
    }

    setMovimientos((respuestaMovimientos.data ?? []) as MovimientoCaja[]);
    setSesiones((respuestaSesiones.data ?? []) as SesionCaja[]);
    setFondosMotorizados((respuestaFondos.data ?? []) as FondoMotorizadoCaja[]);
    setLiquidacionesMotorizados(
      (respuestaLiquidaciones.data ?? []) as LiquidacionMotorizadoCaja[]
    );
    setGastosMotorizados(
      (respuestaGastosMotorizados.data ?? []) as GastoMotorizadoCaja[]
    );
    setPedidosTransferencia(
      (respuestaPedidosTransferencia.data ?? []) as PedidoTransferenciaCaja[]
    );
    setCargando(false);
  }

  useEffect(() => {
    void cargarCaja();
  }, []);

  const sesionAbierta = useMemo(
    () => sesiones.find((sesion) => sesion.estado === "Abierta") ?? null,
    [sesiones]
  );

  const movimientosSesion = useMemo(() => {
    if (!sesionAbierta) return [];
    const apertura = new Date(sesionAbierta.opened_at).getTime();
    return movimientos.filter(
      (movimiento) => new Date(movimiento.created_at).getTime() >= apertura
    );
  }, [movimientos, sesionAbierta]);

  const resumenSesion = useMemo(() => {
    const ingresosTotales = movimientosSesion
      .filter((movimiento) => movimiento.tipo === "Ingreso")
      .reduce((total, movimiento) => total + Number(movimiento.monto || 0), 0);
    const salidasTotales = movimientosSesion
      .filter((movimiento) => movimiento.tipo === "Egreso")
      .reduce((total, movimiento) => total + Number(movimiento.monto || 0), 0);

    const fondosEntregados = fondosMotorizados
      .filter((fondo) => fondo.sesion_caja_id === sesionAbierta?.id)
      .reduce((total, fondo) => total + Number(fondo.monto || 0), 0);

    const fondosDevueltos = liquidacionesMotorizados
      .filter((liquidacion) => liquidacion.sesion_caja_id === sesionAbierta?.id)
      .reduce(
        (total, liquidacion) => total + Number(liquidacion.fondo_entregado || 0),
        0
      );

    const gastosMotorizadosSesion = gastosMotorizados
      .filter((gasto) => gasto.sesion_caja_id === sesionAbierta?.id)
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0);

    const gasolinaSesion = gastosMotorizados
      .filter((gasto) => gasto.sesion_caja_id === sesionAbierta?.id && gasto.tipo === "Gasolina")
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0);

    const recargasSesion = gastosMotorizados
      .filter((gasto) => gasto.sesion_caja_id === sesionAbierta?.id && gasto.tipo === "Recarga")
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0);

    const otrosGastosSesion = gastosMotorizados
      .filter((gasto) => gasto.sesion_caja_id === sesionAbierta?.id && gasto.tipo === "Otro")
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0);

    const fondosEnMotorizados = Math.max(
      0,
      fondosEntregados - fondosDevueltos - gastosMotorizadosSesion
    );

    const ingresosOperativos = movimientosSesion
      .filter(
        (movimiento) =>
          movimiento.tipo === "Ingreso" && !esRetornoLiquidacion(movimiento)
      )
      .reduce((total, movimiento) => total + Number(movimiento.monto || 0), 0);

    const egresosManualesReales = movimientosSesion
      .filter(
        (movimiento) =>
          movimiento.tipo === "Egreso" && !esFondoEntregado(movimiento)
      )
      .reduce((total, movimiento) => total + Number(movimiento.monto || 0), 0);

    const gastosReales = egresosManualesReales + gastosMotorizadosSesion;

    const inicial = Number(sesionAbierta?.monto_inicial ?? 0);
    const saldoEsperado = inicial + ingresosTotales - salidasTotales;

    return {
      ingresosTotales,
      salidasTotales,
      ingresosOperativos,
      gastosReales,
      fondosEntregados,
      fondosDevueltos,
      fondosEnMotorizados,
      gastosMotorizadosSesion,
      gasolinaSesion,
      recargasSesion,
      otrosGastosSesion,
      saldoEsperado,
      totalBajoControl: saldoEsperado + fondosEnMotorizados,
      cantidad: movimientosSesion.length,
    };
  }, [
    fondosMotorizados,
    gastosMotorizados,
    liquidacionesMotorizados,
    movimientosSesion,
    sesionAbierta,
  ]);

  const resumenGeneral = useMemo(() => {
    const hoy = inicioDelDia().getTime();
    const movimientosHoy = movimientos.filter(
      (movimiento) => new Date(movimiento.created_at).getTime() >= hoy
    );

    // Las devoluciones de liquidaciones son retornos de capital, no ingresos operativos.
    const ingresosHoy = movimientosHoy
      .filter(
        (movimiento) =>
          movimiento.tipo === "Ingreso" && !esRetornoLiquidacion(movimiento)
      )
      .reduce((total, movimiento) => total + Number(movimiento.monto || 0), 0);

    // Los fondos entregados a motorizados son transferencias internas, no egresos reales.
    const egresosManualesHoy = movimientosHoy
      .filter(
        (movimiento) =>
          movimiento.tipo === "Egreso" && !esFondoEntregado(movimiento)
      )
      .reduce((total, movimiento) => total + Number(movimiento.monto || 0), 0);

    const gastosMotorizadosHoy = gastosMotorizados
      .filter((gasto) => new Date(gasto.created_at).getTime() >= hoy)
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0);

    const gasolinaHoy = gastosMotorizados
      .filter((gasto) => gasto.tipo === "Gasolina" && new Date(gasto.created_at).getTime() >= hoy)
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0);

    const recargasHoy = gastosMotorizados
      .filter((gasto) => gasto.tipo === "Recarga" && new Date(gasto.created_at).getTime() >= hoy)
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0);

    const otrosGastosHoy = gastosMotorizados
      .filter((gasto) => gasto.tipo === "Otro" && new Date(gasto.created_at).getTime() >= hoy)
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0);

    const egresosHoy = egresosManualesHoy + gastosMotorizadosHoy;

    return {
      ingresosHoy,
      egresosHoy,
      gasolinaHoy,
      recargasHoy,
      otrosGastosHoy,
      balanceHoy: ingresosHoy - egresosHoy,
      movimientosHoy: movimientosHoy.length,
    };
  }, [gastosMotorizados, movimientos]);

  const resumenTransferenciasSesion = useMemo(() => {
    if (!sesionAbierta) {
      return {
        recibido: 0,
        compras: 0,
        envios: 0,
        neto: 0,
        cantidad: 0,
      };
    }

    const apertura = new Date(sesionAbierta.opened_at).getTime();
    const transferencias = pedidosTransferencia.filter(
      (pedido) =>
        esPedidoEntregado(pedido.estado) &&
        esTransferencia(pedido.metodo_pago) &&
        new Date(pedido.created_at).getTime() >= apertura
    );

    const compras = transferencias.reduce(
      (total, pedido) => total + Number(pedido.monto_compra ?? 0),
      0
    );
    const envios = transferencias.reduce(
      (total, pedido) => total + Number(pedido.costo_envio ?? 0),
      0
    );
    const recibido = compras + envios;

    return {
      recibido,
      compras,
      envios,
      neto: recibido - compras,
      cantidad: transferencias.length,
    };
  }, [pedidosTransferencia, sesionAbierta]);

  const resumenTransferenciasHoy = useMemo(() => {
    const hoy = inicioDelDia().getTime();
    const transferencias = pedidosTransferencia.filter(
      (pedido) =>
        esPedidoEntregado(pedido.estado) &&
        esTransferencia(pedido.metodo_pago) &&
        new Date(pedido.created_at).getTime() >= hoy
    );

    const compras = transferencias.reduce(
      (total, pedido) => total + Number(pedido.monto_compra ?? 0),
      0
    );
    const envios = transferencias.reduce(
      (total, pedido) => total + Number(pedido.costo_envio ?? 0),
      0
    );
    const recibido = compras + envios;

    return {
      recibido,
      compras,
      envios,
      neto: recibido - compras,
      cantidad: transferencias.length,
    };
  }, [pedidosTransferencia]);

  const movimientosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return movimientos.filter((movimiento) => {
      const coincideTipo = filtroTipo === "Todos" || movimiento.tipo === filtroTipo;
      const coincideBusqueda =
        !texto ||
        movimiento.categoria.toLowerCase().includes(texto) ||
        movimiento.descripcion?.toLowerCase().includes(texto) ||
        movimiento.pedido_id?.toString().includes(texto);
      return coincideTipo && coincideBusqueda;
    });
  }, [busqueda, filtroTipo, movimientos]);

  function mostrarExito(texto: string) {
    setMensaje(texto);
    window.setTimeout(() => setMensaje(""), 3500);
  }

  async function abrirCaja(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sesionAbierta) {
      setError("Ya existe una caja abierta. Debes cerrarla antes de abrir otra.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const montoInicial = Number(form.get("monto_inicial") ?? 0);
    const notas = form.get("notas_apertura")?.toString().trim() || null;

    if (!Number.isFinite(montoInicial) || montoInicial < 0) {
      setError("El monto inicial no puede ser negativo.");
      return;
    }

    setGuardando(true);
    setError("");
    const { data: usuario } = await supabase.auth.getUser();
    const { data, error: errorApertura } = await supabase
      .from("sesiones_caja")
      .insert({
        estado: "Abierta",
        monto_inicial: montoInicial,
        notas_apertura: notas,
        usuario_id: usuario.user?.id ?? null,
      })
      .select(
        "id, estado, monto_inicial, efectivo_contado, saldo_esperado, diferencia, notas_apertura, notas_cierre, opened_at, closed_at, usuario_id"
      )
      .single();

    if (errorApertura) {
      setError(`No se pudo abrir la Caja: ${errorApertura.message}`);
      setGuardando(false);
      return;
    }

    setSesiones((actuales) => [data as SesionCaja, ...actuales]);
    setMostrarApertura(false);
    setGuardando(false);
    mostrarExito(`Caja abierta con ${formatearDinero(montoInicial)}.`);
  }

  async function cerrarCaja(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sesionAbierta) return;

    const form = new FormData(event.currentTarget);
    const efectivoContado = Number(form.get("efectivo_contado") ?? 0);
    const notas = form.get("notas_cierre")?.toString().trim() || null;

    if (!Number.isFinite(efectivoContado) || efectivoContado < 0) {
      setError("El efectivo contado no puede ser negativo.");
      return;
    }

    const diferencia = efectivoContado - resumenSesion.saldoEsperado;
    setGuardando(true);
    setError("");

    const { data, error: errorCierre } = await supabase
      .from("sesiones_caja")
      .update({
        estado: "Cerrada",
        efectivo_contado: efectivoContado,
        saldo_esperado: resumenSesion.saldoEsperado,
        diferencia,
        notas_cierre: notas,
        closed_at: new Date().toISOString(),
      })
      .eq("id", sesionAbierta.id)
      .select(
        "id, estado, monto_inicial, efectivo_contado, saldo_esperado, diferencia, notas_apertura, notas_cierre, opened_at, closed_at, usuario_id"
      )
      .single();

    if (errorCierre) {
      setError(`No se pudo cerrar la Caja: ${errorCierre.message}`);
      setGuardando(false);
      return;
    }

    setSesiones((actuales) =>
      actuales.map((sesion) => (sesion.id === sesionAbierta.id ? (data as SesionCaja) : sesion))
    );
    setMostrarCierre(false);
    setGuardando(false);
    mostrarExito(`Caja cerrada. Diferencia: ${formatearDinero(diferencia)}.`);
  }

  async function guardarMovimiento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formularioElemento = event.currentTarget;
    const formulario = new FormData(formularioElemento);
    const tipo = formulario.get("tipo")?.toString() === "Egreso" ? "Egreso" : "Ingreso";
    const categoria = formulario.get("categoria")?.toString().trim() ?? "";
    const monto = Number(formulario.get("monto") ?? 0);
    const descripcion = formulario.get("descripcion")?.toString().trim() ?? "";

    if (!sesionAbierta) {
      setError("Debes abrir la Caja antes de registrar movimientos manuales.");
      return;
    }
    if (!categoria) {
      setError("Escribe una categoría para el movimiento.");
      return;
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      setError("El monto debe ser mayor que cero.");
      return;
    }

    setGuardando(true);
    setError("");
    const { data, error: errorGuardado } = await supabase
      .from("movimientos_caja")
      .insert({ pedido_id: null, tipo, categoria, monto, descripcion: descripcion || null })
      .select("id, pedido_id, tipo, categoria, monto, descripcion, created_at")
      .single();

    if (errorGuardado) {
      setError(`No se pudo guardar el movimiento: ${errorGuardado.message}`);
      setGuardando(false);
      return;
    }

    setMovimientos((actuales) => [data as MovimientoCaja, ...actuales]);
    formularioElemento.reset();
    setMostrarMovimiento(false);
    setGuardando(false);
    mostrarExito(`${tipo} de ${formatearDinero(monto)} registrado correctamente.`);
  }

  async function eliminarMovimiento(movimiento: MovimientoCaja) {
    if (movimiento.pedido_id !== null) {
      setError("Los movimientos generados por pedidos no se pueden eliminar desde Caja.");
      return;
    }
    if (!window.confirm(`¿Eliminar este ${movimiento.tipo.toLowerCase()} de ${formatearDinero(movimiento.monto)}?`)) return;

    const { error: errorEliminacion } = await supabase
      .from("movimientos_caja")
      .delete()
      .eq("id", movimiento.id);

    if (errorEliminacion) {
      setError(`No se pudo eliminar el movimiento: ${errorEliminacion.message}`);
      return;
    }

    setMovimientos((actuales) => actuales.filter((item) => item.id !== movimiento.id));
    mostrarExito("Movimiento eliminado correctamente.");
  }

  function exportarCierrePDF(sesion: SesionCaja) {
    const documento = new jsPDF();
    documento.setFontSize(18);
    documento.text("RapidControl - Cierre de Caja", 14, 18);
    documento.setFontSize(10);
    documento.text(`Apertura: ${formatearFecha(sesion.opened_at)}`, 14, 28);
    documento.text(`Cierre: ${formatearFecha(sesion.closed_at)}`, 14, 34);

    autoTable(documento, {
      startY: 42,
      head: [["Concepto", "Monto"]],
      body: [
        ["Monto inicial", formatearDinero(Number(sesion.monto_inicial))],
        ["Saldo esperado", formatearDinero(Number(sesion.saldo_esperado ?? 0))],
        ["Efectivo contado", formatearDinero(Number(sesion.efectivo_contado ?? 0))],
        ["Diferencia", formatearDinero(Number(sesion.diferencia ?? 0))],
      ],
    });
    documento.save(`cierre-caja-${sesion.id}.pdf`);
  }

  function exportarHistorialExcel() {
    const filas = sesiones.map((sesion) => ({
      ID: sesion.id,
      Estado: sesion.estado,
      Apertura: formatearFecha(sesion.opened_at),
      Cierre: formatearFecha(sesion.closed_at),
      "Monto inicial": Number(sesion.monto_inicial),
      "Saldo esperado": Number(sesion.saldo_esperado ?? 0),
      "Efectivo contado": Number(sesion.efectivo_contado ?? 0),
      Diferencia: Number(sesion.diferencia ?? 0),
      "Notas apertura": sesion.notas_apertura ?? "",
      "Notas cierre": sesion.notas_cierre ?? "",
    }));
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), "Cierres de caja");
    XLSX.writeFile(libro, "historial-caja.xlsx");
  }

  return (
    <main className="bg-slate-950 p-5 text-white md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm text-slate-400">Operación financiera diaria</p>
            <h1 className="mt-1 text-3xl font-black">💰 Caja PRO</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exportarHistorialExcel}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 font-bold text-emerald-300 hover:bg-emerald-500/20"
            >
              📊 Exportar historial
            </button>
            {!sesionAbierta ? (
              <button
                type="button"
                onClick={() => setMostrarApertura(true)}
                className="rounded-xl bg-green-600 px-5 py-3 font-bold hover:bg-green-500"
              >
                Abrir Caja
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMostrarMovimiento((valor) => !valor)}
                  className="rounded-xl border border-slate-700 px-5 py-3 font-bold hover:bg-slate-800"
                >
                  + Movimiento
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarCierre(true)}
                  className="rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500"
                >
                  Cerrar Caja
                </button>
              </>
            )}
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">❌ {error}</div>}
        {mensaje && <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-5 py-4 text-green-300">✅ {mensaje}</div>}

        {mostrarApertura && !sesionAbierta && (
          <form onSubmit={abrirCaja} className="rounded-2xl border border-green-500/30 bg-slate-900 p-6">
            <h2 className="text-xl font-black">Abrir Caja</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="font-semibold">Monto inicial</span>
                <input name="monto_inicial" type="number" min="0" step="0.01" required className={estiloCampo} />
              </label>
              <label className="space-y-2">
                <span className="font-semibold">Notas de apertura</span>
                <input name="notas_apertura" className={estiloCampo} placeholder="Opcional" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setMostrarApertura(false)} className="rounded-xl border border-slate-700 px-5 py-3 font-bold">Cancelar</button>
              <button disabled={guardando} className="rounded-xl bg-green-600 px-6 py-3 font-bold disabled:opacity-50">{guardando ? "Abriendo..." : "Confirmar apertura"}</button>
            </div>
          </form>
        )}

        {mostrarMovimiento && sesionAbierta && (
          <form onSubmit={guardarMovimiento} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-black">Registrar movimiento manual</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <select name="tipo" defaultValue="Egreso" className={estiloCampo}><option>Ingreso</option><option>Egreso</option></select>
              <input name="categoria" required className={estiloCampo} placeholder="Categoría" />
              <input name="monto" type="number" min="0.01" step="0.01" required className={estiloCampo} placeholder="Monto" />
              <input name="descripcion" className={estiloCampo} placeholder="Descripción" />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setMostrarMovimiento(false)} className="rounded-xl border border-slate-700 px-5 py-3 font-bold">Cancelar</button>
              <button disabled={guardando} className="rounded-xl bg-green-600 px-6 py-3 font-bold disabled:opacity-50">Guardar</button>
            </div>
          </form>
        )}

        {mostrarCierre && sesionAbierta && (
          <form onSubmit={cerrarCaja} className="rounded-2xl border border-red-500/30 bg-slate-900 p-6">
            <h2 className="text-xl font-black">Arqueo y cierre</h2>
            <p className="mt-2 text-slate-400">Saldo esperado: <strong className="text-white">{formatearDinero(resumenSesion.saldoEsperado)}</strong></p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="font-semibold">Efectivo contado</span>
                <input name="efectivo_contado" type="number" min="0" step="0.01" required className={estiloCampo} />
              </label>
              <label className="space-y-2">
                <span className="font-semibold">Notas del cierre</span>
                <input name="notas_cierre" className={estiloCampo} placeholder="Opcional" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setMostrarCierre(false)} className="rounded-xl border border-slate-700 px-5 py-3 font-bold">Cancelar</button>
              <button disabled={guardando} className="rounded-xl bg-red-600 px-6 py-3 font-bold disabled:opacity-50">Confirmar cierre</button>
            </div>
          </form>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Estado</p>
            <p className={`mt-2 text-2xl font-black ${sesionAbierta ? "text-green-400" : "text-slate-400"}`}>{sesionAbierta ? "ABIERTA" : "CERRADA"}</p>
            <p className="mt-2 text-xs text-slate-500">{sesionAbierta ? formatearFecha(sesionAbierta.opened_at) : "Sin sesión activa"}</p>
          </article>
          <article className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
            <p className="text-sm text-blue-300">Monto inicial</p>
            <p className="mt-2 text-3xl font-black text-blue-400">{formatearDinero(Number(sesionAbierta?.monto_inicial ?? 0))}</p>
          </article>
          <article className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-300">Disponible en Caja</p>
            <p className="mt-2 text-3xl font-black text-amber-400">{formatearDinero(resumenSesion.saldoEsperado)}</p>
            <p className="mt-2 text-xs text-amber-200/70">Efectivo esperado para el arqueo</p>
          </article>
          <article className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
            <p className="text-sm text-cyan-300">Fondos en motorizados</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">{formatearDinero(resumenSesion.fondosEnMotorizados)}</p>
            <p className="mt-2 text-xs text-cyan-200/70">Dinero de la empresa fuera de la caja física</p>
          </article>
          <article className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-300">Total bajo control</p>
            <p className="mt-2 text-3xl font-black text-emerald-300">{formatearDinero(resumenSesion.totalBajoControl)}</p>
            <p className="mt-2 text-xs text-emerald-200/70">Caja disponible + fondos en motorizados</p>
          </article>
          <article className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
            <p className="text-sm text-green-300">Ingresos operativos</p>
            <p className="mt-2 text-3xl font-black text-green-400">{formatearDinero(resumenSesion.ingresosOperativos)}</p>
            <p className="mt-2 text-xs text-green-200/70">No incluye devoluciones de fondos</p>
          </article>
          <article className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="text-sm text-red-300">Gastos reales</p>
            <p className="mt-2 text-3xl font-black text-red-400">{formatearDinero(resumenSesion.gastosReales)}</p>
            <p className="mt-2 text-xs text-red-200/70">No incluye fondos entregados</p>
          </article>
          <article className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-5">
            <p className="text-sm text-orange-300">Detalle de gastos de motorizados</p>
            <p className="mt-2 text-sm font-bold text-orange-200">
              Gasolina: {formatearDinero(resumenSesion.gasolinaSesion)}
            </p>
            <p className="mt-1 text-sm font-bold text-orange-200">
              Recargas: {formatearDinero(resumenSesion.recargasSesion)}
            </p>
            <p className="mt-1 text-sm font-bold text-orange-200">
              Otros: {formatearDinero(resumenSesion.otrosGastosSesion)}
            </p>
          </article>
          <article className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
            <p className="text-sm text-violet-300">Fondos devueltos</p>
            <p className="mt-2 text-3xl font-black text-violet-300">{formatearDinero(resumenSesion.fondosDevueltos)}</p>
            <p className="mt-2 text-xs text-violet-200/70">Capital recuperado mediante liquidaciones</p>
          </article>
        </section>

        <section className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5">
          <div className="mb-5">
            <h2 className="text-xl font-black text-violet-200">🏦 Bancos / Transferencias</h2>
            <p className="mt-1 text-sm text-violet-200/70">
              Pedidos entregados y pagados por transferencia desde la apertura de la caja. Este dinero no forma parte del efectivo disponible para el arqueo.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-2xl border border-violet-500/30 bg-slate-950/40 p-5">
              <p className="text-sm text-violet-300">Transferencias recibidas</p>
              <p className="mt-2 text-2xl font-black text-violet-200">{formatearDinero(resumenTransferenciasSesion.recibido)}</p>
              <p className="mt-2 text-xs text-slate-400">Compra + costo de envío cobrados al cliente</p>
            </article>
            <article className="rounded-2xl border border-amber-500/30 bg-slate-950/40 p-5">
              <p className="text-sm text-amber-300">Compras asociadas</p>
              <p className="mt-2 text-2xl font-black text-amber-300">-{formatearDinero(resumenTransferenciasSesion.compras)}</p>
              <p className="mt-2 text-xs text-slate-400">Dinero de la compra financiado con fondos de la empresa</p>
            </article>
            <article className="rounded-2xl border border-emerald-500/30 bg-slate-950/40 p-5">
              <p className="text-sm text-emerald-300">Ingresos por envíos</p>
              <p className="mt-2 text-2xl font-black text-emerald-300">{formatearDinero(resumenTransferenciasSesion.envios)}</p>
              <p className="mt-2 text-xs text-slate-400">Costo de envío de pedidos por transferencia</p>
            </article>
            <article className="rounded-2xl border border-cyan-500/30 bg-slate-950/40 p-5">
              <p className="text-sm text-cyan-300">Neto bancario operativo</p>
              <p className="mt-2 text-2xl font-black text-cyan-300">{formatearDinero(resumenTransferenciasSesion.neto)}</p>
              <p className="mt-2 text-xs text-slate-400">Transferencias recibidas − compras asociadas</p>
            </article>
            <article className="rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
              <p className="text-sm text-slate-300">Pedidos por transferencia</p>
              <p className="mt-2 text-2xl font-black text-white">{resumenTransferenciasSesion.cantidad}</p>
              <p className="mt-2 text-xs text-slate-400">Solo pedidos en estado Entregado</p>
            </article>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Ingresos operativos hoy</p><p className="mt-2 text-2xl font-black text-green-400">{formatearDinero(resumenGeneral.ingresosHoy)}</p></article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Gastos reales hoy</p><p className="mt-2 text-2xl font-black text-red-400">{formatearDinero(resumenGeneral.egresosHoy)}</p></article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Detalle de gastos hoy</p>
            <p className="mt-2 text-sm text-slate-300">Gasolina: <strong>{formatearDinero(resumenGeneral.gasolinaHoy)}</strong></p>
            <p className="mt-1 text-sm text-slate-300">Recargas: <strong>{formatearDinero(resumenGeneral.recargasHoy)}</strong></p>
            <p className="mt-1 text-sm text-slate-300">Otros: <strong>{formatearDinero(resumenGeneral.otrosGastosHoy)}</strong></p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Balance operativo hoy</p><p className="mt-2 text-2xl font-black text-amber-400">{formatearDinero(resumenGeneral.balanceHoy)}</p></article>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-violet-500/20 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Transferencias recibidas hoy</p>
            <p className="mt-2 text-2xl font-black text-violet-300">{formatearDinero(resumenTransferenciasHoy.recibido)}</p>
          </article>
          <article className="rounded-2xl border border-amber-500/20 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Compras por transferencia hoy</p>
            <p className="mt-2 text-2xl font-black text-amber-300">-{formatearDinero(resumenTransferenciasHoy.compras)}</p>
          </article>
          <article className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Envíos por transferencia hoy</p>
            <p className="mt-2 text-2xl font-black text-emerald-300">{formatearDinero(resumenTransferenciasHoy.envios)}</p>
          </article>
          <article className="rounded-2xl border border-cyan-500/20 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Neto bancario hoy</p>
            <p className="mt-2 text-2xl font-black text-cyan-300">{formatearDinero(resumenTransferenciasHoy.neto)}</p>
            <p className="mt-1 text-xs text-slate-500">{resumenTransferenciasHoy.cantidad} pedido(s) entregado(s)</p>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-800 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-xl font-black">Movimientos</h2><p className="mt-1 text-sm text-slate-400">{movimientosFiltrados.length} registros</p></div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select value={filtroTipo} onChange={(event) => setFiltroTipo(event.target.value as "Todos" | TipoMovimiento)} className={estiloCampo}><option value="Todos">Todos</option><option value="Ingreso">Ingresos</option><option value="Egreso">Egresos</option></select>
              <input type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} className={estiloCampo} placeholder="Buscar..." />
            </div>
          </div>
          {cargando ? <div className="p-12 text-center text-slate-400">Cargando Caja...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-slate-950/50 text-sm text-slate-400"><tr><th className="px-5 py-4">#</th><th className="px-5 py-4">Tipo</th><th className="px-5 py-4">Categoría</th><th className="px-5 py-4">Descripción</th><th className="px-5 py-4">Pedido</th><th className="px-5 py-4 text-right">Monto</th><th className="px-5 py-4">Fecha</th><th className="px-5 py-4"></th></tr></thead>
                <tbody>{movimientosFiltrados.map((movimiento) => (
                  <tr key={movimiento.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="px-5 py-4 font-bold">#{movimiento.id}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${movimiento.tipo === "Ingreso" ? "bg-green-500/15 text-green-300" : "bg-red-500/15 text-red-300"}`}>{movimiento.tipo}</span></td>
                    <td className="px-5 py-4 font-semibold">{movimiento.categoria}</td>
                    <td className="max-w-72 truncate px-5 py-4 text-slate-400">{movimiento.descripcion || "Sin descripción"}</td>
                    <td className="px-5 py-4">{movimiento.pedido_id ? `#${movimiento.pedido_id}` : "Manual"}</td>
                    <td className={`px-5 py-4 text-right font-black ${movimiento.tipo === "Ingreso" ? "text-green-400" : "text-red-400"}`}>{movimiento.tipo === "Ingreso" ? "+" : "-"}{formatearDinero(Number(movimiento.monto))}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-400">{formatearFecha(movimiento.created_at)}</td>
                    <td className="px-5 py-4 text-right">{movimiento.pedido_id === null && <button type="button" onClick={() => void eliminarMovimiento(movimiento)} className="text-sm font-bold text-red-300 hover:text-red-200">Eliminar</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 p-5"><h2 className="text-xl font-black">Historial de aperturas y cierres</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="bg-slate-950/50 text-sm text-slate-400"><tr><th className="px-5 py-4">Sesión</th><th className="px-5 py-4">Apertura</th><th className="px-5 py-4">Cierre</th><th className="px-5 py-4 text-right">Inicial</th><th className="px-5 py-4 text-right">Esperado</th><th className="px-5 py-4 text-right">Contado</th><th className="px-5 py-4 text-right">Diferencia</th><th className="px-5 py-4">Acción</th></tr></thead>
              <tbody>{sesiones.map((sesion) => (
                <tr key={sesion.id} className="border-t border-slate-800">
                  <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${sesion.estado === "Abierta" ? "bg-green-500/15 text-green-300" : "bg-slate-500/15 text-slate-300"}`}>#{sesion.id} {sesion.estado}</span></td>
                  <td className="px-5 py-4 text-slate-300">{formatearFecha(sesion.opened_at)}</td>
                  <td className="px-5 py-4 text-slate-300">{formatearFecha(sesion.closed_at)}</td>
                  <td className="px-5 py-4 text-right">{formatearDinero(Number(sesion.monto_inicial))}</td>
                  <td className="px-5 py-4 text-right">{formatearDinero(Number(sesion.saldo_esperado ?? 0))}</td>
                  <td className="px-5 py-4 text-right">{formatearDinero(Number(sesion.efectivo_contado ?? 0))}</td>
                  <td className={`px-5 py-4 text-right font-bold ${Number(sesion.diferencia ?? 0) === 0 ? "text-green-400" : "text-amber-400"}`}>{formatearDinero(Number(sesion.diferencia ?? 0))}</td>
                  <td className="px-5 py-4">{sesion.estado === "Cerrada" && <button type="button" onClick={() => exportarCierrePDF(sesion)} className="text-sm font-bold text-blue-300 hover:text-blue-200">PDF</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}