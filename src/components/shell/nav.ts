import {
  Boxes,
  Building2,
  Compass,
  FlaskConical,
  GitCompareArrows,
  Map,
  Network,
  Scale,
  Server,
  Trophy,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  sheet: string;
  icon: LucideIcon;
}

/** The atlas index: every page is a numbered sheet. */
export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Survey",
    items: [
      { href: "/", label: "Overview", sheet: "01", icon: Map },
      { href: "/models", label: "Models", sheet: "02", icon: Boxes },
      { href: "/discover", label: "Workload finder", sheet: "03", icon: Compass },
      { href: "/compare", label: "Compare", sheet: "04", icon: GitCompareArrows },
    ],
  },
  {
    group: "Measurements",
    items: [
      { href: "/rankings", label: "Rankings", sheet: "05", icon: Trophy },
      { href: "/benchmarks", label: "Benchmarks", sheet: "06", icon: FlaskConical },
      { href: "/ecosystem", label: "Ecosystem", sheet: "07", icon: Network },
    ],
  },
  {
    group: "Gazetteer",
    items: [
      { href: "/labs", label: "AI labs", sheet: "08", icon: Building2 },
      { href: "/providers", label: "Providers", sheet: "09", icon: Server },
    ],
  },
  {
    group: "Field notes",
    items: [
      { href: "/engine", label: "Atlas Engine", sheet: "10", icon: Workflow },
      { href: "/methodology", label: "Methodology", sheet: "11", icon: Scale },
    ],
  },
];

export const ALL_NAV = NAV.flatMap((g) => g.items);
