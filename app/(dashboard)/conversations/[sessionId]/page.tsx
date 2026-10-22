import { getMessagesBySessionId, getLeadBySessionId } from "@/lib/db";
import ChatBubble from "./ChatBubble";
import LeadPanel from "../../leads/LeadPanel";
import { getChatDatos } from "@/lib/chat/datos";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default async function ConversationDetailPage({ params }: Props) {
  const { sessionId } = await params;
  const decodedId = decodeURIComponent(sessionId);

  const [messages, lead, datos] = await Promise.all([
    getMessagesBySessionId(decodedId),
    getLeadBySessionId(decodedId),
    getChatDatos(decodedId),
  ]);

  return (
    <div className="flex h-full min-h-0 flex-1">
      <section
        className="flex min-w-0 flex-1 flex-col bg-paper px-4 pt-4 sm:px-6 md:px-8 md:pt-4"
        aria-label="Conversación"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="w-full pt-10 pb-12">
            {messages.length === 0 ? (
              <div className="mx-auto w-full max-w-6xl">
                <div className="flex flex-col items-center justify-center py-24">
                  <p className="text-sm text-paper-muted">No hay mensajes en esta conversación.</p>
                </div>
              </div>
            ) : (
              <div className="w-full pt-8">
                <div className="flex w-full flex-col gap-6">
                  {messages.map((m) => (
                    <ChatBubble key={m.id} id={m.id} message={m.message} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-paper-border bg-paper-card p-5 xl:block">
        <LeadPanel
          lead={lead}
          fallback={{
            name: datos.name || null,
            phone: datos.phone || (decodedId.startsWith("+") ? decodedId : null),
            email: datos.email || null,
          }}
          summaryLabel="Resumen de la conversación"
        />
      </aside>
    </div>
  );
}
