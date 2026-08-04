"use client";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <img
          src="/icons/icon-192.png"
          alt="Mandados Rapid"
          className="mx-auto h-24 w-24 rounded-2xl"
        />

        <p className="mt-6 text-sm font-bold uppercase tracking-[0.25em] text-green-400">
          RapidControl
        </p>

        <h1 className="mt-3 text-3xl font-black">📡 Sin conexión</h1>

        <p className="mt-4 leading-7 text-slate-400">
          No fue posible conectarse a RapidControl. Verifica tu conexión a
          Internet y vuelve a intentarlo.
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-7 w-full rounded-xl bg-green-500 px-5 py-4 font-black text-slate-950 transition hover:bg-green-400"
        >
          Reintentar
        </button>
      </section>
    </main>
  );
}
