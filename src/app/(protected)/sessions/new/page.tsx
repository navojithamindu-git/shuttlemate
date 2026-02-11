import { SessionForm } from "@/components/sessions/session-form";

export default function NewSessionPage() {
  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Create a Session</h1>
      <SessionForm />
    </div>
  );
}
