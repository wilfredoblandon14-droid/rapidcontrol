"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import NotificationsBell from "@/components/notifications/NotificationsBell";

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


type UbicacionJornada = {
  motorizado_id: number;
  latitud: number | null;
  longitud: number | null;
  precision_metros: number | null;
  jornada_activa: boolean;
  inicio_jornada: string | null;
  fin_jornada: string | null;
  ultima_actualizacion: string | null;
};

type ResultadoCaja = {
  correcto: boolean;
  yaExistia: boolean;
  mensaje?: string;
};

type FondoDia = {
  id: number;
  motorizado_id: number;
  monto: number;
  fecha: string;
  notas: string | null;
};

type GastoDia = {
  id: number;
  motorizado_id: number;
  tipo: "Gasolina" | "Recarga" | "Otro";
  monto: number;
  fecha: string;
  observacion: string | null;
};

type LiquidacionDia = {
  id: number;
  motorizado_id: number;
  fondo_entregado: number;
  envios_generados: number;
  gasolina: number;
  recargas: number;
  otros_gastos: number;
  esperado: number;
  recibido: number;
  diferencia: number;
  fecha: string;
  created_at: string;
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

function hoyLocal() {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function inicioDiaISO() {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  return fecha.toISOString();
}

function esTransferencia(metodo: string | null | undefined) {
  return (metodo ?? "").toLowerCase().includes("transfer");
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

const pasosPedido: EstadoPedido[] = [
  "Asignado",
  "Recogido",
  "En camino",
  "Entregado",
];

function indicePasoActual(estado: EstadoPedido) {
  if (estado === "Pendiente") {
    return 0;
  }

  const indice = pasosPedido.indexOf(estado);
  return indice >= 0 ? indice : 0;
}

export default function VistaMotorizado() {
  const [motorizados, setMotorizados] = useState<
    Motorizado[]
  >([]);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidosDia, setPedidosDia] = useState<Pedido[]>([]);
  const [fondosDia, setFondosDia] = useState<FondoDia[]>([]);
  const [gastosDia, setGastosDia] = useState<GastoDia[]>([]);
  const [liquidacionesDia, setLiquidacionesDia] = useState<LiquidacionDia[]>([]);

  const [
    motorizadoSeleccionado,
    setMotorizadoSeleccionado,
  ] = useState<number | null>(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [pedidoActualizando, setPedidoActualizando] =
    useState<number | null>(null);

  const [jornadaActiva, setJornadaActiva] = useState(false);
  const [ubicacionActual, setUbicacionActual] =
    useState<UbicacionJornada | null>(null);
  const [procesandoJornada, setProcesandoJornada] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const ultimoEnvioRef = useRef(0);

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
  const [
    respuestaMotorizado,
    respuestaPedidos,
    respuestaPedidosDia,
    respuestaFondos,
    respuestaGastos,
    respuestaLiquidaciones,
    respuestaUbicacion,
  ] = await Promise.all([
    supabase.from("motorizados").select("id, nombre, telefono, placa, estado").eq("id", motorizadoId).single(),
    supabase.from("pedidos").select(`
      id, nombre_cliente, telefono, direccion_recogida, direccion_entrega,
      costo_envio, monto_compra, estado, metodo_pago, descripcion,
      observaciones, created_at, motorizado_id, motorizados ( nombre )
    `).eq("motorizado_id", motorizadoId).in("estado", ["Pendiente", "Asignado", "Recogido", "En camino"]).order("created_at", { ascending: false }),
    supabase.from("pedidos").select(`
      id, nombre_cliente, telefono, direccion_recogida, direccion_entrega,
      costo_envio, monto_compra, estado, metodo_pago, descripcion,
      observaciones, created_at, motorizado_id, motorizados ( nombre )
    `).eq("motorizado_id", motorizadoId).gte("created_at", inicioDiaISO()).order("created_at", { ascending: false }),
    supabase.from("fondos_motorizado")
      .select("id,motorizado_id,monto,fecha,notas")
      .eq("motorizado_id", motorizadoId)
      .eq("fecha", hoyLocal()),
    supabase.from("gastos_motorizado")
      .select("id,motorizado_id,tipo,monto,fecha,observacion")
      .eq("motorizado_id", motorizadoId)
      .eq("fecha", hoyLocal()),
    supabase.from("liquidaciones_motorizado")
      .select("id,motorizado_id,fondo_entregado,envios_generados,gasolina,recargas,otros_gastos,esperado,recibido,diferencia,fecha,created_at")
      .eq("motorizado_id", motorizadoId)
      .eq("fecha", hoyLocal())
      .order("created_at", { ascending: false }),
    supabase
      .from("ubicaciones_motorizados")
      .select("motorizado_id, latitud, longitud, precision_metros, jornada_activa, inicio_jornada, fin_jornada, ultima_actualizacion")
      .eq("motorizado_id", motorizadoId)
      .maybeSingle(),
  ]);

  if (respuestaMotorizado.error) {
    setError(`No se pudo cargar tu perfil de motorizado: ${respuestaMotorizado.error.message}`);
    setCargando(false);
    return;
  }
  const errorFinanciero =
    respuestaPedidos.error ??
    respuestaPedidosDia.error ??
    respuestaFondos.error ??
    respuestaGastos.error ??
    respuestaLiquidaciones.error;

  if (errorFinanciero) {
    setError(`No se pudo cargar tu jornada: ${errorFinanciero.message}`);
    setCargando(false);
    return;
  }

  setMotorizados([respuestaMotorizado.data as Motorizado]);
  setPedidos((respuestaPedidos.data ?? []) as Pedido[]);
  setPedidosDia((respuestaPedidosDia.data ?? []) as Pedido[]);
  setFondosDia((respuestaFondos.data ?? []) as FondoDia[]);
  setGastosDia((respuestaGastos.data ?? []) as GastoDia[]);
  setLiquidacionesDia((respuestaLiquidaciones.data ?? []) as LiquidacionDia[]);
  setMotorizadoSeleccionado(motorizadoId);

  if (!respuestaUbicacion.error && respuestaUbicacion.data) {
    const ubicacion = respuestaUbicacion.data as UbicacionJornada;
    setUbicacionActual(ubicacion);
    setJornadaActiva(Boolean(ubicacion.jornada_activa));

    if (ubicacion.jornada_activa && watchIdRef.current === null) {
      iniciarVigilanciaGPS(motorizadoId);
    }
  } else {
    setUbicacionActual(null);
    setJornadaActiva(false);
  }

  setCargando(false);
}

  async function guardarPosicion(
    motorizadoId: number,
    posicion: GeolocationPosition,
    iniciar = false
  ) {
    const { data: usuarioData } = await supabase.auth.getUser();
    if (!usuarioData.user) return;

    const ahora = new Date().toISOString();
    const registro = {
      motorizado_id: motorizadoId,
      user_id: usuarioData.user.id,
      latitud: posicion.coords.latitude,
      longitud: posicion.coords.longitude,
      precision_metros: posicion.coords.accuracy,
      jornada_activa: true,
      fin_jornada: null,
      ultima_actualizacion: ahora,
      ...(iniciar ? { inicio_jornada: ahora } : {}),
    };

    const { data, error: errorUbicacion } = await supabase
      .from("ubicaciones_motorizados")
      .upsert(registro, { onConflict: "motorizado_id" })
      .select("motorizado_id, latitud, longitud, precision_metros, jornada_activa, inicio_jornada, fin_jornada, ultima_actualizacion")
      .single();

    if (errorUbicacion) {
      console.error(errorUbicacion);
      setError(`No se pudo compartir la ubicación: ${errorUbicacion.message}`);
      return;
    }

    setUbicacionActual(data as UbicacionJornada);
    setJornadaActiva(true);
  }

  function iniciarVigilanciaGPS(motorizadoId: number) {
    if (!navigator.geolocation || watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (posicion) => {
        const ahora = Date.now();
        if (ahora - ultimoEnvioRef.current < 20_000) return;
        ultimoEnvioRef.current = ahora;
        void guardarPosicion(motorizadoId, posicion);
      },
      (errorGPS) => {
        console.error(errorGPS);
        setError(
          errorGPS.code === errorGPS.PERMISSION_DENIED
            ? "Debes permitir el acceso a la ubicación para compartir tu jornada."
            : "No se pudo obtener tu ubicación. Verifica el GPS y los datos móviles."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 20_000,
      }
    );
  }

  async function iniciarJornada() {
    if (!motorizadoSeleccionado) return;
    if (!navigator.geolocation) {
      setError("Este dispositivo no permite compartir ubicación.");
      return;
    }

    setProcesandoJornada(true);
    setError("");
    setMensaje("");

    navigator.geolocation.getCurrentPosition(
      async (posicion) => {
        ultimoEnvioRef.current = Date.now();
        await guardarPosicion(motorizadoSeleccionado, posicion, true);
        iniciarVigilanciaGPS(motorizadoSeleccionado);
        setMensaje("Jornada iniciada. Tu ubicación se está compartiendo.");
        setProcesandoJornada(false);
      },
      (errorGPS) => {
        setError(
          errorGPS.code === errorGPS.PERMISSION_DENIED
            ? "Permite la ubicación en el navegador para iniciar la jornada."
            : "No se pudo obtener la ubicación. Activa el GPS e inténtalo otra vez."
        );
        setProcesandoJornada(false);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
    );
  }

  async function finalizarJornada() {
    if (!motorizadoSeleccionado) return;
    setProcesandoJornada(true);
    setError("");

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const ahora = new Date().toISOString();
    const { error: errorFinalizar } = await supabase
      .from("ubicaciones_motorizados")
      .update({
        jornada_activa: false,
        fin_jornada: ahora,
        ultima_actualizacion: ahora,
      })
      .eq("motorizado_id", motorizadoSeleccionado);

    if (errorFinalizar) {
      setError(`No se pudo finalizar la jornada: ${errorFinalizar.message}`);
      setProcesandoJornada(false);
      return;
    }

    setJornadaActiva(false);
    setUbicacionActual((actual) =>
      actual
        ? { ...actual, jornada_activa: false, fin_jornada: ahora, ultima_actualizacion: ahora }
        : actual
    );
    setMensaje("Jornada finalizada. Dejaste de compartir tu ubicación.");
    setProcesandoJornada(false);
  }

  useEffect(() => {
    void cargarDatos();

    const canalPedidos = supabase
      .channel("pedidos-motorizado-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pedidos",
        },
        () => {
          void cargarDatos();
        }
      )
      .subscribe();

    const canalFinanciero = supabase
      .channel("motorizado-financiero-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "motorizados" },
        () => void cargarDatos()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fondos_motorizado" },
        () => void cargarDatos()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gastos_motorizado" },
        () => void cargarDatos()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "liquidaciones_motorizado" },
        () => void cargarDatos()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canalPedidos);
      void supabase.removeChannel(canalFinanciero);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
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

  const resumenJornada = useMemo(() => {
    const pendientes = pedidosFiltrados.filter(
      (pedido) =>
        pedido.estado === "Pendiente" ||
        pedido.estado === "Asignado"
    ).length;

    const recogidos = pedidosFiltrados.filter(
      (pedido) => pedido.estado === "Recogido"
    ).length;

    const enCamino = pedidosFiltrados.filter(
      (pedido) => pedido.estado === "En camino"
    ).length;

    const totalEnvios = pedidosFiltrados.reduce(
      (acumulado, pedido) =>
        acumulado + Number(pedido.costo_envio ?? 0),
      0
    );

    return {
      pendientes,
      recogidos,
      enCamino,
      totalEnvios,
    };
  }, [pedidosFiltrados]);

  const resumenFinanciero = useMemo(() => {
    if (motorizadoSeleccionado === null) {
      return {
        fondo: 0,
        comprasPagadas: 0,
        cobradoEfectivo: 0,
        transferencias: 0,
        gananciaEnvios: 0,
        gastos: 0,
        gasolina: 0,
        recargas: 0,
        otros: 0,
        efectivoActual: 0,
        disponibleCompras: 0,
        pedidosEntregados: 0,
        cantidadLiquidaciones: 0,
        totalRecibidoLiquidaciones: 0,
        liquidacion: null as LiquidacionDia | null,
      };
    }

    const delMotorizado = pedidosDia.filter(
      (pedido) => pedido.motorizado_id === motorizadoSeleccionado
    );
    const fondo = fondosDia
      .filter((item) => item.motorizado_id === motorizadoSeleccionado)
      .reduce((total, item) => total + Number(item.monto ?? 0), 0);
    const gastosMotorizado = gastosDia.filter(
      (item) => item.motorizado_id === motorizadoSeleccionado
    );
    const gastos = gastosMotorizado.reduce(
      (total, item) => total + Number(item.monto ?? 0),
      0
    );
    const gasolina = gastosMotorizado
      .filter((item) => item.tipo === "Gasolina")
      .reduce((total, item) => total + Number(item.monto ?? 0), 0);
    const recargas = gastosMotorizado
      .filter((item) => item.tipo === "Recarga")
      .reduce((total, item) => total + Number(item.monto ?? 0), 0);
    const otros = gastosMotorizado
      .filter((item) => item.tipo === "Otro")
      .reduce((total, item) => total + Number(item.monto ?? 0), 0);

    const comprasPagadas = delMotorizado
      .filter(
        (pedido) =>
          ["Recogido", "En camino", "Entregado"].includes(pedido.estado) &&
          !esTransferencia(pedido.metodo_pago)
      )
      .reduce(
        (total, pedido) => total + Number(pedido.monto_compra ?? 0),
        0
      );

    const entregados = delMotorizado.filter(
      (pedido) => pedido.estado === "Entregado"
    );
    const cobradoEfectivo = entregados
      .filter((pedido) => !esTransferencia(pedido.metodo_pago))
      .reduce(
        (total, pedido) =>
          total +
          Number(pedido.monto_compra ?? 0) +
          Number(pedido.costo_envio ?? 0),
        0
      );
    const transferencias = entregados
      .filter((pedido) => esTransferencia(pedido.metodo_pago))
      .reduce(
        (total, pedido) =>
          total +
          Number(pedido.monto_compra ?? 0) +
          Number(pedido.costo_envio ?? 0),
        0
      );
    const gananciaEnvios = entregados.reduce(
      (total, pedido) => total + Number(pedido.costo_envio ?? 0),
      0
    );

    const efectivoActual =
      fondo - comprasPagadas + cobradoEfectivo - gastos;

    return {
      fondo,
      comprasPagadas,
      cobradoEfectivo,
      transferencias,
      gananciaEnvios,
      gastos,
      gasolina,
      recargas,
      otros,
      efectivoActual,
      disponibleCompras: Math.max(0, efectivoActual),
      pedidosEntregados: entregados.length,
      cantidadLiquidaciones: liquidacionesDia.filter(
        (item) => item.motorizado_id === motorizadoSeleccionado
      ).length,
      totalRecibidoLiquidaciones: liquidacionesDia
        .filter((item) => item.motorizado_id === motorizadoSeleccionado)
        .reduce((total, item) => total + Number(item.recibido ?? 0), 0),
      liquidacion:
        liquidacionesDia.find(
          (item) => item.motorizado_id === motorizadoSeleccionado
        ) ?? null,
    };
  }, [
    fondosDia,
    gastosDia,
    liquidacionesDia,
    motorizadoSeleccionado,
    pedidosDia,
  ]);

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
      .in("categoria", ["Envío", "Envío efectivo", "Envío transferencia"])
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
        categoria: esTransferencia(pedido.metodo_pago)
          ? "Envío transferencia"
          : "Envío efectivo",
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
          <div className="flex items-center gap-4">
            <img
              src="/logo-mandados-rapid.png"
              alt="Mandados Rapid"
              className="h-16 w-16 rounded-2xl border border-slate-800 bg-black object-contain p-1 shadow-xl"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
                Mandados Rapid
              </p>
              <h1 className="mt-1 text-3xl font-black">🛵 Mi jornada</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NotificationsBell rolUsuario="motorizado" compacto />

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 font-bold text-slate-200 transition hover:bg-slate-800"
            >
              🔄 Actualizar
            </button>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 font-bold text-red-300 transition hover:bg-red-500/20"
            >
              Cerrar sesión
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
              <section className="mb-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-400">
                      Bienvenido a tu jornada
                    </p>

                    <p className="mt-1 text-2xl font-black">
                      Hola, {motorizadoActual.nombre} 👋
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {motorizadoActual.placa || "Sin placa"}{" "}
                      · {motorizadoActual.estado}
                    </p>
                  </div>

                  <span className="w-fit rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-3 font-bold text-green-300">
                    Cuenta vinculada
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <article className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                    <p className="text-sm text-blue-200">
                      Pendientes
                    </p>
                    <p className="mt-2 text-3xl font-black text-blue-300">
                      {resumenJornada.pendientes}
                    </p>
                  </article>

                  <article className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
                    <p className="text-sm text-violet-200">
                      Recogidos
                    </p>
                    <p className="mt-2 text-3xl font-black text-violet-300">
                      {resumenJornada.recogidos}
                    </p>
                  </article>

                  <article className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <p className="text-sm text-amber-200">
                      En camino
                    </p>
                    <p className="mt-2 text-3xl font-black text-amber-300">
                      {resumenJornada.enCamino}
                    </p>
                  </article>

                  <article className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                    <p className="text-sm text-green-200">
                      Valor de envíos activos
                    </p>
                    <p className="mt-2 text-3xl font-black text-green-300">
                      {formatearDinero(resumenJornada.totalEnvios)}
                    </p>
                  </article>
                </div>
              </section>

              <section className="mb-5 overflow-hidden rounded-2xl border border-green-500/30 bg-slate-900 shadow-2xl">
                <div className="border-b border-slate-800 bg-gradient-to-r from-green-500/15 to-slate-900 p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-400">
                        Resumen financiero del día
                      </p>
                      <h2 className="mt-1 text-2xl font-black">💰 Mi dinero de jornada</h2>
                    </div>
                    <span className={`w-fit rounded-full px-4 py-2 text-sm font-black ${
                      resumenFinanciero.liquidacion
                        ? "bg-blue-500/15 text-blue-300"
                        : resumenFinanciero.fondo > 0
                          ? "bg-green-500/15 text-green-300"
                          : "bg-amber-500/15 text-amber-300"
                    }`}>
                      {resumenFinanciero.liquidacion
                        ? "Jornada liquidada"
                        : resumenFinanciero.fondo > 0
                          ? "Fondo recibido"
                          : "Fondo pendiente"}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  <article className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                    <p className="text-sm text-blue-200">Fondo recibido</p>
                    <p className="mt-2 text-3xl font-black text-blue-300">
                      {formatearDinero(resumenFinanciero.fondo)}
                    </p>
                  </article>

                  <article className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <p className="text-sm text-emerald-200">Cobrado en efectivo</p>
                    <p className="mt-2 text-3xl font-black text-emerald-300">
                      {formatearDinero(resumenFinanciero.cobradoEfectivo)}
                    </p>
                    <p className="mt-1 text-xs text-emerald-200/70">
                      Compras y envíos recibidos físicamente
                    </p>
                  </article>

                  <article className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
                    <p className="text-sm text-violet-200">Transferencias</p>
                    <p className="mt-2 text-3xl font-black text-violet-300">
                      {formatearDinero(resumenFinanciero.transferencias)}
                    </p>
                    <p className="mt-1 text-xs text-violet-200/70">
                      Pagadas directamente a la cuenta; no se entregan en efectivo
                    </p>
                  </article>

                  <article className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <p className="text-sm text-amber-200">Compras pagadas en efectivo</p>
                    <p className="mt-2 text-3xl font-black text-amber-300">
                      -{formatearDinero(resumenFinanciero.comprasPagadas)}
                    </p>
                  </article>

                  <article className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <p className="text-sm text-red-200">Gastos autorizados</p>
                    <p className="mt-2 text-3xl font-black text-red-300">
                      -{formatearDinero(resumenFinanciero.gastos)}
                    </p>
                    <p className="mt-1 text-xs text-red-200/70">
                      Gasolina {formatearDinero(resumenFinanciero.gasolina)} · Recargas {formatearDinero(resumenFinanciero.recargas)} · Otros {formatearDinero(resumenFinanciero.otros)}
                    </p>
                  </article>

                  <article className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                    <p className="text-sm text-cyan-200">Ganancia de envíos generada</p>
                    <p className="mt-2 text-3xl font-black text-cyan-300">
                      +{formatearDinero(resumenFinanciero.gananciaEnvios)}
                    </p>
                    <p className="mt-1 text-xs text-cyan-200/70">
                      {resumenFinanciero.pedidosEntregados} pedidos entregados hoy
                    </p>
                  </article>
                </div>

                <div className="grid gap-4 border-t border-slate-800 p-5 lg:grid-cols-2">
                  <article className={`rounded-2xl border p-5 ${
                    resumenFinanciero.disponibleCompras < 300
                      ? "border-red-500/40 bg-red-500/10"
                      : "border-green-500/40 bg-green-500/10"
                  }`}>
                    <p className="text-sm text-slate-300">Disponible para continuar compras</p>
                    <p className="mt-2 text-4xl font-black">
                      {formatearDinero(resumenFinanciero.disponibleCompras)}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      {resumenFinanciero.disponibleCompras < 300
                        ? "⚠ Fondo bajo. Comunícate con recepción para una reposición."
                        : "🟢 Tienes efectivo disponible para continuar la jornada."}
                    </p>
                  </article>

                  <article className="rounded-2xl border border-green-400/50 bg-green-500/15 p-5">
                    <p className="text-sm font-bold uppercase tracking-wider text-green-200">
                      Efectivo estimado que debes entregar
                    </p>
                    <p className="mt-2 text-4xl font-black text-green-300">
                      {formatearDinero(resumenFinanciero.efectivoActual)}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-green-100/70">
                      Fondo − compras pagadas + cobros en efectivo − gastos. Las transferencias quedan fuera de este monto.
                    </p>
                    {resumenFinanciero.liquidacion && (
                      <p className="mt-3 rounded-xl bg-slate-950/40 p-3 text-sm text-slate-300">
                        Última liquidación: recepción registró {formatearDinero(resumenFinanciero.liquidacion.recibido)} · Diferencia {formatearDinero(resumenFinanciero.liquidacion.diferencia)} · {new Date(resumenFinanciero.liquidacion.created_at).toLocaleString("es-NI")}
                        {resumenFinanciero.cantidadLiquidaciones > 1
                          ? ` · ${resumenFinanciero.cantidadLiquidaciones} liquidaciones hoy · Total recibido ${formatearDinero(resumenFinanciero.totalRecibidoLiquidaciones)}`
                          : ""}
                      </p>
                    )}
                  </article>
                </div>
              </section>

              <section className={`mb-5 rounded-2xl border p-5 shadow-xl ${
                jornadaActiva
                  ? "border-green-500/40 bg-green-500/10"
                  : "border-slate-800 bg-slate-900"
              }`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Ubicación durante la jornada</p>
                    <h2 className="mt-1 text-xl font-black">
                      {jornadaActiva ? "🟢 GPS activo" : "⚪ GPS detenido"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      {jornadaActiva
                        ? "Tu posición se actualiza aproximadamente cada 20 segundos mientras esta página permanece activa."
                        : "Inicia la jornada para que Administración y Operaciones puedan ver tu ubicación."}
                    </p>
                    {ubicacionActual?.ultima_actualizacion && (
                      <p className="mt-2 text-xs text-slate-500">
                        Último envío: {new Date(ubicacionActual.ultima_actualizacion).toLocaleString("es-NI")}
                        {ubicacionActual.precision_metros
                          ? ` · precisión aproximada ${Math.round(ubicacionActual.precision_metros)} m`
                          : ""}
                      </p>
                    )}
                  </div>

                  {jornadaActiva ? (
                    <button
                      type="button"
                      disabled={procesandoJornada}
                      onClick={() => void finalizarJornada()}
                      className="rounded-xl bg-red-600 px-6 py-4 font-black transition hover:bg-red-500 disabled:opacity-60"
                    >
                      {procesandoJornada ? "Procesando..." : "🔴 Finalizar jornada"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={procesandoJornada}
                      onClick={() => void iniciarJornada()}
                      className="rounded-xl bg-green-600 px-6 py-4 font-black transition hover:bg-green-500 disabled:opacity-60"
                    >
                      {procesandoJornada ? "Obteniendo ubicación..." : "🟢 Iniciar jornada"}
                    </button>
                  )}
                </div>
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

                          <div className="border-b border-slate-800 px-5 py-4">
                            <div className="grid grid-cols-4 gap-2">
                              {pasosPedido.map((paso, indice) => {
                                const completado =
                                  indice <= indicePasoActual(pedido.estado);

                                return (
                                  <div key={paso} className="text-center">
                                    <div
                                      className={`mx-auto h-2 rounded-full ${
                                        completado
                                          ? "bg-green-500"
                                          : "bg-slate-700"
                                      }`}
                                    />
                                    <p
                                      className={`mt-2 text-[11px] font-semibold ${
                                        completado
                                          ? "text-green-300"
                                          : "text-slate-500"
                                      }`}
                                    >
                                      {paso}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
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