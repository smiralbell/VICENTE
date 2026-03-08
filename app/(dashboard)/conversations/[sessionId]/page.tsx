import { getMessagesBySessionId, getLeadBySessionId } from "@/lib/db";
import ConversationHeader from "./ConversationHeader";
import ChatBubble from "./ChatBubble";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default async function ConversationDetailPage({ params }: Props) {
  const { sessionId } = await params;
  const decodedId = decodeURIComponent(sessionId);

  const [messages, lead] = await Promise.all([
    getMessagesBySessionId(decodedId),
    getLeadBySessionId(decodedId),
  ]);

  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col bg-paper px-4 pt-4 sm:px-6 sm:pt-6 md:px-12 md:pt-12"
      aria-label="Conversación"
    >
      <ConversationHeader lead={lead} sessionId={decodedId} />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="w-full pt-10 pb-12">
          {messages.length === 0 ? (
            <div className="mx-auto w-full max-w-6xl">
              <div className="flex flex-col items-center justify-center py-24">
                <p className="text-sm text-paper-muted">
                  No hay mensajes en esta conversación.
                </p>
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
  );
}
