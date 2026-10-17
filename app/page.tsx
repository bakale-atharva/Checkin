import { ArrowUpRight, CalendarDays, MapPin, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PropertyFrame } from "@/components/ui/property-frame";
import { Surface } from "@/components/ui/surface";

const stays = ["Coastline House", "Garden Room", "The Blue Ridge"];

export default function Home() {
  return <main className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col px-4 py-10 sm:px-6 lg:px-8">
    <section className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end"><div className="space-y-6 pb-2"><p className="text-xs font-bold tracking-[0.18em] text-checkin-signal">STAYS, CLEARLY</p><h1 className="max-w-xl text-5xl font-semibold tracking-[-0.065em] text-checkin-ink sm:text-6xl">A better way to arrive.</h1><p className="max-w-md text-lg leading-8 text-checkin-muted">Search the places that make the trip worth taking. Clear details, simple decisions.</p></div><Surface className="grid gap-px overflow-hidden bg-checkin-line p-px sm:grid-cols-[1.2fr_1fr_1fr_auto]"><SearchCell icon={<MapPin />} label="Where" value="Find a destination" /><SearchCell icon={<CalendarDays />} label="When" value="Add dates" /><SearchCell icon={<UsersRound />} label="Who" value="Add guests" /><Button aria-label="Search stays" variant="signal" className="h-full min-h-16 rounded-[0.85rem]"><ArrowUpRight /></Button></Surface></section>
    <section className="mt-10 @container/results"><div className="mb-5 flex items-baseline justify-between"><h2 className="text-xl font-semibold tracking-[-0.04em]">Made for the long way round</h2><span className="text-sm text-checkin-muted">A new collection each week</span></div><div className="grid gap-5 @lg/results:grid-cols-3">{stays.map((name, index) => <PropertyFrame key={name} className="border border-checkin-line"><div className={`h-64 bg-[linear-gradient(135deg,var(--checkin-mist),#98ada2)] ${index === 1 ? "bg-[linear-gradient(135deg,#d7c8ae,#7e967d)]" : ""}`} /><div className="space-y-2 p-5"><div className="flex items-start justify-between gap-4"><h3 className="font-semibold tracking-[-0.03em]">{name}</h3><span className="text-sm font-semibold">${180 + index * 35}</span></div><p className="text-sm text-checkin-muted">Synthetic preview · 2 guests · 1 bedroom</p></div></PropertyFrame>)}</div></section>
  </main>;
}

function SearchCell({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <button className="flex min-h-16 items-center gap-3 bg-checkin-paper px-4 text-left transition-colors hover:bg-checkin-mist/35"><span className="text-checkin-signal">{icon}</span><span><span className="block text-xs font-bold uppercase tracking-[0.14em] text-checkin-muted">{label}</span><span className="block text-sm font-semibold text-checkin-ink">{value}</span></span></button>;
}
