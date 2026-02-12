"use client";

import { useState } from "react";
import { addSpecificAvailability } from "@/lib/actions/availability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface SpecificAvailabilityFormProps {
  defaultCity?: string;
}

export function SpecificAvailabilityForm({
  defaultCity,
}: SpecificAvailabilityFormProps) {
  const [loading, setLoading] = useState(false);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      await addSpecificAvailability(formData);
      toast.success("Availability added!");
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
        <CardTitle className="text-base">Add Specific Date</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="specific-date">Date</Label>
            <Input
              id="specific-date"
              name="date"
              type="date"
              defaultValue={defaultDate}
              min={new Date().toISOString().split("T")[0]}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="specific-start">From</Label>
              <Input
                id="specific-start"
                name="start_time"
                type="time"
                defaultValue="18:00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specific-end">To</Label>
              <Input
                id="specific-end"
                name="end_time"
                type="time"
                defaultValue="21:00"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="specific-city">City</Label>
            <Input
              id="specific-city"
              name="city"
              defaultValue={defaultCity ?? ""}
              placeholder="e.g., Colombo"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Adding..." : "Add Date"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
