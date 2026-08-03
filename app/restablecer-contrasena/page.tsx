"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RestablecerContrasena() {
  const router=useRouter(); const [password,setPassword]=useState(""); const [confirmacion,setConfirmacion]=useState(""); const [error,setError]=useState(""); const [cargando,setCargando]=useState(false);
  async function guardar(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setError("");if(password.length<8){setError("La contraseña debe tener al menos 8 caracteres.");return;}if(password!==confirmacion){setError("Las contraseñas no coinciden.");return;}setCargando(true);const {error}=await createClient().auth.updateUser({password});if(error){setError(error.message);setCargando(false);return;}router.replace("/login");router.refresh();}
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white"><div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8"><h1 className="text-2xl font-black">Nueva contraseña</h1><form onSubmit={guardar} className="mt-6 space-y-4"><input type="password" required minLength={8} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Nueva contraseña" className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"/><input type="password" required minLength={8} value={confirmacion} onChange={(e)=>setConfirmacion(e.target.value)} placeholder="Confirmar contraseña" className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"/>{error&&<div className="rounded-xl bg-red-500/10 p-3 text-red-300">{error}</div>}<button disabled={cargando} className="w-full rounded-xl bg-green-600 py-3 font-bold disabled:opacity-50">{cargando?"Guardando...":"Guardar contraseña"}</button></form></div></main>;
}
