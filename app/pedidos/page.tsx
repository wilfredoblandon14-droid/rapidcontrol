"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type MotorizadoRelacionado = {
  nombre: string;
  telefono: string | null;
};

type RelMoto =
  | MotorizadoRelacionado
  | MotorizadoRelacionado[]
  | null;

type Pedido = {
  id: number;
  nombre_cliente: string;
  telefono: string;
  direccion_recogida: string;
  direccion_entrega: string;
  costo_envio: number;
  monto_compra: number;
  estado: string;
  metodo_pago: string;
  created_at: string;
  motorizado_id: number | null;
  motorizados: RelMoto;
};

const estados = [
  "Todos",
  "Pendiente",
  "Asignado",
  "Recogido",
  "En camino",
  "Entregado",
  "Cancelado",
];

function obtenerMotorizado(relacion: RelMoto) {
  if (!relacion) return null;
  return Array.isArray(relacion) ? relacion[0] ?? null : relacion;
}

function estilo(estado: string) {
  if (estado === "Entregado") return "bg-green-500/15 text-green-400";
  if (estado === "En camino") return "bg-amber-500/15 text-amber-400";
  if (estado === "Recogido") return "bg-violet-500/15 text-violet-400";
  if (estado === "Asignado") return "bg-blue-500/15 text-blue-400";
  if (estado === "Cancelado") return "bg-red-500/15 text-red-400";
  return "bg-slate-500/15 text-slate-300";
}

const dinero = (valor: number) =>
  new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
  }).format(valor);

const fecha = (valor: string) =>
  new Intl.DateTimeFormat("es-NI", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(valor));

function limpiarTelefono(telefono: string | null | undefined) {
  return (telefono ?? "").replace(/\D/g, "");
}

function telefonoWhatsApp(telefono: string | null | undefined) {
  const limpio = limpiarTelefono(telefono);
  if (!limpio) return "";
  return limpio.startsWith("505") ? limpio : `505${limpio}`;
}

function enlaceWhatsApp(telefono: string, mensaje: string) {
  const numero = telefonoWhatsApp(telefono);
  if (!numero) return "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

function mensajeCliente(pedido: Pedido) {
  const total = Number(pedido.costo_envio ?? 0) + Number(pedido.monto_compra ?? 0);
  const mensajesEstado: Record<string, string> = {
    Pendiente: "Recibimos tu solicitud y estamos preparando la asignación.",
    Asignado: "Tu pedido ya fue asignado a un motorizado.",
    Recogido: "Tu pedido ya fue recogido.",
    "En camino": "Tu pedido va en camino. Por favor mantente pendiente.",
    Entregado: "Tu pedido fue entregado. Gracias por usar Mandados Rapid.",
    Cancelado: "Tu pedido fue cancelado. Contáctanos si necesitas ayuda.",
  };

  return [
    `Hola ${pedido.nombre_cliente} 👋`,
    "",
    `Actualización de tu pedido #${pedido.id}: *${pedido.estado}*`,
    mensajesEstado[pedido.estado] ?? "Te compartimos una actualización de tu pedido.",
    "",
    `📍 Entrega: ${pedido.direccion_entrega}`,
    `💵 Total: ${dinero(total)}`,
    "",
    "Mandados Rapid · RapidControl",
  ].join("\n");
}

function mensajeMotorizado(pedido: Pedido) {
  const total = Number(pedido.costo_envio ?? 0) + Number(pedido.monto_compra ?? 0);
  return [
    `🛵 *Nuevo pedido #${pedido.id}*`,
    "",
    `👤 Cliente: ${pedido.nombre_cliente}`,
    `📞 Teléfono: ${pedido.telefono}`,
    `📦 Recoger: ${pedido.direccion_recogida}`,
    `🏁 Entregar: ${pedido.direccion_entrega}`,
    `💳 Pago: ${pedido.metodo_pago}`,
    `💵 Total: ${dinero(total)}`,
    "",
    "Abre RapidControl para actualizar el estado de la entrega.",
  ].join("\n");
}

function mapaLugar(direccion: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

function mapaRuta(origen: string, destino: string) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    origen
  )}&destination=${encodeURIComponent(destino)}&travelmode=driving`;
}

function abrir(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function ListaPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState<number | null>(null);

  async function cargar() {
    setCargando(true);
    setError("");

    const { data, error: errorCarga } = await supabase
      .from("pedidos")
      .select(
        "id,nombre_cliente,telefono,direccion_recogida,direccion_entrega,costo_envio,monto_compra,estado,metodo_pago,created_at,motorizado_id,motorizados(nombre,telefono)"
      )
      .order("created_at", { ascending: false });

    if (errorCarga) setError(errorCarga.message);
    else setPedidos((data ?? []) as Pedido[]);

    setCargando(false);
  }

  useEffect(() => {
    void cargar();

    const canal = supabase
      .channel("pedidos-admin-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pedidos",
        },
        () => {
          void cargar();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, []);

  const filtrados = useMemo(
    () =>
      pedidos.filter((pedido) => {
        const termino = busqueda.trim().toLowerCase();
        const coincide =
          !termino ||
          String(pedido.id).includes(termino) ||
          pedido.nombre_cliente.toLowerCase().includes(termino) ||
          pedido.telefono.toLowerCase().includes(termino) ||
          pedido.direccion_recogida.toLowerCase().includes(termino) ||
          pedido.direccion_entrega.toLowerCase().includes(termino);

        return coincide && (filtro === "Todos" || pedido.estado === filtro);
      }),
    [pedidos, busqueda, filtro]
  );

  async function cambiarEstado(pedido: Pedido, nuevoEstado: string) {
    setProcesando(pedido.id);
    setError("");

    const { error: errorActualizacion } = await supabase
      .from("pedidos")
      .update({ estado: nuevoEstado })
      .eq("id", pedido.id);

    if (errorActualizacion) {
      setError(errorActualizacion.message);
    } else {
      setPedidos((actuales) =>
        actuales.map((item) =>
          item.id === pedido.id ? { ...item, estado: nuevoEstado } : item
        )
      );
      setMensaje(`Pedido #${pedido.id} actualizado.`);
      window.setTimeout(() => setMensaje(""), 3000);
    }

    setProcesando(null);
  }

  async function eliminar(pedido: Pedido) {
    if (!window.confirm(`¿Eliminar definitivamente el pedido #${pedido.id}?`)) return;

    setProcesando(pedido.id);
    setError("");

    const { error: errorEliminacion } = await supabase
      .from("pedidos")
      .delete()
      .eq("id", pedido.id);

    if (errorEliminacion) {
      setError(errorEliminacion.message);
    } else {
      setPedidos((actuales) => actuales.filter((item) => item.id !== pedido.id));
      setMensaje(`Pedido #${pedido.id} eliminado.`);
      window.setTimeout(() => setMensaje(""), 3000);
    }

    setProcesando(null);
  }

  function avisarCliente(pedido: Pedido) {
    const url = enlaceWhatsApp(pedido.telefono, mensajeCliente(pedido));
    if (!url) {
      setError("El cliente no tiene un número de teléfono válido.");
      return;
    }
    abrir(url);
  }

  function enviarMotorizado(pedido: Pedido) {
    const motorizado = obtenerMotorizado(pedido.motorizados);
    const url = enlaceWhatsApp(motorizado?.telefono ?? "", mensajeMotorizado(pedido));

    if (!motorizado) {
      setError("Primero debes asignar un motorizado al pedido.");
      return;
    }

    if (!url) {
      setError(`El motorizado ${motorizado.nombre} no tiene un teléfono válido.`);
      return;
    }

    abrir(url);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">Gestión completa</p>
            <h1 className="text-3xl font-black md:text-4xl">📦 Pedidos</h1>
          </div>
          <div className="flex gap-3">
            <Link href="/" className="rounded-xl border border-slate-700 px-5 py-3 font-semibold">
              ← Dashboard
            </Link>
            <Link href="/pedidos/nuevo" className="rounded-xl bg-green-600 px-5 py-3 font-bold">
              + Nuevo pedido
            </Link>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}
        {mensaje && (
          <div className="mb-5 rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-green-300">
            {mensaje}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="grid gap-3 border-b border-slate-800 p-5 md:grid-cols-[1fr_240px_auto]">
            <input
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar por número, cliente, teléfono o dirección"
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-green-500"
            />
            <select
              value={filtro}
              onChange={(evento) => setFiltro(evento.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"
            >
              {estados.map((estado) => (
                <option key={estado}>{estado}</option>
              ))}
            </select>
            <button onClick={() => void cargar()} className="rounded-xl border border-slate-700 px-5 py-3 font-semibold">
              Actualizar
            </button>
          </div>

          {cargando ? (
            <div className="p-10 text-center text-slate-400">Cargando pedidos...</div>
          ) : filtrados.length === 0 ? (
            <div className="p-10 text-center text-slate-400">No hay pedidos para mostrar.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1650px] text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400">
                  <tr>
                    <th className="px-4 py-4">Pedido</th>
                    <th className="px-4 py-4">Cliente</th>
                    <th className="px-4 py-4">Ruta</th>
                    <th className="px-4 py-4">Motorizado</th>
                    <th className="px-4 py-4">Pago</th>
                    <th className="px-4 py-4">Estado</th>
                    <th className="px-4 py-4">Total</th>
                    <th className="px-4 py-4">Fecha</th>
                    <th className="px-4 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((pedido) => {
                    const motorizado = obtenerMotorizado(pedido.motorizados);
                    const total = Number(pedido.costo_envio) + Number(pedido.monto_compra);

                    return (
                      <tr key={pedido.id} className="border-t border-slate-800 align-top hover:bg-slate-800/30">
                        <td className="px-4 py-4 font-bold text-green-400">#{pedido.id}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold">{pedido.nombre_cliente}</p>
                          <p className="text-slate-400">{pedido.telefono}</p>
                        </td>
                        <td className="max-w-80 px-4 py-4 text-slate-300">
                          <p className="truncate">{pedido.direccion_recogida}</p>
                          <p className="mt-1 truncate text-slate-500">→ {pedido.direccion_entrega}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button onClick={() => abrir(mapaLugar(pedido.direccion_recogida))} className="rounded-md border border-blue-500/30 px-2 py-1 text-xs text-blue-300">
                              Recogida
                            </button>
                            <button onClick={() => abrir(mapaLugar(pedido.direccion_entrega))} className="rounded-md border border-blue-500/30 px-2 py-1 text-xs text-blue-300">
                              Entrega
                            </button>
                            <button onClick={() => abrir(mapaRuta(pedido.direccion_recogida, pedido.direccion_entrega))} className="rounded-md border border-violet-500/30 px-2 py-1 text-xs text-violet-300">
                              Ruta completa
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-300">
                          <p>{motorizado?.nombre ?? "Sin asignar"}</p>
                          {motorizado?.telefono && <p className="mt-1 text-xs text-slate-500">{motorizado.telefono}</p>}
                        </td>
                        <td className="px-4 py-4">{pedido.metodo_pago}</td>
                        <td className="px-4 py-4">
                          <select
                            disabled={procesando === pedido.id}
                            value={pedido.estado}
                            onChange={(evento) => void cambiarEstado(pedido, evento.target.value)}
                            className={`rounded-lg border border-slate-700 px-2 py-2 text-xs font-bold ${estilo(pedido.estado)}`}
                          >
                            {estados.slice(1).map((estado) => (
                              <option className="bg-slate-900 text-white" key={estado}>
                                {estado}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-4 font-bold">{dinero(total)}</td>
                        <td className="px-4 py-4 text-slate-400">{fecha(pedido.created_at)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button onClick={() => avisarCliente(pedido)} className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-green-300">
                              WhatsApp cliente
                            </button>
                            <button onClick={() => enviarMotorizado(pedido)} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-emerald-300">
                              Enviar a motorizado
                            </button>
                            <Link href={`/pedidos/${pedido.id}/editar`} className="rounded-lg border border-slate-700 px-3 py-2">
                              Editar
                            </Link>
                            <button disabled={procesando === pedido.id} onClick={() => void eliminar(pedido)} className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-300">
                              Eliminar
                            </button>
                          </div>
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
