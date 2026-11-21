import { Container } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <Container className="py-16">
      <EmptyState title="Off the map" body="This page, model or provider isn't in the atlas. It may have been renamed or delisted at the source." action={{ href: "/models", label: "Browse all models" }} />
    </Container>
  );
}
