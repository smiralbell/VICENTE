import { Suspense } from "react";
import { getLeadsPaginated, isLeadSortField } from "@/lib/db";
import LeadsTable from "./LeadsTable";
import LeadsToolbar from "./LeadsToolbar";

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams: Promise<{ page?: string; q?: string; order?: string; sort?: string }>;
};

export default async function LeadsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const search = params.q?.trim() ?? "";
  const order = params.order === "asc" ? "asc" : "desc";
  const sortField = isLeadSortField(params.sort ?? "") ? params.sort! : "created_at";

  const { leads, total } = await getLeadsPaginated(
    page,
    PAGE_SIZE,
    search || undefined,
    order,
    sortField as import("@/lib/db").LeadSortField
  );
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="w-full">
      <Suspense
        fallback={
          <div className="mb-6 h-10 w-full animate-pulse rounded border border-paper-border bg-paper" />
        }
      >
        <div className="mb-6 w-full">
          <LeadsToolbar defaultValue={search} page={page} total={total} totalPages={totalPages} />
        </div>
      </Suspense>

      <div className="border-t border-paper-border">
        <LeadsTable
          leads={leads}
          sortField={sortField}
          order={order}
          search={search}
          page={page}
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
                href={buildPageUrl(page - 1, search, sortField, order)}
                className="min-h-[44px] rounded px-4 py-2.5 text-sm text-paper-inkLight hover:bg-paper hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
              >
                ← Anterior
              </a>
            )}
            {page < totalPages && (
              <a
                href={buildPageUrl(page + 1, search, sortField, order)}
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
  order: string
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (search) params.set("q", search);
  if (sortField !== "created_at") params.set("sort", sortField);
  if (order !== "desc") params.set("order", order);
  return `/leads?${params.toString()}`;
}
