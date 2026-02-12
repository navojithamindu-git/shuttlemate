"use client";

import { useState } from "react";
import {
  removeSpecificAvailability,
  removeRecurringAvailability,
} from "@/lib/actions/availability";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Calendar, Repeat } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type {
  AvailabilitySpecific,
  AvailabilityRecurring,
} from "@/lib/types/database";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface AvailabilityListProps {
  specificSlots: AvailabilitySpecific[];
  recurringSlots: AvailabilityRecurring[];
}

export function AvailabilityList({
  specificSlots,
  recurringSlots,
}: AvailabilityListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteSpecific = async (id: string) => {
    setDeletingId(id);
    try {
      await removeSpecificAvailability(id);
      toast.success("Availability removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    setDeletingId(id);
    try {
      await removeRecurringAvailability(id);
      toast.success("Availability removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const hasSlots = specificSlots.length > 0 || recurringSlots.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Availability</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasSlots && (
          <p className="text-muted-foreground text-sm">
            No availability set yet. Add your available times above to get
            notified when matching sessions are created.
          </p>
        )}

        {recurringSlots.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Repeat className="h-4 w-4" /> Weekly Recurring
            </p>
            {recurringSlots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between p-3 rounded-md border"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {DAY_NAMES[slot.day_of_week]}
                  </Badge>
                  <span className="text-sm">
                    {slot.start_time.slice(0, 5)} -{" "}
                    {slot.end_time.slice(0, 5)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    in {slot.city}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteRecurring(slot.id)}
                  disabled={deletingId === slot.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {specificSlots.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Specific Dates
            </p>
            {specificSlots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between p-3 rounded-md border"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">
                    {format(
                      new Date(slot.date + "T00:00:00"),
                      "EEE, MMM d"
                    )}
                  </Badge>
                  <span className="text-sm">
                    {slot.start_time.slice(0, 5)} -{" "}
                    {slot.end_time.slice(0, 5)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    in {slot.city}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteSpecific(slot.id)}
                  disabled={deletingId === slot.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
