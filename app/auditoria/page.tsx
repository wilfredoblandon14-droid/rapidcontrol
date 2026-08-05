"use client";

import { useEffect, useState } from "react";

type EventoAuditoria = {
  id: number;
  tabla: string;
  operacion: string;
  registro_id: string | null;
  usuario_id: string | null;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  created_at: string;
};

function fecha(valor: string) {
  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(valor));
}

function nombreOperacion(valor: string) {
  if (valor === "INSERT") return "Creación";
  if (valor === "UPDATE") return "Modificación";
  if (valor === "DELETE") return "Eliminación";
  return valor;
}

function estiloOperacion(valor: string) {
  if (valor === "INSERT") return "border-green-500/30 bg-green-500/10 text-green-300";
  if (valor === "UPDATE") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (valor === "DELETE") return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-slate-600 bg-slate-800 text-slate-300";
}

export default function AuditoriaPage() {
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [tabla, setTabla] = useState("todas");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargar(tablaSeleccionada = tabla) {
    setCargando(true);
    setError("");

    const query =
      tablaSeleccionada === "todas"
        ? ""
        : `?tabla=${encodeURIComponent(tablaSeleccionada)}`;

    const respuesta = await fetch(`/api/auditoria/listar${query}`, {
      cache: "no-store",
    });

    const data = await respuesta.json();

    if (!respuesta.ok) {
      setError(data.error ?? "No se pudo cargar la auditoría.");
      setEventos([]);
    } else {
      setEventos(data.eventos ?? []);
    }

    setCargando(false);
  }

  useEffect(() => {
    void cargar("todas");
  }, []);

  function cambiarTabla(valor: string) {
    setTabla(valor);
    void cargar(valor);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-400">
              Trazabilidad
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              📋 Registro de auditoría
            </h1>
            <p className="mt-2 max-w-3xl text-slate-400">
              Historial automático de creaciones, modificaciones y
              eliminaciones en áreas importantes.
            </p>
          </div>

          <select
            value={tabla}
            onChange={(event) => cambiarTabla(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-bold outline-none"
          >
            <option value="todas">Todas las áreas</option>
            <option value="pedidos">Pedidos</option>
            <option value="clientes">Clientes</option>
            <option value="motorizados">Motorizados</option>
            <option value="movimientos_caja">Caja</option>
            <option value="sesiones_caja">Sesiones de caja</option>
            <option value="fondos_motorizado">Fondos</option>
            <option value="gastos_motorizado">Gastos</option>
            <option value="liquidaciones_motorizado">Liquidaciones</option>
          </select>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 p-5">
            <h2 className="text-xl font-black">Últimos movimientos</h2>
            <p className="mt-1 text-sm text-slate-400">
              Se muestran hasta 500 eventos recientes.
            </p>
          </div>

          {cargando ? (
            <p className="p-10 text-center text-slate-400">Cargando auditoría...</p>
          ) : eventos.length === 0 ? (
            <p className="p-10 text-center text-slate-400">
              Todavía no hay eventos registrados para este filtro.
            </p>
          ) : (
            <div className="divide-y divide-slate-800">
              {eventos.map((evento) => (
                <article
                  key={evento.id}
                  className="grid gap-4 p-5 lg:grid-cols-[180px_180px_1fr_220px]"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Fecha
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {fecha(evento.created_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Acción
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${estiloOperacion(
                        evento.operacion
                      )}`}
                    >
                      {nombreOperacion(evento.operacion)}
                    </span>
                  </div>

                  <div>
                    <p className="font-black capitalize">
                      {evento.tabla.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Registro: {evento.registro_id ?? "Sin identificador"}
                    </p>
                    <p className="mt-2 break-all text-xs text-slate-500">
                      Usuario: {evento.usuario_id ?? "Sistema o usuario no identificado"}
                    </p>
                  </div>

                  <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <summary className="cursor-pointer text-sm font-bold text-slate-300">
                      Ver datos
                    </summary>
                    <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-500">
                      {JSON.stringify(
                        {
                          anteriores: evento.datos_anteriores,
                          nuevos: evento.datos_nuevos,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
