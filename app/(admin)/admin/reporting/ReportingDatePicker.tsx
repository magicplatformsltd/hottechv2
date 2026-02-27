"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import * as Popover from "@radix-ui/react-popover";
import { format, subDays, endOfDay, startOfYear } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_DAYS = [7, 30, 90] as const;
type QuickPreset = "7D" | "30D" | "90D" | "YTD" | "custom";

function getPresetFromRange(
  from: Date,
  to: Date,
  today: Date
): QuickPreset {
  const todayEod = endOfDay(today);
  const fromStr = format(from, "yyyy-MM-dd");
  const toStr = format(to, "yyyy-MM-dd");
  const todayStr = format(todayEod, "yyyy-MM-dd");

  if (fromStr === format(subDays(todayEod, 7), "yyyy-MM-dd") && toStr === todayStr)
    return "7D";
  if (fromStr === format(subDays(todayEod, 30), "yyyy-MM-dd") && toStr === todayStr)
    return "30D";
  if (fromStr === format(subDays(todayEod, 90), "yyyy-MM-dd") && toStr === todayStr)
    return "90D";
  if (fromStr === format(startOfYear(today), "yyyy-MM-dd") && toStr === todayStr)
    return "YTD";
  return "custom";
}

function buildHref(preset: QuickPreset): string {
  const today = endOfDay(new Date());
  let from: Date;
  let to: Date = today;

  switch (preset) {
    case "7D":
      from = subDays(today, 7);
      break;
    case "30D":
      from = subDays(today, 30);
      break;
    case "90D":
      from = subDays(today, 90);
      break;
    case "YTD":
      from = startOfYear(new Date());
      break;
    default:
      return "/admin/reporting";
  }

  const params = new URLSearchParams();
  params.set("from", format(from, "yyyy-MM-dd"));
  params.set("to", format(to, "yyyy-MM-dd"));
  return `/admin/reporting?${params.toString()}`;
}

export function ReportingDatePicker({
  startDate,
  endDate,
}: {
  startDate: Date;
  endDate: Date;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const today = endOfDay(new Date());

  const range = useMemo(
    () => ({
      from: startDate,
      to: endDate,
    }),
    [startDate, endDate]
  );

  const activePreset = useMemo(
    () => getPresetFromRange(startDate, endDate, today),
    [startDate, endDate, today]
  );

  const handleRangeSelect = useCallback(
    (newRange: { from?: Date; to?: Date } | undefined) => {
      if (!newRange?.from) return;
      const to = newRange.to ?? newRange.from;
      const params = new URLSearchParams(searchParams.toString());
      params.set("from", format(newRange.from, "yyyy-MM-dd"));
      params.set("to", format(to, "yyyy-MM-dd"));
      router.replace(`/admin/reporting?${params.toString()}`);
      setOpen(false);
    },
    [router, searchParams]
  );

  const buttonStyles =
    "rounded-md border px-3 py-1.5 font-sans text-sm font-medium transition-colors";
  const activeStyles =
    "border-emerald-500/50 bg-emerald-500/20 text-emerald-400";
  const inactiveStyles =
    "border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-hot-white";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-sans text-sm text-gray-400">Time range:</span>

      {/* Quick preset buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={buildHref("7D")}
          className={cn(
            buttonStyles,
            activePreset === "7D" ? activeStyles : inactiveStyles
          )}
        >
          7D
        </a>
        <a
          href={buildHref("30D")}
          className={cn(
            buttonStyles,
            activePreset === "30D" ? activeStyles : inactiveStyles
          )}
        >
          30D
        </a>
        <a
          href={buildHref("90D")}
          className={cn(
            buttonStyles,
            activePreset === "90D" ? activeStyles : inactiveStyles
          )}
        >
          90D
        </a>
        <a
          href={buildHref("YTD")}
          className={cn(
            buttonStyles,
            activePreset === "YTD" ? activeStyles : inactiveStyles
          )}
        >
          YTD
        </a>

        {/* Custom date picker */}
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={cn(
                buttonStyles,
                "inline-flex items-center gap-1.5",
                activePreset === "custom" ? activeStyles : inactiveStyles
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" aria-hidden />
              Custom
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              sideOffset={6}
              align="start"
              className="z-50 rounded-lg border border-white/10 bg-hot-gray p-3 shadow-xl"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <DayPicker
                mode="range"
                selected={range}
                onSelect={handleRangeSelect}
                numberOfMonths={2}
                defaultMonth={endDate}
                disabled={{ after: today }}
                classNames={{
                  root: "rdp-root",
                  months: "flex gap-4",
                  month: "space-y-4",
                  month_caption: "flex justify-center font-sans text-sm font-medium text-hot-white",
                  nav: "flex gap-1",
                  button_previous:
                    "h-8 w-8 rounded border border-white/10 bg-white/5 p-0 text-gray-400 hover:bg-white/10 hover:text-hot-white",
                  button_next:
                    "h-8 w-8 rounded border border-white/10 bg-white/5 p-0 text-gray-400 hover:bg-white/10 hover:text-hot-white",
                  weekdays: "flex",
                  weekday: "w-9 font-sans text-xs text-gray-500",
                  week: "flex w-full mt-2",
                  day: "h-9 w-9 text-center text-sm font-sans",
                  day_button:
                    "h-9 w-9 rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
                  selected:
                    "bg-emerald-500/30 text-emerald-400 hover:bg-emerald-500/40",
                  range_start: "rounded-l-md bg-emerald-500/30 text-emerald-400",
                  range_end: "rounded-r-md bg-emerald-500/30 text-emerald-400",
                  range_middle:
                    "rounded-none bg-emerald-500/10 text-emerald-300/80",
                  today: "font-semibold text-emerald-400",
                  outside: "text-gray-600 opacity-50",
                  disabled: "text-gray-600 opacity-40 cursor-not-allowed",
                }}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );
}
