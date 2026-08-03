"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type EstadoPedido =
  | "Pendiente"
  | "Asignado"
  | "Recogido"
  | "En camino"
  | "Entregado"
  | "Cancelado";

type EstadoMotorizado = "Disponible" | "Ocupado" | "Inactivo";

type Motorizado = {
  id: number;
  nombre: string;
  telefono: string | null;
  placa: string | null;
  estado: EstadoMotorizado;
};

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
  telefono: string;
  direccion_recogida: string;
  direccion_entrega: string;
  costo_envio: number | null;
  monto_compra: number | null;
  estado: EstadoPedido;
  metodo_pago: string;
  descripcion: string | null;
  observaciones: string | null;
  created_at: string;
  motorizado_id: number | null;
  motorizados: RelacionMotorizado;
};

type ResultadoCaja = {
  correcto: boolean;
  yaExistia: boolean;
  mensaje?: string;
};

function obtenerNombreMotorizado(
  motorizados: RelacionMotorizado
) {
  if (!motorizados) {
    return "Sin asignar";
  }

  if (Array.isArray(motorizados)) {
    return motorizados[0]?.nombre ?? "Sin asignar";
  }

  return motorizados.nombre;
}

function limpiarTelefono(telefono: string) {
  return telefono.replace(/\D/g, "");
}

function crearEnlaceWhatsApp(pedido: Pedido) {
  const telefonoLimpio = limpiarTelefono(pedido.telefono);

  const telefonoConPais = telefonoLimpio.startsWith("505")
    ? telefonoLimpio
    : `505${telefonoLimpio}`;

  let mensajeEstado = "";

  if (pedido.estado === "Pendiente" || pedido.estado === "Asignado") {
    mensajeEstado =
      "Ya recibimos tu pedido y pronto iremos a recogerlo.";
  }

  if (pedido.estado === "Recogido") {
    mensajeEstado =
      "Tu pedido ya fue recogido y pronto iniciaremos la entrega.";
  }

  if (pedido.estado === "En camino") {
    mensajeEstado =
      "Voy en camino con tu pedido. Por favor, mantente pendiente.";
  }

  const mensaje = [
    `Hola ${pedido.nombre_cliente}.`,
    "",
    `Soy el motorizado de Mandados Rapid y estoy gestionando tu pedido #${pedido.id}.`,
    "",
    mensajeEstado,
    "",
    `Dirección de entrega: ${pedido.direccion_entrega}`,
    `Total a pagar: ${formatearDinero(
      Number(pedido.costo_envio ?? 0) +
        Number(pedido.monto_compra ?? 0)
    )}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/${telefonoConPais}?text=${encodeURIComponent(
    mensaje
  )}`;
}

function crearEnlaceMapa(direccion: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    direccion
  )}`;
}

function crearEnlaceRuta(origen: string, destino: string) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    origen
  )}&destination=${encodeURIComponent(destino)}&travelmode=driving`;
}

function formatearDinero(
  valor: number | null | undefined
) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
  }).format(Number(valor ?? 0));
}

function estiloEstado(estado: EstadoPedido) {
  if (estado === "Entregado") {
    return "border-green-500/40 bg-green-500/15 text-green-300";
  }

  if (estado === "En camino") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  }

  if (estado === "Recogido") {
    return "border-violet-500/40 bg-violet-500/15 text-violet-300";
  }

  if (estado === "Asignado") {
    return "border-blue-500/40 bg-blue-500/15 text-blue-300";
  }

  if (estado === "Cancelado") {
    return "border-red-500/40 bg-red-500/15 text-red-300";
  }

  return "border-slate-600 bg-slate-500/15 text-slate-300";
}

export default function VistaMotorizado() {
  const [motorizados, setMotorizados] = useState<
    Motorizado[]
  >([]);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const [
    motorizadoSeleccionado,
    setMotorizadoSeleccionado,
  ] = useState<number | null>(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [pedidoActualizando, setPedidoActualizando] =
    useState<number | null>(null);

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true);
      setError("");

      const { data: usuarioData, error: errorUsuario } = await supabase.auth.getUser();
      if (errorUsuario || !usuarioData.user) {
        setError(errorUsuario?.message ?? "No hay una sesión activa.");
        setCargando(false);
        return;
      }

      const { data: perfil, error: errorPerfil } = await supabase
        .from("perfiles")
        .select("rol, motorizado_id")
        .eq("id", usuarioData.user.id)
        .single();

      if (errorPerfil || perfil?.rol !== "motorizado" || !perfil.motorizado_id) {
        setError("Tu cuenta no está vinculada correctamente con un motorizado.");
        setCargando(false);
        return;
      }

      const motorizadoId = Number(perfil.motorizado_id);
      const [respuestaMotorizado, respuestaPedidos] = await Promise.all([
        supabase.from("motorizados").select("id, nombre, telefono, placa, estado").eq("id", motorizadoId).single(),
        supabase.from("pedidos").select(`
          id, nombre_cliente, telefono, direccion_recogida, direccion_entrega,
          costo_envio, monto_compra, estado, metodo_pago, descripcion,
          observaciones, created_at, motorizado_id, motorizados ( nombre )
        `).eq("motorizado_id", motorizadoId).in("estado", ["Pendiente", "Asignado", "Recogido", "En camino"]).order("created_at", { ascending: false }),
      ]);

      if (respuestaMotorizado.error) {
        setError(`No se pudo cargar tu perfil de motorizado: ${respuestaMotorizado.error.message}`);
        setCargando(false);
        return;
      }
      if (respuestaPedidos.error) {
        setError(`No se pudieron cargar tus pedidos: ${respuestaPedidos.error.message}`);
        setCargando(false);
        return;
      }

      setMotorizados([respuestaMotorizado.data as Motorizado]);
      setPedidos((respuestaPedidos.data ?? []) as Pedido[]);
      setMotorizadoSeleccionado(motorizadoId);
      setCargando(false);
    }

    void cargarDatos();
  }, []);

  const motorizadoActual = useMemo(() => {
    return (
      motorizados.find(
        (motorizado) =>
          motorizado.id === motorizadoSeleccionado
      ) ?? null
    );
  }, [motorizadoSeleccionado, motorizados]);

  const pedidosFiltrados = useMemo(() => {
    if (motorizadoSeleccionado === null) {
      return [];
    }

    return pedidos.filter(
      (pedido) =>
        pedido.motorizado_id ===
        motorizadoSeleccionado
    );
  }, [motorizadoSeleccionado, pedidos]);

  function seleccionarMotorizado(
    motorizadoId: number
  ) {
    setMotorizadoSeleccionado(motorizadoId);
    setError("");
    setMensaje("");

    window.localStorage.setItem(
      "rapidcontrol_motorizado",
      motorizadoId.toString()
    );
  }

  function cambiarMotorizado() {
    setMotorizadoSeleccionado(null);
    setError("");
    setMensaje("");

    window.localStorage.removeItem(
      "rapidcontrol_motorizado"
    );
  }

  async function registrarIngresoCaja(
    pedido: Pedido
  ): Promise<ResultadoCaja> {
    const montoEnvio = Number(
      pedido.costo_envio ?? 0
    );

    if (montoEnvio <= 0) {
      return {
        correcto: true,
        yaExistia: false,
      };
    }

    const {
      data: movimientoExistente,
      error: errorBusqueda,
    } = await supabase
      .from("movimientos_caja")
      .select("id")
      .eq("pedido_id", pedido.id)
      .eq("tipo", "Ingreso")
      .eq("categoria", "Envío")
      .maybeSingle();

    if (errorBusqueda) {
      return {
        correcto: false,
        yaExistia: false,
        mensaje: errorBusqueda.message,
      };
    }

    if (movimientoExistente) {
      return {
        correcto: true,
        yaExistia: true,
      };
    }

    const { error: errorCaja } = await supabase
      .from("movimientos_caja")
      .insert({
        pedido_id: pedido.id,
        tipo: "Ingreso",
        categoria: "Envío",
        monto: montoEnvio,
        descripcion: `Ingreso por entrega del pedido #${pedido.id} - ${pedido.nombre_cliente}`,
      });

    if (errorCaja) {
      return {
        correcto: false,
        yaExistia: false,
        mensaje: errorCaja.message,
      };
    }

    return {
      correcto: true,
      yaExistia: false,
    };
  }

  async function actualizarEstado(
    pedidoId: number,
    nuevoEstado: EstadoPedido
  ) {
    const pedidoAnterior = pedidos.find(
      (pedido) => pedido.id === pedidoId
    );

    if (
      !pedidoAnterior ||
      pedidoAnterior.estado === nuevoEstado
    ) {
      return;
    }

    setPedidoActualizando(pedidoId);
    setError("");
    setMensaje("");

    const { error: errorActualizacion } =
      await supabase
        .from("pedidos")
        .update({
          estado: nuevoEstado,
        })
        .eq("id", pedidoId);

    if (errorActualizacion) {
      console.error(errorActualizacion);

      setError(
        `No se pudo actualizar el pedido #${pedidoId}: ${errorActualizacion.message}`
      );

      setPedidoActualizando(null);
      return;
    }

    if (nuevoEstado === "Entregado") {
      const resultadoCaja =
        await registrarIngresoCaja(pedidoAnterior);

      if (!resultadoCaja.correcto) {
        await supabase
          .from("pedidos")
          .update({
            estado: pedidoAnterior.estado,
          })
          .eq("id", pedidoId);

        setError(
          `El pedido no se marcó como entregado porque no se pudo registrar en Caja: ${resultadoCaja.mensaje}`
        );

        setPedidoActualizando(null);
        return;
      }

      setPedidos((pedidosActuales) =>
        pedidosActuales.filter(
          (pedido) => pedido.id !== pedidoId
        )
      );

      const otrosPedidosActivos = pedidos.filter(
        (pedido) =>
          pedido.id !== pedidoId &&
          pedido.motorizado_id ===
            pedidoAnterior.motorizado_id
      );

      if (
        otrosPedidosActivos.length === 0 &&
        pedidoAnterior.motorizado_id !== null
      ) {
        await supabase
          .from("motorizados")
          .update({
            estado: "Disponible",
          })
          .eq(
            "id",
            pedidoAnterior.motorizado_id
          );

        setMotorizados(
          (motorizadosActuales) =>
            motorizadosActuales.map(
              (motorizado) =>
                motorizado.id ===
                pedidoAnterior.motorizado_id
                  ? {
                      ...motorizado,
                      estado: "Disponible",
                    }
                  : motorizado
            )
        );
      }

      setMensaje(
        resultadoCaja.yaExistia
          ? `Pedido #${pedidoId} entregado. El ingreso ya estaba registrado en Caja.`
          : `Pedido #${pedidoId} entregado y se registró ${formatearDinero(
              pedidoAnterior.costo_envio
            )} en Caja.`
      );
    } else {
      setPedidos((pedidosActuales) =>
        pedidosActuales.map((pedido) =>
          pedido.id === pedidoId
            ? {
                ...pedido,
                estado: nuevoEstado,
              }
            : pedido
        )
      );

      if (
        pedidoAnterior.motorizado_id !== null
      ) {
        await supabase
          .from("motorizados")
          .update({
            estado: "Ocupado",
          })
          .eq(
            "id",
            pedidoAnterior.motorizado_id
          );

        setMotorizados(
          (motorizadosActuales) =>
            motorizadosActuales.map(
              (motorizado) =>
                motorizado.id ===
                pedidoAnterior.motorizado_id
                  ? {
                      ...motorizado,
                      estado: "Ocupado",
                    }
                  : motorizado
            )
        );
      }

      setMensaje(
        `Pedido #${pedidoId} actualizado a "${nuevoEstado}".`
      );
    }

    setPedidoActualizando(null);

    window.setTimeout(() => {
      setMensaje("");
    }, 3500);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">
              Vista de reparto
            </p>

            <h1 className="text-3xl font-black">
              🛵 Mis entregas
            </h1>
          </div>

          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            className="w-fit rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 font-bold text-red-300 transition hover:bg-red-500/20"
          >
            Cerrar sesión
          </button>
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

        {cargando && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-14 text-center text-slate-400">
            Cargando información...
          </div>
        )}

        {!cargando &&
          motorizadoSeleccionado === null && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-6">
              <div className="mb-6 text-center">
                <div className="text-5xl">🛵</div>

                <h2 className="mt-4 text-2xl font-black">
                  Selecciona tu nombre
                </h2>

                <p className="mt-2 text-slate-400">
                  Verás únicamente los pedidos que
                  tienes asignados.
                </p>
              </div>

              {motorizados.length === 0 ? (
                <p className="py-8 text-center text-slate-400">
                  No hay motorizados activos.
                </p>
              ) : (
                <div className="space-y-3">
                  {motorizados.map(
                    (motorizado) => {
                      const cantidadPedidos =
                        pedidos.filter(
                          (pedido) =>
                            pedido.motorizado_id ===
                            motorizado.id
                        ).length;

                      return (
                        <button
                          key={motorizado.id}
                          type="button"
                          onClick={() =>
                            seleccionarMotorizado(
                              motorizado.id
                            )
                          }
                          className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4 text-left transition hover:border-green-500/50 hover:bg-slate-700"
                        >
                          <div>
                            <p className="text-lg font-bold">
                              {motorizado.nombre}
                            </p>

                            <p className="mt-1 text-sm text-slate-400">
                              {motorizado.placa ||
                                "Sin placa"}{" "}
                              · {motorizado.estado}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-2xl font-black text-green-400">
                              {cantidadPedidos}
                            </p>

                            <p className="text-xs text-slate-500">
                              pedidos
                            </p>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          )}

        {!cargando &&
          motorizadoSeleccionado !== null &&
          motorizadoActual && (
            <>
              <section className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-400">
                    Motorizado seleccionado
                  </p>

                  <p className="mt-1 text-xl font-black">
                    {motorizadoActual.nombre}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {motorizadoActual.placa ||
                      "Sin placa"}{" "}
                    · {motorizadoActual.estado}
                  </p>
                </div>

                <span className="rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-3 font-bold text-green-300">
                  Cuenta vinculada
                </span>
              </section>

              {pedidosFiltrados.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-14 text-center">
                  <p className="text-xl font-bold">
                    No tienes entregas activas.
                  </p>

                  <p className="mt-2 text-slate-400">
                    Los nuevos pedidos asignados
                    aparecerán aquí.
                  </p>
                </div>
              )}

              {pedidosFiltrados.length > 0 && (
                <section className="space-y-5">
                  {pedidosFiltrados.map(
                    (pedido) => {
                      const total =
                        Number(
                          pedido.costo_envio ?? 0
                        ) +
                        Number(
                          pedido.monto_compra ?? 0
                        );

                      const telefonoLimpio =
                        limpiarTelefono(
                          pedido.telefono
                        );

                      const estaActualizando =
                        pedidoActualizando ===
                        pedido.id;

                      return (
                        <article
                          key={pedido.id}
                          className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800 p-5">
                            <div>
                              <p className="text-sm text-slate-400">
                                Pedido
                              </p>

                              <h2 className="text-2xl font-black text-green-400">
                                #{pedido.id}
                              </h2>
                            </div>

                            <span
                              className={`rounded-full border px-3 py-2 text-sm font-bold ${estiloEstado(
                                pedido.estado
                              )}`}
                            >
                              {pedido.estado}
                            </span>
                          </div>

                          <div className="space-y-5 p-5">
                            <section>
                              <p className="text-sm text-slate-500">
                                Cliente
                              </p>

                              <p className="mt-1 text-xl font-bold">
                                {
                                  pedido.nombre_cliente
                                }
                              </p>

                              <p className="mt-1 text-slate-300">
                                {pedido.telefono}
                              </p>
                            </section>

                            <section className="rounded-xl bg-slate-800/70 p-4">
                              <p className="text-sm font-semibold text-slate-400">
                                Recoger en
                              </p>

                              <p className="mt-2 text-lg font-bold">
                                {
                                  pedido.direccion_recogida
                                }
                              </p>
                            </section>

                            <section className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                              <p className="text-sm font-semibold text-green-300">
                                Entregar en
                              </p>

                              <p className="mt-2 text-lg font-bold">
                                {
                                  pedido.direccion_entrega
                                }
                              </p>
                            </section>

                            {pedido.descripcion && (
                              <section>
                                <p className="text-sm text-slate-500">
                                  Descripción del pedido
                                </p>

                                <p className="mt-2 whitespace-pre-wrap text-slate-200">
                                  {pedido.descripcion}
                                </p>
                              </section>
                            )}

                            {pedido.observaciones && (
                              <section>
                                <p className="text-sm text-slate-500">
                                  Observaciones
                                </p>

                                <p className="mt-2 whitespace-pre-wrap text-slate-200">
                                  {
                                    pedido.observaciones
                                  }
                                </p>
                              </section>
                            )}

                            <section className="grid grid-cols-2 gap-3 rounded-xl bg-slate-800/50 p-4">
                              <div>
                                <p className="text-sm text-slate-500">
                                  Método de pago
                                </p>

                                <p className="mt-1 font-bold">
                                  {
                                    pedido.metodo_pago
                                  }
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="text-sm text-slate-500">
                                  Total
                                </p>

                                <p className="mt-1 text-xl font-black">
                                  {formatearDinero(
                                    total
                                  )}
                                </p>
                              </div>
                            </section>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <a
                                href={crearEnlaceMapa(pedido.direccion_recogida)}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-center font-bold text-blue-300 transition hover:bg-blue-500/20"
                              >
                                📦 Ver recogida
                              </a>

                              <a
                                href={crearEnlaceMapa(pedido.direccion_entrega)}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-center font-bold text-blue-300 transition hover:bg-blue-500/20"
                              >
                                🏁 Ver entrega
                              </a>

                              <a
                                href={crearEnlaceRuta(
                                  pedido.direccion_recogida,
                                  pedido.direccion_entrega
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-center font-bold text-violet-300 transition hover:bg-violet-500/20 sm:col-span-2"
                              >
                                🗺️ Abrir ruta completa
                              </a>

                              <a
                                href={`tel:${telefonoLimpio}`}
                                className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-center font-bold text-green-300 transition hover:bg-green-500/20"
                              >
                                📞 Llamar cliente
                              </a>

                              <a
                                href={crearEnlaceWhatsApp(pedido)}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-center font-bold text-emerald-300 transition hover:bg-emerald-500/20"
                              >
                                💬 WhatsApp cliente
                              </a>
                            </div>

                            <div className="grid gap-3">
                              {(pedido.estado ===
                                "Pendiente" ||
                                pedido.estado ===
                                  "Asignado") && (
                                <button
                                  type="button"
                                  disabled={
                                    estaActualizando
                                  }
                                  onClick={() =>
                                    void actualizarEstado(
                                      pedido.id,
                                      "Recogido"
                                    )
                                  }
                                  className="rounded-xl bg-violet-600 px-5 py-4 font-black transition hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60"
                                >
                                  {estaActualizando
                                    ? "Guardando..."
                                    : "📦 Pedido recogido"}
                                </button>
                              )}

                              {pedido.estado ===
                                "Recogido" && (
                                <button
                                  type="button"
                                  disabled={
                                    estaActualizando
                                  }
                                  onClick={() =>
                                    void actualizarEstado(
                                      pedido.id,
                                      "En camino"
                                    )
                                  }
                                  className="rounded-xl bg-amber-600 px-5 py-4 font-black transition hover:bg-amber-500 disabled:cursor-wait disabled:opacity-60"
                                >
                                  {estaActualizando
                                    ? "Guardando..."
                                    : "🛵 Iniciar entrega"}
                                </button>
                              )}

                              {pedido.estado ===
                                "En camino" && (
                                <button
                                  type="button"
                                  disabled={
                                    estaActualizando
                                  }
                                  onClick={() =>
                                    void actualizarEstado(
                                      pedido.id,
                                      "Entregado"
                                    )
                                  }
                                  className="rounded-xl bg-green-600 px-5 py-4 font-black transition hover:bg-green-500 disabled:cursor-wait disabled:opacity-60"
                                >
                                  {estaActualizando
                                    ? "Guardando..."
                                    : "✅ Marcar entregado"}
                                </button>
                              )}
                            </div>

                            <p className="text-sm text-slate-500">
                              Motorizado:{" "}
                              {obtenerNombreMotorizado(
                                pedido.motorizados
                              )}
                            </p>
                          </div>
                        </article>
                      );
                    }
                  )}
                </section>
              )}
            </>
          )}
      </div>
    </main>
  );
}