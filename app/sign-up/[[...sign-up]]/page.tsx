import { SignUp } from "@clerk/nextjs";
import AuthShell from "@/components/AuthShell";

// Looks come from the shared appearance in lib/clerkAppearance.ts (set on ClerkProvider in app/layout.tsx).
export default function SignUpPage() {
  return (
    <AuthShell tagline="Build your business. Own your future." switchText="Already have an account?" switchLabel="Sign in" switchHref="/sign-in">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" fallbackRedirectUrl="/chat" />
    </AuthShell>
  );
}
