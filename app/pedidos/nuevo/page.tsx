"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Motorizado = {
  id: number;
  nombre: string;
};

export default function NuevoPedido() {
  const router = useRouter();

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [cargandoMotorizados, setCargandoMotorizados] = useState(true);

  useEffect(() => {
    async function cargarMotorizados() {
      setCargandoMotorizados(true);

      const { data, error: errorMotorizados } = await supabase
        .from("motorizados")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (errorMotorizados) {
        console.error(errorMotorizados);
        setError(
          `No se pudieron cargar los motorizados: ${errorMotorizados.message}`
        );
        setCargandoMotorizados(false);
        return;
      }

      setMotorizados(data ?? []);
      setCargandoMotorizados(false);
    }

    cargarMotorizados();
  }, []);

  async function guardarPedido(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setGuardando(true);
    setMensaje("");
    setError("");

    const formulario = new FormData(event.currentTarget);
    const motorizadoSeleccionado = formulario.get("motorizado_id");

    const nuevoPedido = {
      nombre_cliente:
        formulario.get("nombre_cliente")?.toString().trim() ?? "",
      telefono: formulario.get("telefono")?.toString().trim() ?? "",
      tipo_servicio:
        formulario.get("tipo_servicio")?.toString() ?? "Solo envío",
      metodo_pago:
        formulario.get("metodo_pago")?.toString() ?? "Efectivo",
      direccion_recogida:
        formulario.get("direccion_recogida")?.toString().trim() ?? "",
      direccion_entrega:
        formulario.get("direccion_entrega")?.toString().trim() ?? "",
      costo_envio: Number(formulario.get("costo_envio") ?? 0),
      monto_compra: Number(formulario.get("monto_compra") ?? 0),
      motorizado_id:
        motorizadoSeleccionado &&
        motorizadoSeleccionado.toString() !== ""
          ? Number(motorizadoSeleccionado)
          : null,
      estado: formulario.get("estado")?.toString() ?? "Pendiente",
      descripcion:
        formulario.get("descripcion")?.toString().trim() ?? "",
      observaciones:
        formulario.get("observaciones")?.toString().trim() ?? "",
    };

    const { error: errorSupabase } = await supabase
      .from("pedidos")
      .insert(nuevoPedido);

    if (errorSupabase) {
      console.error(errorSupabase);
      setError(`No se pudo guardar el pedido: ${errorSupabase.message}`);
      setGuardando(false);
      return;
    }

    setMensaje("Pedido guardado correctamente.");
    setGuardando(false);

    event.currentTarget.reset();

    setTimeout(() => {
      router.push("/pedidos");
      router.refresh();
    }, 1200);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">Registro de pedidos</p>
            <h1 className="text-3xl font-black md:text-4xl">
              📦 Nuevo pedido
            </h1>
          </div>

          <Link
            href="/pedidos"
            className="w-fit rounded-xl border border-slate-700 px-5 py-3 font-semibold hover:bg-slate-800"
          >
            ← Volver a pedidos
          </Link>
        </header>

        <form
          onSubmit={guardarPedido}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-8"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <Campo etiqueta="Nombre del cliente">
              <input
                name="nombre_cliente"
                required
                className="campo"
                placeholder="Ejemplo: Juan Pérez"
              />
            </Campo>

            <Campo etiqueta="Teléfono">
              <input
                name="telefono"
                type="tel"
                required
                className="campo"
                placeholder="Ejemplo: 8888-8888"
              />
            </Campo>

            <Campo etiqueta="Tipo de servicio">
              <select name="tipo_servicio" className="campo">
                <option value="Solo envío">Solo envío</option>
                <option value="Compra por cuenta del cliente">
                  Compra por cuenta del cliente
                </option>
                <option value="Retiro y entrega">Retiro y entrega</option>
                <option value="Otro mandado">Otro mandado</option>
              </select>
            </Campo>

            <Campo etiqueta="Método de pago">
              <select name="metodo_pago" className="campo">
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Pago pendiente">Pago pendiente</option>
              </select>
            </Campo>

            <div className="md:col-span-2">
              <Campo etiqueta="Dirección de recogida">
                <input
                  name="direccion_recogida"
                  required
                  className="campo"
                  placeholder="Lugar donde se recogerá el pedido"
                />
              </Campo>
            </div>

            <div className="md:col-span-2">
              <Campo etiqueta="Dirección de entrega">
                <input
                  name="direccion_entrega"
                  required
                  className="campo"
                  placeholder="Lugar donde se entregará el pedido"
                />
              </Campo>
            </div>

            <Campo etiqueta="Costo del envío">
              <input
                name="costo_envio"
                type="number"
                min="0"
                step="0.01"
                required
                className="campo"
                placeholder="C$ 0.00"
              />
            </Campo>

            <Campo etiqueta="Monto de la compra">
              <input
                name="monto_compra"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                className="campo"
                placeholder="C$ 0.00"
              />
            </Campo>

            <Campo etiqueta="Motorizado">
              <select
                name="motorizado_id"
                className="campo"
                disabled={cargandoMotorizados}
                defaultValue=""
              >
                <option value="">
                  {cargandoMotorizados
                    ? "Cargando motorizados..."
                    : "Sin asignar"}
                </option>

                {motorizados.map((motorizado) => (
                  <option key={motorizado.id} value={motorizado.id}>
                    {motorizado.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo etiqueta="Estado inicial">
              <select name="estado" className="campo">
                <option value="Pendiente">Pendiente</option>
                <option value="Asignado">Asignado</option>
                <option value="En camino">En camino</option>
              </select>
            </Campo>

            <div className="md:col-span-2">
              <Campo etiqueta="Descripción del pedido">
                <textarea
                  name="descripcion"
                  rows={3}
                  className="campo"
                  placeholder="Ejemplo: Comprar medicamentos"
                />
              </Campo>
            </div>

            <div className="md:col-span-2">
              <Campo etiqueta="Observaciones">
                <textarea
                  name="observaciones"
                  rows={3}
                  className="campo"
                  placeholder="Indicaciones adicionales"
                />
              </Campo>
            </div>
          </div>

          {mensaje && (
            <p className="mt-6 rounded-xl border border-green-900 bg-green-950/50 p-4 text-green-300">
              ✅ {mensaje}
            </p>
          )}

          {error && (
            <p className="mt-6 rounded-xl border border-red-900 bg-red-950/50 p-4 text-red-300">
              ❌ {error}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/pedidos"
              className="rounded-xl border border-slate-700 px-6 py-4 text-center font-bold hover:bg-slate-800"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={guardando || cargandoMotorizados}
              className="rounded-xl bg-green-600 px-8 py-4 text-lg font-bold hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar pedido"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-300">
        {etiqueta}
      </span>
      {children}
    </label>
  );
}