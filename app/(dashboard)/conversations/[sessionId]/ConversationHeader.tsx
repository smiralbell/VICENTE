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
      <div className="pb-4 md:pb-6">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="font-serif text-base font-semibold text-paper-ink md:text-lg">
                {lead?.name ?? "Sin nombre"}
              </h1>
              {lead?.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="text-sm text-paper-inkLight hover:text-brand"
                >
                  {lead.phone}
                </a>
              )}
              {lead?.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="text-sm text-paper-inkLight hover:text-brand"
                >
                  {lead.email}
                </a>
              )}
            </div>
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
