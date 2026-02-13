"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSession, editSession } from "@/lib/actions/sessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CityCombobox } from "@/components/ui/city-combobox";
import type { SessionFormData } from "@/lib/types/database";

interface SessionFormProps {
  mode?: "create" | "edit";
  initialData?: SessionFormData;
}

export function SessionForm({ mode = "create", initialData }: SessionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const isEdit = mode === "edit";

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError(null);
    try {
      if (isEdit && initialData) {
        const result = await editSession(initialData.id, formData);
        if (!result.success) {
          setError(result.error);
          setLoading(false);
          return;
        }
        router.push(`/sessions/${initialData.id}`);
      } else {
        await createSession(formData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  // Default date to tomorrow (for create mode)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = initialData?.date ?? tomorrow.toISOString().split("T")[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Session" : "Session Details"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g., Saturday Morning Doubles"
              defaultValue={initialData?.title ?? ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Any details about the session..."
              defaultValue={initialData?.description ?? ""}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={defaultDate}
              min={new Date().toISOString().split("T")[0]}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time *</Label>
              <Input
                id="start_time"
                name="start_time"
                type="time"
                defaultValue={initialData?.start_time?.slice(0, 5) ?? "09:00"}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time *</Label>
              <Input
                id="end_time"
                name="end_time"
                type="time"
                defaultValue={initialData?.end_time?.slice(0, 5) ?? "11:00"}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Venue / Location *</Label>
              <Input
                id="location"
                name="location"
                placeholder="e.g., City Sports Complex"
                defaultValue={initialData?.location ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>City *</Label>
              <CityCombobox
                name="city"
                defaultValue={initialData?.city ?? ""}
                placeholder="Select city..."
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="skill_level">Skill Level</Label>
              <Select name="skill_level" defaultValue={initialData?.skill_level ?? "Open"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                  <SelectItem value="Open">Open / Any</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="game_type">Game Type</Label>
              <Select name="game_type" defaultValue={initialData?.game_type ?? "Either"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Singles">Singles</SelectItem>
                  <SelectItem value="Doubles">Doubles</SelectItem>
                  <SelectItem value="Either">Either</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_players">Max Players</Label>
              <Input
                id="max_players"
                name="max_players"
                type="number"
                min={2}
                max={20}
                defaultValue={initialData?.max_players ?? 4}
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? isEdit
                ? "Saving..."
                : "Creating..."
              : isEdit
                ? "Save Changes"
                : "Create Session"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
