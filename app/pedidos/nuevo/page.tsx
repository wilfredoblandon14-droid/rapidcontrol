"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Motorizado = {
  id: number;
  nombre: string;
};

type Cliente = {
  id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  referencia: string | null;
};

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

export default function NuevoPedido() {
  const router = useRouter();

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [clienteId, setClienteId] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [referenciaEntrega, setReferenciaEntrega] = useState("");

  useEffect(() => {
    async function cargarDatos() {
      setCargandoDatos(true);
      setError("");

      const [respuestaClientes, respuestaMotorizados] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, nombre, telefono, direccion, referencia")
          .order("nombre", { ascending: true }),

        supabase
          .from("motorizados")
          .select("id, nombre")
          .order("nombre", { ascending: true }),
      ]);

      if (respuestaClientes.error) {
        console.error(respuestaClientes.error);
        setError(
          `No se pudieron cargar los clientes: ${respuestaClientes.error.message}`
        );
        setCargandoDatos(false);
        return;
      }

      if (respuestaMotorizados.error) {
        console.error(respuestaMotorizados.error);
        setError(
          `No se pudieron cargar los motorizados: ${respuestaMotorizados.error.message}`
        );
        setCargandoDatos(false);
        return;
      }

      setClientes((respuestaClientes.data ?? []) as Cliente[]);
      setMotorizados((respuestaMotorizados.data ?? []) as Motorizado[]);
      setCargandoDatos(false);
    }

    void cargarDatos();
  }, []);

  function seleccionarCliente(idSeleccionado: string) {
    setClienteId(idSeleccionado);

    if (!idSeleccionado) {
      setNombreCliente("");
      setTelefono("");
      setDireccionEntrega("");
      setReferenciaEntrega("");
      return;
    }

    const clienteSeleccionado = clientes.find(
      (cliente) => cliente.id === Number(idSeleccionado)
    );

    if (!clienteSeleccionado) {
      return;
    }

    setNombreCliente(clienteSeleccionado.nombre);
    setTelefono(clienteSeleccionado.telefono);
    setDireccionEntrega(clienteSeleccionado.direccion);
    setReferenciaEntrega(clienteSeleccionado.referencia ?? "");
  }

  async function guardarPedido(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formularioElemento = event.currentTarget;
    const formulario = new FormData(formularioElemento);

    setGuardando(true);
    setMensaje("");
    setError("");

    const motorizadoSeleccionado = formulario
      .get("motorizado_id")
      ?.toString();

    const observacionesGenerales =
      formulario.get("observaciones")?.toString().trim() ?? "";

    const observacionesCompletas = [
      referenciaEntrega.trim()
        ? `Referencia de entrega: ${referenciaEntrega.trim()}`
        : "",
      observacionesGenerales,
    ]
      .filter(Boolean)
      .join("\n");

    const nuevoPedido = {
      cliente_id: clienteId ? Number(clienteId) : null,

      nombre_cliente: nombreCliente.trim(),

      telefono: telefono.trim(),

      tipo_servicio:
        formulario.get("tipo_servicio")?.toString() ?? "Solo envío",

      metodo_pago:
        formulario.get("metodo_pago")?.toString() ?? "Efectivo",

      direccion_recogida:
        formulario.get("direccion_recogida")?.toString().trim() ?? "",

      direccion_entrega: direccionEntrega.trim(),

      costo_envio: Number(formulario.get("costo_envio") ?? 0),

      monto_compra: Number(formulario.get("monto_compra") ?? 0),

      motorizado_id:
        motorizadoSeleccionado && motorizadoSeleccionado !== ""
          ? Number(motorizadoSeleccionado)
          : null,

      estado: formulario.get("estado")?.toString() ?? "Pendiente",

      descripcion:
        formulario.get("descripcion")?.toString().trim() ?? "",

      observaciones: observacionesCompletas,
    };

    if (
      !nuevoPedido.nombre_cliente ||
      !nuevoPedido.telefono ||
      !nuevoPedido.direccion_recogida ||
      !nuevoPedido.direccion_entrega
    ) {
      setError(
        "Completa el nombre, teléfono, dirección de recogida y dirección de entrega."
      );
      setGuardando(false);
      return;
    }

    const { error: errorSupabase } = await supabase
      .from("pedidos")
      .insert(nuevoPedido);

    if (errorSupabase) {
      console.error(errorSupabase);
      setError(`No se pudo guardar el pedido: ${errorSupabase.message}`);
      setGuardando(false);
      return;
    }

    formularioElemento.reset();

    setClienteId("");
    setNombreCliente("");
    setTelefono("");
    setDireccionEntrega("");
    setReferenciaEntrega("");

    setMensaje("Pedido guardado correctamente.");
    setGuardando(false);

    window.setTimeout(() => {
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
            className="w-fit rounded-xl border border-slate-700 px-5 py-3 font-semibold transition hover:bg-slate-800"
          >
            ← Volver a pedidos
          </Link>
        </header>

        <form
          onSubmit={guardarPedido}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl md:p-8"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <Campo etiqueta="Cliente guardado">
                <select
                  value={clienteId}
                  onChange={(event) => seleccionarCliente(event.target.value)}
                  disabled={guardando || cargandoDatos}
                  className={estiloCampo}
                >
                  <option value="">
                    {cargandoDatos
                      ? "Cargando clientes..."
                      : "Cliente nuevo / escribir manualmente"}
                  </option>

                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre} — {cliente.telefono}
                    </option>
                  ))}
                </select>
              </Campo>

              <p className="mt-2 text-sm text-slate-500">
                Al seleccionar un cliente se completan sus datos. Puedes cambiar
                la dirección para este pedido sin modificar la ficha del cliente.
              </p>
            </div>

            <Campo etiqueta="Nombre del cliente">
              <input
                type="text"
                name="nombre_cliente"
                required
                value={nombreCliente}
                onChange={(event) => setNombreCliente(event.target.value)}
                disabled={guardando}
                className={estiloCampo}
                placeholder="Ejemplo: Juan Pérez"
              />
            </Campo>

            <Campo etiqueta="Teléfono">
              <input
                type="tel"
                name="telefono"
                required
                value={telefono}
                onChange={(event) => setTelefono(event.target.value)}
                disabled={guardando}
                className={estiloCampo}
                placeholder="Ejemplo: 8888 8888"
              />
            </Campo>

            <Campo etiqueta="Tipo de servicio">
              <select
                name="tipo_servicio"
                defaultValue="Solo envío"
                disabled={guardando}
                className={estiloCampo}
              >
                <option value="Solo envío">Solo envío</option>
                <option value="Compra y envío">Compra y envío</option>
                <option value="Mandado">Mandado</option>
              </select>
            </Campo>

            <Campo etiqueta="Método de pago">
              <select
                name="metodo_pago"
                defaultValue="Efectivo"
                disabled={guardando}
                className={estiloCampo}
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Tarjeta">Tarjeta</option>
              </select>
            </Campo>

            <div className="md:col-span-2">
              <Campo etiqueta="Dirección de recogida">
                <input
                  type="text"
                  name="direccion_recogida"
                  required
                  disabled={guardando}
                  className={estiloCampo}
                  placeholder="Lugar donde se recogerá el pedido"
                />
              </Campo>
            </div>

            <div className="md:col-span-2">
              <Campo etiqueta="Dirección de entrega">
                <textarea
                  name="direccion_entrega"
                  required
                  rows={3}
                  value={direccionEntrega}
                  onChange={(event) =>
                    setDireccionEntrega(event.target.value)
                  }
                  disabled={guardando}
                  className={estiloCampo}
                  placeholder="Lugar donde se entregará el pedido"
                />
              </Campo>

              {clienteId && (
                <p className="mt-2 text-sm text-amber-300">
                  Puedes editar esta dirección. El cambio solo afectará este
                  pedido.
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <Campo etiqueta="Referencia de entrega">
                <textarea
                  name="referencia_entrega"
                  rows={2}
                  value={referenciaEntrega}
                  onChange={(event) =>
                    setReferenciaEntrega(event.target.value)
                  }
                  disabled={guardando}
                  className={estiloCampo}
                  placeholder="Ejemplo: casa azul, frente al parque"
                />
              </Campo>
            </div>

            <Campo etiqueta="Costo del envío">
              <input
                type="number"
                name="costo_envio"
                min="0"
                step="0.01"
                required
                disabled={guardando}
                className={estiloCampo}
                placeholder="Ejemplo: 50"
              />
            </Campo>

            <Campo etiqueta="Monto de la compra">
              <input
                type="number"
                name="monto_compra"
                min="0"
                step="0.01"
                defaultValue="0"
                disabled={guardando}
                className={estiloCampo}
                placeholder="Ejemplo: 350"
              />
            </Campo>

            <Campo etiqueta="Motorizado">
              <select
                name="motorizado_id"
                defaultValue=""
                disabled={guardando || cargandoDatos}
                className={estiloCampo}
              >
                <option value="">
                  {cargandoDatos
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
              <select
                name="estado"
                defaultValue="Pendiente"
                disabled={guardando}
                className={estiloCampo}
              >
                <option value="Pendiente">Pendiente</option>
                <option value="Asignado">Asignado</option>
                <option value="En camino">En camino</option>
                <option value="Entregado">Entregado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </Campo>

            <div className="md:col-span-2">
              <Campo etiqueta="Descripción del pedido">
                <textarea
                  name="descripcion"
                  rows={4}
                  disabled={guardando}
                  className={estiloCampo}
                  placeholder="Describe lo que debe comprar o transportar"
                />
              </Campo>
            </div>

            <div className="md:col-span-2">
              <Campo etiqueta="Observaciones">
                <textarea
                  name="observaciones"
                  rows={4}
                  disabled={guardando}
                  className={estiloCampo}
                  placeholder="Indicaciones adicionales"
                />
              </Campo>
            </div>
          </div>

          {error && (
            <div className="mt-8 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
              ❌ {error}
            </div>
          )}

          {mensaje && (
            <div className="mt-8 rounded-xl border border-green-500/40 bg-green-500/10 px-5 py-4 text-green-300">
              ✅ {mensaje}
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/pedidos"
              className="rounded-xl border border-slate-700 px-6 py-3 text-center font-bold transition hover:bg-slate-800"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={guardando}
              className="rounded-xl bg-green-600 px-8 py-3 font-bold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? "Guardando..." : "Guardar pedido"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}