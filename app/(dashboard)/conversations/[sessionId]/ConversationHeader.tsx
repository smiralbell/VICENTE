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
      <div className="pb-4 md:pb-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="font-serif text-base font-semibold text-paper-ink md:text-lg">
              {lead?.name ?? "Sin nombre"}
            </h1>
            {lead?.email && (
              <a
                href={`mailto:${lead.email}`}
                className="inline-block min-h-[44px] py-2 text-sm text-paper-muted hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand rounded"
              >
                {lead.email}
              </a>
            )}
            {lead?.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="inline-block min-h-[44px] py-2 text-sm text-paper-muted hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand rounded"
              >
                {lead.phone}
              </a>
            )}
          </div>
          {lead?.summary && (
            <p className="mt-3 text-sm leading-relaxed text-paper-inkLight md:mt-4">
              {lead.summary}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
