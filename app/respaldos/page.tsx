"use client";

import { useEffect, useMemo, useState } from "react";

type Respaldo = {
  id: number;
  grupo_id: string;
  tipo: string;
  formato: string;
  ruta_storage: string;
  tamano_bytes: number;
  estado: string;
  rango_desde: string | null;
  rango_hasta: string | null;
  created_at: string;
};

function tamano(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function fecha(valor: string) {
  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(valor));
}

export default function CentroRespaldos() {
  const hoy = new Date().toISOString().slice(0, 10);
  const hace15 = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const [desde, setDesde] = useState(hace15);
  const [hasta, setHasta] = useState(hoy);
  const [respaldos, setRespaldos] = useState<Respaldo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function cargar() {
    setCargando(true);
    const respuesta = await fetch("/api/respaldos/listar", { cache: "no-store" });
    const data = await respuesta.json();
    if (!respuesta.ok) setError(data.error ?? "No se pudo cargar el historial.");
    else setRespaldos(data.respaldos ?? []);
    setCargando(false);
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function generar() {
    setGenerando(true);
    setMensaje("");
    setError("");
    try {
      const respuesta = await fetch("/api/respaldos/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desde, hasta }),
      });
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(data.error ?? "No se pudo generar.");
      setMensaje("Exportación generada y guardada correctamente.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setGenerando(false);
    }
  }

  async function descargar(ruta: string) {
    setError("");
    const respuesta = await fetch("/api/respaldos/descargar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruta }),
    });
    const data = await respuesta.json();
    if (!respuesta.ok) {
      setError(data.error ?? "No se pudo descargar.");
      return;
    }
    window.location.href = data.url;
  }

  const ultimo = respaldos[0];
  const totalBytes = useMemo(
    () => respaldos.reduce((s, r) => s + Number(r.tamano_bytes ?? 0), 0),
    [respaldos]
  );

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-400">
            Seguridad de la información
          </p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">🛡️ Centro de respaldos</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            La generación automática guarda los archivos en almacenamiento privado. La descarga al equipo ocurre solamente al pulsar un botón.
          </p>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Último respaldo", ultimo ? fecha(ultimo.created_at) : "Sin respaldos", ultimo?.estado ?? "Pendiente"],
            ["Archivos guardados", respaldos.length.toString(), "PDF, Excel y ZIP"],
            ["Espacio registrado", tamano(totalBytes), "Historial visible"],
            ["Automatización", "Activa", "ZIP diario · PDF/Excel quincenal y mensual"],
          ].map(([titulo, valor, detalle]) => (
            <article key={titulo} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">{titulo}</p>
              <p className="mt-2 text-2xl font-black">{valor}</p>
              <p className="mt-2 text-xs text-slate-500">{detalle}</p>
            </article>
          ))}
        </section>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-black">Exportación administrativa manual</h2>
          <p className="mt-2 text-sm text-slate-400">
            Selecciona un período. RapidControl guardará PDF, Excel y ZIP en la misma estructura privada.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
            <label className="text-sm font-bold text-slate-300">
              Desde
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none" />
            </label>
            <label className="text-sm font-bold text-slate-300">
              Hasta
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none" />
            </label>
            <button type="button" onClick={() => void generar()} disabled={generando} className="self-end rounded-xl bg-green-500 px-6 py-3 font-black text-slate-950 disabled:opacity-60">
              {generando ? "Generando..." : "Generar exportación"}
            </button>
          </div>
        </section>

        {mensaje && <div className="mb-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-300">{mensaje}</div>}
        {error && <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>}

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 p-5">
            <h2 className="text-xl font-black">Historial de respaldos</h2>
          </div>
          {cargando ? (
            <p className="p-8 text-center text-slate-400">Cargando...</p>
          ) : respaldos.length === 0 ? (
            <p className="p-8 text-center text-slate-400">Todavía no hay respaldos registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-950/60 text-left text-xs uppercase text-slate-500">
                  <tr><th className="px-5 py-4">Fecha</th><th className="px-5 py-4">Tipo</th><th className="px-5 py-4">Formato</th><th className="px-5 py-4">Tamaño</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4 text-right">Acción</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {respaldos.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-4 text-sm">{fecha(r.created_at)}</td>
                      <td className="px-5 py-4 font-bold capitalize">{r.tipo}</td>
                      <td className="px-5 py-4"><span className="rounded-lg bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-300">{r.formato}</span></td>
                      <td className="px-5 py-4 text-sm text-slate-400">{tamano(r.tamano_bytes)}</td>
                      <td className="px-5 py-4 text-green-300">● {r.estado}</td>
                      <td className="px-5 py-4 text-right"><button type="button" onClick={() => void descargar(r.ruta_storage)} className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-300">Descargar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
