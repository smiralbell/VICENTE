"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import ConversationsSidebar from "./ConversationsSidebar";

type Props = {
  children: React.ReactNode;
};

function SidebarFallback() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <span className="text-sm text-paper-muted">Cargando…</span>
    </div>
  );
}

export default function ConversationsLayout({ children }: Props) {
  const pathname = usePathname();
  const isConversationPage = pathname !== "/conversations" && pathname.startsWith("/conversations/");
  const showSidebarMobile = !isConversationPage;
  const showChatMobile = isConversationPage;

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-8rem)] w-full shrink-0 gap-0 overflow-hidden sm:-mx-6 md:-mx-10 md:-my-8 md:h-screen lg:-mx-14">
      <div
        className={`h-full shrink-0 flex-col overflow-hidden md:w-[320px] ${
          showSidebarMobile ? "flex w-full" : "hidden md:flex"
        }`}
      >
        <Suspense fallback={<SidebarFallback />}>
          <ConversationsSidebar />
        </Suspense>
      </div>
      <div
        className={`flex h-full min-w-0 flex-1 flex-col overflow-hidden ${
          showChatMobile ? "flex" : "hidden md:flex"
        }`}
      >
        {showChatMobile && (
          <div className="flex shrink-0 items-center gap-2 border-b border-paper-border bg-paper px-4 py-3 md:hidden">
            <Link
              href="/conversations"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-paper-ink hover:bg-paper-border focus:outline-none focus:ring-2 focus:ring-brand"
              aria-label="Volver a conversaciones"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-sm font-medium text-paper-ink">Conversación</span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
