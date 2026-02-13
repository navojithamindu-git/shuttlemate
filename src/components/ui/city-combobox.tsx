"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface GeoNameCity {
  geonameId: number;
  name: string;
  adminName1: string;
}

function useCitySearch() {
  const [search, setSearch] = useState("");
  const [cities, setCities] = useState<GeoNameCity[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (!search || search.length < 2) {
      setCities([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const username = process.env.NEXT_PUBLIC_GEONAMES_USERNAME ?? "demo";
        const res = await fetch(
          `https://secure.geonames.org/searchJSON?name_startsWith=${encodeURIComponent(search)}&country=LK&featureClass=P&maxRows=10&username=${username}`
        );
        const data = await res.json();
        if (data.geonames) {
          const seen = new Set<string>();
          const unique: GeoNameCity[] = [];
          for (const city of data.geonames as GeoNameCity[]) {
            if (!seen.has(city.name)) {
              seen.add(city.name);
              unique.push(city);
            }
          }
          setCities(unique);
        }
      } catch {
        setCities([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  return { search, setSearch, cities, loading };
}

// --- Single-select CityCombobox ---

interface CityComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}

export function CityCombobox({
  value: controlledValue,
  onValueChange,
  name,
  defaultValue = "",
  placeholder = "Select city...",
  required,
}: CityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const { search, setSearch, cities, loading } = useCitySearch();

  const value = controlledValue ?? internalValue;

  const handleSelect = useCallback(
    (cityName: string) => {
      if (onValueChange) {
        onValueChange(cityName);
      } else {
        setInternalValue(cityName);
      }
      setOpen(false);
    },
    [onValueChange]
  );

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground"
            )}
          >
            {value || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search cities..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {!loading && search.length >= 2 && cities.length === 0 && (
                <CommandEmpty>No cities found.</CommandEmpty>
              )}
              {!loading && search.length < 2 && !value && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Type at least 2 characters...
                </div>
              )}
              {cities.length > 0 && (
                <CommandGroup>
                  {cities.map((city) => (
                    <CommandItem
                      key={city.geonameId}
                      value={city.name}
                      onSelect={() => handleSelect(city.name)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === city.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span>{city.name}</span>
                      {city.adminName1 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {city.adminName1}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {required && !value && (
        <input
          tabIndex={-1}
          autoComplete="off"
          className="absolute opacity-0 h-0 w-0"
          value={value}
          onChange={() => {}}
          required
        />
      )}
    </>
  );
}

// --- Multi-select CityCombobox ---

interface MultiCityComboboxProps {
  value?: string[];
  onValueChange?: (value: string[]) => void;
  name?: string;
  defaultValue?: string[];
  placeholder?: string;
  required?: boolean;
}

export function MultiCityCombobox({
  value: controlledValue,
  onValueChange,
  name,
  defaultValue = [],
  placeholder = "Add cities...",
  required,
}: MultiCityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<string[]>(defaultValue);
  const { search, setSearch, cities, loading } = useCitySearch();

  const selected = controlledValue ?? internalValue;

  const handleSelect = useCallback(
    (cityName: string) => {
      const updated = selected.includes(cityName)
        ? selected.filter((c) => c !== cityName)
        : [...selected, cityName];

      if (onValueChange) {
        onValueChange(updated);
      } else {
        setInternalValue(updated);
      }
      setSearch("");
    },
    [selected, onValueChange, setSearch]
  );

  const handleRemove = useCallback(
    (cityName: string) => {
      const updated = selected.filter((c) => c !== cityName);
      if (onValueChange) {
        onValueChange(updated);
      } else {
        setInternalValue(updated);
      }
    },
    [selected, onValueChange]
  );

  // Store as comma-separated for form submission
  const formValue = selected.join(", ");

  return (
    <div className="space-y-2">
      {name && <input type="hidden" name={name} value={formValue} />}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((city) => (
            <Badge key={city} variant="secondary" className="gap-1 pr-1">
              {city}
              <button
                type="button"
                onClick={() => handleRemove(city)}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              selected.length === 0 && "text-muted-foreground"
            )}
          >
            {selected.length === 0
              ? placeholder
              : `${selected.length} ${selected.length === 1 ? "city" : "cities"} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search cities..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {!loading && search.length >= 2 && cities.length === 0 && (
                <CommandEmpty>No cities found.</CommandEmpty>
              )}
              {!loading && search.length < 2 && selected.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Type at least 2 characters...
                </div>
              )}
              {cities.length > 0 && (
                <CommandGroup>
                  {cities.map((city) => (
                    <CommandItem
                      key={city.geonameId}
                      value={city.name}
                      onSelect={() => handleSelect(city.name)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selected.includes(city.name) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span>{city.name}</span>
                      {city.adminName1 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {city.adminName1}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {required && selected.length === 0 && (
        <input
          tabIndex={-1}
          autoComplete="off"
          className="absolute opacity-0 h-0 w-0"
          value=""
          onChange={() => {}}
          required
        />
      )}
    </div>
  );
}
