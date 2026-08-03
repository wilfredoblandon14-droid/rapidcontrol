"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useState } from "react";
import { supabase } from "../../lib/supabase";

type CampoProps = {
  etiqueta: string;
  children: ReactNode;
};

function Campo({ etiqueta, children }: CampoProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-semibold text-slate-200">{etiqueta}</span>
      {children}
    </label>
  );
}

const estiloCampo =
  "w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 disabled:cursor-not-allowed disabled:opacity-60";

export default function SolicitarPedido() {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [codigo, setCodigo] = useState("");

  async function enviarSolicitud(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formulario = event.currentTarget;
    const datos = new FormData(formulario);

    setGuardando(true);
    setError("");
    setCodigo("");

    const nombre = datos.get("nombre")?.toString().trim() ?? "";
    const telefono = datos.get("telefono")?.toString().trim() ?? "";
    const recogida = datos.get("recogida")?.toString().trim() ?? "";
    const entrega = datos.get("entrega")?.toString().trim() ?? "";
    const descripcion = datos.get("descripcion")?.toString().trim() ?? "";
    const observaciones = datos.get("observaciones")?.toString().trim() ?? "";
    const metodoPago = datos.get("metodo_pago")?.toString() ?? "Efectivo";
    const tipoServicio = datos.get("tipo_servicio")?.toString() ?? "Solo envío";

    if (!nombre || !telefono || !recogida || !entrega) {
      setError("Completa nombre, teléfono, recogida y entrega.");
      setGuardando(false);
      return;
    }

    const { data, error: errorSolicitud } = await supabase.rpc(
      "crear_pedido_publico",
      {
        p_nombre_cliente: nombre,
        p_telefono: telefono,
        p_direccion_recogida: recogida,
        p_direccion_entrega: entrega,
        p_descripcion: descripcion,
        p_observaciones: observaciones,
        p_metodo_pago: metodoPago,
        p_tipo_servicio: tipoServicio,
      }
    );

    if (errorSolicitud) {
      console.error(errorSolicitud);
      setError(`No se pudo enviar la solicitud: ${errorSolicitud.message}`);
      setGuardando(false);
      return;
    }

    const resultado = data as { codigo?: string } | null;
    const codigoGenerado = resultado?.codigo ?? "";

    if (!codigoGenerado) {
      setError("El pedido se creó, pero no se recibió el código de seguimiento.");
      setGuardando(false);
      return;
    }

    formulario.reset();
    setCodigo(codigoGenerado);
    setGuardando(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-green-400">
            Mandados Rapid
          </p>
          <h1 className="mt-3 text-4xl font-black">Solicita tu mandado</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            Completa los datos. Al finalizar recibirás un código para consultar el estado de tu pedido.
          </p>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
            ❌ {error}
          </div>
        )}

        {codigo && (
          <section className="mb-6 rounded-2xl border border-green-500/40 bg-green-500/10 p-6 text-center">
            <p className="font-semibold text-green-200">Pedido recibido correctamente</p>
            <p className="mt-3 text-sm text-slate-300">Tu código de seguimiento es:</p>
            <p className="mt-2 text-4xl font-black tracking-wider text-green-300">{codigo}</p>
            <p className="mt-3 text-sm text-slate-400">Guárdalo para consultar el avance del pedido.</p>
            <Link
              href={`/seguimiento/${encodeURIComponent(codigo)}`}
              className="mt-5 inline-flex rounded-xl bg-green-500 px-6 py-3 font-black text-slate-950 transition hover:bg-green-400"
            >
              Ver seguimiento
            </Link>
          </section>
        )}

        <form
          onSubmit={enviarSolicitud}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-7"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Campo etiqueta="Nombre completo">
              <input name="nombre" required disabled={guardando} className={estiloCampo} placeholder="Tu nombre" />
            </Campo>

            <Campo etiqueta="Teléfono">
              <input name="telefono" required disabled={guardando} className={estiloCampo} placeholder="Número de contacto" inputMode="tel" />
            </Campo>

            <div className="sm:col-span-2">
              <Campo etiqueta="Dirección de recogida">
                <textarea name="recogida" required disabled={guardando} className={`${estiloCampo} min-h-24`} placeholder="¿Dónde debemos recoger?" />
              </Campo>
            </div>

            <div className="sm:col-span-2">
              <Campo etiqueta="Dirección de entrega">
                <textarea name="entrega" required disabled={guardando} className={`${estiloCampo} min-h-24`} placeholder="¿Dónde debemos entregar?" />
              </Campo>
            </div>

            <Campo etiqueta="Tipo de servicio">
              <select name="tipo_servicio" disabled={guardando} className={estiloCampo} defaultValue="Solo envío">
                <option>Solo envío</option>
                <option>Compra y envío</option>
                <option>Trámite</option>
              </select>
            </Campo>

            <Campo etiqueta="Método de pago">
              <select name="metodo_pago" disabled={guardando} className={estiloCampo} defaultValue="Efectivo">
                <option>Efectivo</option>
                <option>Transferencia</option>
              </select>
            </Campo>

            <div className="sm:col-span-2">
              <Campo etiqueta="Descripción del pedido">
                <textarea name="descripcion" disabled={guardando} className={`${estiloCampo} min-h-28`} placeholder="Qué debemos comprar, recoger o entregar" />
              </Campo>
            </div>

            <div className="sm:col-span-2">
              <Campo etiqueta="Observaciones">
                <textarea name="observaciones" disabled={guardando} className={`${estiloCampo} min-h-24`} placeholder="Referencias, indicaciones o detalles adicionales" />
              </Campo>
            </div>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="mt-6 w-full rounded-xl bg-green-500 px-6 py-4 text-lg font-black text-slate-950 transition hover:bg-green-400 disabled:cursor-wait disabled:opacity-60"
          >
            {guardando ? "Enviando solicitud..." : "Solicitar mandado"}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
          <Link href="/rastrear" className="font-semibold text-green-300 hover:text-green-200">
            Ya tengo un código: rastrear pedido
          </Link>
          <Link href="/login" className="text-slate-400 hover:text-slate-200">
            Acceso del personal
          </Link>
        </div>
      </div>
    </main>
  );
}
