"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/** URL is the single source of truth for discovery filters (shareable, back-button friendly). */
export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const getList = useCallback((key: string) => (sp.get(key) ?? "").split(",").filter(Boolean), [sp]);

  const update = useCallback(
    (patch: Record<string, string | string[] | null | undefined>, opts: { resetPage?: boolean } = { resetPage: true }) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        const val = Array.isArray(v) ? v.join(",") : v;
        if (val == null || val === "" || val === "false") next.delete(k);
        else next.set(k, val);
      }
      if (opts.resetPage) next.delete("page");
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [sp, router, pathname],
  );

  const toggleInList = useCallback(
    (key: string, value: string) => {
      const cur = getList(key);
      update({ [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] });
    },
    [getList, update],
  );

  return { sp, get: (k: string) => sp.get(k), getList, update, toggleInList, pending };
}
