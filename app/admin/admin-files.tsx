"use client";

import { FormEvent, useMemo, useState } from "react";

type AdminFile = {
  slug: string;
  fileName: string;
  fileSize: number;
  downloadsRemaining: number;
  uploadedAt: string;
  expiresAt: string;
};

type AdminResponse = {
  files?: AdminFile[];
  error?: string;
};

type AdminActionResponse = {
  ok?: boolean;
  error?: string;
};

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} bytes`;
}

export function AdminFiles() {
  const [password, setPassword] = useState("");
  const [files, setFiles] = useState<AdminFile[]>([]);
  const [status, setStatus] = useState("Enter the admin password.");
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const totalBytes = useMemo(
    () => files.reduce((sum, file) => sum + file.fileSize, 0),
    [files]
  );

  async function loadFiles(event?: FormEvent) {
    event?.preventDefault();
    setIsLoading(true);
    setStatus("Loading active files...");

    try {
      const response = await fetch("/api/admin/files", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${password}`,
        },
      });
      const data = (await response.json()) as AdminResponse;
      if (!response.ok) throw new Error(data.error || "Admin load failed.");

      setFiles(data.files || []);
      setHasLoaded(true);
      setStatus("Loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Admin load failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function runAdminAction(action: "delete-expired" | "delete-all") {
    const confirmed =
      action === "delete-expired"
        ? window.confirm("Delete expired files now?")
        : window.confirm("Delete every active file?");

    if (!confirmed) return;

    setIsLoading(true);
    setStatus(action === "delete-expired" ? "Deleting expired files..." : "Deleting all files...");

    try {
      const response = await fetch("/api/admin/files", {
        method: "DELETE",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${password}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as AdminActionResponse;
      if (!response.ok) throw new Error(data.error || "Admin action failed.");

      setStatus(action === "delete-expired" ? "Expired files deleted." : "All files deleted.");
      await loadFiles();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Admin action failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07111d] px-4 py-5 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-7xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-cyan-300/20 bg-[#0d1a29] px-4 py-3 shadow-2xl shadow-black/20">
          <a href="/" className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-lg border border-cyan-200/70 bg-cyan-400/15 text-sm font-black tracking-[.08em] text-white shadow-inner shadow-cyan-300/10">
              CTS
            </div>
            <div>
              <p className="text-lg font-black leading-tight text-white">Clear Technology Solutions</p>
              <p className="text-sm font-medium text-cyan-100/80">Clear Send admin</p>
            </div>
          </a>
          <a
            href="/"
            className="rounded-md border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-300/20"
          >
            Back to send
          </a>
        </header>

        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-lg border border-white/10 bg-white/[.05] p-5 shadow-2xl shadow-black/25">
            <h1 className="text-3xl font-black tracking-tight">Clear Send Admin</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Manage temporary Clear Technology Solutions file handoffs.
            </p>

            <form onSubmit={loadFiles} className="mt-6 space-y-3">
              <label htmlFor="adminPassword" className="block text-sm font-bold text-slate-300">
                Password
              </label>
              <input
                id="adminPassword"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-md border border-white/15 bg-slate-950/70 px-3 text-base text-white outline-none ring-cyan-300/40 focus:ring-4"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-md bg-cyan-400 px-4 text-sm font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
              >
                {isLoading ? "Loading" : "Unlock"}
              </button>
            </form>

            <div className="mt-5 rounded-md border border-white/10 bg-slate-950/45 p-3">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Summary</p>
              <p className="mt-2 text-sm text-slate-200">{files.length} active files</p>
              <p className="mt-1 text-sm text-slate-400">{formatBytes(totalBytes)} stored</p>
            </div>

            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => void runAdminAction("delete-expired")}
                disabled={!hasLoaded || isLoading}
                className="h-11 w-full rounded-md border border-white/15 px-4 text-sm font-bold text-slate-100 hover:bg-white/10 disabled:opacity-50"
              >
                Delete expired files
              </button>
              <button
                type="button"
                onClick={() => void runAdminAction("delete-all")}
                disabled={!hasLoaded || files.length === 0 || isLoading}
                className="h-11 w-full rounded-md border border-red-300/35 bg-red-500/10 px-4 text-sm font-bold text-red-100 hover:bg-red-500/20 disabled:opacity-50"
              >
                Delete all files
              </button>
            </div>

            <p className="mt-5 text-sm text-slate-300">
              Status: <span className="text-slate-100">{status}</span>
            </p>
          </aside>

          <section className="min-h-[620px] rounded-lg border border-white/10 bg-white/[.05] shadow-2xl shadow-black/25">
            <div className="border-b border-white/10 p-4">
              <p className="text-sm font-bold uppercase tracking-[.14em] text-cyan-200">Active files</p>
              <p className="mt-1 text-sm text-slate-400">Soonest expirations appear first.</p>
            </div>

            {!hasLoaded ? (
              <div className="p-5 text-sm text-slate-400">Unlock admin view to list active files.</div>
            ) : files.length === 0 ? (
              <div className="p-5 text-sm text-slate-400">No active files.</div>
            ) : (
              <div className="divide-y divide-white/10">
                {files.map((file) => (
                  <article key={file.slug} className="grid gap-3 p-4 md:grid-cols-[150px_1fr_auto]">
                    <div>
                      <a className="font-mono text-base font-black text-cyan-200 hover:text-cyan-100" href={`/${file.slug}`}>
                        /{file.slug}
                      </a>
                      <p className="mt-1 text-xs text-slate-500">
                        {file.downloadsRemaining} downloads left
                      </p>
                    </div>
                    <div>
                      <p className="break-all font-bold text-slate-100">{file.fileName}</p>
                      <p className="mt-1 text-sm text-slate-400">{formatBytes(file.fileSize)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Uploaded {new Date(file.uploadedAt).toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Expires {new Date(file.expiresAt).toLocaleString()}
                      </p>
                    </div>
                    <a
                      className="h-10 rounded-md border border-white/15 px-4 py-2 text-center text-sm font-bold text-slate-100 hover:bg-white/10"
                      href={`/${file.slug}`}
                    >
                      Open
                    </a>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
