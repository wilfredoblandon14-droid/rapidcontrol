"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Motorizado = {
  id: number;
  nombre: string;
  telefono: string | null;
  placa: string | null;
  estado: string;
};

type Fondo = {
  id: number;
  motorizado_id: number;
  sesion_caja_id: number | null;
  monto: number;
  fecha: string;
  notas: string | null;
  created_at: string;
};

type Gasto = {
  id: number;
  motorizado_id: number;
  sesion_caja_id: number | null;
  tipo: "Gasolina" | "Recarga" | "Otro";
  monto: number;
  observacion: string | null;
  excepcional: boolean;
  fecha: string;
  created_at: string;
};

type Liquidacion = {
  id: number;
  motorizado_id: number;
  sesion_caja_id: number | null;
  fecha: string;
  fondo_entregado: number;
  envios_generados: number;
  gasolina: number;
  recargas: number;
  otros_gastos: number;
  esperado: number;
  recibido: number;
  diferencia: number;
  notas: string | null;
  created_at: string;
};

type Configuracion = {
  fondo_motorizado: number;
  max_gasolina_mes: number;
  monto_gasolina_sugerido: number;
  max_recargas_mes: number;
  monto_recarga_sugerido: number;
};

type SesionCaja = { id: number; estado: string };
type PedidoEntregado = { motorizado_id: number | null; costo_envio: number | null };

const campo = "w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20";
const hoy = () => new Date().toISOString().slice(0, 10);
const inicioMes = () => {
  const fecha = new Date();
  fecha.setDate(1);
  fecha.setHours(0, 0, 0, 0);
  return fecha.toISOString();
};
const inicioDia = () => {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  return fecha.toISOString();
};

function dinero(valor: number) {
  return new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" }).format(valor || 0);
}

export default function LiquidacionesPage() {
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [pedidos, setPedidos] = useState<PedidoEntregado[]>([]);
  const [sesionCaja, setSesionCaja] = useState<SesionCaja | null>(null);
  const [config, setConfig] = useState<Configuracion>({
    fondo_motorizado: 1500,
    max_gasolina_mes: 5,
    monto_gasolina_sugerido: 400,
    max_recargas_mes: 2,
    monto_recarga_sugerido: 220,
  });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [motorizadoActivo, setMotorizadoActivo] = useState<number | null>(null);
  const [modal, setModal] = useState<"fondo" | "gasto" | "liquidar" | null>(null);

  async function cargar() {
    setCargando(true);
    setError("");
    const [rMotorizados, rFondos, rGastos, rLiquidaciones, rConfig, rSesion, rPedidos] = await Promise.all([
      supabase.from("motorizados").select("id,nombre,telefono,placa,estado").order("nombre"),
      supabase.from("fondos_motorizado").select("id,motorizado_id,sesion_caja_id,monto,fecha,notas,created_at").eq("fecha", hoy()).order("created_at", { ascending: false }),
      supabase.from("gastos_motorizado").select("id,motorizado_id,sesion_caja_id,tipo,monto,observacion,excepcional,fecha,created_at").gte("created_at", inicioMes()).order("created_at", { ascending: false }),
      supabase.from("liquidaciones_motorizado").select("id,motorizado_id,sesion_caja_id,fecha,fondo_entregado,envios_generados,gasolina,recargas,otros_gastos,esperado,recibido,diferencia,notas,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("configuracion_operativa").select("fondo_motorizado,max_gasolina_mes,monto_gasolina_sugerido,max_recargas_mes,monto_recarga_sugerido").eq("id", 1).maybeSingle(),
      supabase.from("sesiones_caja").select("id,estado").eq("estado", "Abierta").maybeSingle(),
      supabase.from("pedidos").select("motorizado_id,costo_envio").eq("estado", "Entregado").gte("created_at", inicioDia()),
    ]);

    const primerError = [rMotorizados.error, rFondos.error, rGastos.error, rLiquidaciones.error, rConfig.error, rSesion.error, rPedidos.error].find(Boolean);
    if (primerError) {
      setError(`${primerError.message}. Ejecuta primero el SQL incluido en la entrega.`);
      setCargando(false);
      return;
    }

    setMotorizados((rMotorizados.data ?? []) as Motorizado[]);
    setFondos((rFondos.data ?? []) as Fondo[]);
    setGastos((rGastos.data ?? []) as Gasto[]);
    setLiquidaciones((rLiquidaciones.data ?? []) as Liquidacion[]);
    setPedidos((rPedidos.data ?? []) as PedidoEntregado[]);
    setSesionCaja((rSesion.data as SesionCaja | null) ?? null);
    if (rConfig.data) setConfig(rConfig.data as Configuracion);
    setCargando(false);
  }

  useEffect(() => { void cargar(); }, []);

  const datos = useMemo(() => motorizados.map((m) => {
    const fondo = fondos.find((f) => f.motorizado_id === m.id);
    const gastosMes = gastos.filter((g) => g.motorizado_id === m.id);
    const gastosHoy = gastosMes.filter((g) => g.fecha === hoy());
    const gasolinaMes = gastosMes.filter((g) => g.tipo === "Gasolina");
    const recargasMes = gastosMes.filter((g) => g.tipo === "Recarga");
    const gasolinaHoy = gastosHoy.filter((g) => g.tipo === "Gasolina").reduce((t, g) => t + Number(g.monto), 0);
    const recargasHoy = gastosHoy.filter((g) => g.tipo === "Recarga").reduce((t, g) => t + Number(g.monto), 0);
    const otrosHoy = gastosHoy.filter((g) => g.tipo === "Otro").reduce((t, g) => t + Number(g.monto), 0);
    const envios = pedidos.filter((p) => p.motorizado_id === m.id).reduce((t, p) => t + Number(p.costo_envio ?? 0), 0);
    const liquidado = liquidaciones.some((l) => l.motorizado_id === m.id && l.fecha === hoy());
    const esperado = Number(fondo?.monto ?? 0) + envios - gasolinaHoy - recargasHoy - otrosHoy;
    return { m, fondo, gasolinaMes, recargasMes, gasolinaHoy, recargasHoy, otrosHoy, envios, esperado, liquidado };
  }), [motorizados, fondos, gastos, pedidos, liquidaciones]);

  const actual = datos.find((d) => d.m.id === motorizadoActivo) ?? null;

  function exito(texto: string) {
    setMensaje(texto);
    window.setTimeout(() => setMensaje(""), 3500);
  }

  async function entregarFondo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actual) return;
    if (!sesionCaja) { setError("Debes abrir Caja antes de entregar fondos."); return; }
    if (actual.fondo) { setError("Este motorizado ya recibió fondo hoy."); return; }
    const form = new FormData(event.currentTarget);
    const monto = Number(form.get("monto") ?? 0);
    const notas = form.get("notas")?.toString().trim() || null;
    if (monto <= 0) { setError("El fondo debe ser mayor que cero."); return; }
    setGuardando(true); setError("");
    const { data: usuario } = await supabase.auth.getUser();
    const { error: e1 } = await supabase.from("fondos_motorizado").insert({ motorizado_id: actual.m.id, sesion_caja_id: sesionCaja.id, monto, fecha: hoy(), notas, usuario_id: usuario.user?.id ?? null });
    if (e1) { setError(e1.message); setGuardando(false); return; }
    const { error: e2 } = await supabase.from("movimientos_caja").insert({ tipo: "Egreso", categoria: "Fondo motorizado", monto, descripcion: `Fondo entregado a ${actual.m.nombre}` });
    if (e2) { setError(`El fondo se guardó, pero no pudo registrarse en Caja: ${e2.message}`); setGuardando(false); await cargar(); return; }
    setModal(null); setGuardando(false); exito(`Fondo de ${dinero(monto)} entregado a ${actual.m.nombre}.`); await cargar();
  }

  async function registrarGasto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actual) return;
    if (!actual.fondo) { setError("Primero debes entregar el fondo diario."); return; }
    const form = new FormData(event.currentTarget);
    const tipo = form.get("tipo")?.toString() as Gasto["tipo"];
    const monto = Number(form.get("monto") ?? 0);
    const observacion = form.get("observacion")?.toString().trim() || null;
    const conteo = tipo === "Gasolina" ? actual.gasolinaMes.length : tipo === "Recarga" ? actual.recargasMes.length : 0;
    const limite = tipo === "Gasolina" ? config.max_gasolina_mes : tipo === "Recarga" ? config.max_recargas_mes : 999;
    const excepcional = conteo >= limite;
    if (monto <= 0) { setError("El gasto debe ser mayor que cero."); return; }
    if (excepcional && !window.confirm(`Este registro supera el límite mensual recomendado (${limite}). ¿Deseas continuar?`)) return;
    setGuardando(true); setError("");
    const { data: usuario } = await supabase.auth.getUser();
    const { error: e } = await supabase.from("gastos_motorizado").insert({ motorizado_id: actual.m.id, sesion_caja_id: sesionCaja?.id ?? null, tipo, monto, observacion, excepcional, fecha: hoy(), usuario_id: usuario.user?.id ?? null });
    if (e) { setError(e.message); setGuardando(false); return; }
    setModal(null); setGuardando(false); exito(`${tipo} registrada para ${actual.m.nombre}.`); await cargar();
  }

  async function liquidar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actual?.fondo) return;
    if (actual.liquidado) { setError("Este motorizado ya fue liquidado hoy."); return; }
    const form = new FormData(event.currentTarget);
    const recibido = Number(form.get("recibido") ?? 0);
    const notas = form.get("notas")?.toString().trim() || null;
    if (recibido < 0) { setError("El efectivo recibido no puede ser negativo."); return; }
    const diferencia = recibido - actual.esperado;
    setGuardando(true); setError("");
    const { data: usuario } = await supabase.auth.getUser();
    const { error: e1 } = await supabase.from("liquidaciones_motorizado").insert({
      motorizado_id: actual.m.id, sesion_caja_id: sesionCaja?.id ?? null, fecha: hoy(),
      fondo_entregado: actual.fondo.monto, envios_generados: actual.envios,
      gasolina: actual.gasolinaHoy, recargas: actual.recargasHoy, otros_gastos: actual.otrosHoy,
      esperado: actual.esperado, recibido, diferencia, notas, usuario_id: usuario.user?.id ?? null,
    });
    if (e1) { setError(e1.message); setGuardando(false); return; }
    const { error: e2 } = await supabase.from("movimientos_caja").insert({ tipo: "Ingreso", categoria: "Liquidación motorizado", monto: recibido, descripcion: `Liquidación recibida de ${actual.m.nombre}. Diferencia: ${dinero(diferencia)}` });
    if (e2) { setError(`La liquidación se guardó, pero no pudo registrarse en Caja: ${e2.message}`); setGuardando(false); await cargar(); return; }
    setModal(null); setGuardando(false); exito(`Liquidación registrada. Diferencia: ${dinero(diferencia)}.`); await cargar();
  }

  return <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm text-slate-400">Control operativo diario</p><h1 className="text-3xl font-black">🛵 Liquidaciones</h1></div>
        <button onClick={() => void cargar()} className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 font-bold hover:bg-slate-800">🔄 Actualizar</button>
      </header>
      {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">❌ {error}</div>}
      {mensaje && <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-green-300">✅ {mensaje}</div>}
      {!sesionCaja && <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">⚠️ Caja está cerrada. Abre Caja antes de entregar fondos.</div>}
      {cargando ? <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center text-slate-400">Cargando liquidaciones...</div> :
      <section className="grid gap-5 xl:grid-cols-2">{datos.map((d) => <article key={d.m.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">{d.m.nombre}</h2><p className="mt-1 text-sm text-slate-400">{d.m.placa || "Sin placa"} · {d.m.estado}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${d.liquidado ? "bg-green-500/15 text-green-300" : d.fondo ? "bg-blue-500/15 text-blue-300" : "bg-slate-800 text-slate-400"}`}>{d.liquidado ? "Liquidado" : d.fondo ? "Fondo entregado" : "Sin fondo"}</span></div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-800/70 p-4"><p className="text-slate-400">Fondo</p><p className="mt-1 text-xl font-black">{dinero(Number(d.fondo?.monto ?? 0))}</p></div>
          <div className="rounded-xl bg-slate-800/70 p-4"><p className="text-slate-400">Envíos hoy</p><p className="mt-1 text-xl font-black text-green-400">{dinero(d.envios)}</p></div>
          <div className="rounded-xl bg-slate-800/70 p-4"><p className="text-slate-400">Gasolina hoy</p><p className="mt-1 font-black text-red-300">-{dinero(d.gasolinaHoy)}</p><p className="mt-1 text-xs text-slate-500">{d.gasolinaMes.length}/{config.max_gasolina_mes} este mes</p></div>
          <div className="rounded-xl bg-slate-800/70 p-4"><p className="text-slate-400">Recargas hoy</p><p className="mt-1 font-black text-red-300">-{dinero(d.recargasHoy)}</p><p className="mt-1 text-xs text-slate-500">{d.recargasMes.length}/{config.max_recargas_mes} este mes</p></div>
        </div>
        <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4"><p className="text-sm text-green-200">Debe entregar</p><p className="mt-1 text-3xl font-black text-green-300">{dinero(d.esperado)}</p><p className="mt-1 text-xs text-green-200/70">Fondo + envíos − gasolina − recargas − otros</p></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button disabled={!sesionCaja || !!d.fondo} onClick={() => {setMotorizadoActivo(d.m.id);setModal("fondo");setError("")}} className="rounded-xl bg-blue-600 px-4 py-3 font-bold disabled:opacity-40">💵 Fondo</button>
          <button disabled={!d.fondo || d.liquidado} onClick={() => {setMotorizadoActivo(d.m.id);setModal("gasto");setError("")}} className="rounded-xl bg-amber-600 px-4 py-3 font-bold disabled:opacity-40">🧾 Gasto</button>
          <button disabled={!d.fondo || d.liquidado} onClick={() => {setMotorizadoActivo(d.m.id);setModal("liquidar");setError("")}} className="rounded-xl bg-green-600 px-4 py-3 font-bold disabled:opacity-40">✅ Liquidar</button>
        </div>
      </article>)}</section>}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-xl font-black">Historial reciente</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="text-slate-400"><tr><th className="p-3">Fecha</th><th className="p-3">Motorizado</th><th className="p-3">Esperado</th><th className="p-3">Recibido</th><th className="p-3">Diferencia</th></tr></thead><tbody>{liquidaciones.map((l) => {const m=motorizados.find(x=>x.id===l.motorizado_id);return <tr key={l.id} className="border-t border-slate-800"><td className="p-3">{l.fecha}</td><td className="p-3 font-semibold">{m?.nombre ?? `#${l.motorizado_id}`}</td><td className="p-3">{dinero(l.esperado)}</td><td className="p-3">{dinero(l.recibido)}</td><td className={`p-3 font-black ${l.diferencia===0?"text-green-400":"text-red-400"}`}>{dinero(l.diferencia)}</td></tr>})}</tbody></table></div></section>
    </div>

    {modal && actual && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm text-slate-400">{actual.m.nombre}</p><h2 className="text-2xl font-black">{modal === "fondo" ? "Entregar fondo" : modal === "gasto" ? "Registrar gasto" : "Liquidar turno"}</h2></div><button onClick={()=>setModal(null)} className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800">✕</button></div>
      {modal === "fondo" && <form onSubmit={entregarFondo} className="space-y-4"><label className="block"><span className="mb-2 block font-semibold">Monto</span><input name="monto" type="number" step="0.01" defaultValue={config.fondo_motorizado} className={campo}/></label><label className="block"><span className="mb-2 block font-semibold">Notas</span><textarea name="notas" className={campo}/></label><button disabled={guardando} className="w-full rounded-xl bg-blue-600 px-5 py-3 font-black disabled:opacity-50">{guardando?"Guardando...":"Confirmar entrega"}</button></form>}
      {modal === "gasto" && <form onSubmit={registrarGasto} className="space-y-4"><label className="block"><span className="mb-2 block font-semibold">Tipo</span><select name="tipo" className={campo} onChange={(e)=>{const input=e.currentTarget.form?.elements.namedItem("monto") as HTMLInputElement|null;if(input)input.value=e.target.value==="Gasolina"?String(config.monto_gasolina_sugerido):e.target.value==="Recarga"?String(config.monto_recarga_sugerido):"0"}}><option>Gasolina</option><option>Recarga</option><option>Otro</option></select></label><label className="block"><span className="mb-2 block font-semibold">Monto</span><input name="monto" type="number" step="0.01" defaultValue={config.monto_gasolina_sugerido} className={campo}/></label><label className="block"><span className="mb-2 block font-semibold">Observación</span><textarea name="observacion" required className={campo}/></label><button disabled={guardando} className="w-full rounded-xl bg-amber-600 px-5 py-3 font-black disabled:opacity-50">{guardando?"Guardando...":"Registrar gasto"}</button></form>}
      {modal === "liquidar" && <form onSubmit={liquidar} className="space-y-4"><div className="rounded-xl bg-slate-800 p-4"><p className="text-sm text-slate-400">Efectivo esperado</p><p className="mt-1 text-3xl font-black text-green-400">{dinero(actual.esperado)}</p></div><label className="block"><span className="mb-2 block font-semibold">Efectivo recibido</span><input name="recibido" type="number" step="0.01" defaultValue={actual.esperado.toFixed(2)} className={campo}/></label><label className="block"><span className="mb-2 block font-semibold">Notas</span><textarea name="notas" className={campo}/></label><button disabled={guardando} className="w-full rounded-xl bg-green-600 px-5 py-3 font-black disabled:opacity-50">{guardando?"Guardando...":"Cerrar liquidación"}</button></form>}
    </div></div>}
  </main>;
}
