"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

import {
  addDays,
  canSelectDate,
  monthGrid,
  nextStaySelection,
  type StaySelection,
} from "@/lib/booking/stay-selection";
import { cn } from "@/lib/utils";

const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function monthOf(date: string) {
  const [year, month] = date.split("-").map(Number);
  return { year, month: month - 1 };
}

function shiftMonth(value: { year: number; month: number }, delta: number) {
  const index = value.year * 12 + value.month + delta;
  return { year: Math.floor(index / 12), month: index % 12 };
}

/**
 * Two-month stay picker. Arrow keys move between days, Enter or Space selects,
 * and unavailable nights are announced as well as struck through.
 */
export function AvailabilityCalendar({
  today,
  lastDate,
  selection,
  unavailable,
  onChange,
}: {
  today: string;
  lastDate: string;
  selection: StaySelection;
  unavailable: ReadonlySet<string>;
  onChange: (selection: StaySelection) => void;
}) {
  const [start, setStart] = useState(() => monthOf(selection.checkIn ?? today));
  const [focused, setFocused] = useState(selection.checkIn ?? today);
  const gridRef = useRef<HTMLDivElement>(null);
  const firstMonth = monthOf(today);
  const lastMonth = monthOf(lastDate);
  const atStart =
    start.year * 12 + start.month <= firstMonth.year * 12 + firstMonth.month;
  const atEnd =
    start.year * 12 + start.month + 1 >= lastMonth.year * 12 + lastMonth.month;
  const months = [start, shiftMonth(start, 1)];

  function moveFocus(date: string) {
    if (date < today || date > lastDate) return;
    const target = monthOf(date);
    const index = target.year * 12 + target.month;
    const shown = start.year * 12 + start.month;
    if (index < shown) setStart(target);
    else if (index > shown + 1) setStart(shiftMonth(target, -1));
    setFocused(date);
    requestAnimationFrame(() =>
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)
        ?.focus(),
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in moves) {
      event.preventDefault();
      moveFocus(addDays(date, moves[event.key]));
    }
  }

  const { checkIn, checkOut } = selection;
  const status = !checkIn
    ? "Select a check-in date."
    : !checkOut
      ? "Select a checkout date."
      : "Dates selected.";

  return (
    <div className="@container/calendar">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={atStart}
          onClick={() => setStart(shiftMonth(start, -1))}
          className="grid size-11 place-items-center rounded-full hover:bg-checkin-mist/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35 disabled:opacity-30"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <p aria-live="polite" className="text-sm text-checkin-muted">
          {status}
        </p>
        <button
          type="button"
          aria-label="Next month"
          disabled={atEnd}
          onClick={() => setStart(shiftMonth(start, 1))}
          className="grid size-11 place-items-center rounded-full hover:bg-checkin-mist/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35 disabled:opacity-30"
        >
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </div>
      <div ref={gridRef} className="mt-2 grid gap-8 @xl/calendar:grid-cols-2">
        {months.map((month, monthIndex) => (
          <table
            key={`${month.year}-${month.month}`}
            className={cn(
              "w-full border-collapse",
              monthIndex === 1 && "@max-xl/calendar:hidden",
            )}
          >
            <caption className="pb-3 text-sm font-semibold">
              {monthLabel.format(new Date(Date.UTC(month.year, month.month)))}
            </caption>
            <thead>
              <tr>
                {weekdays.map((day) => (
                  <th
                    key={day}
                    scope="col"
                    className="pb-1 text-xs font-medium text-checkin-muted"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthGrid(month.year, month.month).map((week, weekIndex) => (
                <tr key={weekIndex}>
                  {week.map((date, dayIndex) => {
                    if (!date) return <td key={dayIndex} />;
                    const outOfRange = date < today || date > lastDate;
                    const booked = unavailable.has(date);
                    const selectable =
                      !outOfRange &&
                      canSelectDate(date, selection, unavailable, today);
                    const isEdge = date === checkIn || date === checkOut;
                    const inRange =
                      !!checkIn &&
                      !!checkOut &&
                      date > checkIn &&
                      date < checkOut;
                    const label = [
                      dayLabel.format(new Date(`${date}T00:00:00Z`)),
                      date === checkIn ? "check-in" : null,
                      date === checkOut ? "checkout" : null,
                      booked && !selectable ? "unavailable" : null,
                      booked && selectable
                        ? "available for checkout only"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <td key={date} className="p-0 text-center">
                        <button
                          type="button"
                          data-date={date}
                          aria-label={label}
                          aria-pressed={isEdge}
                          aria-disabled={!selectable}
                          tabIndex={date === focused ? 0 : -1}
                          onKeyDown={(event) => onKeyDown(event, date)}
                          onFocus={() => setFocused(date)}
                          onClick={() => {
                            if (!selectable) return;
                            onChange(
                              nextStaySelection(selection, date, unavailable),
                            );
                          }}
                          className={cn(
                            "mx-auto grid size-11 place-items-center rounded-full text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/45",
                            selectable
                              ? "font-medium hover:border hover:border-checkin-ink"
                              : "cursor-not-allowed text-checkin-muted/60",
                            booked && !selectable && "line-through",
                            inRange && "rounded-none bg-checkin-mist",
                            isEdge &&
                              "bg-checkin-ink text-checkin-canvas hover:border-0",
                          )}
                        >
                          {Number(date.slice(8))}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}
