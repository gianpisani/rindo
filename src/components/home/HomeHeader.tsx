import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PiggyBank, RefreshCw } from "lucide-react";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useLastBankSync } from "@/hooks/useLastBankSync";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { greetingFor, sinceLabel } from "@/lib/home-summary";
import { clpCompact } from "@/lib/format";
import { HomeNotices, type HomeNotice } from "./HomeNotices";
import { initialsOf, profileDisplayName } from "@/lib/profile-name";

interface HomeHeaderProps {
  sweepAlert: { amount: number } | null;
  lastMonthName: Date;
  onSync: () => void;
}

export function HomeHeader({ sweepAlert, lastMonthName, onSync }: HomeHeaderProps) {
  const navigate = useNavigate();
  const { openProfileEdit } = useGlobalDrawers();
  const { profile: userProfile, avatarUrl } = useUserProfile();
  const lastSync = useLastBankSync();

  const displayName = profileDisplayName(userProfile);
  const greetingInitials = initialsOf(displayName || "");

  const notices = useMemo(() => {
    const list: HomeNotice[] = [];
    if (sweepAlert) {
      list.push({
        id: "sweep",
        icon: PiggyBank,
        label: `${clpCompact(sweepAlert.amount)} sin invertir`,
        detail: `Cerraste ${format(lastMonthName, "MMMM", { locale: es })} con ${clpCompact(
          sweepAlert.amount
        )} ahorrados que no barriste a inversión.`,
        tone: "warning",
        onClick: () => navigate("/budget"),
      });
    }
    return list;
  }, [sweepAlert, lastMonthName, navigate]);

  return (
    <header className="inicio-head">
      {displayName && (
        <button onClick={() => openProfileEdit()} className="inicio-avatar" aria-label="Editar perfil">
          <Avatar className="size-full">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" className="object-cover" />}
            <AvatarFallback className="text-xs font-medium">
              {greetingInitials}
            </AvatarFallback>
          </Avatar>
        </button>
      )}
      <h1 className="inicio-hello">
        {greetingFor(new Date().getHours())}{displayName ? `, ${displayName}` : ""}
      </h1>
      <div className="inicio-head-end">
        <HomeNotices notices={notices} className="shrink-0" />
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          onClick={onSync}
          aria-label={lastSync ? `Sincronizar bancos, última vez ${sinceLabel(lastSync)}` : "Sincronizar bancos"}
          title="Sincronizar bancos"
        >
          {lastSync && sinceLabel(lastSync)}
          <RefreshCw aria-hidden />
        </Button>
      </div>
    </header>
  );
}
