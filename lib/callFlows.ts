import { reportIncident } from "./incidents";
import { query } from "./db";
import { isSystemOn } from "./availability";
import { auditCall, type TranscriptEntry } from "./callAudit";
import { createPhoneCall } from "./retell";
import { requireEnv } from "./env";

const LEADS_TABLE = "eliasymunozabogados_leads";
const TRANSCRIPTIONS_TABLE = "eliasmunozabogados_transcripciones";
const INBOUND_SOURCE = "Llamada directa al teléfono del despacho";
// Motivos por los que la persona no contestó (buzón, ocupado, fallo de línea...). No cuentan como "Contestó".
const NO_ANSWER_REASONS = new Set([
  "dial_no_answer",
  "dial_busy",
  "dial_failed",
  "voicemail_reached",
  "invalid_destination",
  "telephony_provider_unavailable",
]);

export type RetellCall = {
  call_id?: string;
  agent_id?: string;
  transcript_with_tool_calls?: TranscriptEntry[];
  call_status?: string;
  disconnection_reason?: string;
  to_number?: string;
  transcript?: string;
  retell_llm_dynamic_variables?: { name?: string; phone?: string; email?: string };
  call_analysis?: { call_summary?: string; in_voicemail?: boolean };
};

export type RetellWebhookPayload = {
  event?: string;
  call?: RetellCall;
};

export type InboundPayload = {
  call_inbound?: { from_number?: string; agent_id?: string };
};

function phoneOf(call: RetellCall): string {
  return call.retell_llm_dynamic_variables?.phone || call.to_number || "";
}

type LeadForRetry = { name: string | null; email: string | null; summary: string | null; call_attempts: number | null };

async function getLeadForRetry(phone: string): Promise<LeadForRetry | undefined> {
  const { rows } = await query<LeadForRetry>(
    `SELECT name, email, summary, call_attempts FROM ${LEADS_TABLE} WHERE session_id = $1 LIMIT 1`,
    [phone]
  );
  return rows[0];
}

async function setStatus(phone: string, status: string): Promise<void> {
  await query(`UPDATE ${LEADS_TABLE} SET status = $2 WHERE session_id = $1`, [phone, status]);
}

async function markNoAnswer(phone: string, attempts: number): Promise<void> {
  await query(
    `UPDATE ${LEADS_TABLE} SET status = 'no_answer', call_attempts = $2, last_call_at = NOW() WHERE session_id = $1`,
    [phone, attempts]
  );
}

// Si la persona no contesta, se vuelve a llamar en el momento, una sola vez.
// Si tampoco contesta (o el sistema está apagado), queda como "No contesta" y no se llama más.
async function retryOnceOrGiveUp(call: RetellCall, phone: string): Promise<void> {
  const lead = await getLeadForRetry(phone);
  const attempts = lead?.call_attempts ?? 0;

  if (attempts >= 1) {
    await markNoAnswer(phone, 2);
    return;
  }
  if (!(await isSystemOn())) {
    await markNoAnswer(phone, attempts);
    return;
  }

  await query(
    `UPDATE ${LEADS_TABLE} SET status = 'retry_pending', call_attempts = 1, last_call_at = NOW() WHERE session_id = $1`,
    [phone]
  );
  try {
    await createPhoneCall({
      fromNumber: requireEnv("RETELL_FROM_NUMBER"),
      toNumber: phone,
      agentId: requireEnv("RETELL_OUTBOUND_AGENT_ID"),
      dynamicVariables: {
        name: lead?.name ?? call.retell_llm_dynamic_variables?.name ?? "",
        phone,
        email: lead?.email ?? "",
        summaryCase: lead?.summary ?? "",
        source: "Formulario",
      },
    });
  } catch (error) {
    reportIncident("callFlows", error);
    await markNoAnswer(phone, 1);
  }
}

async function setSummary(phone: string, summary: string): Promise<void> {
  await query(`UPDATE ${LEADS_TABLE} SET summary = $2 WHERE session_id = $1`, [phone, summary]);
}

async function insertTranscript(call: RetellCall, phone: string): Promise<void> {
  await query(
    `INSERT INTO ${TRANSCRIPTIONS_TABLE} (transcription, name, phone, mail, fecha) VALUES ($1, $2, $3, $4, NOW())`,
    [
      call.transcript ?? null,
      call.retell_llm_dynamic_variables?.name ?? null,
      phone,
      call.retell_llm_dynamic_variables?.email ?? null,
    ]
  );
}

// Eventos de Retell: call_started (no hace nada), call_ended (estado),
// call_analyzed (resumen y transcripción).
export async function handleRetellCallEvent(payload: RetellWebhookPayload): Promise<void> {
  const call = payload.call ?? {};
  const phone = phoneOf(call);
  if (!phone) return;

  if (payload.event === "call_ended") {
    if (NO_ANSWER_REASONS.has(call.disconnection_reason ?? "")) {
      await retryOnceOrGiveUp(call, phone);
    } else {
      await setStatus(phone, "contacted");
    }
    return;
  }

  if (payload.event === "call_analyzed") {
    const summary = call.call_analysis?.call_summary;
    if (summary) {
      await setSummary(phone, summary);
    }

    const voicemail = call.call_analysis?.in_voicemail === true;
    const notConnected = call.call_status === "not_connected";
    if (!voicemail && !notConnected && call.transcript) {
      await insertTranscript(call, phone);
    }

    // Doble confirmación: comprueba si el agente usó la herramienta que el cliente necesitaba.
    const entries = call.transcript_with_tool_calls ?? [];
    if (entries.length) {
      const toolNames = Array.from(new Set(entries.filter((e) => e.role === "tool_call_invocation").map((e) => e.name ?? "").filter(Boolean)));
      try {
        await auditCall({ callId: call.call_id ?? "", phone, agentId: call.agent_id ?? "", transcript: entries, toolNames });
      } catch (error) {
        reportIncident("callFlows", error);
        // Un fallo en la auditoría no debe afectar al resto del evento.
      }
    }
  }
}

type LeadRow = { name: string | null; email: string | null; summary: string | null };

// Llamada entrante: devuelve las variables dinámicas al agente de voz y crea el lead si no existe.
export async function handleInboundCall(payload: InboundPayload) {
  const fromNumber = payload.call_inbound?.from_number;
  if (!fromNumber) {
    throw new Error("Falta call_inbound.from_number");
  }

  const { rows } = await query<LeadRow>(
    `SELECT name, email, summary FROM ${LEADS_TABLE} WHERE session_id = $1 OR phone = $1 ORDER BY created_at DESC LIMIT 1`,
    [fromNumber]
  );

  let lead: LeadRow | undefined = rows[0];
  if (!lead) {
    await query(
      `INSERT INTO ${LEADS_TABLE} (session_id, phone, source, status) VALUES ($1, $1, $2, 'pending_contact')`,
      [fromNumber, INBOUND_SOURCE]
    );
    lead = { name: null, email: null, summary: null };
  }

  return {
    call_inbound: {
      dynamic_variables: {
        name: lead.name ?? "",
        phone: fromNumber,
        email: lead.email ?? "",
        summaryCase: lead.summary ?? "",
      },
    },
  };
}
