"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

export default function InstallPWA() {
  const [eventoInstalacion, setEventoInstalacion] =
    useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const ocultado = window.localStorage.getItem(
      "rapidcontrol_instalacion_ocultada"
    );

    const instalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        Boolean(
          (window.navigator as Navigator & { standalone?: boolean }).standalone
        ));

    if (instalada || ocultado === "si") {
      return;
    }

    function manejarEvento(evento: Event) {
      evento.preventDefault();
      setEventoInstalacion(evento as InstallPromptEvent);
      setVisible(true);
    }

    function manejarInstalacion() {
      setVisible(false);
      setEventoInstalacion(null);
    }

    window.addEventListener("beforeinstallprompt", manejarEvento);
    window.addEventListener("appinstalled", manejarInstalacion);

    return () => {
      window.removeEventListener("beforeinstallprompt", manejarEvento);
      window.removeEventListener("appinstalled", manejarInstalacion);
    };
  }, []);

  async function instalar() {
    if (!eventoInstalacion) return;

    await eventoInstalacion.prompt();
    const resultado = await eventoInstalacion.userChoice;

    if (resultado.outcome === "accepted") {
      setVisible(false);
      setEventoInstalacion(null);
    }
  }

  function cerrar() {
    window.localStorage.setItem(
      "rapidcontrol_instalacion_ocultada",
      "si"
    );
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-2xl border border-green-500/30 bg-slate-950 p-4 text-white shadow-2xl sm:left-auto sm:right-5 sm:w-[420px]">
      <div className="flex gap-4">
        <img
          src="/icons/icon-64.png"
          alt=""
          className="h-14 w-14 rounded-xl border border-slate-800"
        />

        <div className="min-w-0 flex-1">
          <h2 className="font-black">Instala RapidControl</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Accede más rápido y úsalo como una aplicación a pantalla completa.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void instalar()}
              className="rounded-lg bg-green-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-green-400"
            >
              Instalar
            </button>

            <button
              type="button"
              onClick={cerrar}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-slate-900"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
