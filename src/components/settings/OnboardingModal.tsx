import { BaseModal } from "../shared/BaseModal";
import { useStepTransition } from "@/hooks/useStepTransition";
import { useOnboardingDraft, type OnboardingMode } from "@/hooks/useOnboardingDraft";
import { cn } from "@/lib/utils";
import { ONBOARDING_STEPS } from "./onboarding/steps";
import { StepIndicator } from "./onboarding/StepIndicator";
import { OnboardingFooter } from "./onboarding/OnboardingFooter";
import { NameStep } from "./onboarding/NameStep";
import { AvatarStep } from "./onboarding/AvatarStep";
import { ThemeStep } from "./onboarding/ThemeStep";

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: OnboardingMode;
}

export function OnboardingModal({
  open,
  onOpenChange,
  mode = "onboarding",
}: OnboardingModalProps) {
  const { step, slideDirection, animating, goToStep, restart } = useStepTransition();
  const draft = useOnboardingDraft({ open, mode, onOpenChange, restartSteps: restart });

  return (
    <BaseModal
      open={open}
      onOpenChange={
        mode === "onboarding"
          ? (v) => {
              if (!v) draft.skipAll();
            }
          : onOpenChange
      }
      title={mode === "edit" ? "Editar perfil" : "Personaliza tu experiencia"}
      description={mode === "onboarding" ? "Haz que Rindo se sienta tuyo" : undefined}
      maxWidth="md"
      footer={
        <OnboardingFooter
          mode={mode}
          step={step}
          isLastStep={step === ONBOARDING_STEPS.length - 1}
          saving={draft.saving}
          onStepChange={goToStep}
          onSkip={draft.skipAll}
          onSave={draft.save}
        />
      }
    >
      <StepIndicator step={step} onStepClick={goToStep} />

      <div
        className={cn(
          "transition-all duration-200 ease-out",
          animating && slideDirection === "right" && "opacity-0 translate-x-4",
          animating && slideDirection === "left" && "opacity-0 -translate-x-4",
          !animating && "opacity-100 translate-x-0"
        )}
      >
        {step === 0 && (
          <NameStep
            fullName={draft.fullName}
            nickname={draft.nickname}
            onFullNameChange={draft.setFullName}
            onNicknameChange={draft.setNickname}
          />
        )}

        {step === 1 && (
          <AvatarStep
            avatarSrc={draft.avatarSrc}
            initials={draft.initials}
            uploading={draft.uploading}
            onSelectFile={draft.selectAvatarFile}
            onRemove={draft.removeAvatarPhoto}
          />
        )}

        {step === 2 && <ThemeStep draft={draft.themeDraft} />}
      </div>
    </BaseModal>
  );
}
