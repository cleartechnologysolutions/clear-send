import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { fileShares } from "../../../../db/schema";

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const EXPIRATION_MS = 24 * 60 * 60 * 1000;
const DOWNLOADS_ALLOWED = 2;

type R2BucketLike = {
  put: (
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null,
    options?: { httpMetadata?: { contentType?: string } }
  ) => Promise<unknown>;
  get: (key: string) => Promise<{ body: ReadableStream | null } | null>;
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

function safeFileName(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]+/g, "_").trim();
  return cleaned.slice(0, 140) || "download";
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "Storage is not ready yet. Create the file_shares table in D1 first.";
  }
  return message;
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
    const share = await db.query.fileShares.findFirst({
      where: eq(fileShares.slug, slug),
    });

    if (!share) {
      return Response.json({ file: null });
    }

    if (share.expiresAt.getTime() <= Date.now()) {
      await removeShare(slug, share.objectKey);
      return Response.json({ file: null });
    }

    return Response.json({
      file: {
        fileName: share.fileName,
        fileSize: share.fileSize,
        contentType: share.contentType,
        downloadsRemaining: share.downloadsRemaining,
        uploadedAt: share.uploadedAt.toISOString(),
        expiresAt: share.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params;
    const slug = normalizeSlug(rawSlug);
    if (!slug) return Response.json({ error: "Invalid code." }, { status: 400 });

    const size = Number(request.headers.get("content-length") || "0");
    if (!Number.isFinite(size) || size <= 0) {
      return Response.json({ error: "Choose a file first." }, { status: 400 });
    }

    if (size > MAX_FILE_SIZE) {
      return Response.json({ error: "File is over the 500 MB limit." }, { status: 413 });
    }

    if (!request.body) {
      return Response.json({ error: "Upload body was empty." }, { status: 400 });
    }

    const db = getDb();
    const bucket = getBucket();
    const existing = await db.query.fileShares.findFirst({
      where: eq(fileShares.slug, slug),
    });

    if (existing) {
      await bucket.delete(existing.objectKey).catch(() => undefined);
    }

    const fileName = safeFileName(
      decodeURIComponent(request.headers.get("x-file-name") || "download")
    );
    const contentType = request.headers.get("content-type") || "application/octet-stream";
    const objectKey = `${slug}/${crypto.randomUUID()}-${fileName}`;
    const uploadedAt = new Date();
    const expiresAt = new Date(uploadedAt.getTime() + EXPIRATION_MS);

    await bucket.put(objectKey, request.body, {
      httpMetadata: { contentType },
    });

    await db
      .insert(fileShares)
      .values({
        slug,
        objectKey,
        fileName,
        contentType,
        fileSize: size,
        downloadsRemaining: DOWNLOADS_ALLOWED,
        uploadedAt,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: fileShares.slug,
        set: {
          objectKey,
          fileName,
          contentType,
          fileSize: size,
          downloadsRemaining: DOWNLOADS_ALLOWED,
          uploadedAt,
          expiresAt,
        },
      });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
