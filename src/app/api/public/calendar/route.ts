import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { buildIcs } from "@/lib/calendar";
import { getPublicEvents } from "@/server/services/public-content.service";

const query = z.object({ locale: z.enum(["kh", "en"]).catch("kh"), event: z.uuid().optional().catch(undefined) });

/** .ics download of published events (all, or one with ?event=<id>). Public data only. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const { locale, event } = query.parse({ locale: sp.get("locale") ?? undefined, event: sp.get("event") ?? undefined });
  const events = (await getPublicEvents(locale)).filter((e) => !event || e.id === event);
  if (event && events.length === 0) return new NextResponse(null, { status: 404 });
  const ics = buildIcs(
    events.map((e) => ({
      id: e.id,
      title: e.title,
      description: [e.description, e.dressCode].filter(Boolean).join("\n"),
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      location: e.location ? `${e.location.name}, ${e.location.address}` : "",
    })),
    new URL(env().APP_URL).host,
  );
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="wedding${event ? "-event" : ""}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
