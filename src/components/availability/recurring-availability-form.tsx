"use client";

import { useState } from "react";
import { addRecurringAvailability } from "@/lib/actions/availability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MultiCityCombobox } from "@/components/ui/city-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const DAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

interface RecurringAvailabilityFormProps {
  defaultCity?: string;
}

export function RecurringAvailabilityForm({
  defaultCity,
}: RecurringAvailabilityFormProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      await addRecurringAvailability(formData);
      toast.success("Recurring availability added!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Weekly Recurring</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Day of Week</Label>
            <Select name="day_of_week" defaultValue="1">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recurring-start">From</Label>
              <Input
                id="recurring-start"
                name="start_time"
                type="time"
                defaultValue="18:00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurring-end">To</Label>
              <Input
                id="recurring-end"
                name="end_time"
                type="time"
                defaultValue="21:00"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cities</Label>
            <MultiCityCombobox
              name="city"
              defaultValue={defaultCity ? defaultCity.split(", ").filter(Boolean) : []}
              placeholder="Add cities..."
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Adding..." : "Add Recurring Day"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
