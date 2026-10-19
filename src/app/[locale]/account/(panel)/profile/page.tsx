import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { PasswordForm, ProfileForm } from "@/components/shop/account/ProfileForms";

export default async function ProfilePage({ params }: PageProps<"/[locale]/account/profile">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireUser(localePath(locale, "/account/login"));
  return (
    <div className="space-y-6">
      <ProfileForm user={{ firstName: user.firstName, lastName: user.lastName, phone: user.phone, email: user.email, newsletter: user.newsletter }} />
      <PasswordForm />
    </div>
  );
}
