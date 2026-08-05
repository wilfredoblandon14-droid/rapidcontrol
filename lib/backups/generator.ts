import JSZip from "jszip";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { crearClienteServicio } from "./admin";

type TipoRespaldo = "diario" | "quincenal" | "mensual" | "manual";

type Rango = {
  desde: string;
  hasta: string;
};

type Datos = Record<string, Record<string, unknown>[]>;

const TABLAS = [
  "clientes",
  "pedidos",
  "motorizados",
  "movimientos_caja",
  "sesiones_caja",
  "fondos_motorizado",
  "gastos_motorizado",
  "liquidaciones_motorizado",
  "configuracion_operativa",
  "perfiles",
] as const;

function slugFecha(fecha = new Date()) {
  return fecha.toISOString().replace(/[:.]/g, "-");
}

function rutaBase(tipo: TipoRespaldo, fecha = new Date()) {
  const anio = fecha.getUTCFullYear();
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const nombres: Record<TipoRespaldo, string> = {
    diario: "Diarios",
    quincenal: "Quincenales",
    mensual: "Mensuales",
    manual: "Exportaciones",
  };
  return `${anio}/${mes}/${nombres[tipo]}`;
}

function filtroPorRango(tabla: string, desde: string, hasta: string) {
  if (tabla === "fondos_motorizado" || tabla === "gastos_motorizado") {
    return { columna: "fecha", desde: desde.slice(0, 10), hasta: hasta.slice(0, 10) };
  }
  if (tabla === "configuracion_operativa" || tabla === "perfiles") return null;
  return { columna: "created_at", desde, hasta };
}

async function obtenerDatos(rango?: Rango): Promise<Datos> {
  const supabase = crearClienteServicio();
  const datos: Datos = {};

  for (const tabla of TABLAS) {
    let consulta = supabase.from(tabla).select("*");
    if (rango) {
      const filtro = filtroPorRango(tabla, rango.desde, rango.hasta);
      if (filtro) {
        consulta = consulta.gte(filtro.columna, filtro.desde).lte(filtro.columna, filtro.hasta);
      }
    }
    const { data, error } = await consulta;
    if (error) {
      // Una tabla opcional ausente no debe impedir los demás respaldos.
      datos[tabla] = [{ error: error.message }];
    } else {
      datos[tabla] = (data ?? []) as Record<string, unknown>[];
    }
  }

  return datos;
}

function normalizarCelda(valor: unknown) {
  if (valor == null) return "";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

function crearExcel(datos: Datos, titulo: string): Buffer {
  const libro = XLSX.utils.book_new();
  const resumen = [
    { Campo: "Informe", Valor: titulo },
    { Campo: "Generado", Valor: new Date().toISOString() },
    ...Object.entries(datos).map(([tabla, filas]) => ({
      Campo: tabla,
      Valor: filas.length,
    })),
  ];
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(resumen), "Resumen");

  for (const [tabla, filas] of Object.entries(datos)) {
    const limpias = filas.map((fila) =>
      Object.fromEntries(Object.entries(fila).map(([k, v]) => [k, normalizarCelda(v)]))
    );
    const hoja = XLSX.utils.json_to_sheet(limpias.length ? limpias : [{ Sin_datos: "" }]);
    XLSX.utils.book_append_sheet(libro, hoja, tabla.slice(0, 31));
  }

  return XLSX.write(libro, { type: "buffer", bookType: "xlsx", compression: true });
}

function totalNumero(filas: Record<string, unknown>[], campo: string) {
  return filas.reduce((s, f) => s + Number(f[campo] ?? 0), 0);
}

function crearPdf(datos: Datos, titulo: string, rango?: Rango): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pedidos = datos.pedidos ?? [];
  const movimientos = datos.movimientos_caja ?? [];
  const entregados = pedidos.filter((p) => p.estado === "Entregado");
  const cancelados = pedidos.filter((p) => p.estado === "Cancelado");
  const ingresos = movimientos
    .filter((m) => m.tipo === "Ingreso")
    .reduce((s, m) => s + Number(m.monto ?? 0), 0);
  const egresos = movimientos
    .filter((m) => m.tipo === "Egreso")
    .reduce((s, m) => s + Number(m.monto ?? 0), 0);

  doc.setFontSize(20);
  doc.text("MANDADOS RAPID", 40, 48);
  doc.setFontSize(15);
  doc.text(titulo, 40, 73);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString("es-NI")}`, 40, 92);
  if (rango) doc.text(`Periodo: ${rango.desde.slice(0, 10)} al ${rango.hasta.slice(0, 10)}`, 40, 107);

  autoTable(doc, {
    startY: rango ? 124 : 110,
    head: [["Indicador", "Valor"]],
    body: [
      ["Pedidos", pedidos.length],
      ["Entregados", entregados.length],
      ["Cancelados", cancelados.length],
      ["Clientes", (datos.clientes ?? []).length],
      ["Motorizados", (datos.motorizados ?? []).length],
      ["Ingresos", `C$ ${ingresos.toFixed(2)}`],
      ["Egresos", `C$ ${egresos.toFixed(2)}`],
      ["Balance", `C$ ${(ingresos - egresos).toFixed(2)}`],
      ["Envios entregados", `C$ ${totalNumero(entregados, "costo_envio").toFixed(2)}`],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [22, 163, 74] },
  });

  const topClientes = new Map<string, number>();
  pedidos.forEach((p) => {
    const n = String(p.nombre_cliente ?? "Sin nombre");
    topClientes.set(n, (topClientes.get(n) ?? 0) + 1);
  });
  const ranking = [...topClientes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
      ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24
      : 320,
    head: [["Top clientes", "Pedidos"]],
    body: ranking.length ? ranking : [["Sin datos", 0]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

function crearCsv(filas: Record<string, unknown>[]) {
  if (!filas.length) return "";
  const columnas = [...new Set(filas.flatMap((f) => Object.keys(f)))];
  const escapar = (v: unknown) => `"${normalizarCelda(v).replace(/"/g, '""')}"`;
  return [
    columnas.map(escapar).join(","),
    ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(",")),
  ].join("\n");
}

async function subir(path: string, contenido: Buffer | string, contentType: string) {
  const supabase = crearClienteServicio();
  const { error } = await supabase.storage
    .from("rapidcontrol-respaldos")
    .upload(path, contenido, { contentType, upsert: true });
  if (error) throw error;
}

export async function generarRespaldo({
  tipo,
  rango,
  usuarioId,
}: {
  tipo: TipoRespaldo;
  rango?: Rango;
  usuarioId?: string | null;
}) {
  const supabase = crearClienteServicio();
  const fecha = new Date();
  const datos = await obtenerDatos(rango);
  const base = rutaBase(tipo, fecha);
  const sello = slugFecha(fecha);
  const titulo =
    tipo === "manual"
      ? "Exportacion administrativa personalizada"
      : `Informe administrativo ${tipo}`;

  const zip = new JSZip();
  zip.file("metadata.json", JSON.stringify({ tipo, rango, generado_en: fecha.toISOString() }, null, 2));
  for (const [tabla, filas] of Object.entries(datos)) {
    zip.file(`json/${tabla}.json`, JSON.stringify(filas, null, 2));
    zip.file(`csv/${tabla}.csv`, crearCsv(filas));
  }

  const excel = tipo === "diario" ? null : crearExcel(datos, titulo);
  const pdf = tipo === "diario" ? null : crearPdf(datos, titulo, rango);
  if (excel) zip.file("administracion.xlsx", excel);
  if (pdf) zip.file("administracion.pdf", pdf);
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  const archivos: Array<{ formato: "ZIP" | "PDF" | "XLSX"; path: string; data: Buffer; type: string }> = [
    { formato: "ZIP", path: `${base}/Respaldo_${tipo}_${sello}.zip`, data: zipBuffer, type: "application/zip" },
  ];

  if (pdf && excel) {
    archivos.push(
      { formato: "PDF", path: `${base}/Informe_${tipo}_${sello}.pdf`, data: pdf, type: "application/pdf" },
      { formato: "XLSX", path: `${base}/Informe_${tipo}_${sello}.xlsx`, data: excel, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    );
  }

  const grupo = crypto.randomUUID();
  for (const archivo of archivos) {
    await subir(archivo.path, archivo.data, archivo.type);
    const { error } = await supabase.from("respaldos").insert({
      grupo_id: grupo,
      tipo,
      formato: archivo.formato,
      ruta_storage: archivo.path,
      tamano_bytes: archivo.data.length,
      estado: "Correcto",
      rango_desde: rango?.desde ?? null,
      rango_hasta: rango?.hasta ?? null,
      usuario_id: usuarioId ?? null,
    });
    if (error) throw error;
  }

  return { grupo, archivos: archivos.map(({ formato, path, data }) => ({ formato, path, bytes: data.length })) };
}

export function rangoQuincenaAnterior(fecha = new Date()): Rango {
  const y = fecha.getUTCFullYear();
  const m = fecha.getUTCMonth();
  if (fecha.getUTCDate() === 16) {
    return {
      desde: new Date(Date.UTC(y, m, 1, 0, 0, 0)).toISOString(),
      hasta: new Date(Date.UTC(y, m, 15, 23, 59, 59)).toISOString(),
    };
  }
  const anterior = new Date(Date.UTC(y, m, 0));
  return {
    desde: new Date(Date.UTC(anterior.getUTCFullYear(), anterior.getUTCMonth(), 16, 0, 0, 0)).toISOString(),
    hasta: new Date(Date.UTC(anterior.getUTCFullYear(), anterior.getUTCMonth() + 1, 0, 23, 59, 59)).toISOString(),
  };
}

export function rangoMesAnterior(fecha = new Date()): Rango {
  const primeroActual = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
  const ultimoAnterior = new Date(primeroActual.getTime() - 1000);
  return {
    desde: new Date(Date.UTC(ultimoAnterior.getUTCFullYear(), ultimoAnterior.getUTCMonth(), 1)).toISOString(),
    hasta: ultimoAnterior.toISOString(),
  };
}
