import { notFound } from "next/navigation";
import { getTranscriptionById } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type Turn = {
  role: "agent" | "user" | "unknown";
  text: string;
};

function formatDate(fecha: Date | null) {
  if (!fecha) return "Sin fecha";
  return new Date(fecha).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseTranscription(raw: string | null): Turn[] {
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  const turns: Turn[] = [];
  let current: Turn | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    let role: Turn["role"] | null = null;
    let content = trimmed;

    if (lower.startsWith("agent:")) {
      role = "agent";
      content = trimmed.slice(6).trim();
    } else if (lower.startsWith("user:")) {
      role = "user";
      content = trimmed.slice(5).trim();
    }

    if (role) {
      if (current) {
        turns.push(current);
      }
      current = { role, text: content };
    } else if (current) {
      current.text += "\n" + trimmed;
    } else {
      current = { role: "unknown", text: trimmed };
    }
  }

  if (current) {
    turns.push(current);
  }

  return turns;
}

export default async function TranscriptionDetailPage({ params }: Props) {
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (Number.isNaN(numericId)) notFound();

  const transcription = await getTranscriptionById(numericId);
  if (!transcription) notFound();

  const turns = parseTranscription(transcription.transcription);

  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col bg-paper px-4 pt-4 sm:px-6 sm:pt-6 md:px-12 md:pt-12"
      aria-label="Transcripción de llamada"
    >
      <header className="shrink-0 border-b border-paper-border bg-paper pb-4 md:pb-6">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="font-serif text-base font-semibold text-paper-ink md:text-lg">
                {transcription.name || transcription.phone || "Transcripción"}
              </h1>
              {transcription.phone && (
                <span className="text-sm text-paper-inkLight">
                  {transcription.phone}
                </span>
              )}
              {transcription.mail && (
                <span className="text-sm text-paper-inkLight">
                  {transcription.mail}
                </span>
              )}
            </div>
            <span className="text-xs text-paper-muted">
              {formatDate(transcription.fecha)}
            </span>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl py-6 md:py-8">
          {turns.length === 0 ? (
            <div className="rounded-xl border border-paper-border bg-paper-card px-4 py-4 text-sm text-paper-muted shadow-sm sm:px-6 sm:py-6">
              Sin contenido de transcripción.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {turns.map((turn, index) => {
                const isUser = turn.role === "user";
                const label =
                  turn.role === "agent"
                    ? "Agente"
                    : turn.role === "user"
                      ? "Usuario"
                      : "Otro";
                return (
                  <div
                    key={index}
                    className={`flex w-full ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-[15px] leading-relaxed sm:max-w-[70%] ${
                        isUser
                          ? "bg-brand text-white"
                          : "border border-paper-border bg-white text-paper-ink"
                      }`}
                    >
                      <p
                        className={`mb-1 text-[11px] font-medium uppercase tracking-wider ${
                          isUser ? "text-white/90" : "text-paper-muted"
                        }`}
                      >
                        {label}
                      </p>
                      <p className="whitespace-pre-wrap">
                        {turn.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

