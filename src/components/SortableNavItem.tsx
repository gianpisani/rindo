import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { type RouteConfig } from "@/lib/routes-config";
import { cn } from "@/lib/utils";
import { ComponentType } from "react";
import { LucideIcon } from "lucide-react";

interface SortableNavItemProps {
  route: RouteConfig;
  isHidden: boolean;
  isEditMode: boolean;
  isActive: boolean;
  shortcutNumber?: string;
  onToggleVisibility: () => void;
  onClick?: () => void;
  isMobile?: boolean;
}

export function SortableNavItem({
  route,
  isHidden,
  isEditMode,
  isActive,
  shortcutNumber,
  onToggleVisibility,
  onClick,
  isMobile,
}: SortableNavItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: route.url,
    disabled: !isEditMode,
    transition: {
      duration: 250,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : isEditMode && isHidden ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center rounded-md text-sm",
        !isDragging && "transition-[background-color] duration-150",
        !isEditMode && isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
        !isEditMode && !isActive && "hover:bg-sidebar-accent/50",
        isEditMode && !isDragging && "hover:bg-sidebar-accent/30",
      )}
    >
      {/* Drag handle - only in edit mode */}
      {isEditMode && (
        <button
          className={cn(
            "flex items-center justify-center w-7 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-muted-foreground touch-none",
            "transition-opacity duration-200",
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
      )}

      {/* Route link / content */}
      <button
        onClick={isEditMode ? undefined : onClick}
        disabled={isEditMode}
        className={cn(
          "flex items-center gap-2 flex-1 px-2 py-1.5 min-h-[32px] text-left",
          !isEditMode && "cursor-pointer",
          isEditMode && "cursor-default",
        )}
      >
        <NavItemIcon route={route} isHidden={isHidden} isEditMode={isEditMode} />
        <span className={cn(
          "truncate",
          isHidden && isEditMode && "text-muted-foreground/50 line-through decoration-muted-foreground/30"
        )}>
          {route.title}
        </span>
      </button>

      {/* Right side: shortcut badge or visibility toggle */}
      {isEditMode ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility();
          }}
          className={cn(
            "flex items-center justify-center size-7 rounded-md mr-1 shrink-0 transition-colors",
            isHidden
              ? "text-muted-foreground/40 hover:text-foreground hover:bg-primary/10"
              : "text-primary/70 hover:text-primary hover:bg-primary/10"
          )}
        >
          {isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      ) : (
        !isMobile && shortcutNumber && (
          <span className="flex gap-0.5 opacity-60 mr-2 shrink-0 text-[10px] px-1 py-0.5 bg-muted rounded font-mono">
            {shortcutNumber}
          </span>
        )
      )}
    </div>
  );
}

// ─── Drag overlay (the "ghost" you see while dragging) ──────
export function DragOverlayItem({ route }: { route: RouteConfig }) {
  return (
    <div className="flex items-center rounded-md text-sm bg-sidebar-accent ring-1 ring-primary/30 shadow-xl shadow-black/10 px-1 py-0.5">
      <div className="flex items-center justify-center w-7 shrink-0 text-primary/60">
        <GripVertical className="size-3.5" />
      </div>
      <div className="flex items-center gap-2 flex-1 px-2 py-1.5 min-h-[32px]">
        <NavItemIcon route={route} isHidden={false} isEditMode={false} />
        <span className="truncate font-medium">{route.title}</span>
      </div>
    </div>
  );
}

// ─── Shared icon renderer ───────────────────────────────────
function NavItemIcon({
  route,
  isHidden,
  isEditMode,
}: {
  route: RouteConfig;
  isHidden: boolean;
  isEditMode: boolean;
}) {
  const Icon = route.icon;
  if (route.customIcon) {
    return (
      <img
        src={Icon as string}
        alt={route.title}
        className={cn("size-4", isHidden && isEditMode && "grayscale")}
      />
    );
  }
  const IconComp = Icon as LucideIcon | ComponentType<{ className?: string }>;
  return (
    <IconComp
      className={cn("size-4", isHidden && isEditMode && "text-muted-foreground/50")}
    />
  );
}
