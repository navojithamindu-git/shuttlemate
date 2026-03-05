"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { deleteRecurringGroup } from "@/lib/actions/groups";

interface DeleteGroupButtonProps {
  groupId: string;
  groupName: string;
}

export function DeleteGroupButton({ groupId, groupName }: DeleteGroupButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteRecurringGroup(groupId);
      } catch (err) {
        if (err instanceof Error && !err.message.includes("NEXT_REDIRECT")) {
          toast.error(err.message);
        }
      }
    });
  };

  if (!confirming) {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        Delete group
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        Type <span className="font-bold">{groupName}</span> to confirm deletion:
      </p>
      <ConfirmInput
        expected={groupName}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
        isPending={isPending}
      />
    </div>
  );
}

function ConfirmInput({
  expected,
  onConfirm,
  onCancel,
  isPending,
}: {
  expected: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [value, setValue] = useState("");
  const matches = value === expected;

  return (
    <div className="space-y-2">
      <input
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder={expected}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={!matches || isPending}
          onClick={onConfirm}
        >
          {isPending ? "Deleting..." : "Yes, delete forever"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
