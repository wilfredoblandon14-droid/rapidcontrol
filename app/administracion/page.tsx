"use client";

import Link from "next/link";

const modulos = [
  {
    titulo: "Reiniciar operación",
    descripcion:
      "Deja pedidos, Caja, fondos y liquidaciones en blanco sin borrar usuarios ni configuración.",
    href: "/reiniciar-operacion",
    icono: "🧹",
    clase: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  },
  {
    titulo: "Respaldos",
    descripcion:
      "Generación automática, exportaciones por rango, historial y descargas privadas.",
    href: "/respaldos",
    icono: "🛡️",
    clase: "border-green-500/30 bg-green-500/10 text-green-300",
  },
  {
    titulo: "Auditoría",
    descripcion:
      "Consulta quién creó, modificó o eliminó información importante del sistema.",
    href: "/auditoria",
    icono: "📋",
    clase: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  },
  {
    titulo: "Estado del sistema",
    descripcion:
      "Verifica conexión con Supabase, respaldo más reciente y configuración del servidor.",
    href: "/estado-sistema",
    icono: "❤️",
    clase: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  },
  {
    titulo: "Usuarios y permisos",
    descripcion:
      "Administra cuentas, roles y acceso de administrador, recepcionista y motorizados.",
    href: "/usuarios",
    icono: "👥",
    clase: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  {
    titulo: "Exportaciones",
    descripcion:
      "Genera PDF, Excel y ZIP administrativos de cualquier período.",
    href: "/respaldos",
    icono: "📤",
    clase: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  },
  {
    titulo: "Seguridad",
    descripcion:
      "Revisa recomendaciones para claves, acceso administrativo y recuperación.",
    href: "/estado-sistema",
    icono: "🔐",
    clase: "border-red-500/30 bg-red-500/10 text-red-300",
  },
];

export default function AdministracionSistema() {
  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-400">
            Control administrativo
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black leading-tight tracking-tight md:text-4xl">
            ⚙️ Administración del sistema
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-400">
            Centro exclusivo del administrador para respaldos, auditoría,
            usuarios, exportaciones y revisión general de RapidControl.
          </p>
        </header>

        <section className="mb-7 rounded-3xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-slate-900 p-6 shadow-2xl md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold text-green-300">RapidControl</p>
              <h2 className="mt-2 text-2xl font-black md:text-3xl">
                Centro de control administrativo
              </h2>
              <p className="mt-3 max-w-2xl text-slate-400">
                Los respaldos se generan y guardan en privado. Solo se
                descargan al equipo cuando el administrador pulsa un botón.
              </p>
            </div>

            <div className="rounded-2xl border border-green-500/20 bg-slate-950/60 px-6 py-5">
              <p className="text-sm text-slate-400">Acceso</p>
              <p className="mt-1 text-xl font-black text-green-300">
                Solo administrador
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {modulos.map((modulo) => (
            <Link
              key={modulo.titulo}
              href={modulo.href}
              className={`rounded-2xl border p-6 transition hover:-translate-y-1 hover:shadow-2xl ${modulo.clase}`}
            >
              <span className="text-3xl">{modulo.icono}</span>
              <h2 className="mt-5 text-xl font-black text-white">
                {modulo.titulo}
              </h2>
              <p className="mt-3 leading-6 text-slate-400">
                {modulo.descripcion}
              </p>
              <p className="mt-5 text-sm font-black">Abrir →</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
