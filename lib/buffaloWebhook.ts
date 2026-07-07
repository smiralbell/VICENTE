export function getBuffaloTicketsWebhookUrl(): string {
  if (process.env.BUFFALO_TICKETS_WEBHOOK_URL) {
    return process.env.BUFFALO_TICKETS_WEBHOOK_URL;
  }
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000/api/webhooks/tickets";
  }
  return "https://n8n-crmv2-buffalo.zedf6b.easypanel.host/api/webhooks/tickets";
}

export function getBuffaloWebhookConfig():
  | { url: string; token: string; projectRef: string }
  | null {
  const token = process.env.BUFFALO_TICKETS_WEBHOOK_TOKEN;
  const projectRef = process.env.BUFFALO_PROJECT_REF;
  const url = getBuffaloTicketsWebhookUrl();
  if (!url || !token || !projectRef) return null;
  return { url, token, projectRef };
}

export async function deleteTicketInBuffalo(input: {
  external_id: string;
  ticket_id?: string | null;
}): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const config = getBuffaloWebhookConfig();
  if (!config) {
    return { ok: false, status: 500, data: { error: "Webhook no configurado" } };
  }

  const payload: Record<string, unknown> = {
    action: "delete",
    project_ref: config.projectRef,
    external_id: input.external_id,
  };
  if (input.ticket_id) {
    payload.ticket_id = input.ticket_id;
  }

  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const ok = res.ok && data.ok !== false;
  return { ok, status: res.status, data };
}
