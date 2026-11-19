import { query } from "./db";
import { requireEnv } from "./env";
import { chatCompletion } from "./openai";

const AUDIT_TABLE = "eliasymunozabogados_call_audits";

export type TranscriptEntry = {
  role: string;
  content?: string;
  name?: string;
  arguments?: string;
  tool_call_id?: string;
};

export type AuditInput = {
  callId: string;
  phone: string;
  agentId: string;
  transcript: TranscriptEntry[];
  toolNames: string[];
  // Motivo de corte que da Retell (call.disconnection_reason), p. ej. "inactivity" o "user_hangup".
  disconnectionReason?: string;
};

// Retell corta la llamada por inactividad cuando nadie habla durante un rato: siempre cuenta como fallo real.
const INACTIVITY_REASON = "inactivity";
const INACTIVITY_PROBLEM =
  "La llamada se cortó por inactividad: el agente dejó de responder o el cliente se quedó en silencio.";

// Cómo terminó la llamada según el modelo. Solo "fallo_real" cuenta como problema del agente.
export type AuditOutcome = "cliente_desistio" | "comportamiento_esperado" | "fallo_real" | "sin_problema";

const OUTCOME_LABELS: Record<AuditOutcome, string> = {
  cliente_desistio: "[Cliente desistió]",
  comportamiento_esperado: "[Comportamiento esperado]",
  fallo_real: "[Fallo real]",
  sin_problema: "[Sin problema]",
};

function parseOutcome(value: unknown): AuditOutcome | null {
  return typeof value === "string" && Object.hasOwn(OUTCOME_LABELS, value) ? (value as AuditOutcome) : null;
}

export type AuditResult = {
  user_requested_derivation: boolean;
  user_requested_appointment: boolean;
  user_requested_appointment_change: boolean;
  user_requested_appointment_cancel: boolean;
  cancelled_booking_in_call: boolean;
  used_derivation_tool: boolean;
  used_appointment_tool: boolean;
  problem: string | null;
  explanation: string;
  outcome: AuditOutcome | null;
};

// Las herramientas de Retell se identifican por su nombre. Si cambias el nombre
// en Retell, hay que añadirlo aquí.
function isDerivationTool(name: string): boolean {
  return /deriv/i.test(name);
}
export function isAppointmentTool(name: string): boolean {
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
    "user_requested_appointment_change (boolean: el cliente ya tenía una cita y quiso cambiarle el día o la hora; " +
    "false si pidió otra cita distinta para hablar de otro asunto o si era su primera cita), " +
    "user_requested_appointment_cancel (boolean: el cliente pidió anular o cancelar una cita que tenía, sin pedir otra en su lugar; " +
    "false si la cambió por otra fecha), " +
    "cancelled_booking_in_call (boolean: el agente agendó una cita en esta llamada y después, en la misma llamada, el cliente dijo que la anulaba " +
    "o que no la quería, sin pedir otra en su lugar; p. ej. «entonces hay que cancelarlo, no puedo ir a Madrid»), " +
    "used_derivation_tool (boolean: el agente usó una herramienta de derivación), " +
    "used_appointment_tool (boolean: el agente usó una herramienta de agendar consulta), " +
    "problem (string o null: si el cliente lo pidió y el agente no usó la herramienta correspondiente, explícalo; si no hay problema, null), " +
    "explanation (string breve en español), " +
    "outcome (uno de estos valores: " +
    "\"cliente_desistio\": el cliente colgó, rechazó o dudó por el coste, dijo que lo pensaría o dejó de responder antes de agendar o derivar, y el agente iba bien; " +
    "\"comportamiento_esperado\": el agente no usó herramienta pero actuó como debe (número equivocado, " +
    "asunto que el despacho no lleva, anulación de cita, o agendó aunque también pidiera hablar con alguien, o derivó aunque pidiera consulta); " +
    "\"fallo_real\": el cliente seguía dispuesto a continuar y el agente no hizo lo que tocaba (no usó la herramienta, se quedó callado, colgó, " +
    "repitió preguntas sin avanzar o confirmó algo sin herramienta); también es fallo_real si alguien, sea cliente o no, " +
    "pidió hablar con un abogado o con una persona del despacho y el agente no usó la herramienta de derivación ni agendó cita; " +
    "\"sin_problema\": no pidió cita ni derivación, o se hizo todo).";

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
    user_requested_appointment_change: parsed.user_requested_appointment_change === true,
    user_requested_appointment_cancel: parsed.user_requested_appointment_cancel === true,
    cancelled_booking_in_call: parsed.cancelled_booking_in_call === true,
    used_derivation_tool: derivationTool,
    used_appointment_tool: appointmentTool,
    problem: parsed.problem ?? null,
    explanation: parsed.explanation ?? "",
    outcome: parseOutcome(parsed.outcome),
  };

  // Comprobación determinista: el modelo puede equivocarse con la lista de herramientas.
  const missing: string[] = [];
  if (result.user_requested_derivation && !result.used_derivation_tool) missing.push("derivación");
  if (result.user_requested_appointment && !result.used_appointment_tool) missing.push("cita");
  if (missing.length && !result.problem) {
    result.problem = `El cliente pidió ${missing.join(" y ")} y el agente no usó la herramienta correspondiente.`;
  }

  // Corte por inactividad: fallo real decida lo que decida el modelo. Va antes de la regla siguiente
  // para que no se anule el problema. Si ya hay un problema escrito, se mantiene su texto.
  if (input.disconnectionReason === INACTIVITY_REASON) {
    result.outcome = "fallo_real";
    if (!result.problem) result.problem = INACTIVITY_PROBLEM;
  }

  // Si el modelo dice que no fue un fallo del agente (cliente desistió, comportamiento esperado o sin problema),
  // no se marca como problema. Sin outcome válido, todo queda como antes.
  if (result.outcome && result.outcome !== "fallo_real") {
    result.problem = null;
    result.explanation = `${OUTCOME_LABELS[result.outcome]} ${result.explanation}`;
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
