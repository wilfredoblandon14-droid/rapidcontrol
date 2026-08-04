"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type NivelCliente = "Nuevo" | "Recurrente" | "Frecuente" | "VIP" | "Diamante";

type Cliente = {
  id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  referencia: string | null;
  created_at: string;
};

type RelMotorizado =
  | { nombre: string }
  | { nombre: string }[]
  | null;

type Pedido = {
  id: number;
  codigo: string | null;
  cliente_id: number | null;
  nombre_cliente: string;
  telefono: string;
  direccion_recogida: string;
  direccion_entrega: string;
  costo_envio: number | null;
  monto_compra: number | null;
  estado: string;
  metodo_pago: string;
  descripcion: string | null;
  observaciones: string | null;
  created_at: string;
  motorizados: RelMotorizado;
};

type Frecuencia = {
  valor: string;
  cantidad: number;
};

function telefonoNormalizado(valor: string | null | undefined) {
  return (valor ?? "").replace(/\D/g, "").slice(-8);
}

function dinero(valor: number) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
  }).format(valor);
}

function fecha(valor: string | null) {
  if (!valor) return "Sin información";

  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(valor));
}

function tiempoRelativo(valor: string | null) {
  if (!valor) return "Sin pedidos";

  const dias = Math.max(
    0,
    Math.floor((Date.now() - new Date(valor).getTime()) / 86_400_000)
  );

  if (dias === 0) return "Hoy";
  if (dias === 1) return "Hace 1 día";
  if (dias < 30) return `Hace ${dias} días`;

  const meses = Math.floor(dias / 30);
  if (meses === 1) return "Hace 1 mes";
  if (meses < 12) return `Hace ${meses} meses`;

  const anios = Math.floor(meses / 12);
  return anios === 1 ? "Hace 1 año" : `Hace ${anios} años`;
}

function nombreMotorizado(relacion: RelMotorizado) {
  if (!relacion) return "Sin asignar";
  if (Array.isArray(relacion)) return relacion[0]?.nombre ?? "Sin asignar";
  return relacion.nombre;
}

function contarFrecuencias(
  valores: Array<string | null | undefined>,
  limite = 5
): Frecuencia[] {
  const mapa = new Map<string, number>();

  for (const valorOriginal of valores) {
    const valor = valorOriginal?.trim();
    if (!valor) continue;
    mapa.set(valor, (mapa.get(valor) ?? 0) + 1);
  }

  return Array.from(mapa.entries())
    .map(([valor, cantidad]) => ({ valor, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.valor.localeCompare(b.valor))
    .slice(0, limite);
}

function calcularPuntuacion(
  total: number,
  entregados: number,
  cancelados: number,
  totalEnvios: number,
  ultimoPedido: string | null,
  creadoEn: string
) {
  const puntosVolumen = Math.min(40, total * 1.2);
  const tasaEntrega = total > 0 ? entregados / total : 0;
  const puntosCumplimiento = tasaEntrega * 25;
  const puntosValor = Math.min(15, totalEnvios / 500);

  const diasSinPedir = ultimoPedido
    ? Math.max(
        0,
        (Date.now() - new Date(ultimoPedido).getTime()) / 86_400_000
      )
    : 365;

  const puntosRecencia = Math.max(0, 12 - diasSinPedir / 10);
  const mesesComoCliente = Math.max(
    0,
    (Date.now() - new Date(creadoEn).getTime()) / (30.44 * 86_400_000)
  );
  const puntosAntiguedad = Math.min(8, mesesComoCliente / 3);
  const penalizacionCancelaciones = Math.min(15, cancelados * 2);

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        puntosVolumen +
          puntosCumplimiento +
          puntosValor +
          puntosRecencia +
          puntosAntiguedad -
          penalizacionCancelaciones
      )
    )
  );
}

function obtenerNivel(total: number, puntuacion: number): NivelCliente {
  if (total >= 50 && puntuacion >= 80) return "Diamante";
  if (total >= 25 && puntuacion >= 60) return "VIP";
  if (total >= 10) return "Frecuente";
  if (total >= 3) return "Recurrente";
  return "Nuevo";
}

function estiloEstado(estado: string) {
  if (estado === "Entregado") {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (estado === "Cancelado") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (estado === "En camino") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  if (estado === "Recogido") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-300";
  }

  return "border-blue-500/30 bg-blue-500/10 text-blue-300";
}

export default function ExpedienteCliente() {
  const params = useParams<{ id: string }>();
  const clienteId = Number(params.id);

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargar() {
      if (!Number.isFinite(clienteId)) {
        setError("El cliente solicitado no es válido.");
        setCargando(false);
        return;
      }

      setCargando(true);
      setError("");

      const { data: clienteData, error: errorCliente } = await supabase
        .from("clientes")
        .select("id, nombre, telefono, direccion, referencia, created_at")
        .eq("id", clienteId)
        .single();

      if (errorCliente || !clienteData) {
        setError(
          errorCliente?.message ?? "No se encontró el cliente solicitado."
        );
        setCargando(false);
        return;
      }

      const telefono = telefonoNormalizado(clienteData.telefono);

      const { data: pedidosData, error: errorPedidos } = await supabase
        .from("pedidos")
        .select(`
          id,
          codigo,
          cliente_id,
          nombre_cliente,
          telefono,
          direccion_recogida,
          direccion_entrega,
          costo_envio,
          monto_compra,
          estado,
          metodo_pago,
          descripcion,
          observaciones,
          created_at,
          motorizados ( nombre )
        `)
        .order("created_at", { ascending: false });

      if (errorPedidos) {
        setError(`No se pudo cargar el historial: ${errorPedidos.message}`);
        setCargando(false);
        return;
      }

      const propios = ((pedidosData ?? []) as Pedido[]).filter(
        (pedido) =>
          pedido.cliente_id === clienteId ||
          (!pedido.cliente_id &&
            telefonoNormalizado(pedido.telefono) === telefono)
      );

      setCliente(clienteData as Cliente);
      setPedidos(propios);
      setCargando(false);
    }

    void cargar();
  }, [clienteId]);

  const estadisticas = useMemo(() => {
    const entregados = pedidos.filter(
      (pedido) => pedido.estado === "Entregado"
    );
    const cancelados = pedidos.filter(
      (pedido) => pedido.estado === "Cancelado"
    );

    const totalEnvios = entregados.reduce(
      (suma, pedido) => suma + Number(pedido.costo_envio ?? 0),
      0
    );

    const totalMovido = entregados.reduce(
      (suma, pedido) =>
        suma +
        Number(pedido.costo_envio ?? 0) +
        Number(pedido.monto_compra ?? 0),
      0
    );

    const primerPedido =
      pedidos.length > 0 ? pedidos[pedidos.length - 1].created_at : null;
    const ultimoPedido = pedidos[0]?.created_at ?? null;
    const promedio = entregados.length > 0 ? totalEnvios / entregados.length : 0;

    const puntuacion = cliente
      ? calcularPuntuacion(
          pedidos.length,
          entregados.length,
          cancelados.length,
          totalEnvios,
          ultimoPedido,
          cliente.created_at
        )
      : 0;

    return {
      total: pedidos.length,
      entregados: entregados.length,
      cancelados: cancelados.length,
      activos: pedidos.filter(
        (pedido) =>
          !["Entregado", "Cancelado"].includes(pedido.estado)
      ).length,
      totalEnvios,
      totalMovido,
      promedio,
      primerPedido,
      ultimoPedido,
      puntuacion,
      nivel: obtenerNivel(pedidos.length, puntuacion),
    };
  }, [cliente, pedidos]);

  const direccionesEntrega = useMemo(
    () => contarFrecuencias(pedidos.map((pedido) => pedido.direccion_entrega)),
    [pedidos]
  );

  const lugaresCompra = useMemo(
    () => contarFrecuencias(pedidos.map((pedido) => pedido.direccion_recogida)),
    [pedidos]
  );

  const metodosPago = useMemo(
    () => contarFrecuencias(pedidos.map((pedido) => pedido.metodo_pago), 3),
    [pedidos]
  );

  const motorizadosFrecuentes = useMemo(
    () =>
      contarFrecuencias(
        pedidos.map((pedido) => nombreMotorizado(pedido.motorizados)),
        3
      ).filter((item) => item.valor !== "Sin asignar"),
    [pedidos]
  );

  const resumen = useMemo(() => {
    if (!cliente) return [];

    const elementos = [
      `${estadisticas.total} pedido${
        estadisticas.total === 1 ? "" : "s"
      } registrado${estadisticas.total === 1 ? "" : "s"}.`,
      estadisticas.entregados > 0
        ? `${estadisticas.entregados} entrega${
            estadisticas.entregados === 1 ? "" : "s"
          } completada${estadisticas.entregados === 1 ? "" : "s"}.`
        : "Todavía no tiene entregas completadas.",
      estadisticas.cancelados === 0
        ? "Sin cancelaciones registradas."
        : `${estadisticas.cancelados} cancelación${
            estadisticas.cancelados === 1 ? "" : "es"
          } registrada${estadisticas.cancelados === 1 ? "" : "s"}.`,
      estadisticas.ultimoPedido
        ? `Último pedido: ${tiempoRelativo(estadisticas.ultimoPedido)}.`
        : "Aún no ha realizado pedidos.",
      direccionesEntrega[0]
        ? `Entrega habitual: ${direccionesEntrega[0].valor}.`
        : `Dirección registrada: ${cliente.direccion}.`,
    ];

    return elementos;
  }, [cliente, direccionesEntrega, estadisticas]);

  if (cargando) {
    return (
      <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-800 bg-slate-900 px-6 py-16 text-center text-slate-400">
          Cargando expediente del cliente...
        </div>
      </main>
    );
  }

  if (error || !cliente) {
    return (
      <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-7 text-red-200">
          <h1 className="text-2xl font-black">No se pudo abrir el expediente</h1>
          <p className="mt-3">{error || "Cliente no encontrado."}</p>
          <Link
            href="/clientes"
            className="mt-6 inline-block rounded-xl border border-red-400/40 px-5 py-3 font-bold"
          >
            ← Volver a Clientes
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Expediente del cliente
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              👤 {cliente.nombre}
            </h1>
            <p className="mt-2 text-slate-400">
              Cliente #{cliente.id} · Registrado el {fecha(cliente.created_at)}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/clientes"
              className="rounded-xl border border-slate-700 px-5 py-3 font-bold transition hover:bg-slate-900"
            >
              ← Clientes
            </Link>

            <Link
              href={`/clientes/${cliente.id}/editar`}
              className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-5 py-3 font-bold text-blue-300 transition hover:bg-blue-500/20"
            >
              Editar
            </Link>

            <Link
              href={`/pedidos/nuevo?cliente=${cliente.id}`}
              className="rounded-xl bg-green-500 px-5 py-3 font-black text-slate-950 transition hover:bg-green-400"
            >
              + Nuevo pedido
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-5 xl:grid-cols-[1.15fr_1.85fr]">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-green-500/15 text-4xl font-black text-green-400">
                {cliente.nombre.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <span className="inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-black text-green-300">
                  {estadisticas.nivel}
                </span>
                <p className="mt-3 text-2xl font-black">
                  {estadisticas.puntuacion}/100
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${estadisticas.puntuacion}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  Puntuación calculada con frecuencia, cumplimiento,
                  antigüedad y valor generado.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4 border-t border-slate-800 pt-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Teléfono
                </p>
                <p className="mt-1 text-lg font-bold">{cliente.telefono}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Dirección principal
                </p>
                <p className="mt-1 font-semibold">{cliente.direccion}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Referencia permanente
                </p>
                <p className="mt-1 text-slate-300">
                  {cliente.referencia || "Sin referencia registrada."}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-xl font-black">Resumen del cliente</h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {resumen.map((elemento) => (
                <div
                  key={elemento}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300"
                >
                  ✓ {elemento}
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Pedidos", estadisticas.total.toString(), "Total histórico"],
            [
              "Entregados",
              estadisticas.entregados.toString(),
              `${estadisticas.cancelados} cancelados`,
            ],
            [
              "Generado en envíos",
              dinero(estadisticas.totalEnvios),
              `Promedio ${dinero(estadisticas.promedio)}`,
            ],
            [
              "Último pedido",
              tiempoRelativo(estadisticas.ultimoPedido),
              estadisticas.ultimoPedido
                ? fecha(estadisticas.ultimoPedido)
                : "Sin actividad",
            ],
          ].map(([titulo, valor, detalle]) => (
            <article
              key={titulo}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">{titulo}</p>
              <p className="mt-2 text-2xl font-black text-white">{valor}</p>
              <p className="mt-2 text-xs text-slate-500">{detalle}</p>
            </article>
          ))}
        </section>

        <section className="mb-6 grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-black">📍 Direcciones frecuentes</h2>

            <div className="mt-5 space-y-3">
              {direccionesEntrega.length === 0 ? (
                <p className="text-slate-400">
                  Todavía no hay direcciones en el historial.
                </p>
              ) : (
                direccionesEntrega.map((item, indice) => (
                  <div
                    key={item.valor}
                    className="flex items-start justify-between gap-4 rounded-xl bg-slate-950/60 p-4"
                  >
                    <div>
                      <p className="font-bold">
                        {indice === 0 ? "⭐ " : ""}
                        {item.valor}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Dirección de entrega
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-green-500/10 px-3 py-1 text-xs font-black text-green-300">
                      {item.cantidad} uso{item.cantidad === 1 ? "" : "s"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-black">🛒 Lugares de compra frecuentes</h2>

            <div className="mt-5 space-y-3">
              {lugaresCompra.length === 0 ? (
                <p className="text-slate-400">
                  Todavía no hay lugares de recogida en el historial.
                </p>
              ) : (
                lugaresCompra.map((item, indice) => (
                  <div
                    key={item.valor}
                    className="flex items-start justify-between gap-4 rounded-xl bg-slate-950/60 p-4"
                  >
                    <div>
                      <p className="font-bold">
                        {indice === 0 ? "⭐ " : ""}
                        {item.valor}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Punto de recogida
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-300">
                      {item.cantidad} pedido{item.cantidad === 1 ? "" : "s"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        <section className="mb-6 grid gap-5 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="font-black">💳 Pago habitual</h2>
            <div className="mt-4 space-y-3">
              {metodosPago.length === 0 ? (
                <p className="text-sm text-slate-400">Sin información.</p>
              ) : (
                metodosPago.map((item, indice) => (
                  <div
                    key={item.valor}
                    className="flex items-center justify-between rounded-xl bg-slate-950/60 p-4"
                  >
                    <span className="font-semibold">
                      {indice === 0 ? "⭐ " : ""}
                      {item.valor}
                    </span>
                    <span className="text-sm text-slate-400">
                      {item.cantidad}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="font-black">🛵 Motorizado frecuente</h2>
            <div className="mt-4 space-y-3">
              {motorizadosFrecuentes.length === 0 ? (
                <p className="text-sm text-slate-400">Sin información.</p>
              ) : (
                motorizadosFrecuentes.map((item, indice) => (
                  <div
                    key={item.valor}
                    className="flex items-center justify-between rounded-xl bg-slate-950/60 p-4"
                  >
                    <span className="font-semibold">
                      {indice === 0 ? "⭐ " : ""}
                      {item.valor}
                    </span>
                    <span className="text-sm text-slate-400">
                      {item.cantidad}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="font-black">📅 Relación comercial</h2>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">
                  Cliente registrado
                </dt>
                <dd className="mt-1 font-semibold">{fecha(cliente.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">
                  Primer pedido
                </dt>
                <dd className="mt-1 font-semibold">
                  {fecha(estadisticas.primerPedido)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">
                  Dinero movilizado
                </dt>
                <dd className="mt-1 font-semibold text-green-400">
                  {dinero(estadisticas.totalMovido)}
                </dd>
              </div>
            </dl>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">📦 Historial de pedidos</h2>
              <p className="mt-1 text-sm text-slate-400">
                {pedidos.length} pedido{pedidos.length === 1 ? "" : "s"} en el expediente
              </p>
            </div>

            <Link
              href={`/pedidos/nuevo?cliente=${cliente.id}`}
              className="rounded-xl bg-green-500 px-5 py-3 text-center font-black text-slate-950"
            >
              + Nuevo pedido
            </Link>
          </div>

          {pedidos.length === 0 ? (
            <div className="px-6 py-16 text-center text-slate-400">
              Este cliente todavía no tiene pedidos registrados.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {pedidos.map((pedido) => (
                <article
                  key={pedido.id}
                  className="grid gap-4 p-5 transition hover:bg-slate-800/30 lg:grid-cols-[120px_1fr_190px_150px]"
                >
                  <div>
                    <p className="text-xs text-slate-500">Pedido</p>
                    <p className="mt-1 text-xl font-black text-green-400">
                      #{pedido.id}
                    </p>
                    {pedido.codigo && (
                      <p className="mt-1 text-xs text-slate-500">
                        {pedido.codigo}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="font-bold">{pedido.direccion_recogida}</p>
                    <p className="mt-1 text-sm text-slate-500">↓ entregar en</p>
                    <p className="mt-1 text-slate-300">
                      {pedido.direccion_entrega}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {nombreMotorizado(pedido.motorizados)} ·{" "}
                      {pedido.metodo_pago}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400">
                      {fecha(pedido.created_at)}
                    </p>
                    <p className="mt-2 font-black">
                      {dinero(
                        Number(pedido.costo_envio ?? 0) +
                          Number(pedido.monto_compra ?? 0)
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <span
                      className={`rounded-full border px-3 py-1.5 text-xs font-black ${estiloEstado(
                        pedido.estado
                      )}`}
                    >
                      {pedido.estado}
                    </span>

                    <Link
                      href={`/pedidos/${pedido.id}/editar`}
                      className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold transition hover:bg-slate-800"
                    >
                      Ver pedido
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
