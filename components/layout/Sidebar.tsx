"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { RolUsuario } from "@/lib/auth/roles";
import { nombresRol } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

type SidebarProps = {
  nombreUsuario?: string | null;
  correoUsuario?: string | null;
  rolUsuario?: RolUsuario | null;
};

type OpcionMenu = {
  nombre: string;
  href: string;
  icono: string;
  roles: RolUsuario[];
};

const administrativos: RolUsuario[] = ["administrador", "despachador"];

const opcionesMenu: OpcionMenu[] = [
  {
    nombre: "Dashboard",
    href: "/",
    icono: "🏠",
    roles: ["administrador"],
  },
  {
    nombre: "Operaciones",
    href: "/operaciones",
    icono: "🧭",
    roles: ["despachador"],
  },
  {
    nombre: "Pedidos",
    href: "/pedidos",
    icono: "📦",
    roles: administrativos,
  },
  {
    nombre: "Nuevo pedido",
    href: "/pedidos/nuevo",
    icono: "➕",
    roles: administrativos,
  },
  {
    nombre: "Clientes",
    href: "/clientes",
    icono: "👥",
    roles: administrativos,
  },
  {
    nombre: "Motorizados",
    href: "/motorizados",
    icono: "🛵",
    roles: administrativos,
  },
  {
    nombre: "Ubicaciones",
    href: "/ubicaciones",
    icono: "📍",
    roles: administrativos,
  },
  {
    nombre: "Caja",
    href: "/caja",
    icono: "💰",
    roles: administrativos,
  },
  {
    nombre: "Liquidaciones",
    href: "/liquidaciones",
    icono: "🧾",
    roles: administrativos,
  },
  {
    nombre: "Reportes",
    href: "/reportes",
    icono: "📊",
    roles: ["administrador"],
  },
  {
    nombre: "Rendimiento",
    href: "/rendimiento",
    icono: "📈",
    roles: ["administrador"],
  },
  {
    nombre: "Calendario",
    href: "/calendario",
    icono: "📅",
    roles: ["administrador"],
  },
  {
    nombre: "Inteligencia",
    href: "/inteligencia",
    icono: "🧠",
    roles: ["administrador"],
  },
  {
    nombre: "Administración",
    href: "/administracion",
    icono: "🛡️",
    roles: ["administrador"],
  },
  {
    nombre: "Configuración",
    href: "/configuracion",
    icono: "⚙️",
    roles: ["administrador"],
  },
];

function rutaActiva(pathname: string, href: string) {
  if (href === "/") return pathname === "/";

  if (href === "/pedidos") {
    return pathname === "/pedidos" || pathname.includes("/editar");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({
  nombreUsuario,
  correoUsuario,
  rolUsuario,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [error, setError] = useState("");

  const rol = rolUsuario ?? "despachador";

  const opcionesVisibles = opcionesMenu.filter((opcion) =>
    opcion.roles.includes(rol),
  );

  async function cerrarSesion() {
    if (cerrandoSesion) return;

    setCerrandoSesion(true);
    setError("");

    const { error: errorCerrarSesion } =
      await createClient().auth.signOut();

    if (errorCerrarSesion) {
      setError(errorCerrarSesion.message);
      setCerrandoSesion(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMenuAbierto(true)}
        className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-xl text-white shadow-lg transition hover:bg-slate-800 lg:hidden"
        aria-label="Abrir menú"
      >
        ☰
      </button>

      {menuAbierto && (
        <button
          type="button"
          onClick={() => setMenuAbierto(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          aria-label="Cerrar menú"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800 bg-slate-950 text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          menuAbierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-28 items-center justify-between border-b border-slate-800 px-5 py-3">
          <Link
            href={rol === "despachador" ? "/operaciones" : "/"}
            onClick={() => setMenuAbierto(false)}
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black">
              <Image
                src="/logo-mandados-rapid.png"
                alt="Mandados Rapid"
                width={80}
                height={80}
                className="h-full w-full object-contain p-1"
                priority
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-lg font-black leading-none">
                RapidControl
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Mandados Rapid
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMenuAbierto(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 lg:hidden"
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Navegación
          </p>

          <div className="space-y-2">
            {opcionesVisibles.map((opcion) => {
              const activa = rutaActiva(pathname, opcion.href);

              return (
                <Link
                  key={opcion.href}
                  href={opcion.href}
                  onClick={() => setMenuAbierto(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 font-semibold transition ${
                    activa
                      ? "bg-green-600 text-white"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center text-lg">
                    {opcion.icono}
                  </span>
                  <span>{opcion.nombre}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 font-black text-green-400">
                {(nombreUsuario || correoUsuario || "U")
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  {nombreUsuario || nombresRol[rol]}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {correoUsuario || nombresRol[rol]}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-green-400">
                  {nombresRol[rol]}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => void cerrarSesion()}
            disabled={cerrandoSesion}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-60"
          >
            🚪 {cerrandoSesion ? "Cerrando..." : "Cerrar sesión"}
          </button>
        </div>
      </aside>
    </>
  );
}