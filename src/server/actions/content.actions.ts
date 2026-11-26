"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  basicsSchema,
  contactsSchema,
  eventSchema,
  locationSchema,
  milestoneSchema,
  reorderSchema,
  sectionsSchema,
  storySchema,
} from "@/features/content/schemas";
import { uuid } from "@/features/shared/schemas";
import type { ActionResult } from "@/server/action-result";
import * as content from "@/server/services/content.service";
import { adminAction } from "./admin-action";

/** Public pages read content per request; refresh admin views after edits. */
function refresh(...paths: string[]) {
  for (const p of ["/admin/content", ...paths]) revalidatePath(p);
}

export async function updateBasicsAction(input: unknown): Promise<ActionResult> {
  return adminAction("content.basics", basicsSchema, input, async (ctx, d) => {
    await content.updateBasics(ctx, d);
    refresh();
  });
}

export async function updateStoryAction(input: unknown): Promise<ActionResult> {
  return adminAction("content.story", storySchema, input, async (ctx, d) => {
    await content.updateStory(ctx, d);
    refresh("/admin/content/story");
  });
}

export async function updateSectionsAction(input: unknown): Promise<ActionResult> {
  return adminAction("content.sections", sectionsSchema, input, async (ctx, d) => {
    await content.updateSections(ctx, d);
    refresh();
  });
}

export async function updateContactsAction(input: unknown): Promise<ActionResult> {
  return adminAction("content.contacts", contactsSchema, input, async (ctx, d) => {
    await content.updateContacts(ctx, d);
    refresh();
  });
}

export async function saveMilestoneAction(input: unknown): Promise<ActionResult> {
  return adminAction("content.milestone", milestoneSchema, input, async (ctx, d) => {
    await content.saveMilestone(ctx, d);
    refresh("/admin/content/story");
  });
}

export async function deleteMilestoneAction(id: unknown): Promise<ActionResult> {
  return adminAction("content.milestoneDelete", uuid, id, async (ctx, mid) => {
    await content.deleteMilestone(ctx, mid);
    refresh("/admin/content/story");
  });
}

const moveSchema = reorderSchema.extend({ model: z.enum(["storyMilestone", "weddingLocation", "photoAlbum"]) });

export async function moveContentAction(input: unknown): Promise<ActionResult> {
  return adminAction("content.move", moveSchema, input, async (ctx, d) => {
    await content.moveItem(ctx, d.model, d.id, d.direction);
    refresh("/admin/content/story", "/admin/locations", "/admin/gallery");
  });
}

export async function saveLocationAction(input: unknown): Promise<ActionResult> {
  return adminAction("content.location", locationSchema, input, async (ctx, d) => {
    await content.saveLocation(ctx, d);
    refresh("/admin/locations", "/admin/events");
  });
}

export async function deleteLocationAction(id: unknown): Promise<ActionResult> {
  return adminAction("content.locationDelete", uuid, id, async (ctx, lid) => {
    await content.deleteLocation(ctx, lid);
    refresh("/admin/locations");
  });
}

export async function saveEventAction(input: unknown): Promise<ActionResult> {
  return adminAction("content.event", eventSchema, input, async (ctx, d) => {
    await content.saveEvent(ctx, d);
    refresh("/admin/events");
  });
}

export async function deleteEventAction(id: unknown): Promise<ActionResult> {
  return adminAction("content.eventDelete", uuid, id, async (ctx, eid) => {
    await content.deleteEvent(ctx, eid);
    refresh("/admin/events");
  });
}
