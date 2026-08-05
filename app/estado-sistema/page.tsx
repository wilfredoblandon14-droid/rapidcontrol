"use client";

import { useEffect, useState } from "react";

type EstadoSistema = {
  baseDatos: {
    correcto: boolean;
    pedidos: number;
    clientes: number;
    tiempoRespuestaMs: number;
    error: string | null;
  };
  respaldos: {
    configurado: boolean;
    cronConfigurado: boolean;
    ultimo: {
      created_at: string;
      estado: string;
      formato: string;
      tipo: string;
    } | null;
    error: string | null;
  };
  ia: {
    configurada: boolean;
  };
  entorno: string;
  timestamp: string;
};

function fecha(valor: string | null | undefined) {
  if (!valor) return "Sin respaldo registrado";
  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(valor));
}

function TarjetaEstado({
  titulo,
  correcto,
  detalle,
}: {
  titulo: string;
  correcto: boolean;
  detalle: string;
}) {
  return (
    <article
      className={`rounded-2xl border p-5 ${
        correcto
          ? "border-green-500/30 bg-green-500/10"
          : "border-red-500/30 bg-red-500/10"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-black">{titulo}</h2>
        <span className="text-2xl">{correcto ? "🟢" : "🔴"}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{detalle}</p>
    </article>
  );
}

export default function EstadoSistemaPage() {
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function comprobar() {
    setCargando(true);
    setError("");

    const respuesta = await fetch("/api/sistema/estado", {
      cache: "no-store",
    });
    const data = await respuesta.json();

    if (!respuesta.ok) {
      setError(data.error ?? "No se pudo comprobar el sistema.");
      setEstado(null);
    } else {
      setEstado(data);
    }

    setCargando(false);
  }

  useEffect(() => {
    void comprobar();
  }, []);

  const saludables = estado
    ? [
        estado.baseDatos.correcto,
        estado.respaldos.configurado,
        estado.respaldos.cronConfigurado,
        estado.ia.configurada,
      ].filter(Boolean).length
    : 0;

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-violet-400">
              Diagnóstico administrativo
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              ❤️ Estado del sistema
            </h1>
            <p className="mt-2 text-slate-400">
              Comprobación de servicios esenciales sin mostrar claves privadas.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void comprobar()}
            disabled={cargando}
            className="rounded-xl bg-violet-500 px-5 py-3 font-black text-white disabled:opacity-60"
          >
            {cargando ? "Comprobando..." : "Comprobar otra vez"}
          </button>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {estado && (
          <>
            <section className="mb-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-8">
              <p className="text-sm text-slate-400">Estado general</p>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-4xl font-black">
                    {saludables}/4 servicios listos
                  </p>
                  <p className="mt-2 text-slate-400">
                    Entorno actual: {estado.entorno}
                  </p>
                </div>
                <p className="text-sm text-slate-500">
                  Última comprobación: {fecha(estado.timestamp)}
                </p>
              </div>
            </section>

            <section className="grid gap-5 sm:grid-cols-2">
              <TarjetaEstado
                titulo="Base de datos"
                correcto={estado.baseDatos.correcto}
                detalle={
                  estado.baseDatos.correcto
                    ? `${estado.baseDatos.pedidos} pedidos y ${estado.baseDatos.clientes} clientes consultados en ${estado.baseDatos.tiempoRespuestaMs} ms.`
                    : estado.baseDatos.error ?? "No fue posible conectar."
                }
              />

              <TarjetaEstado
                titulo="Clave de respaldos"
                correcto={estado.respaldos.configurado}
                detalle={
                  estado.respaldos.configurado
                    ? "La clave privada del servidor está configurada."
                    : "Falta SUPABASE_SERVICE_ROLE_KEY."
                }
              />

              <TarjetaEstado
                titulo="Tarea automática"
                correcto={estado.respaldos.cronConfigurado}
                detalle={
                  estado.respaldos.cronConfigurado
                    ? `CRON_SECRET está configurado. Último respaldo: ${fecha(
                        estado.respaldos.ultimo?.created_at
                      )}.`
                    : "Falta CRON_SECRET."
                }
              />

              <TarjetaEstado
                titulo="Asistente de IA"
                correcto={estado.ia.configurada}
                detalle={
                  estado.ia.configurada
                    ? "OPENAI_API_KEY está configurada en el servidor."
                    : "Falta OPENAI_API_KEY o fue removida."
                }
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
