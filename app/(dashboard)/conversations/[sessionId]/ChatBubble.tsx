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
  const type = typeof msg.type === "string" ? msg.type.toLowerCase() : null;

  // Ocultar mensajes internos de tools/sistema; solo mostramos usuario y respuestas de IA
  if (type && type !== "ai" && type !== "assistant" && type !== "human" && type !== "user") {
    return null;
  }

  const raw = msg.text ?? msg.content ?? msg.message ?? msg.body;
  if (typeof raw !== "string") return null;

  const text = raw.trim();
  if (!text) return null;

  // Ocultar mensajes internos del sistema tipo "Calling tool with input: {...}"
  if (text.startsWith("Calling ") && text.includes(" with input:")) {
    return null;
  }

  // Si viene un JSON de salida, intentar mostrar solo el campo "output"
  if (text.startsWith("[{") && text.endsWith("}]")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed[0] && typeof parsed[0].output === "string") {
        return parsed[0].output;
      }
      return null;
    } catch {
      return null;
    }
  }

  return text;
}

export default function ChatBubble({ id, message }: ChatBubbleProps) {
  const role = getRole(message);
  const text = getText(message);
  const isUser = role === "user";

  // Si no hay texto útil para mostrar, no renderizamos la burbuja
  if (text == null) {
    return null;
  }

  const content = (
    <p
      className={
        isUser
          ? "whitespace-pre-wrap text-[15px] leading-relaxed text-white"
          : "whitespace-pre-wrap text-[15px] leading-relaxed text-paper-ink"
      }
    >
      {text}
    </p>
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
        </p>
        {content}
      </div>
    </div>
  );
}
