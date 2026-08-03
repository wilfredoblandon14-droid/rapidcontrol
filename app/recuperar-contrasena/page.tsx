"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RecuperarContrasena() {
  const [correo, setCorreo] = useState(""); const [mensaje, setMensaje] = useState(""); const [error, setError] = useState(""); const [cargando, setCargando] = useState(false);
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setCargando(true); setError(""); setMensaje("");
    const redirectTo = `${window.location.origin}/restablecer-contrasena`;
    const { error } = await createClient().auth.resetPasswordForEmail(correo.trim(), { redirectTo });
    if (error) setError(error.message); else setMensaje("Revisa tu correo. Enviamos un enlace para cambiar la contraseña.");
    setCargando(false);
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white"><div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8"><h1 className="text-2xl font-black">Recuperar contraseña</h1><p className="mt-2 text-slate-400">Escribe el correo registrado en RapidControl.</p><form onSubmit={enviar} className="mt-6 space-y-4"><input type="email" required value={correo} onChange={(e)=>setCorreo(e.target.value)} placeholder="correo@ejemplo.com" className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-green-500" />{error&&<div className="rounded-xl bg-red-500/10 p-3 text-red-300">{error}</div>}{mensaje&&<div className="rounded-xl bg-green-500/10 p-3 text-green-300">{mensaje}</div>}<button disabled={cargando} className="w-full rounded-xl bg-green-600 py-3 font-bold disabled:opacity-50">{cargando?"Enviando...":"Enviar enlace"}</button><Link href="/login" className="block text-center text-sm text-slate-400 hover:text-white">Volver al inicio de sesión</Link></form></div></main>;
}
