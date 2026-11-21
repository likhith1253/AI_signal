import Link from "next/link";
import type { ModelCard } from "@/server/queries/models";
import { fmtPrice, fmtTokens } from "@/lib/format";
import { LabMark } from "../identity/LabMark";
import { ScoreDial } from "./bits";

export function MiniModelList({ models, showLab = true }: { models: ModelCard[]; showLab?: boolean }) {
  return (
    <ul>
      {models.map((m) => (
        <li key={m.slug} className="border-b border-line last:border-0">
          <Link href={`/models/${m.slug}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
            {showLab && <LabMark slug={m.lab.slug} size={24} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-ink">{m.name}</span>
              <span className="num block text-[11px] text-ink-3">
                {fmtPrice(m.pricing.blended)} blended · {fmtTokens(m.contextLength)} ctx
              </span>
            </span>
            <ScoreDial score={m.score?.overall} confidence={m.score?.confidence} size={30} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
