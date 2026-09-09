import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../../db";
import { fileShares } from "../../../../../db/schema";

type R2BucketLike = {
  get: (
    key: string
  ) => Promise<{ body: ReadableStream | null } | null>;
  delete: (key: string) => Promise<void>;
};

function getBucket() {
  const bucket = (env as { BUCKET?: R2BucketLike }).BUCKET;
  if (!bucket) {
    throw new Error("Cloudflare R2 binding `BUCKET` is unavailable.");
  }
  return bucket;
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "Storage is not ready yet. Create the file_shares table in D1 first.";
  }
  return message;
}

function dispositionFileName(fileName: string) {
  return fileName.replace(/["\\]/g, "_");
}

async function removeShare(slug: string, objectKey: string) {
  const db = getDb();
  const bucket = getBucket();
  await bucket.delete(objectKey).catch(() => undefined);
  await db.delete(fileShares).where(eq(fileShares.slug, slug));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params;
    const slug = normalizeSlug(rawSlug);
    if (!slug) return Response.json({ error: "Invalid code." }, { status: 400 });

    const db = getDb();
    const bucket = getBucket();
    const share = await db.query.fileShares.findFirst({
      where: eq(fileShares.slug, slug),
    });

    if (!share) {
      return Response.json({ error: "No file is waiting for this code." }, { status: 404 });
    }

    if (share.expiresAt.getTime() <= Date.now()) {
      await removeShare(slug, share.objectKey);
      return Response.json({ error: "That file expired." }, { status: 410 });
    }

    const object = await bucket.get(share.objectKey);
    if (!object?.body) {
      await db.delete(fileShares).where(eq(fileShares.slug, slug));
      return Response.json({ error: "The file was not found in storage." }, { status: 404 });
    }

    if (share.downloadsRemaining <= 1) {
      await removeShare(slug, share.objectKey);
    } else {
      await db
        .update(fileShares)
        .set({ downloadsRemaining: share.downloadsRemaining - 1 })
        .where(eq(fileShares.slug, slug));
    }

    return new Response(object.body, {
      headers: {
        "content-type": share.contentType,
        "content-length": String(share.fileSize),
        "content-disposition": `attachment; filename="${dispositionFileName(share.fileName)}"`,
      },
    });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
