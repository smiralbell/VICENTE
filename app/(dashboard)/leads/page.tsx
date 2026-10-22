import { Suspense } from "react";
import { getLeadsPaginated, getLeadsKpis, isLeadSortField, findTranscriptionIdForLead, findSessionIdForLead } from "@/lib/db";
import { isFormularioSource, isWebChatSource } from "@/lib/leadNavigation";
import { isDateFilter, isLeadStatusFilter, isModalidadFilter, type LeadFilters } from "@/lib/leadFilters";
import LeadsKpis from "./LeadsKpis";
import EstadosLeyenda from "./EstadosLeyenda";
import LeadsTable from "./LeadsTable";
import LeadsToolbar from "./LeadsToolbar";

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    order?: string;
    sort?: string;
    estado?: string;
    modalidad?: string;
    desde?: string;
    hasta?: string;
  }>;
};

export default async function LeadsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const search = params.q?.trim() ?? "";
  const order = params.order === "asc" ? "asc" : "desc";
  const sortField = isLeadSortField(params.sort ?? "") ? params.sort! : "created_at";

  const filters: LeadFilters = {
    status: isLeadStatusFilter(params.estado ?? "") ? params.estado : "",
    modalidad: isModalidadFilter(params.modalidad ?? "") ? params.modalidad : "",
    from: isDateFilter(params.desde ?? "") ? params.desde : "",
    to: isDateFilter(params.hasta ?? "") ? params.hasta : "",
  };

  const [{ leads, total }, kpis] = await Promise.all([
    getLeadsPaginated(
      page,
      PAGE_SIZE,
      search || undefined,
      order,
      sortField as import("@/lib/db").LeadSortField,
      filters
    ),
    getLeadsKpis(),
  ]);

  const leadsWithNavigation = await Promise.all(
    leads.map(async (lead) => {
      if (isFormularioSource(lead.source)) {
        const transcriptionId = await findTranscriptionIdForLead(lead);
        return { ...lead, transcriptionId };
      }

      if (isWebChatSource(lead.source)) {
        const resolvedSessionId = await findSessionIdForLead(lead);
        return { ...lead, resolvedSessionId };
      }

      return lead;
    })
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="w-full">
      <LeadsKpis kpis={kpis} />

      <div className="mb-3 flex justify-end">
        <EstadosLeyenda />
      </div>

      <Suspense
        fallback={
          <div className="mb-6 h-10 w-full animate-pulse rounded border border-paper-border bg-paper" />
        }
      >
        <div className="mb-6 w-full">
          <LeadsToolbar
            defaultValue={search}
            status={filters.status}
            modalidad={filters.modalidad}
            from={filters.from}
            to={filters.to}
            page={page}
            total={total}
            totalPages={totalPages}
          />
        </div>
      </Suspense>

      <div className="border-t border-paper-border">
        <LeadsTable
          leads={leadsWithNavigation}
          sortField={sortField}
          order={order}
          search={search}
          page={page}
          filters={filters}
        />
      </div>

      {totalPages > 1 && (
        <nav
          className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-paper-border pt-4"
          aria-label="Paginación"
        >
          <p className="text-xs text-paper-muted">
            {total} resultado{total !== 1 ? "s" : ""} · página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={buildPageUrl(page - 1, search, sortField, order, filters)}
                className="min-h-[44px] rounded px-4 py-2.5 text-sm text-paper-inkLight hover:bg-paper hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
              >
                ← Anterior
              </a>
            )}
            {page < totalPages && (
              <a
                href={buildPageUrl(page + 1, search, sortField, order, filters)}
                className="min-h-[44px] rounded px-4 py-2.5 text-sm text-paper-inkLight hover:bg-paper hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
              >
                Siguiente →
              </a>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

function buildPageUrl(
  page: number,
  search: string,
  sortField: string,
  order: string,
  filters: LeadFilters
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (search) params.set("q", search);
  if (sortField !== "created_at") params.set("sort", sortField);
  if (order !== "desc") params.set("order", order);
  if (filters.status) params.set("estado", filters.status);
  if (filters.modalidad) params.set("modalidad", filters.modalidad);
  if (filters.from) params.set("desde", filters.from);
  if (filters.to) params.set("hasta", filters.to);
  return `/leads?${params.toString()}`;
}
