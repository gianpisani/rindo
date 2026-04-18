import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { type RouteConfig } from "@/lib/routes-config";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
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
  } = useSortable({ id: route.url, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = route.icon;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={false}
      animate={{
        opacity: isEditMode && isHidden ? 0.4 : 1,
        scale: isDragging ? 1.02 : 1,
      }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group relative flex items-center rounded-md text-sm transition-colors",
        isDragging && "z-50 shadow-lg bg-sidebar-accent ring-1 ring-primary/20",
        !isEditMode && isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
        !isEditMode && !isActive && "hover:bg-sidebar-accent/50",
        isEditMode && "hover:bg-sidebar-accent/30",
      )}
    >
      {/* Drag handle - only in edit mode */}
      {isEditMode && (
        <motion.button
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 28 }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-muted-foreground touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </motion.button>
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
        {route.customIcon ? (
          <img
            src={Icon as string}
            alt={route.title}
            className={cn("size-4", isHidden && isEditMode && "grayscale")}
          />
        ) : (
          (Icon as LucideIcon | ComponentType<{ className?: string }>) && (
            <Icon className={cn("size-4", isHidden && isEditMode && "text-muted-foreground/50")} />
          )
        )}
        <span className={cn(
          "truncate",
          isHidden && isEditMode && "text-muted-foreground/50 line-through decoration-muted-foreground/30"
        )}>
          {route.title}
        </span>
      </button>

      {/* Right side: shortcut badge or visibility toggle */}
      {isEditMode ? (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
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
        </motion.button>
      ) : (
        !isMobile && shortcutNumber && (
          <span className="flex gap-0.5 opacity-60 mr-2 shrink-0 text-[10px] px-1 py-0.5 bg-muted rounded font-mono">
            {shortcutNumber}
          </span>
        )
      )}
    </motion.div>
  );
}
