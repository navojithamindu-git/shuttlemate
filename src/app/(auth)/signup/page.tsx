import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Join ShuttleMates</h1>
          <p className="text-muted-foreground mt-2">
            Create an account and find badminton partners near you
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
