import { query } from "./db";
import { requireEnv } from "./env";
import { chatCompletion } from "./openai";

const AUDIT_TABLE = "eliasymunozabogados_call_audits";

export type TranscriptEntry = {
  role: string;
  content?: string;
  name?: string;
  arguments?: string;
};

export type AuditInput = {
  callId: string;
  phone: string;
  agentId: string;
  transcript: TranscriptEntry[];
  toolNames: string[];
};

export type AuditResult = {
  user_requested_derivation: boolean;
  user_requested_appointment: boolean;
  used_derivation_tool: boolean;
  used_appointment_tool: boolean;
  problem: string | null;
  explanation: string;
};

// Las herramientas de Retell se identifican por su nombre. Si cambias el nombre
// en Retell, hay que añadirlo aquí.
function isDerivationTool(name: string): boolean {
  return /deriv/i.test(name);
}
function isAppointmentTool(name: string): boolean {
  return /agend|cita|consulta/i.test(name);
}

function transcriptToText(entries: TranscriptEntry[]): string {
  return entries
    .map((e) => {
      if (e.role === "agent") return `Agente: ${e.content ?? ""}`;
      if (e.role === "user") return `Cliente: ${e.content ?? ""}`;
      if (e.role === "tool_call_invocation") return `[Herramienta usada: ${e.name ?? "?"} ${e.arguments ?? ""}]`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

// Analiza la transcripción: ¿pidió el cliente derivación o cita, y el agente usó la herramienta?
export async function auditCall(input: AuditInput): Promise<AuditResult> {
  const text = transcriptToText(input.transcript);
  const toolNames = input.toolNames.join(", ") || "ninguna";

  const instructions =
    "Eres un auditor de llamadas de un despacho de abogados. Analiza la transcripción y responde SOLO con JSON con estas claves: " +
    "user_requested_derivation (boolean: el cliente pidió hablar con una persona o abogado concreto), " +
    "user_requested_appointment (boolean: el cliente quiso una cita o consulta), " +
    "used_derivation_tool (boolean: el agente usó una herramienta de derivación), " +
    "used_appointment_tool (boolean: el agente usó una herramienta de agendar consulta), " +
    "problem (string o null: si el cliente lo pidió y el agente no usó la herramienta correspondiente, explícalo; si no hay problema, null), " +
    "explanation (string breve en español).";

  const reply = await chatCompletion(requireEnv("OPENAI_CHAT_MODEL"), [
    { role: "system", content: instructions },
    { role: "user", content: `Herramientas usadas en la llamada: ${toolNames}\n\nTranscripción:\n${text}` },
  ]);

  const parsed = JSON.parse(reply.content ?? "{}") as Partial<AuditResult>;
  const derivationTool = input.toolNames.some(isDerivationTool) || parsed.used_derivation_tool === true;
  const appointmentTool = input.toolNames.some(isAppointmentTool) || parsed.used_appointment_tool === true;

  const result: AuditResult = {
    user_requested_derivation: parsed.user_requested_derivation === true,
    user_requested_appointment: parsed.user_requested_appointment === true,
    used_derivation_tool: derivationTool,
    used_appointment_tool: appointmentTool,
    problem: parsed.problem ?? null,
    explanation: parsed.explanation ?? "",
  };

  // Comprobación determinista: el modelo puede equivocarse con la lista de herramientas.
  const missing: string[] = [];
  if (result.user_requested_derivation && !result.used_derivation_tool) missing.push("derivación");
  if (result.user_requested_appointment && !result.used_appointment_tool) missing.push("cita");
  if (missing.length && !result.problem) {
    result.problem = `El cliente pidió ${missing.join(" y ")} y el agente no usó la herramienta correspondiente.`;
  }

  await query(
    `INSERT INTO ${AUDIT_TABLE}
     (call_id, phone, agent_id, user_requested_derivation, user_requested_appointment, used_derivation_tool, used_appointment_tool, problem, explanation)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.callId,
      input.phone,
      input.agentId,
      result.user_requested_derivation,
      result.user_requested_appointment,
      result.used_derivation_tool,
      result.used_appointment_tool,
      result.problem,
      result.explanation,
    ]
  );

  return result;
}
