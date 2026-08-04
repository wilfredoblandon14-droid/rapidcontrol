import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SolicitudAnalisis = {
  mensaje?: unknown;
};

const esquemaPedido = {
  type: "object",
  additionalProperties: false,
  properties: {
    nombre_cliente: { type: "string" },
    telefono: { type: "string" },
    direccion_recogida: { type: "string" },
    direccion_entrega: { type: "string" },
    descripcion: { type: "string" },
    observaciones: { type: "string" },
    metodo_pago: {
      type: "string",
      enum: ["", "Efectivo", "Transferencia", "Tarjeta"],
    },
    tipo_servicio: {
      type: "string",
      enum: ["", "Solo envío", "Compra y envío", "Mandado"],
    },
    confianza: { type: "integer", minimum: 0, maximum: 100 },
    campos_por_confirmar: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "nombre_cliente",
    "telefono",
    "direccion_recogida",
    "direccion_entrega",
    "descripcion",
    "observaciones",
    "metodo_pago",
    "tipo_servicio",
    "confianza",
    "campos_por_confirmar"
  ],
} as const;

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: usuarioData } = await supabase.auth.getUser();

    if (!usuarioData.user) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para utilizar RapidControl IA." },
        { status: 401 }
      );
    }

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", usuarioData.user.id)
      .maybeSingle();

    if (!perfil || !["administrador", "despachador"].includes(perfil.rol)) {
      return NextResponse.json(
        { error: "Tu usuario no tiene permiso para analizar pedidos." },
        { status: 403 }
      );
    }

    const cuerpo = (await request.json()) as SolicitudAnalisis;
    const mensaje = typeof cuerpo.mensaje === "string" ? cuerpo.mensaje.trim() : "";

    if (mensaje.length < 8) {
      return NextResponse.json(
        { error: "Pega un mensaje más completo antes de analizarlo." },
        { status: 400 }
      );
    }

    if (mensaje.length > 6000) {
      return NextResponse.json(
        { error: "El mensaje es demasiado largo. Usa únicamente la parte relacionada con el pedido." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "RapidControl IA no está configurado en el servidor." },
        { status: 503 }
      );
    }

    const cliente = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const respuesta = await cliente.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "Eres un asistente de recepción de pedidos para Mandados Rapid en Nicaragua.",
                "Extrae únicamente información explícita o razonablemente clara del mensaje.",
                "No inventes nombres, teléfonos, direcciones, montos ni métodos de pago.",
                "Si un dato no aparece, devuelve una cadena vacía y agrégalo a campos_por_confirmar.",
                "direccion_recogida es el comercio o lugar donde se recoge o compra.",
                "direccion_entrega es el destino final del cliente.",
                "descripcion resume qué se debe comprar, retirar o transportar.",
                "observaciones conserva referencias, horarios, cantidades o instrucciones especiales.",
                "Usa Efectivo, Transferencia o Tarjeta solo cuando el mensaje lo indique.",
                "Usa Compra y envío cuando hay que comprar algo; Solo envío cuando solo se traslada; Mandado para otras gestiones.",
                "El nivel de confianza debe reflejar qué tan completos y claros son los datos.",
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: mensaje }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "pedido_whatsapp",
          description: "Datos estructurados extraídos de un mensaje de cliente.",
          strict: true,
          schema: esquemaPedido,
        },
      },
    });

    if (!respuesta.output_text) {
      return NextResponse.json(
        { error: "La IA no devolvió información utilizable. Intenta nuevamente." },
        { status: 502 }
      );
    }

    const datos = JSON.parse(respuesta.output_text);
    return NextResponse.json({ datos });
  } catch (error) {
    console.error("Error de RapidControl IA:", error);
    return NextResponse.json(
      { error: "No se pudo analizar el mensaje en este momento." },
      { status: 500 }
    );
  }
}
