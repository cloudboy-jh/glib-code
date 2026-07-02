import { Hono } from "hono";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const ATTACHMENTS_DIR = join(process.cwd(), ".glib-attachments");

export type AttachmentMeta = { id: string; name: string; type: string; size: number; path: string };
const attachmentById = new Map<string, AttachmentMeta>();

/** Read-only lookup for consumers (e.g. the attachment compiler) that must not
 *  reach into the private map directly. */
export function getAttachment(id: string): AttachmentMeta | undefined {
  return attachmentById.get(id);
}

/** Test-only seam to seed the store without driving the HTTP upload path.
 *  Mirrors the __set*ForTests convention used elsewhere in the codebase. */
export function __setAttachmentForTests(meta: AttachmentMeta) {
  attachmentById.set(meta.id, meta);
  return () => attachmentById.delete(meta.id);
}

async function ensureDir() {
  await mkdir(ATTACHMENTS_DIR, { recursive: true });
}

export const attachmentsRoutes = new Hono()
  .post("/", async (c) => {
    await ensureDir();
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return c.json({ ok: false, message: "file required" }, 400);
    const id = crypto.randomUUID();
    const path = join(ATTACHMENTS_DIR, `${id}-${file.name}`);
    await Bun.write(path, file);
    attachmentById.set(id, { id, name: file.name, type: file.type || "application/octet-stream", size: file.size, path });
    return c.json({ ok: true, id, name: file.name, size: file.size, type: file.type || "application/octet-stream" }, 201);
  })
  .get("/:id", async (c) => {
    const item = attachmentById.get(c.req.param("id"));
    if (!item) return c.json({ ok: false, message: "attachment not found" }, 404);
    const file = Bun.file(item.path);
    if (!(await file.exists())) return c.json({ ok: false, message: "attachment not found" }, 404);
    return new Response(file, {
      headers: {
        "content-type": item.type,
        "content-length": String(item.size),
        "content-disposition": `attachment; filename="${item.name}"`
      }
    });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const item = attachmentById.get(id);
    if (!item) return c.json({ ok: false, message: "attachment not found" }, 404);
    await rm(item.path, { force: true });
    attachmentById.delete(id);
    return c.json({ ok: true });
  });
