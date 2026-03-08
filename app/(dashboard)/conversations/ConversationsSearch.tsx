"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export default function ConversationsSearch({
  defaultValue = "",
}: {
  defaultValue?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      router.push(`/conversations${params.toString() ? `?${params.toString()}` : ""}`);
    },
    [value, router]
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar por session_id"
        className="flex-1 max-w-md px-3 py-2 border border-neutral-300 rounded-md text-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-neutral-800 text-white text-sm font-medium rounded-md hover:bg-neutral-700"
      >
        Buscar
      </button>
    </form>
  );
}
