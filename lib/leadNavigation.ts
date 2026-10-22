import type { Lead } from "./db";

export type LeadWithNavigation = Lead & {
  transcriptionId?: number | null;
  resolvedSessionId?: string | null;
};

export function isFormularioSource(source: string | null): boolean {
  if (!source) return false;
  return source.trim().toLowerCase().includes("formulario");
}

// Leads que llegan por llamada (entrante o agendados durante la llamada): su sitio es la transcripción o la ficha.
export function isPhoneSource(source: string | null): boolean {
  return /llamada|\{\{/i.test(source ?? "");
}

export function isWebChatSource(source: string | null): boolean {
  if (!source) return false;
  const normalized = source.trim().toLowerCase();
  return normalized.includes("web chat") || normalized === "webchat";
}

export function getLeadNavigationPath(lead: LeadWithNavigation): string {
  // Formulario y llamadas: se abre su transcripción, igual que en el listado de transcripciones.
  if (isFormularioSource(lead.source) || isPhoneSource(lead.source)) {
    if (lead.transcriptionId) {
      return `/transcriptions/${lead.transcriptionId}`;
    }
    const q = lead.phone?.trim() || lead.email?.trim() || lead.name?.trim();
    if (q) return `/transcriptions?q=${encodeURIComponent(q)}`;
    return `/leads/${lead.id}`;
  }

  const sessionId = lead.resolvedSessionId ?? lead.session_id;
  if (isWebChatSource(lead.source) && sessionId) {
    return `/conversations/${encodeURIComponent(sessionId)}`;
  }

  if (sessionId) {
    return `/conversations/${encodeURIComponent(sessionId)}`;
  }

  return `/leads/${lead.id}`;
}
