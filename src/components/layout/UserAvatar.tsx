import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function UserAvatar({
  src,
  initials,
  className,
}: {
  src: string | null;
  initials: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-8 shrink-0 ring-1 ring-border", className)}>
      {src && <AvatarImage src={src} alt="" className="object-cover" />}
      <AvatarFallback className="bg-muted text-xs font-medium">{initials}</AvatarFallback>
    </Avatar>
  );
}
