import { asc, lt } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { fileShares } from "../../../../db/schema";

type R2BucketLike = {
  delete: (key: string) => Promise<void>;
};

function getAdminPassword() {
  const value = (env as { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD;
  return typeof value === "string" && value ? value : "@dm!N4CtS";
}

function getBucket() {
  const bucket = (env as { BUCKET?: R2BucketLike }).BUCKET;
  if (!bucket) {
    throw new Error("Cloudflare R2 binding `BUCKET` is unavailable.");
  }
  return bucket;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token || "" : "";
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "Storage is not ready yet. Create the file_shares table in D1 first.";
  }
  return message;
}

function requireAdmin(request: Request) {
  if (getBearerToken(request) !== getAdminPassword()) {
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  return null;
}

async function deleteRows(rows: Array<{ slug: string; objectKey: string }>) {
  const db = getDb();
  const bucket = getBucket();

  for (const row of rows) {
    await bucket.delete(row.objectKey).catch(() => undefined);
  }

  await db.delete(fileShares);
}

export async function GET(request: Request) {
  try {
    const adminError = requireAdmin(request);
    if (adminError) return adminError;

    const db = getDb();
    const rows = await db
      .select()
      .from(fileShares)
      .orderBy(asc(fileShares.expiresAt))
      .limit(500);

    return Response.json({
      files: rows.map((file) => ({
        slug: file.slug,
        fileName: file.fileName,
        fileSize: file.fileSize,
        downloadsRemaining: file.downloadsRemaining,
        uploadedAt: file.uploadedAt.toISOString(),
        expiresAt: file.expiresAt.toISOString(),
      })),
    });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const adminError = requireAdmin(request);
    if (adminError) return adminError;

    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const db = getDb();

    if (body.action === "delete-expired") {
      const rows = await db
        .select({ slug: fileShares.slug, objectKey: fileShares.objectKey })
        .from(fileShares)
        .where(lt(fileShares.expiresAt, new Date()));

      const bucket = getBucket();
      for (const row of rows) {
        await bucket.delete(row.objectKey).catch(() => undefined);
      }

      await db.delete(fileShares).where(lt(fileShares.expiresAt, new Date()));
      return Response.json({ ok: true });
    }

    if (body.action === "delete-all") {
      const rows = await db
        .select({ slug: fileShares.slug, objectKey: fileShares.objectKey })
        .from(fileShares)
        .limit(500);
      await deleteRows(rows);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown admin action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
