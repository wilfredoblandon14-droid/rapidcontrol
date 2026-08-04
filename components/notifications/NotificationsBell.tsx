"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RolUsuario } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

type PerfilNotificaciones = {
  rol: string | null;
  motorizado_id: number | null;
};

type Notificacion = {
  id: number;
  titulo: string;
  mensaje: string | null;
  tipo: string;
  enlace: string | null;
  destinatario_rol: string | null;
  destinatario_usuario: string | null;
  motorizado_id: number | null;
  created_at: string;
};

type Lectura = {
  notificacion_id: number;
};

type NotificationsBellProps = {
  rolUsuario?: RolUsuario | null;
  compacto?: boolean;
};

function iconoTipo(tipo: string) {
  if (tipo === "pedido_nuevo") return "📦";
  if (tipo === "pedido_asignado") return "🛵";
  if (tipo === "pedido_entregado") return "✅";
  if (tipo === "pedido_cancelado") return "❌";
  if (tipo === "jornada") return "📍";
  if (tipo === "caja") return "💰";
  if (tipo === "liquidacion") return "🧾";
  return "🔔";
}

function tiempoRelativo(fecha: string) {
  const diferencia = Date.now() - new Date(fecha).getTime();
  const minutos = Math.max(0, Math.floor(diferencia / 60000));

  if (minutos < 1) return "Ahora";
  if (minutos < 60) return `Hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  return `Hace ${dias} d`;
}

export default function NotificationsBell({
  rolUsuario,
  compacto = false,
}: NotificationsBellProps) {
  const supabase = useMemo(() => createClient(), []);
  const [abierto, setAbierto] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [leidas, setLeidas] = useState<Set<number>>(new Set());
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<PerfilNotificaciones | null>(null);
  const [cargando, setCargando] = useState(true);
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const inicializadoRef = useRef(false);

  const cargar = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      setCargando(false);
      return;
    }

    setUsuarioId(user.id);

    const { data: perfilData } = await supabase
      .from("perfiles")
      .select("rol, motorizado_id")
      .eq("id", user.id)
      .maybeSingle<PerfilNotificaciones>();

    const rol = rolUsuario ?? perfilData?.rol ?? null;
    const motorizadoId = perfilData?.motorizado_id ?? null;

    setPerfil({
      rol,
      motorizado_id: motorizadoId,
    });

    let consulta = supabase
      .from("notificaciones")
      .select(
        "id, titulo, mensaje, tipo, enlace, destinatario_rol, destinatario_usuario, motorizado_id, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(40);

    if (rol === "administrador") {
      // El administrador puede ver todos los eventos operativos.
    } else {
      const filtros = [
        `destinatario_usuario.eq.${user.id}`,
        rol ? `destinatario_rol.eq.${rol}` : "",
        motorizadoId ? `motorizado_id.eq.${motorizadoId}` : "",
      ].filter(Boolean);

      if (filtros.length > 0) {
        consulta = consulta.or(filtros.join(","));
      }
    }

    const { data: notificacionesData, error } = await consulta;

    if (error) {
      console.error("No se pudieron cargar las notificaciones:", error);
      setCargando(false);
      return;
    }

    const lista = (notificacionesData ?? []) as Notificacion[];
    setNotificaciones(lista);

    if (lista.length > 0) {
      const { data: lecturasData } = await supabase
        .from("notificaciones_lecturas")
        .select("notificacion_id")
        .eq("usuario_id", user.id)
        .in(
          "notificacion_id",
          lista.map((item) => item.id)
        );

      setLeidas(
        new Set(
          ((lecturasData ?? []) as Lectura[]).map(
            (lectura) => lectura.notificacion_id
          )
        )
      );
    } else {
      setLeidas(new Set());
    }

    setCargando(false);
  }, [rolUsuario, supabase]);

  useEffect(() => {
    void cargar();

    const canal = supabase
      .channel("centro-notificaciones")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificaciones",
        },
        (evento) => {
          const nueva = evento.new as Notificacion;
          const rol = rolUsuario ?? perfil?.rol ?? null;
          const corresponde =
            rol === "administrador" ||
            nueva.destinatario_usuario === usuarioId ||
            nueva.destinatario_rol === rol ||
            (perfil?.motorizado_id != null &&
              nueva.motorizado_id === perfil.motorizado_id);

          if (!corresponde) return;

          setNotificaciones((actuales) => [
            nueva,
            ...actuales.filter((item) => item.id !== nueva.id),
          ].slice(0, 40));

          if (inicializadoRef.current) {
            try {
              const contexto = new AudioContext();
              const oscilador = contexto.createOscillator();
              const ganancia = contexto.createGain();
              oscilador.connect(ganancia);
              ganancia.connect(contexto.destination);
              oscilador.frequency.value = 660;
              ganancia.gain.value = 0.04;
              oscilador.start();
              oscilador.stop(contexto.currentTime + 0.12);
            } catch {
              // Algunos navegadores bloquean sonidos sin interacción previa.
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificaciones_lecturas",
        },
        (evento) => {
          const lectura = evento.new as {
            notificacion_id: number;
            usuario_id: string;
          };

          if (lectura.usuario_id === usuarioId) {
            setLeidas((actuales) => {
              const siguientes = new Set(actuales);
              siguientes.add(lectura.notificacion_id);
              return siguientes;
            });
          }
        }
      )
      .subscribe();

    inicializadoRef.current = true;

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [cargar, perfil, rolUsuario, supabase, usuarioId]);

  useEffect(() => {
    function cerrarAlHacerClicFuera(evento: MouseEvent) {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(evento.target as Node)
      ) {
        setAbierto(false);
      }
    }

    document.addEventListener("mousedown", cerrarAlHacerClicFuera);
    return () => {
      document.removeEventListener("mousedown", cerrarAlHacerClicFuera);
    };
  }, []);

  const noLeidas = notificaciones.filter(
    (notificacion) => !leidas.has(notificacion.id)
  ).length;

  async function marcarLeida(id: number) {
    if (!usuarioId || leidas.has(id)) return;

    setLeidas((actuales) => {
      const siguientes = new Set(actuales);
      siguientes.add(id);
      return siguientes;
    });

    const { error } = await supabase
      .from("notificaciones_lecturas")
      .upsert(
        {
          notificacion_id: id,
          usuario_id: usuarioId,
        },
        {
          onConflict: "notificacion_id,usuario_id",
        }
      );

    if (error) {
      console.error("No se pudo marcar la notificación:", error);
    }
  }

  async function marcarTodasLeidas() {
    if (!usuarioId) return;

    const pendientes = notificaciones.filter(
      (notificacion) => !leidas.has(notificacion.id)
    );

    if (pendientes.length === 0) return;

    setLeidas(
      new Set(notificaciones.map((notificacion) => notificacion.id))
    );

    const { error } = await supabase
      .from("notificaciones_lecturas")
      .upsert(
        pendientes.map((notificacion) => ({
          notificacion_id: notificacion.id,
          usuario_id: usuarioId,
        })),
        {
          onConflict: "notificacion_id,usuario_id",
        }
      );

    if (error) {
      console.error("No se pudieron marcar las notificaciones:", error);
    }
  }

  return (
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        className={`relative flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-green-500/50 hover:bg-slate-800 ${
          compacto ? "h-11 w-11" : "h-11 gap-2 px-4"
        }`}
        aria-label="Abrir notificaciones"
      >
        <span className={noLeidas > 0 ? "animate-pulse" : ""}>🔔</span>
        {!compacto && <span className="hidden text-sm font-bold md:inline">Avisos</span>}

        {noLeidas > 0 && (
          <span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-black text-white">
            {noLeidas > 99 ? "99+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <section className="fixed inset-x-3 top-20 z-[80] max-h-[75vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-14 sm:w-[390px]">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
            <div>
              <h2 className="font-black">Notificaciones</h2>
              <p className="text-xs text-slate-400">
                {noLeidas} sin leer
              </p>
            </div>

            <button
              type="button"
              onClick={() => void marcarTodasLeidas()}
              className="text-xs font-bold text-green-400 hover:text-green-300"
            >
              Marcar todas
            </button>
          </div>

          <div className="max-h-[62vh] overflow-y-auto">
            {cargando && (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                Cargando avisos…
              </p>
            )}

            {!cargando && notificaciones.length === 0 && (
              <div className="px-5 py-12 text-center">
                <p className="text-3xl">🔕</p>
                <p className="mt-3 font-bold">No hay notificaciones</p>
                <p className="mt-1 text-sm text-slate-400">
                  Los eventos nuevos aparecerán aquí.
                </p>
              </div>
            )}

            {notificaciones.map((notificacion) => {
              const estaLeida = leidas.has(notificacion.id);
              const contenido = (
                <article
                  className={`border-b border-slate-800 px-4 py-4 transition hover:bg-slate-900 ${
                    estaLeida ? "opacity-65" : "bg-green-500/[0.04]"
                  }`}
                  onClick={() => void marcarLeida(notificacion.id)}
                >
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xl">
                      {iconoTipo(notificacion.tipo)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-bold">{notificacion.titulo}</p>
                        {!estaLeida && (
                          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
                        )}
                      </div>

                      {notificacion.mensaje && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                          {notificacion.mensaje}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-slate-500">
                        {tiempoRelativo(notificacion.created_at)}
                      </p>
                    </div>
                  </div>
                </article>
              );

              return notificacion.enlace ? (
                <Link
                  key={notificacion.id}
                  href={notificacion.enlace}
                  onClick={() => {
                    void marcarLeida(notificacion.id);
                    setAbierto(false);
                  }}
                >
                  {contenido}
                </Link>
              ) : (
                <div key={notificacion.id}>{contenido}</div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
