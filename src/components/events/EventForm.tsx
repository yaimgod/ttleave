"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { createEventSchema, type CreateEventInput } from "@/lib/validations/event.schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EventFormProps {
  defaultValues?: Partial<CreateEventInput>;
  eventId?: string;
  groups?: Array<{ id: string; name: string }>;
}

export function EventForm({ defaultValues, eventId, groups = [] }: EventFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isRange, setIsRange] = useState(!!defaultValues?.start_date);
  const isEditing = !!eventId;

  const form = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: "",
      description: "",
      event_type: "set_date",
      member_permissions: "view_comment",
      color: "#6366f1",
      reminder_days: [],
      start_date: null,
      ...defaultValues,
    },
  });

  async function onSubmit(values: CreateEventInput) {
    setLoading(true);
    const url = isEditing ? `/api/events/${eventId}` : "/api/events";
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    const event = await res.json();
    toast.success(isEditing ? "Event updated" : "Event created");
    router.push(`/events/${event.id}`);
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Job interview, Last day, Moving out…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Add some context…"
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="event_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Event type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="set_date">Fixed Date</SelectItem>
                  <SelectItem value="mutable">Dynamic (can adjust)</SelectItem>
                  <SelectItem value="linked">Linked (chain)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription className="text-xs">
                Dynamic events can be adjusted by boss events.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Date range toggle */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={isRange}
              onCheckedChange={(v) => {
                setIsRange(!!v);
                if (!v) form.setValue("start_date", null);
              }}
            />
            Multi-day range (start + end date)
          </label>
        </div>

        <div className={cn("grid gap-4", isRange ? "sm:grid-cols-2" : "sm:grid-cols-1 max-w-xs")}>
          {isRange && (
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Start date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(new Date(field.value), "PPP") : "Pick start date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => field.onChange(date?.toISOString() ?? "")}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="target_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{isRange ? "End date" : "Target date"}</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(new Date(field.value), "PPP") : "Pick a date"}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) => field.onChange(date?.toISOString() ?? "")}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {groups.length > 0 && (
          <FormField
            control={form.control}
            name="group_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Share with group (optional)</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                  defaultValue={field.value ?? "none"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="No group" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No group</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormLabel className="font-normal whitespace-nowrap">
                Color
              </FormLabel>
              <FormControl>
                <input
                  type="color"
                  className="h-8 w-10 cursor-pointer rounded border"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Reminder notifications */}
        <FormField
          control={form.control}
          name="reminder_days"
          render={({ field }) => {
            const REMINDERS = [
              { value: 1,  label: "1 day before" },
              { value: 7,  label: "1 week before" },
              { value: 30, label: "1 month before" },
            ];
            const toggle = (days: number) => {
              const current = field.value ?? [];
              field.onChange(
                current.includes(days)
                  ? current.filter((d) => d !== days)
                  : [...current, days]
              );
            };
            return (
              <FormItem>
                <FormLabel>Reminders</FormLabel>
                <FormDescription className="text-xs">
                  Get an email reminder before the date arrives.
                </FormDescription>
                <div className="flex flex-wrap gap-4 pt-1">
                  {REMINDERS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={(field.value ?? []).includes(value)}
                        onCheckedChange={() => toggle(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading
            ? isEditing
              ? "Saving…"
              : "Creating…"
            : isEditing
            ? "Save changes"
            : "Create event"}
        </Button>
      </form>
    </Form>
  );
}
