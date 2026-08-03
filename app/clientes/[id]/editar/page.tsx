"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const campo = "w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20";

export default function EditarCliente() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const [form, setForm] = useState({ nombre: "", telefono: "", direccion: "", referencia: "" });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargar() {
      const { data, error } = await supabase.from("clientes").select("nombre, telefono, direccion, referencia").eq("id", id).single();
      if (error) setError(error.message);
      else if (data) setForm({ nombre: data.nombre ?? "", telefono: data.telefono ?? "", direccion: data.direccion ?? "", referencia: data.referencia ?? "" });
      setCargando(false);
    }
    if (Number.isFinite(id)) void cargar();
  }, [id]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true); setError("");
    const { error } = await supabase.from("clientes").update({
      nombre: form.nombre.trim(), telefono: form.telefono.trim(), direccion: form.direccion.trim(), referencia: form.referencia.trim() || null,
    }).eq("id", id);
    if (error) { setError(error.message); setGuardando(false); return; }
    router.push("/clientes"); router.refresh();
  }

  return <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8"><div className="mx-auto max-w-3xl">
    <header className="mb-8 flex items-center justify-between gap-4"><div><p className="text-sm text-slate-400">Gestión de clientes</p><h1 className="text-3xl font-black">Editar cliente</h1></div><Link href="/clientes" className="rounded-xl border border-slate-700 px-5 py-3 font-semibold">← Volver</Link></header>
    {cargando ? <div className="rounded-2xl bg-slate-900 p-8">Cargando...</div> : <form onSubmit={guardar} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8">
      {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">{error}</div>}
      <label className="block"><span className="mb-2 block font-semibold">Nombre</span><input className={campo} required value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></label>
      <label className="block"><span className="mb-2 block font-semibold">Teléfono</span><input className={campo} required value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})}/></label>
      <label className="block"><span className="mb-2 block font-semibold">Dirección</span><textarea className={campo} rows={3} value={form.direccion} onChange={e=>setForm({...form,direccion:e.target.value})}/></label>
      <label className="block"><span className="mb-2 block font-semibold">Referencia</span><textarea className={campo} rows={2} value={form.referencia} onChange={e=>setForm({...form,referencia:e.target.value})}/></label>
      <button disabled={guardando} className="w-full rounded-xl bg-green-600 px-5 py-3 font-bold hover:bg-green-500 disabled:opacity-60">{guardando ? "Guardando..." : "Guardar cambios"}</button>
    </form>}
  </div></main>;
}
