"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { MultiCityCombobox } from "@/components/ui/city-combobox";
import type { Profile, SkillLevel, Gender } from "@/lib/types/database";

const SKILL_LEVELS: { value: SkillLevel; label: string; desc: string }[] = [
  { value: "Beginner", label: "Beginner", desc: "Learning basics, casual play" },
  { value: "Intermediate", label: "Intermediate", desc: "Consistent rallies, plays regularly" },
  { value: "Advanced", label: "Advanced", desc: "Strong technique, competitive play" },
  { value: "Open", label: "Open / Any", desc: "Happy to play with anyone" },
];

interface ProfileFormProps {
  profile: Profile | null;
  isOnboarding?: boolean;
}

export function ProfileForm({ profile, isOnboarding = false }: ProfileFormProps) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(
    profile?.skill_level ?? "Beginner"
  );
  const [gender, setGender] = useState<Gender | "">(profile?.gender ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth ?? "");
  const [cities, setCities] = useState<string[]>(
    profile?.city ? profile.city.split(", ").filter(Boolean) : []
  );
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        skill_level: skillLevel,
        gender: gender || null,
        date_of_birth: dateOfBirth || null,
        city: cities.join(", "),
        bio,
        profile_complete: true,
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      router.push("/sessions");
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name *</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="skillLevel">Skill Level *</Label>
        <Select
          value={skillLevel}
          onValueChange={(v) => setSkillLevel(v as SkillLevel)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SKILL_LEVELS.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                <span>{level.label}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  - {level.desc}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
            <SelectTrigger>
              <SelectValue placeholder="Select gender..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of Birth</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            max={new Date(new Date().setFullYear(new Date().getFullYear() - 10)).toISOString().split("T")[0]}
            min={new Date(new Date().setFullYear(new Date().getFullYear() - 100)).toISOString().split("T")[0]}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Cities you can play in *</Label>
        <MultiCityCombobox
          value={cities}
          onValueChange={setCities}
          placeholder="Add cities..."
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">Bio (optional)</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Playing style, availability, what you're looking for..."
          rows={3}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading
          ? "Saving..."
          : isOnboarding
            ? "Complete Profile & Start"
            : "Save Changes"}
      </Button>
    </form>
  );
}
