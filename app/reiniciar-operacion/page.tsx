"use client";

import { useEffect, useState } from "react";

type Conteos = Record<string, number>;

const etiquetas: Record<string, string> = {
  pedidos: "Pedidos",
  clientes: "Clientes",
  movimientos_caja: "Movimientos de Caja",
  sesiones_caja: "Sesiones de Caja",
  fondos_motorizado: "Fondos entregados",
  gastos_motorizado: "Gastos",
  liquidaciones_motorizado: "Liquidaciones",
  notificaciones: "Notificaciones",
  notificaciones_lecturas: "Lecturas de notificaciones",
  ubicaciones_motorizados: "Jornadas GPS",
  auditoria: "Auditoría operativa",
  respaldos: "Registros de respaldos",
};

export default function ReiniciarOperacionPage() {
  const [conteos, setConteos] = useState<Conteos>({});
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [borrarClientes, setBorrarClientes] = useState(true);
  const [reiniciarContadores, setReiniciarContadores] = useState(true);
  const [confirmacion, setConfirmacion] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargarEstado() {
    setCargando(true);
    setError("");

    const respuesta = await fetch("/api/reiniciar-operacion/estado", {
      cache: "no-store",
    });
    const data = await respuesta.json();

    if (!respuesta.ok) {
      setError(data.error ?? "No se pudo comprobar la información actual.");
    } else {
      setConteos(data.conteos ?? {});
    }

    setCargando(false);
  }

  useEffect(() => {
    void cargarEstado();
  }, []);

  async function reiniciar() {
    setError("");
    setMensaje("");

    if (!acepta) {
      setError("Debes confirmar que comprendes que los datos se eliminarán.");
      return;
    }

    setProcesando(true);

    const respuesta = await fetch("/api/reiniciar-operacion/ejecutar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmacion,
        borrarClientes,
        reiniciarContadores,
      }),
    });
    const data = await respuesta.json();

    if (!respuesta.ok) {
      setError(data.error ?? "No se pudo reiniciar la operación.");
      setProcesando(false);
      return;
    }

    setMensaje(data.mensaje);
    setConfirmacion("");
    setAcepta(false);
    setProcesando(false);
    await cargarEstado();
  }

  const totalOperacion = Object.entries(conteos)
    .filter(([tabla]) => borrarClientes || tabla !== "clientes")
    .reduce((total, [, cantidad]) => total + Number(cantidad ?? 0), 0);

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-orange-400">
            Herramienta administrativa
          </p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">
            🧹 Reiniciar operación
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-400">
            Deja RapidControl en blanco para comenzar una prueba nueva. Conserva
            usuarios, roles, cuentas de trabajadores, motorizados, configuración
            y estructura del sistema.
          </p>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}
        {mensaje && (
          <div className="mb-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-300">
            ✅ {mensaje}
          </div>
        )}

        <section className="mb-6 rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-500/15 to-slate-900 p-6 md:p-8">
          <h2 className="text-2xl font-black">Qué permanecerá intacto</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {["Usuarios y perfiles", "Motorizados", "Roles y permisos", "Configuración", "Logo y archivos", "Estructura de Supabase"].map((item) => (
              <div key={item} className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 font-bold text-green-300">
                ✓ {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Información que se eliminará</h2>
              <p className="mt-2 text-slate-400">
                {cargando ? "Comprobando..." : `${totalOperacion} registros seleccionados.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void cargarEstado()}
              disabled={cargando || procesando}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-bold text-slate-300 disabled:opacity-50"
            >
              🔄 Actualizar conteos
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(etiquetas).map(([tabla, etiqueta]) => {
              const seConserva = tabla === "clientes" && !borrarClientes;
              return (
                <article
                  key={tabla}
                  className={`min-w-0 rounded-xl border p-4 ${
                    seConserva
                      ? "border-green-500/20 bg-green-500/10"
                      : "border-red-500/20 bg-red-500/10"
                  }`}
                >
                  <p className="text-sm text-slate-400">{etiqueta}</p>
                  <p className="mt-2 text-3xl font-black">
                    {conteos[tabla] ?? 0}
                  </p>
                  <p className={`mt-1 text-xs font-bold ${seConserva ? "text-green-300" : "text-red-300"}`}>
                    {seConserva ? "Se conservarán" : "Se eliminarán"}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-red-500/30 bg-slate-900 p-6">
          <h2 className="text-xl font-black text-red-300">Confirmación de seguridad</h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-400">
            Esta acción es irreversible desde esta pantalla. Antes de usarla con
            datos reales, descarga un respaldo desde el Centro de Respaldos.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <input
                type="checkbox"
                checked={borrarClientes}
                onChange={(event) => setBorrarClientes(event.target.checked)}
                className="mt-1 h-5 w-5"
              />
              <span>
                <strong>Borrar también los clientes</strong>
                <span className="mt-1 block text-sm text-slate-500">
                  Actívalo para que la recepcionista encuentre Clientes vacío.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <input
                type="checkbox"
                checked={reiniciarContadores}
                onChange={(event) => setReiniciarContadores(event.target.checked)}
                className="mt-1 h-5 w-5"
              />
              <span>
                <strong>Reiniciar contadores internos</strong>
                <span className="mt-1 block text-sm text-slate-500">
                  Los próximos registros de prueba volverán a comenzar desde 1.
                </span>
              </span>
            </label>
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <input
              type="checkbox"
              checked={acepta}
              onChange={(event) => setAcepta(event.target.checked)}
              className="mt-1 h-5 w-5"
            />
            <span className="font-bold text-red-200">
              Comprendo que los datos operativos seleccionados serán eliminados.
            </span>
          </label>

          <label className="mt-5 block max-w-xl">
            <span className="text-sm font-bold text-slate-300">
              Escribe REINICIAR OPERACION
            </span>
            <input
              value={confirmacion}
              onChange={(event) => setConfirmacion(event.target.value)}
              placeholder="REINICIAR OPERACION"
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-bold outline-none focus:border-red-500"
            />
          </label>

          <button
            type="button"
            onClick={() => void reiniciar()}
            disabled={
              procesando ||
              !acepta ||
              confirmacion !== "REINICIAR OPERACION"
            }
            className="mt-5 rounded-xl bg-red-600 px-6 py-4 font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {procesando ? "Reiniciando..." : "🧹 Dejar sistema en blanco"}
          </button>
        </section>
      </div>
    </main>
  );
}
