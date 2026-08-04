"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type RegistroUbicacion = {
  motorizado_id: number;
  latitud: number | null;
  longitud: number | null;
  precision_metros: number | null;
  jornada_activa: boolean;
  inicio_jornada: string | null;
  fin_jornada: string | null;
  ultima_actualizacion: string | null;
  motorizados: { nombre: string; telefono: string | null; placa: string | null; estado: string } | { nombre: string; telefono: string | null; placa: string | null; estado: string }[] | null;
};

function motorizadoDe(registro: RegistroUbicacion) {
  if (!registro.motorizados) return null;
  return Array.isArray(registro.motorizados)
    ? registro.motorizados[0] ?? null
    : registro.motorizados;
}

function haceCuanto(fecha: string | null) {
  if (!fecha) return "Sin ubicación";
  const segundos = Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 1000));
  if (segundos < 60) return `hace ${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h`;
}

function enlaceMapa(latitud: number, longitud: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`;
}

export default function UbicacionesPage() {
  const [registros, setRegistros] = useState<RegistroUbicacion[]>([]);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const { data, error: errorConsulta } = await supabase
      .from("ubicaciones_motorizados")
      .select(`
        motorizado_id, latitud, longitud, precision_metros, jornada_activa,
        inicio_jornada, fin_jornada, ultima_actualizacion,
        motorizados ( nombre, telefono, placa, estado )
      `)
      .order("jornada_activa", { ascending: false })
      .order("ultima_actualizacion", { ascending: false });

    if (errorConsulta) {
      setError(errorConsulta.message);
      setCargando(false);
      return;
    }

    const lista = (data ?? []) as RegistroUbicacion[];
    setRegistros(lista);
    setSeleccionado((actual) => actual ?? lista[0]?.motorizado_id ?? null);
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
    const canal = supabase
      .channel("ubicaciones-panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ubicaciones_motorizados" },
        () => void cargar()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [cargar]);

  const registroSeleccionado = useMemo(
    () => registros.find((item) => item.motorizado_id === seleccionado) ?? null,
    [registros, seleccionado]
  );

  const enLinea = registros.filter((item) => item.jornada_activa).length;

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-400">Operación en vivo</p>
            <h1 className="mt-2 text-3xl font-black">📍 Ubicación de motorizados</h1>
            <p className="mt-2 text-slate-400">Se actualiza en tiempo real mientras cada trabajador mantiene su jornada activa.</p>
          </div>
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-3 font-bold text-green-300">
            {enLinea} en línea
          </div>
        </header>

        {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">{error}</div>}
        {cargando && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center text-slate-400">Cargando ubicaciones...</div>}

        {!cargando && (
          <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
            <section className="space-y-3">
              {registros.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
                  Ningún motorizado ha iniciado una jornada con GPS todavía.
                </div>
              )}

              {registros.map((registro) => {
                const motorizado = motorizadoDe(registro);
                const activo = registro.motorizado_id === seleccionado;
                return (
                  <button
                    key={registro.motorizado_id}
                    type="button"
                    onClick={() => setSeleccionado(registro.motorizado_id)}
                    className={`w-full rounded-2xl border p-5 text-left transition ${
                      activo ? "border-green-500 bg-green-500/10" : "border-slate-800 bg-slate-900 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black">{motorizado?.nombre ?? `Motorizado #${registro.motorizado_id}`}</p>
                        <p className="mt-1 text-sm text-slate-400">{motorizado?.placa ?? "Sin placa"}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${registro.jornada_activa ? "bg-green-500/15 text-green-300" : "bg-slate-700 text-slate-300"}`}>
                        {registro.jornada_activa ? "🟢 En línea" : "Fuera de jornada"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">Última ubicación: {haceCuanto(registro.ultima_actualizacion)}</p>
                  </button>
                );
              })}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              {registroSeleccionado?.latitud != null && registroSeleccionado.longitud != null ? (
                <>
                  <iframe
                    title="Ubicación del motorizado"
                    src={`https://maps.google.com/maps?q=${registroSeleccionado.latitud},${registroSeleccionado.longitud}&z=16&output=embed`}
                    className="h-[480px] w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="flex flex-col gap-3 border-t border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold">{motorizadoDe(registroSeleccionado)?.nombre}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Actualizado {haceCuanto(registroSeleccionado.ultima_actualizacion)}
                        {registroSeleccionado.precision_metros ? ` · precisión ${Math.round(registroSeleccionado.precision_metros)} m` : ""}
                      </p>
                    </div>
                    <a
                      href={enlaceMapa(registroSeleccionado.latitud, registroSeleccionado.longitud)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-green-600 px-5 py-3 text-center font-bold hover:bg-green-500"
                    >
                      Abrir en Google Maps
                    </a>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[480px] items-center justify-center p-8 text-center text-slate-400">
                  Selecciona un motorizado con una ubicación disponible.
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
