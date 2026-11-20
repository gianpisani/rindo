import { BaseModal } from "../shared/BaseModal";
import { useStepTransition } from "@/hooks/useStepTransition";
import { useOnboardingDraft, type OnboardingMode } from "@/hooks/useOnboardingDraft";
import { cn } from "@/lib/utils";
import { ONBOARDING_STEPS } from "./onboarding/steps";
import { StepIndicator } from "./onboarding/StepIndicator";
import { OnboardingFooter } from "./onboarding/OnboardingFooter";
import { NameStep } from "./onboarding/NameStep";
import { AvatarStep } from "./onboarding/AvatarStep";
import { ThemeEditor } from "./appearance/ThemeEditor";

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
  const isEdit = mode === "edit";

  const nameStep = (
    <NameStep
      fullName={draft.fullName}
      nickname={draft.nickname}
      onFullNameChange={draft.setFullName}
      onNicknameChange={draft.setNickname}
    />
  );

  const avatarStep = (
    <AvatarStep
      avatarSrc={draft.avatarSrc}
      initials={draft.initials}
      uploading={draft.uploading}
      onSelectFile={draft.selectAvatarFile}
      onRemove={draft.removeAvatarPhoto}
    />
  );

  return (
    <BaseModal
      open={open}
      onOpenChange={
        isEdit
          ? onOpenChange
          : (v) => {
              if (!v) draft.skipAll();
            }
      }
      title={isEdit ? "Perfil" : "Personaliza tu experiencia"}
      description={isEdit ? undefined : "Haz que Rindo se sienta tuyo"}
      maxWidth={isEdit ? "sm" : "md"}
      footer={
        <OnboardingFooter
          mode={mode}
          step={isEdit ? 0 : step}
          isLastStep={isEdit || step === ONBOARDING_STEPS.length - 1}
          saving={draft.saving}
          onStepChange={goToStep}
          onSkip={draft.skipAll}
          onSave={draft.save}
        />
      }
    >
      {isEdit ? (
        <div className="space-y-6">
          {avatarStep}
          {nameStep}
        </div>
      ) : (
        <>
          <StepIndicator step={step} onStepClick={goToStep} />
          <div
            className={cn(
              "transition-all duration-200 ease-out",
              animating && slideDirection === "right" && "opacity-0 translate-x-4",
              animating && slideDirection === "left" && "opacity-0 -translate-x-4",
              !animating && "opacity-100 translate-x-0"
            )}
          >
            {step === 0 && nameStep}
            {step === 1 && avatarStep}
            {step === 2 && <ThemeEditor draft={draft.themeDraft} />}
          </div>
        </>
      )}
    </BaseModal>
  );
}
