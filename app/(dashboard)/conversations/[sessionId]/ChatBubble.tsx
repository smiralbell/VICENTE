type ChatBubbleProps = {
  id: number;
  message: Record<string, unknown>;
};

function getRole(msg: Record<string, unknown>): "user" | "assistant" {
  const role = msg.role ?? msg.roleName ?? msg.type;
  if (role == null) return "assistant";
  const r = String(role).toLowerCase();
  if (r === "user" || r === "human") return "user";
  return "assistant";
}

function getText(msg: Record<string, unknown>): string | null {
  const text = msg.text ?? msg.content ?? msg.message ?? msg.body;
  if (typeof text === "string") return text;
  return null;
}

export default function ChatBubble({ id, message }: ChatBubbleProps) {
  const role = getRole(message);
  const text = getText(message);
  const isUser = role === "user";

  const content =
    text != null ? (
      <p
        className={
          isUser
            ? "whitespace-pre-wrap text-[15px] leading-relaxed text-white"
            : "whitespace-pre-wrap text-[15px] leading-relaxed text-paper-ink"
        }
      >
        {text}
      </p>
    ) : (
      <pre
        className={
          isUser
            ? "overflow-x-auto text-xs leading-relaxed text-white/95"
            : "overflow-x-auto rounded-md bg-paper px-3 py-2 text-xs leading-relaxed text-paper-inkLight"
        }
      >
        {JSON.stringify(message, null, 2)}
      </pre>
    );

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
      data-role={role}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2.5 sm:max-w-[70%] ${
          isUser
            ? "bg-brand text-white"
            : "border border-paper-border bg-white"
        }`}
      >
        <p
          className={
            isUser
              ? "mb-2 text-[11px] font-medium uppercase tracking-wider text-white/90"
              : "mb-2 text-[11px] font-medium uppercase tracking-wider text-paper-muted"
          }
        >
          {isUser ? "Usuario" : "Asistente"}
          <span className="ml-2 font-normal normal-case">#{id}</span>
        </p>
        {content}
      </div>
    </div>
  );
}
