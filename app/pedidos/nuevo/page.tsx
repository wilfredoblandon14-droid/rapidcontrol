"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type ResultadoIA = {
  nombre_cliente: string;
  telefono: string;
  direccion_recogida: string;
  direccion_entrega: string;
  descripcion: string;
  observaciones: string;
  metodo_pago: "" | "Efectivo" | "Transferencia" | "Tarjeta";
  tipo_servicio: "" | "Solo envío" | "Compra y envío" | "Mandado";
  confianza: number;
  campos_por_confirmar: string[];
};

type PedidoCreado = {
  id: number;
  codigo: string;
  nombre_cliente: string;
  telefono: string;
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
  const searchParams = useSearchParams();

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [enviarSeguimiento, setEnviarSeguimiento] = useState(false);
  const [pedidoCreado, setPedidoCreado] = useState<PedidoCreado | null>(null);
  const [copiado, setCopiado] = useState(false);

  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [clienteId, setClienteId] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [referenciaEntrega, setReferenciaEntrega] = useState("");
  const [mensajeWhatsApp, setMensajeWhatsApp] = useState("");
  const [descripcionWhatsApp, setDescripcionWhatsApp] = useState("");
  const [origenPedido, setOrigenPedido] = useState("WhatsApp");
  const [analizandoIA, setAnalizandoIA] = useState(false);
  const [resultadoIA, setResultadoIA] = useState<ResultadoIA | null>(null);
  const [direccionRecogida, setDireccionRecogida] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [tipoServicio, setTipoServicio] = useState("Solo envío");

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

  useEffect(() => {
    const clienteDesdeExpediente = searchParams.get("cliente");

    if (
      !clienteDesdeExpediente ||
      clientes.length === 0 ||
      clienteId
    ) {
      return;
    }

    const clienteSeleccionado = clientes.find(
      (cliente) => cliente.id === Number(clienteDesdeExpediente)
    );

    if (!clienteSeleccionado) {
      return;
    }

    setClienteId(String(clienteSeleccionado.id));
    setNombreCliente(clienteSeleccionado.nombre);
    setTelefono(clienteSeleccionado.telefono);
    setDireccionEntrega(clienteSeleccionado.direccion);
    setReferenciaEntrega(clienteSeleccionado.referencia ?? "");
    setMensaje(
      `Datos de ${clienteSeleccionado.nombre} cargados desde su expediente.`
    );
  }, [clienteId, clientes, searchParams]);

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

  async function procesarMensajeWhatsApp() {
    const texto = mensajeWhatsApp.trim();

    if (!texto) {
      setError("Pega primero el mensaje recibido por WhatsApp.");
      return;
    }

    setAnalizandoIA(true);
    setError("");
    setMensaje("");
    setResultadoIA(null);

    try {
      const respuesta = await fetch("/api/ia/analizar-pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: texto }),
      });

      const contenido = (await respuesta.json()) as {
        datos?: ResultadoIA;
        error?: string;
      };

      if (!respuesta.ok || !contenido.datos) {
        throw new Error(contenido.error ?? "No se pudo analizar el mensaje.");
      }

      const datos = contenido.datos;
      setResultadoIA(datos);

      if (datos.nombre_cliente) setNombreCliente(datos.nombre_cliente);
      if (datos.telefono) setTelefono(datos.telefono.replace(/\D/g, ""));
      if (datos.direccion_recogida) setDireccionRecogida(datos.direccion_recogida);
      if (datos.direccion_entrega) setDireccionEntrega(datos.direccion_entrega);
      if (datos.descripcion) setDescripcionWhatsApp(datos.descripcion);
      if (datos.observaciones) setObservaciones(datos.observaciones);
      if (datos.metodo_pago) setMetodoPago(datos.metodo_pago);
      if (datos.tipo_servicio) setTipoServicio(datos.tipo_servicio);

      setOrigenPedido("WhatsApp");

      const telefonoIA = datos.telefono.replace(/\D/g, "");
      const clienteExistente = clientes.find(
        (cliente) =>
          telefonoIA.length >= 8 &&
          cliente.telefono.replace(/\D/g, "").endsWith(telefonoIA.slice(-8))
      );

      if (clienteExistente) {
        setClienteId(String(clienteExistente.id));
        if (!datos.nombre_cliente) setNombreCliente(clienteExistente.nombre);
        if (!datos.direccion_entrega) setDireccionEntrega(clienteExistente.direccion);
        if (!datos.observaciones && clienteExistente.referencia) {
          setReferenciaEntrega(clienteExistente.referencia);
        }
        setMensaje(
          `IA completó el formulario y encontró al cliente guardado: ${clienteExistente.nombre}. Revisa todo antes de guardar.`
        );
      } else {
        setMensaje("IA completó los datos detectados. Revisa y confirma todo antes de guardar.");
      }
    } catch (errorAnalisis) {
      setError(
        errorAnalisis instanceof Error
          ? errorAnalisis.message
          : "No se pudo analizar el mensaje."
      );
    } finally {
      setAnalizandoIA(false);
    }
  }

  function crearEnlaceSeguimiento(codigo: string) {
    return `${window.location.origin}/seguimiento/${encodeURIComponent(codigo)}`;
  }

  function limpiarTelefonoWhatsApp(valor: string) {
    const limpio = valor.replace(/\D/g, "");
    if (!limpio) return "";
    return limpio.startsWith("505") ? limpio : `505${limpio}`;
  }

  function crearMensajeSeguimiento(pedido: PedidoCreado) {
    return [
      `Hola ${pedido.nombre_cliente} 👋`,
      "",
      "Tu pedido fue registrado correctamente en Mandados Rapid.",
      `📦 Pedido: #${pedido.id}`,
      `🔑 Código de seguimiento: ${pedido.codigo}`,
      "",
      "Puedes consultar el estado aquí:",
      crearEnlaceSeguimiento(pedido.codigo),
      "",
      "Gracias por preferir Mandados Rapid 🚀",
    ].join("\n");
  }

  function abrirWhatsAppSeguimiento(pedido: PedidoCreado) {
    const numero = limpiarTelefonoWhatsApp(pedido.telefono);
    if (!numero) {
      setError("El cliente no tiene un teléfono válido para WhatsApp.");
      return;
    }

    const url = `https://wa.me/${numero}?text=${encodeURIComponent(
      crearMensajeSeguimiento(pedido)
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copiarEnlaceSeguimiento(pedido: PedidoCreado) {
    try {
      await navigator.clipboard.writeText(crearEnlaceSeguimiento(pedido.codigo));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setError("No se pudo copiar el enlace. Puedes copiarlo manualmente.");
    }
  }

  async function guardarPedido(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formularioElemento = event.currentTarget;
    const formulario = new FormData(formularioElemento);

    setGuardando(true);
    setMensaje("");
    setError("");
    setPedidoCreado(null);

    const motorizadoSeleccionado = formulario
      .get("motorizado_id")
      ?.toString();

    const observacionesGenerales = observaciones.trim();

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

      tipo_servicio: tipoServicio,

      metodo_pago: metodoPago,

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
      origen_pedido: origenPedido,
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

    const { data: pedidoInsertado, error: errorSupabase } = await supabase
      .from("pedidos")
      .insert(nuevoPedido)
      .select("id, codigo, nombre_cliente, telefono")
      .single();

    if (errorSupabase) {
      console.error(errorSupabase);
      setError(`No se pudo guardar el pedido: ${errorSupabase.message}`);
      setGuardando(false);
      return;
    }

    const creado = pedidoInsertado as PedidoCreado | null;
    if (!creado?.codigo) {
      setError("El pedido se guardó, pero no se generó el código de seguimiento.");
      setGuardando(false);
      return;
    }

    formularioElemento.reset();
    setClienteId("");
    setNombreCliente("");
    setTelefono("");
    setDireccionEntrega("");
    setReferenciaEntrega("");
    setDireccionRecogida("");
    setObservaciones("");
    setMetodoPago("Efectivo");
    setTipoServicio("Solo envío");
    setMensajeWhatsApp("");
    setResultadoIA(null);
    setPedidoCreado(creado);
    setMensaje("Pedido guardado correctamente.");
    setGuardando(false);

    if (enviarSeguimiento) {
      abrirWhatsAppSeguimiento(creado);
    }
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

        <section className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-emerald-300">RapidControl IA</p>
              <h2 className="mt-1 text-xl font-black">🤖 Rellenar desde WhatsApp</h2>
              <p className="mt-1 text-sm text-slate-400">Pega el mensaje. La IA rellenará únicamente los datos que detecte; la recepcionista siempre confirma antes de guardar.</p>
            </div>
            <button type="button" disabled={analizandoIA} onClick={() => void procesarMensajeWhatsApp()} className="rounded-xl bg-emerald-600 px-5 py-3 font-black transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60">{analizandoIA ? "Analizando…" : "🤖 Analizar con IA"}</button>
          </div>
          <textarea value={mensajeWhatsApp} onChange={(e)=>setMensajeWhatsApp(e.target.value)} rows={5} className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Ejemplo: Hola, soy María. Necesito comprar medicina en Farmacia X y llevarla a Villa Fontana. Mi teléfono es 8888-8888." />

          {resultadoIA && (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-bold text-slate-200">Resultado del análisis</p>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-black text-emerald-300">
                  Confianza: {resultadoIA.confianza}%
                </span>
              </div>

              {resultadoIA.campos_por_confirmar.length > 0 ? (
                <p className="mt-3 text-sm text-amber-300">
                  ⚠️ Confirma: {resultadoIA.campos_por_confirmar.join(", ")}.
                </p>
              ) : (
                <p className="mt-3 text-sm text-emerald-300">
                  ✅ La IA encontró los campos principales. Aun así, revísalos antes de guardar.
                </p>
              )}
            </div>
          )}
        </section>

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

            <Campo etiqueta="Origen del pedido">
              <select value={origenPedido} onChange={(event)=>setOrigenPedido(event.target.value)} disabled={guardando} className={estiloCampo}>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Llamada">Llamada</option>
                <option value="Presencial">Presencial</option>
                <option value="Portal web">Portal web</option>
                <option value="Facebook">Facebook</option>
                <option value="Instagram">Instagram</option>
                <option value="Otro">Otro</option>
              </select>
            </Campo>

            <Campo etiqueta="Tipo de servicio">
              <select
                name="tipo_servicio"
                value={tipoServicio}
                onChange={(event) => setTipoServicio(event.target.value)}
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
                value={metodoPago}
                onChange={(event) => setMetodoPago(event.target.value)}
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
                  value={direccionRecogida}
                  onChange={(event) => setDireccionRecogida(event.target.value)}
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
                  value={descripcionWhatsApp}
                  onChange={(event) => setDescripcionWhatsApp(event.target.value)}
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
                  value={observaciones}
                  onChange={(event) => setObservaciones(event.target.value)}
                  disabled={guardando}
                  className={estiloCampo}
                  placeholder="Indicaciones adicionales"
                />
              </Campo>
            </div>
          </div>

          <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
            <input
              type="checkbox"
              checked={enviarSeguimiento}
              onChange={(event) => setEnviarSeguimiento(event.target.checked)}
              disabled={guardando}
              className="mt-1 h-5 w-5 accent-green-500"
            />
            <span>
              <span className="block font-bold text-slate-200">
                Enviar seguimiento por WhatsApp al guardar
              </span>
              <span className="mt-1 block text-sm text-slate-400">
                Es opcional y está desmarcado por defecto. Puedes enviarlo después desde la lista de pedidos.
              </span>
            </span>
          </label>

          {pedidoCreado && (
            <section className="mt-8 rounded-2xl border border-green-500/40 bg-green-500/10 p-6">
              <p className="font-bold text-green-200">✅ Pedido creado correctamente</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-950/40 p-4">
                  <p className="text-sm text-slate-400">Pedido</p>
                  <p className="mt-1 text-2xl font-black">#{pedidoCreado.id}</p>
                </div>
                <div className="rounded-xl bg-slate-950/40 p-4">
                  <p className="text-sm text-slate-400">Código de seguimiento</p>
                  <p className="mt-1 font-mono text-2xl font-black text-green-300">
                    {pedidoCreado.codigo}
                  </p>
                </div>
              </div>
              <p className="mt-4 break-all text-sm text-slate-300">
                {crearEnlaceSeguimiento(pedidoCreado.codigo)}
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => abrirWhatsAppSeguimiento(pedidoCreado)}
                  className="rounded-xl bg-green-500 px-5 py-3 font-black text-slate-950 hover:bg-green-400"
                >
                  📲 Enviar seguimiento por WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => void copiarEnlaceSeguimiento(pedidoCreado)}
                  className="rounded-xl border border-slate-700 px-5 py-3 font-bold hover:bg-slate-800"
                >
                  {copiado ? "✅ Enlace copiado" : "📋 Copiar enlace"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPedidoCreado(null);
                    setMensaje("");
                    setEnviarSeguimiento(false);
                  }}
                  className="rounded-xl border border-slate-700 px-5 py-3 font-bold hover:bg-slate-800"
                >
                  ➕ Crear otro pedido
                </button>
                <button
                  type="button"
                  onClick={() => {
                    router.push("/pedidos");
                    router.refresh();
                  }}
                  className="rounded-xl border border-slate-700 px-5 py-3 font-bold hover:bg-slate-800"
                >
                  Continuar sin enviar
                </button>
              </div>
            </section>
          )}

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