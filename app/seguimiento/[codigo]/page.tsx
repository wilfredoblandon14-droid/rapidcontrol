"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type EstadoPedido = "Pendiente" | "Asignado" | "Recogido" | "En camino" | "Entregado" | "Cancelado";

type Seguimiento = {
  codigo: string;
  pedido_id: number;
  nombre_cliente: string;
  direccion_recogida: string;
  direccion_entrega: string;
  estado: EstadoPedido;
  costo_envio: number;
  monto_compra: number;
  metodo_pago: string;
  created_at: string;
  motorizado_nombre: string | null;
  motorizado_telefono: string | null;
  motorizado_latitud: number | null;
  motorizado_longitud: number | null;
  ubicacion_actualizada: string | null;
};

const pasos: EstadoPedido[] = ["Pendiente", "Asignado", "Recogido", "En camino", "Entregado"];

function dinero(valor: number) {
  return new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" }).format(valor);
}

function telefonoWhatsApp(telefono: string) {
  const limpio = telefono.replace(/\D/g, "");
  return limpio.startsWith("505") ? limpio : `505${limpio}`;
}

export default function SeguimientoPedido() {
  const params = useParams<{ codigo: string }>();
  const codigo = decodeURIComponent(params.codigo ?? "").toUpperCase();
  const [datos, setDatos] = useState<Seguimiento | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargar() {
  setCargando(true);
  setError("");

  const { data, error: errorConsulta } = await supabase.rpc("rastrear_pedido_publico", {
    p_codigo: codigo,
  });

  if (errorConsulta) {
    console.error(errorConsulta);
    setError("No se pudo consultar el pedido. Intenta nuevamente.");
    setCargando(false);
    return;
  }

  if (!data) {
    setError("No encontramos un pedido con ese código.");
    setCargando(false);
    return;
  }

  setDatos(data as Seguimiento);
  setCargando(false);
}

  useEffect(() => {
    if (!codigo) return;

    void cargar();

    const canal = supabase
      .channel(`seguimiento-${codigo}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos" },
        () => void cargar()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ubicaciones_motorizados" },
        () => void cargar()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [codigo]);

  const indiceActual = useMemo(() => {
    if (!datos) return 0;
    const indice = pasos.indexOf(datos.estado);
    return indice >= 0 ? indice : 0;
  }, [datos]);

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <header className="mb-7 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-green-400">Mandados Rapid</p>
          <h1 className="mt-2 text-3xl font-black">Seguimiento del pedido</h1>
          <p className="mt-2 font-mono text-lg font-bold text-slate-300">{codigo}</p>
        </header>

        {cargando && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center text-slate-400">
            Consultando pedido...
          </div>
        )}

        {error && (
          <section className="rounded-2xl border border-red-500/40 bg-red-500/10 p-7 text-center">
            <p className="font-bold text-red-300">{error}</p>
            <Link href="/rastrear" className="mt-5 inline-flex rounded-xl border border-slate-700 px-5 py-3 font-semibold hover:bg-slate-800">
              Intentar con otro código
            </Link>
          </section>
        )}

        {!cargando && datos && (
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">Pedido #{datos.pedido_id}</p>
                  <p className="mt-1 text-2xl font-black">Hola, {datos.nombre_cliente}</p>
                </div>
                <span className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 font-bold text-green-300">
                  {datos.estado}
                </span>
              </div>

              {datos.estado === "Cancelado" ? (
                <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">
                  Este pedido fue cancelado.
                </div>
              ) : (
                <div className="mt-7 grid grid-cols-5 gap-2">
                  {pasos.map((paso, indice) => {
                    const activo = indice <= indiceActual;
                    return (
                      <div key={paso} className="text-center">
                        <div className={`mx-auto h-2 rounded-full ${activo ? "bg-green-500" : "bg-slate-700"}`} />
                        <p className={`mt-2 text-[10px] font-bold sm:text-xs ${activo ? "text-green-300" : "text-slate-500"}`}>
                          {paso}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm font-semibold text-slate-400">📦 Recogida</p>
                <p className="mt-2 font-bold">{datos.direccion_recogida}</p>
              </article>
              <article className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
                <p className="text-sm font-semibold text-green-300">🏁 Entrega</p>
                <p className="mt-2 font-bold">{datos.direccion_entrega}</p>
              </article>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">Método de pago</p>
                  <p className="mt-1 font-bold">{datos.metodo_pago}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Total estimado</p>
                  <p className="mt-1 text-2xl font-black">
                    {dinero(Number(datos.costo_envio ?? 0) + Number(datos.monto_compra ?? 0))}
                  </p>
                </div>
              </div>
            </section>

            {datos.estado === "En camino" && datos.motorizado_latitud != null && datos.motorizado_longitud != null && (
              <section className="overflow-hidden rounded-2xl border border-green-500/30 bg-slate-900">
                <div className="border-b border-slate-800 p-5">
                  <p className="text-sm text-green-300">📍 Motorizado en camino</p>
                  <p className="mt-1 font-bold">Ubicación aproximada compartida durante la jornada.</p>
                  {datos.ubicacion_actualizada && (
                    <p className="mt-1 text-xs text-slate-500">
                      Última actualización: {new Date(datos.ubicacion_actualizada).toLocaleString("es-NI")}
                    </p>
                  )}
                </div>
                <iframe
                  title="Ubicación del motorizado"
                  src={`https://maps.google.com/maps?q=${datos.motorizado_latitud},${datos.motorizado_longitud}&z=15&output=embed`}
                  className="h-72 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </section>
            )}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Motorizado asignado</p>
              <p className="mt-2 text-xl font-black">{datos.motorizado_nombre ?? "Pendiente de asignación"}</p>

              {datos.motorizado_telefono && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <a href={`tel:${datos.motorizado_telefono.replace(/\D/g, "")}`} className="rounded-xl border border-green-500/40 bg-green-500/10 px-5 py-3 text-center font-bold text-green-300">
                    📞 Llamar
                  </a>
                  <a
                    href={`https://wa.me/${telefonoWhatsApp(datos.motorizado_telefono)}?text=${encodeURIComponent(`Hola, consulto por el pedido ${datos.codigo}.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 text-center font-bold text-emerald-300"
                  >
                    💬 WhatsApp
                  </a>
                </div>
              )}
            </section>

            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <button onClick={() => window.location.reload()} className="rounded-xl border border-slate-700 px-5 py-3 font-semibold hover:bg-slate-800">
                🔄 Actualizar estado
              </button>
              <Link href="/rastrear" className="rounded-xl border border-slate-700 px-5 py-3 font-semibold hover:bg-slate-800">
                Buscar otro pedido
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
