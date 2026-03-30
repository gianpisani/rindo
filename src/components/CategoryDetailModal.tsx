import { BaseModal } from "./BaseModal";
import { CategorySpending } from "@/hooks/useCategoryInsights";
import { CategoryDetailContent } from "./CategoryDetailContent";

interface CategoryDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategorySpending | null;
  monthName: string;
}

export function CategoryDetailModal({
  open,
  onOpenChange,
  category,
  monthName,
}: CategoryDetailModalProps) {
  if (!category) return null;

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={`${category.category} - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`}
      maxWidth="xl"
    >
      <CategoryDetailContent category={category} monthName={monthName} />
    </BaseModal>
  );
}
