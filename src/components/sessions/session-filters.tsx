"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CityCombobox } from "@/components/ui/city-combobox";
import { X } from "lucide-react";

interface SessionFiltersProps {
  currentFilters: {
    city?: string;
    skill_level?: string;
    game_type?: string;
    date_from?: string;
    date_to?: string;
  };
}

export function SessionFilters({ currentFilters }: SessionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/sessions?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = () => {
    router.push("/sessions");
  };

  const hasFilters =
    currentFilters.city ||
    currentFilters.skill_level ||
    currentFilters.game_type ||
    currentFilters.date_from ||
    currentFilters.date_to;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="sm:max-w-[200px]">
          <CityCombobox
            value={currentFilters.city ?? ""}
            onValueChange={(v) => updateFilter("city", v || null)}
            placeholder="Filter by city..."
          />
        </div>
        <Select
          value={currentFilters.skill_level ?? "all"}
          onValueChange={(v) => updateFilter("skill_level", v)}
        >
          <SelectTrigger className="sm:max-w-[180px]">
            <SelectValue placeholder="Skill level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="Beginner">Beginner</SelectItem>
            <SelectItem value="Intermediate">Intermediate</SelectItem>
            <SelectItem value="Advanced">Advanced</SelectItem>
            <SelectItem value="Open">Open / Any</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={currentFilters.game_type ?? "all"}
          onValueChange={(v) => updateFilter("game_type", v)}
        >
          <SelectTrigger className="sm:max-w-[180px]">
            <SelectValue placeholder="Game type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="Singles">Singles</SelectItem>
            <SelectItem value="Doubles">Doubles</SelectItem>
            <SelectItem value="Either">Either</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            className="sm:w-[160px]"
            value={currentFilters.date_from ?? ""}
            onChange={(e) => updateFilter("date_from", e.target.value || null)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            className="sm:w-[160px]"
            value={currentFilters.date_to ?? ""}
            min={currentFilters.date_from ?? undefined}
            onChange={(e) => updateFilter("date_to", e.target.value || null)}
          />
        </div>
      </div>
    </div>
  );
}
