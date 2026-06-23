import type { Lead } from "./db";

export type LeadWithNavigation = Lead & {
  transcriptionId?: number | null;
  resolvedSessionId?: string | null;
};

export function isFormularioSource(source: string | null): boolean {
  if (!source) return false;
  return source.trim().toLowerCase().includes("formulario");
}

export function isWebChatSource(source: string | null): boolean {
  if (!source) return false;
  const normalized = source.trim().toLowerCase();
  return normalized.includes("web chat") || normalized === "webchat";
}

export function getLeadNavigationPath(lead: LeadWithNavigation): string {
  if (isFormularioSource(lead.source)) {
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
