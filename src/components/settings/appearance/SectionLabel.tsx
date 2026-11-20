import type { LucideIcon } from "lucide-react";

export function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-2 text-muted-foreground">
      <Icon className="size-3.5" />
      <span className="text-xs font-medium">{children}</span>
    </div>
  );
}
