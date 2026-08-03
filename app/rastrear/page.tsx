"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RastrearPedido() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");

  function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const limpio = codigo.trim().toUpperCase();

    if (!/^RC-[A-Z0-9]{6,12}$/.test(limpio)) {
      setError("Escribe un código válido, por ejemplo RC-8F4K2P.");
      return;
    }

    router.push(`/seguimiento/${encodeURIComponent(limpio)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-10 text-white">
      <div className="w-full max-w-lg">
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-7 text-center shadow-2xl sm:p-9">
          <div className="text-5xl">📦</div>
          <p className="mt-5 text-sm font-bold uppercase tracking-[0.25em] text-green-400">RapidControl</p>
          <h1 className="mt-2 text-3xl font-black">Rastrear pedido</h1>
          <p className="mt-3 text-slate-400">Ingresa el código recibido al solicitar tu mandado.</p>

          {error && (
            <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-left text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={buscar} className="mt-6">
            <input
              value={codigo}
              onChange={(event) => {
                setCodigo(event.target.value.toUpperCase());
                setError("");
              }}
              placeholder="RC-8F4K2P"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-4 text-center text-xl font-black uppercase tracking-widest outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            />
            <button className="mt-4 w-full rounded-xl bg-green-500 px-6 py-4 font-black text-slate-950 transition hover:bg-green-400">
              Consultar estado
            </button>
          </form>

          <Link href="/solicitar" className="mt-6 inline-block text-sm font-semibold text-green-300 hover:text-green-200">
            Solicitar un nuevo mandado
          </Link>
        </section>
      </div>
    </main>
  );
}
