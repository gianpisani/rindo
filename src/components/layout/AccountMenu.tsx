import type { ReactNode } from "react";
import {
  Bell,
  CalendarRange,
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  Palette,
  UserRound,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar-context";
import { Switch } from "@/components/ui/switch";
import { ColorModeToggle } from "@/components/settings/appearance/ColorModeToggle";
import { COLOR_MODES } from "@/components/settings/appearance/color-modes";
import { useAccountMenu, type AccountMenu as Account } from "@/hooks/useAccountMenu";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";

const keepOpen = (e: Event) => e.preventDefault();

function Identity({ account }: { account: Account }) {
  return (
    <>
      <UserAvatar src={account.avatarUrl} initials={account.initials} />
      <div className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="truncate text-sm font-medium">{account.name}</span>
        {account.email && <span className="truncate text-xs text-muted-foreground">{account.email}</span>}
      </div>
    </>
  );
}

function MenuRow({
  icon: Icon,
  children,
  trailing,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuItem> & { icon: LucideIcon; trailing?: ReactNode }) {
  return (
    <DropdownMenuItem className="gap-3 px-3 py-2" {...props}>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{children}</span>
      {trailing}
    </DropdownMenuItem>
  );
}

function SwitchRow({ icon, label, checked, disabled, onToggle }: {
  icon: LucideIcon;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <MenuRow
      icon={icon}
      role="menuitemcheckbox"
      aria-checked={checked}
      disabled={disabled}
      onSelect={(e) => {
        keepOpen(e);
        onToggle();
      }}
      trailing={<Switch size="sm" checked={checked} tabIndex={-1} aria-hidden className="pointer-events-none" />}
    >
      {label}
    </MenuRow>
  );
}

function ColorModeItems({ account }: { account: Account }) {
  return (
    <div role="group" aria-label="Modo de color" className="mb-1 grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
      {COLOR_MODES.map(({ value, label, icon: Icon }) => {
        const active = account.colorMode === value;
        return (
          <DropdownMenuItem
            key={value}
            role="menuitemradio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onSelect={(e) => {
              keepOpen(e);
              account.setColorMode(value);
            }}
            className={cn(
              "h-8 justify-center rounded-full p-0",
              active ? "bg-card text-foreground focus:bg-card" : "text-muted-foreground focus:bg-card/60",
            )}
          >
            <Icon className="size-4" />
          </DropdownMenuItem>
        );
      })}
    </div>
  );
}

export function AccountMenu() {
  const account = useAccountMenu();
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          tooltip={account.name}
          aria-label={`Cuenta de ${account.name}`}
          className="data-[state=open]:bg-sidebar-accent"
        >
          <Identity account={account} />
          <ChevronsUpDown className="ml-auto text-muted-foreground" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? "right" : "top"}
        align="end"
        sideOffset={8}
        className="w-[--radix-dropdown-menu-trigger-width] min-w-60 max-h-[calc(var(--radix-dropdown-menu-content-available-height)-16px)] overflow-y-auto"
      >
        <ColorModeItems account={account} />
        <MenuRow icon={Palette} onSelect={account.openAppearance}>
          Apariencia
        </MenuRow>
        <MenuRow icon={UserRound} onSelect={account.openProfile}>
          Perfil
        </MenuRow>
        <MenuRow
          icon={CalendarRange}
          onSelect={account.openPeriod}
          trailing={<span className="tabular-nums text-muted-foreground">{account.periodLabel}</span>}
        >
          Mes financiero
        </MenuRow>
        <SwitchRow icon={Volume2} label="Sonidos" checked={account.soundEnabled} onToggle={account.toggleSound} />
        {account.push.isSupported && (
          <SwitchRow
            icon={Bell}
            label="Notificaciones"
            checked={account.push.isSubscribed}
            disabled={account.push.isBusy}
            onToggle={() => account.push.setSubscribed(!account.push.isSubscribed)}
          />
        )}
        <DropdownMenuSeparator className="bg-border" />
        <MenuRow icon={LogOut} onSelect={account.signOut}>
          Cerrar sesión
        </MenuRow>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const rowClass = "flex w-full items-center gap-3 rounded-card px-3 py-2 text-left text-sm font-medium transition-colors active:bg-muted";

function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center text-muted-foreground">
      <Icon className="size-4" />
    </span>
  );
}

function DrawerSwitchRow({ icon, label, checked, disabled, onToggle }: {
  icon: LucideIcon;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <label className={cn(rowClass, disabled && "opacity-60")}>
      <RowIcon icon={icon} />
      <span className="flex-1">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onToggle} aria-label={label} />
    </label>
  );
}

export function AccountSection({ onOpen }: { onOpen: (open: () => void) => void }) {
  const account = useAccountMenu();

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={() => onOpen(account.openProfile)} className={rowClass}>
        <Identity account={account} />
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <div className="px-3 py-2">
        <ColorModeToggle colorMode={account.colorMode} onChange={account.setColorMode} />
      </div>

      <button type="button" onClick={() => onOpen(account.openAppearance)} className={rowClass}>
        <RowIcon icon={Palette} />
        <span className="flex-1">Apariencia</span>
      </button>
      <button type="button" onClick={() => onOpen(account.openPeriod)} className={rowClass}>
        <RowIcon icon={CalendarRange} />
        <span className="flex-1">Mes financiero</span>
        <span className="font-normal tabular-nums text-muted-foreground">{account.periodLabel}</span>
      </button>
      <DrawerSwitchRow icon={Volume2} label="Sonidos" checked={account.soundEnabled} onToggle={account.toggleSound} />
      {account.push.isSupported && (
        <DrawerSwitchRow
          icon={Bell}
          label="Notificaciones"
          checked={account.push.isSubscribed}
          disabled={account.push.isBusy}
          onToggle={() => account.push.setSubscribed(!account.push.isSubscribed)}
        />
      )}
      <button type="button" onClick={() => onOpen(account.signOut)} className={rowClass}>
        <RowIcon icon={LogOut} />
        <span className="flex-1">Cerrar sesión</span>
      </button>
    </div>
  );
}
