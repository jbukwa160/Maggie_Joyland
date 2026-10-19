import { SearchX } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/admin/ui";

export default function AdminNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Не намерихме тази страница"
      text="Записът може да е изтрит или адресът да е грешен."
      action={
        <LinkButton href="/admin" variant="primary">
          Към таблото
        </LinkButton>
      }
    />
  );
}
