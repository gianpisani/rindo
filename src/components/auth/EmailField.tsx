import { useCallback, useMemo } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  getDomainSuggestion,
  getVisibleDomains,
  hasEmailLocalPart,
  withDomain,
} from "@/lib/email-domains";
import { AUTH_INPUT_CLASS } from "./auth-input-class";

interface EmailFieldProps {
  email: string;
  onEmailChange: (email: string) => void;
}

export function EmailField({ email, onEmailChange }: EmailFieldProps) {
  const domainSuggestion = getDomainSuggestion(email);
  const visibleDomains = getVisibleDomains(email);
  const showDomainUI = hasEmailLocalPart(email);

  const acceptSuggestion = useCallback(() => {
    if (!domainSuggestion) return;
    onEmailChange(withDomain(email, domainSuggestion));
  }, [email, domainSuggestion, onEmailChange]);

  const handleEmailKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.key === "Tab" || e.key === "ArrowRight") && domainSuggestion && showDomainUI) {
        e.preventDefault();
        acceptSuggestion();
      }
    },
    [domainSuggestion, showDomainUI, acceptSuggestion]
  );

  const handleDomainChipClick = useCallback(
    (domain: string) => {
      onEmailChange(withDomain(email, domain));
      const pwInput = document.getElementById("password") as HTMLInputElement | null;
      pwInput?.focus();
    },
    [email, onEmailChange]
  );

  const ghostText = useMemo(() => {
    if (!showDomainUI || !domainSuggestion) return "";
    const partial = email.slice(email.indexOf("@") + 1);
    return domainSuggestion.slice(partial.length);
  }, [email, showDomainUI, domainSuggestion]);

  return (
    <div className="space-y-2">
      <Label htmlFor="email" className="text-xs font-medium text-white/25">
        Correo
      </Label>
      <div className="relative group">
        <Input
          id="email"
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onKeyDown={handleEmailKeyDown}
          className={AUTH_INPUT_CLASS}
          required
          autoComplete="email"
        />
        {showDomainUI && ghostText && (
          <div className="hidden lg:flex absolute inset-0 pointer-events-none items-center px-3">
            <span className="text-transparent text-sm">{email}</span>
            <span className="text-white/15 text-sm">{ghostText}</span>
          </div>
        )}
      </div>
      {showDomainUI && ghostText && (
        <p className="hidden lg:block text-xs text-white/15 ml-1">
          Tab para completar
        </p>
      )}
      {showDomainUI && visibleDomains.length > 0 && (
        <div className="lg:hidden flex flex-wrap gap-1.5 mt-2">
          {visibleDomains.map((domain) => (
            <button
              key={domain}
              type="button"
              onClick={() => handleDomainChipClick(domain)}
              className="px-2 py-1 text-xs rounded-full bg-white/[0.04] border border-white/[0.08] text-white/30 hover:bg-white/[0.08] hover:text-white/50 active:bg-white/[0.1] active:text-white/60 transition-colors"
            >
              @{domain}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
