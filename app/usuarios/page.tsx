"use client";

import { useEffect, useMemo, useState } from "react";

type Rol = "administrador" | "despachador" | "motorizado";
type Usuario = {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  motorizado_id: number | null;
  activo: boolean;
  creado_en: string;
  ultimo_acceso: string | null;
};
type Motorizado = { id: number; nombre: string; telefono: string | null; estado: string };

type Formulario = {
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
  motorizado_id: string;
};

const vacio: Formulario = { nombre: "", email: "", password: "", rol: "despachador", motorizado_id: "" };
const campo = "w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-green-500";

function nombreRol(rol: string) {
  if (rol === "administrador") return "Administrador";
  if (rol === "despachador") return "Recepcionista";
  if (rol === "motorizado") return "Motorizado";
  return "Sin rol";
}

function fecha(valor: string | null) {
  if (!valor) return "Nunca";
  return new Intl.DateTimeFormat("es-NI", { dateStyle: "medium", timeStyle: "short" }).format(new Date(valor));
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [formulario, setFormulario] = useState<Formulario>(vacio);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    setCargando(true);
    setError("");
    const respuesta = await fetch("/api/usuarios", { cache: "no-store" });
    const data = await respuesta.json();
    if (!respuesta.ok) setError(data.error ?? "No se pudieron cargar los usuarios.");
    else {
      setUsuarios(data.usuarios ?? []);
      setMotorizados(data.motorizados ?? []);
    }
    setCargando(false);
  }

  useEffect(() => { void cargar(); }, []);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return usuarios;
    return usuarios.filter((u) => `${u.nombre} ${u.email} ${nombreRol(u.rol)}`.toLowerCase().includes(texto));
  }, [busqueda, usuarios]);

  function nuevo() {
    setEditando(null);
    setFormulario(vacio);
    setError("");
    setMensaje("");
    setMostrarFormulario(true);
  }

  function editar(usuario: Usuario) {
    setEditando(usuario);
    setFormulario({
      nombre: usuario.nombre,
      email: usuario.email,
      password: "",
      rol: ["administrador", "despachador", "motorizado"].includes(usuario.rol) ? usuario.rol as Rol : "despachador",
      motorizado_id: usuario.motorizado_id ? String(usuario.motorizado_id) : "",
    });
    setError("");
    setMensaje("");
    setMostrarFormulario(true);
  }

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    setError("");
    setMensaje("");

    const url = editando ? `/api/usuarios/${editando.id}` : "/api/usuarios";
    const metodo = editando ? "PATCH" : "POST";
    const respuesta = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formulario,
        motorizado_id: formulario.rol === "motorizado" ? formulario.motorizado_id : null,
      }),
    });
    const data = await respuesta.json();
    if (!respuesta.ok) setError(data.error ?? "No se pudo guardar el usuario.");
    else {
      setMensaje(editando ? "Usuario actualizado correctamente." : "Usuario creado correctamente.");
      setMostrarFormulario(false);
      setFormulario(vacio);
      setEditando(null);
      await cargar();
    }
    setGuardando(false);
  }

  async function cambiarEstado(usuario: Usuario) {
    const accion = usuario.activo ? "desactivar" : "activar";
    if (!confirm(`¿Seguro que deseas ${accion} a ${usuario.nombre || usuario.email}?`)) return;
    const respuesta = await fetch(`/api/usuarios/${usuario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: usuario.nombre,
        rol: usuario.rol,
        motorizado_id: usuario.motorizado_id,
        activo: !usuario.activo,
      }),
    });
    const data = await respuesta.json();
    if (!respuesta.ok) setError(data.error ?? `No se pudo ${accion} la cuenta.`);
    else await cargar();
  }

  async function eliminar(usuario: Usuario) {
    const confirmacion = prompt(`Para eliminar definitivamente a ${usuario.nombre || usuario.email}, escribe ELIMINAR`);
    if (confirmacion !== "ELIMINAR") return;
    const respuesta = await fetch(`/api/usuarios/${usuario.id}`, { method: "DELETE" });
    const data = await respuesta.json();
    if (!respuesta.ok) setError(data.error ?? "No se pudo eliminar el usuario.");
    else await cargar();
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-amber-400">Administración de acceso</p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">👥 Usuarios y permisos</h1>
            <p className="mt-2 text-slate-400">Crea las cuentas de la recepcionista y los motorizados sin entrar a Supabase.</p>
          </div>
          <button onClick={nuevo} className="rounded-xl bg-green-500 px-5 py-3 font-black text-slate-950 hover:bg-green-400">+ Nuevo usuario</button>
        </header>

        {error && <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">{error}</div>}
        {mensaje && <div className="mb-5 rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-green-300">{mensaje}</div>}

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 p-5">
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, correo o rol" className={campo} />
          </div>
          {cargando ? <p className="p-12 text-center text-slate-400">Cargando usuarios...</p> : filtrados.length === 0 ? <p className="p-12 text-center text-slate-400">No hay usuarios para mostrar.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full">
                <thead className="bg-slate-950/60 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr><th className="px-5 py-4">Usuario</th><th className="px-5 py-4">Rol</th><th className="px-5 py-4">Vínculo</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4">Último acceso</th><th className="px-5 py-4 text-right">Acciones</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filtrados.map((usuario) => {
                    const moto = motorizados.find((m) => m.id === usuario.motorizado_id);
                    return <tr key={usuario.id}>
                      <td className="px-5 py-5"><p className="font-black">{usuario.nombre || "Sin nombre"}</p><p className="mt-1 text-sm text-slate-400">{usuario.email}</p></td>
                      <td className="px-5 py-5"><span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-300">{nombreRol(usuario.rol)}</span></td>
                      <td className="px-5 py-5 text-sm text-slate-300">{moto ? `🛵 ${moto.nombre}` : "—"}</td>
                      <td className="px-5 py-5"><span className={`rounded-full border px-3 py-1 text-xs font-black ${usuario.activo ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{usuario.activo ? "Activo" : "Inactivo"}</span></td>
                      <td className="px-5 py-5 text-sm text-slate-400">{fecha(usuario.ultimo_acceso)}</td>
                      <td className="px-5 py-5"><div className="flex justify-end gap-2"><button onClick={() => editar(usuario)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold">Editar</button><button onClick={() => void cambiarEstado(usuario)} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-300">{usuario.activo ? "Desactivar" : "Activar"}</button><button onClick={() => void eliminar(usuario)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300">Eliminar</button></div></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {mostrarFormulario && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-black">{editando ? "Editar usuario" : "Nuevo usuario"}</h2><p className="mt-1 text-sm text-slate-400">La contraseña temporal se entrega de forma privada al trabajador.</p></div><button onClick={() => setMostrarFormulario(false)} className="rounded-lg border border-slate-700 px-3 py-2">✕</button></div>
            <div className="mt-6 space-y-4">
              <label className="block"><span className="mb-2 block font-semibold">Nombre</span><input value={formulario.nombre} onChange={(e) => setFormulario({...formulario, nombre: e.target.value})} className={campo} /></label>
              <label className="block"><span className="mb-2 block font-semibold">Correo</span><input type="email" disabled={Boolean(editando)} value={formulario.email} onChange={(e) => setFormulario({...formulario, email: e.target.value})} className={`${campo} disabled:text-slate-500`} /></label>
              <label className="block"><span className="mb-2 block font-semibold">{editando ? "Nueva contraseña (opcional)" : "Contraseña temporal"}</span><input type="password" value={formulario.password} onChange={(e) => setFormulario({...formulario, password: e.target.value})} placeholder={editando ? "Déjala vacía para no cambiarla" : "Mínimo 8 caracteres"} className={campo} /></label>
              <label className="block"><span className="mb-2 block font-semibold">Rol</span><select value={formulario.rol} onChange={(e) => setFormulario({...formulario, rol: e.target.value as Rol, motorizado_id: e.target.value === "motorizado" ? formulario.motorizado_id : ""})} className={campo}><option value="despachador">Recepcionista</option><option value="motorizado">Motorizado</option><option value="administrador">Administrador</option></select></label>
              {formulario.rol === "motorizado" && <label className="block"><span className="mb-2 block font-semibold">Vincular con motorizado</span><select value={formulario.motorizado_id} onChange={(e) => setFormulario({...formulario, motorizado_id: e.target.value})} className={campo}><option value="">Seleccionar...</option>{motorizados.map((m) => <option key={m.id} value={m.id}>{m.nombre} · {m.telefono || "sin teléfono"}</option>)}</select></label>}
            </div>
            <div className="mt-7 flex justify-end gap-3"><button onClick={() => setMostrarFormulario(false)} className="rounded-xl border border-slate-700 px-5 py-3 font-bold">Cancelar</button><button disabled={guardando} onClick={() => void guardar()} className="rounded-xl bg-green-500 px-5 py-3 font-black text-slate-950 disabled:opacity-60">{guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear usuario"}</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
