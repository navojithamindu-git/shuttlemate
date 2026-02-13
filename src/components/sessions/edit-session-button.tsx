import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export function EditSessionButton({ sessionId }: { sessionId: string }) {
  return (
    <Link href={`/sessions/${sessionId}/edit`}>
      <Button variant="outline">
        <Pencil className="mr-2 h-4 w-4" />
        Edit Session
      </Button>
    </Link>
  );
}
