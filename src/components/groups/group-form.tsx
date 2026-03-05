"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CityCombobox } from "@/components/ui/city-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createRecurringGroup, updateGroup } from "@/lib/actions/groups";
import type { RecurringGroup } from "@/lib/types/database";

const DAY_NAMES = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Open"];
const GAME_TYPES = ["Singles", "Doubles", "Either"];

interface GroupFormProps {
  mode: "create" | "edit";
  group?: RecurringGroup;
}

export function GroupForm({ mode, group }: GroupFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createRecurringGroup(formData);
        } else if (group) {
          const result = await updateGroup(group.id, formData);
          if (!result.success) {
            setError(result.error);
          } else {
            toast.success("Group updated");
          }
        }
      } catch (err) {
        // redirect throws internally for create — ignore
        if (err instanceof Error && err.message !== "NEXT_REDIRECT") {
          setError(err.message);
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Group name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Tuesday Night Crew"
          defaultValue={group?.name}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Our weekly badminton group..."
          defaultValue={group?.description ?? ""}
          rows={2}
        />
      </div>

      {/* Day + Time row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Day of week</Label>
          <Select name="day_of_week" defaultValue={group?.day_of_week?.toString() ?? "2"} required>
            <SelectTrigger>
              <SelectValue placeholder="Day" />
            </SelectTrigger>
            <SelectContent>
              {DAY_NAMES.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="start_time">Start time</Label>
          <Input
            id="start_time"
            name="start_time"
            type="time"
            defaultValue={group?.start_time?.slice(0, 5) ?? "19:00"}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end_time">End time</Label>
          <Input
            id="end_time"
            name="end_time"
            type="time"
            defaultValue={group?.end_time?.slice(0, 5) ?? "21:00"}
            required
          />
        </div>
      </div>

      {/* Location + City */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="location">Location / court</Label>
          <Input
            id="location"
            name="location"
            placeholder="Sports Complex Hall A"
            defaultValue={group?.location}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>City</Label>
          <CityCombobox
            name="city"
            defaultValue={group?.city ?? ""}
            placeholder="Select city..."
            required
          />
        </div>
      </div>

      {/* Skill + Game type + Max players */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Skill level</Label>
          <Select name="skill_level" defaultValue={group?.skill_level ?? "Open"} required>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SKILL_LEVELS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Game type</Label>
          <Select name="game_type" defaultValue={group?.game_type ?? "Either"} required>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GAME_TYPES.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max_players">Max players</Label>
          <Input
            id="max_players"
            name="max_players"
            type="number"
            min={2}
            max={20}
            defaultValue={group?.max_players ?? 4}
            required
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending
          ? mode === "create" ? "Creating..." : "Saving..."
          : mode === "create" ? "Create Group" : "Save Changes"}
      </Button>
    </form>
  );
}
