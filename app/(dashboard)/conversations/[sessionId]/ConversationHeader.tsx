import type { Lead } from "@/lib/db";

type Props = {
  lead: Lead | null;
  sessionId: string;
};

export default function ConversationHeader({ lead }: Props) {
  return (
    <header
      className="shrink-0 border-b border-paper-border bg-paper"
      aria-label="Datos del lead"
    >
      <div className="pb-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="font-serif text-lg font-semibold text-paper-ink">
              {lead?.name ?? "Sin nombre"}
            </h1>
            {lead?.email && (
              <a
                href={`mailto:${lead.email}`}
                className="text-sm text-paper-muted hover:text-brand"
              >
                {lead.email}
              </a>
            )}
            {lead?.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="text-sm text-paper-muted hover:text-brand"
              >
                {lead.phone}
              </a>
            )}
          </div>
          {lead?.summary && (
            <p className="mt-4 text-sm leading-relaxed text-paper-inkLight">
              {lead.summary}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
