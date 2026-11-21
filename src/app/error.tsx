"use client";
import { useEffect } from "react";
import { Container } from "@/components/ui/primitives";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-[480px] rounded-none border border-line bg-surface p-6 text-center">
        <div className="font-display text-[22px] text-ink">Something went wrong loading this view</div>
        <p className="mt-2 text-[13.5px] text-ink-2">The data service may be temporarily unavailable. Nothing you did caused this.</p>
        {error.digest && <p className="num mt-2 text-[11px] text-ink-3">ref {error.digest}</p>}
        <button onClick={reset} className="mt-4 rounded-none bg-ink px-4 py-2 text-[13px] text-bg">
          Try again
        </button>
      </div>
    </Container>
  );
}
