import {
  Boxes,
  Building2,
  Compass,
  Cpu,
  FlaskConical,
  GitCompareArrows,
  LayoutDashboard,
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
  icon: LucideIcon;
  hint?: string;
}

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Explore",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/models", label: "Models", icon: Boxes },
      { href: "/discover", label: "Workload finder", icon: Compass },
      { href: "/compare", label: "Compare", icon: GitCompareArrows },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { href: "/rankings", label: "Rankings", icon: Trophy },
      { href: "/benchmarks", label: "Benchmarks", icon: FlaskConical },
      { href: "/ecosystem", label: "Ecosystem", icon: Network },
    ],
  },
  {
    group: "Directory",
    items: [
      { href: "/labs", label: "AI labs", icon: Building2 },
      { href: "/providers", label: "Providers", icon: Server },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/engine", label: "Atlas Engine", icon: Workflow },
      { href: "/methodology", label: "Methodology", icon: Scale },
    ],
  },
];

export const ALL_NAV = NAV.flatMap((g) => g.items);
export { Cpu };
