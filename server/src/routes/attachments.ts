import { Hono } from "hono";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const ATTACHMENTS_DIR = join(process.cwd(), ".glib-attachments");

type AttachmentMeta = { id: string; name: string; type: string; size: number; path: string };
const attachmentById = new Map<string, AttachmentMeta>();

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
