"use client";

import { useEffect, useState } from "react";
import { nombresRol, esRolUsuario, type RolUsuario } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

const campo = "w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-green-500";

export default function Configuracion() {
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<RolUsuario | null>(null);
  const [politica, setPolitica] = useState({ fondo_motorizado: 1500, max_gasolina_mes: 5, monto_gasolina_sugerido: 400, max_recargas_mes: 2, monto_recarga_sugerido: 220 });
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { let activo = true; async function cargar() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (!activo) return;
    if (error || !data.user) { setError(error?.message ?? "No hay sesión activa."); setCargando(false); return; }
    setCorreo(data.user.email ?? "");
    const [rPerfil, rPolitica] = await Promise.all([
      supabase.from("perfiles").select("nombre, rol").eq("id", data.user.id).single(),
      supabase.from("configuracion_operativa").select("fondo_motorizado,max_gasolina_mes,monto_gasolina_sugerido,max_recargas_mes,monto_recarga_sugerido").eq("id", 1).maybeSingle(),
    ]);
    if (!activo) return;
    if (rPerfil.error) setError(rPerfil.error.message); else { setNombre(rPerfil.data?.nombre ?? ""); setRol(esRolUsuario(rPerfil.data?.rol) ? rPerfil.data.rol : null); }
    if (rPolitica.data) setPolitica(rPolitica.data);
    setCargando(false);
  } void cargar(); return () => { activo = false; }; }, []);

  async function guardar() {
    if (guardando) return;
    setGuardando(true); setError(""); setMensaje("");
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setError("No hay sesión activa."); setGuardando(false); return; }
    const [rPerfil, rPolitica] = await Promise.all([
      supabase.from("perfiles").update({ nombre: nombre.trim() || null }).eq("id", data.user.id),
      supabase.from("configuracion_operativa").upsert({ id: 1, ...politica, updated_by: data.user.id, updated_at: new Date().toISOString() }),
    ]);
    const fallo = rPerfil.error ?? rPolitica.error;
    if (fallo) setError(fallo.message); else setMensaje("Perfil y política operativa actualizados.");
    setGuardando(false);
  }

  return <main className="bg-slate-950 p-5 text-white md:p-8"><div className="mx-auto max-w-4xl space-y-6">
    {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">{error}</div>}
    {mensaje && <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-green-300">{mensaje}</div>}
    {cargando ? <div className="py-12 text-center text-slate-400">Cargando configuración...</div> : <>
      <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6"><h2 className="text-2xl font-black">Perfil</h2><label className="block"><span className="mb-2 block font-semibold">Correo</span><input disabled value={correo} className={`${campo} text-slate-400`}/></label><label className="block"><span className="mb-2 block font-semibold">Nombre visible</span><input value={nombre} onChange={e=>setNombre(e.target.value)} className={campo}/></label><label className="block"><span className="mb-2 block font-semibold">Rol asignado</span><input disabled value={rol ? nombresRol[rol] : "Sin rol válido"} className={`${campo} text-slate-400`}/></label></section>
      <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6"><div><h2 className="text-2xl font-black">Política operativa</h2><p className="mt-1 text-sm text-slate-400">Valores sugeridos y límites mensuales para los motorizados.</p></div><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block font-semibold">Fondo diario por motorizado</span><input type="number" value={politica.fondo_motorizado} onChange={e=>setPolitica({...politica,fondo_motorizado:Number(e.target.value)})} className={campo}/></label><label><span className="mb-2 block font-semibold">Máximo de cargas de gasolina/mes</span><input type="number" value={politica.max_gasolina_mes} onChange={e=>setPolitica({...politica,max_gasolina_mes:Number(e.target.value)})} className={campo}/></label><label><span className="mb-2 block font-semibold">Monto sugerido de gasolina</span><input type="number" value={politica.monto_gasolina_sugerido} onChange={e=>setPolitica({...politica,monto_gasolina_sugerido:Number(e.target.value)})} className={campo}/></label><label><span className="mb-2 block font-semibold">Máximo de recargas/mes</span><input type="number" value={politica.max_recargas_mes} onChange={e=>setPolitica({...politica,max_recargas_mes:Number(e.target.value)})} className={campo}/></label><label><span className="mb-2 block font-semibold">Monto sugerido de recarga</span><input type="number" value={politica.monto_recarga_sugerido} onChange={e=>setPolitica({...politica,monto_recarga_sugerido:Number(e.target.value)})} className={campo}/></label></div><p className="text-xs text-amber-300">Los límites generan advertencias, pero no bloquean gastos excepcionales.</p></section>
      <button onClick={()=>void guardar()} disabled={guardando} className="w-full rounded-xl bg-green-600 px-5 py-4 font-black disabled:opacity-60">{guardando ? "Guardando..." : "Guardar configuración"}</button>
    </>}
  </div></main>;
}
