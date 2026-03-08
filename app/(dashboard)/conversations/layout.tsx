import ConversationsSidebar from "./ConversationsSidebar";

export const dynamic = "force-dynamic";

type Props = {
  children: React.ReactNode;
};

export default function ConversationsLayout({ children }: Props) {
  return (
    <div className="-mx-8 -my-8 flex h-screen w-full shrink-0 gap-0 overflow-hidden md:-mx-10 lg:-mx-14">
      <ConversationsSidebar />
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
