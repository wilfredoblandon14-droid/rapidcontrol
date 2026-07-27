import type { ReactNode } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

type AdminShellProps = {
  children: ReactNode;
  titulo?: string;
  subtitulo?: string;
  nombreUsuario?: string | null;
  correoUsuario?: string | null;
};

export default function AdminShell({
  children,
  titulo,
  subtitulo,
  nombreUsuario,
  correoUsuario,
}: AdminShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Sidebar
        nombreUsuario={nombreUsuario}
        correoUsuario={correoUsuario}
      />

      <div className="min-h-screen lg:pl-72">
        <Header
          titulo={titulo}
          subtitulo={subtitulo}
          nombreUsuario={nombreUsuario}
          correoUsuario={correoUsuario}
        />

        <main>{children}</main>
      </div>
    </div>
  );
}