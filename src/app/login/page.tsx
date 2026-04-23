import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getOptionalAppUser } from "@/lib/auth/user";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const appUser = await getOptionalAppUser();
  const params = await searchParams;

  if (appUser) {
    redirect("/dashboard");
  }

  return <LoginForm initialError={params.error} />;
}
