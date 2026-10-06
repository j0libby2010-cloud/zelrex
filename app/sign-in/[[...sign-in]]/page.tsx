import { SignIn } from "@clerk/nextjs";
import AuthShell from "@/components/AuthShell";

// Looks come from the shared appearance in lib/clerkAppearance.ts (set on ClerkProvider in app/layout.tsx).
export default function SignInPage() {
  return (
    <AuthShell tagline="Go independent. Get paid." switchText="New to Zelrex?" switchLabel="Create an account" switchHref="/sign-up">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/chat" />
    </AuthShell>
  );
}
