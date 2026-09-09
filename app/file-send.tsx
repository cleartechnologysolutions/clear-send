"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

const MAX_FILE_SIZE = 500 * 1024 * 1024;

type WaitingFile = {
  fileName: string;
  fileSize: number;
  contentType: string;
  downloadsRemaining: number;
  uploadedAt: string;
  expiresAt: string;
};

type FileResponse = {
  file?: WaitingFile | null;
  error?: string;
};

function makeCode() {
  return Math.random().toString(36).slice(2, 6);
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} bytes`;
}

function getShareLink(code: string) {
  if (typeof window === "undefined") return `/${code}`;
  return `${window.location.origin}/${code}`;
}

export function FileSend({ initialSlug = "" }: { initialSlug?: string }) {
  const initialCode = normalizeCode(initialSlug) || makeCode();
  const [code, setCode] = useState(initialCode);
  const [file, setFile] = useState<File | null>(null);
  const [waitingFile, setWaitingFile] = useState<WaitingFile | null>(null);
  const [status, setStatus] = useState("Choose a code or use the one we made.");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const shareLink = useMemo(() => getShareLink(code), [code]);

  async function loadFile(nextCode = code) {
    const cleanCode = normalizeCode(nextCode);
    if (!cleanCode) return;

    setIsLoading(true);
    setStatus("Checking for a file...");

    try {
      const response = await fetch(`/api/files/${cleanCode}`, { cache: "no-store" });
      const data = (await response.json()) as FileResponse;
      if (!response.ok) throw new Error(data.error || "Could not check this code.");

      setWaitingFile(data.file || null);
      setStatus(data.file ? "File is ready to download." : "No file is waiting for this code.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not check this code.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadFile(initialCode);
    const timer = window.setInterval(() => {
      void loadFile(code);
    }, 7000);

    return () => window.clearInterval(timer);
  }, [code, initialCode]);

  function openCode(event: FormEvent) {
    event.preventDefault();
    const cleanCode = normalizeCode(code) || makeCode();
    setCode(cleanCode);
    window.history.replaceState(null, "", `/${cleanCode}`);
    void loadFile(cleanCode);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    if (!selected) {
      setFile(null);
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStatus("That file is over the 500 MB limit.");
      return;
    }

    setFile(selected);
    setStatus(`${selected.name} is ready to upload.`);
  }

  async function uploadFile() {
    if (!file) {
      setStatus("Choose a file first.");
      return;
    }

    const cleanCode = normalizeCode(code) || makeCode();
    setCode(cleanCode);
    window.history.replaceState(null, "", `/${cleanCode}`);
    setIsLoading(true);
    setUploadProgress(0);
    setStatus("Uploading...");

    try {
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("PUT", `/api/files/${cleanCode}`);
        request.setRequestHeader("content-type", file.type || "application/octet-stream");
        request.setRequestHeader("x-file-name", encodeURIComponent(file.name));

        request.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        request.onload = () => {
          if (request.status >= 200 && request.status < 300) {
            resolve();
            return;
          }

          try {
            const data = JSON.parse(request.responseText) as FileResponse;
            reject(new Error(data.error || "Upload failed."));
          } catch {
            reject(new Error("Upload failed."));
          }
        };
        request.onerror = () => reject(new Error("Upload failed."));
        request.send(file);
      });

      setStatus("Uploaded. Send the link.");
      setUploadProgress(100);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadFile(cleanCode);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setStatus("Link copied.");
    } catch {
      setStatus("Copy failed. You can still copy the link manually.");
    }
  }

  function newCode() {
    const nextCode = makeCode();
    setCode(nextCode);
    setFile(null);
    setWaitingFile(null);
    setUploadProgress(0);
    window.history.replaceState(null, "", `/${nextCode}`);
    setStatus("New code ready.");
  }

  return (
    <main className="min-h-screen bg-[#07111d] px-4 py-5 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-7xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[.04] px-4 py-3">
          <a href="/" className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg border border-white/60 bg-cyan-400/15 text-sm font-black tracking-[.08em]">
              CTS
            </div>
            <div>
              <p className="text-base font-black">Clear Technology Solutions</p>
              <p className="text-sm text-slate-400">Temporary file send</p>
            </div>
          </a>
          <button
            type="button"
            onClick={newCode}
            className="rounded-md border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-300/20"
          >
            New code
          </button>
        </header>

        <section className="grid flex-1 gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-lg border border-white/10 bg-white/[.05] p-5 shadow-2xl shadow-black/25">
            <h1 className="text-3xl font-black tracking-tight">Send</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Upload one file, send the simple link, and it disappears after 2 downloads or 24 hours.
            </p>

            <form onSubmit={openCode} className="mt-6 space-y-3">
              <label htmlFor="code" className="block text-sm font-bold text-slate-300">
                URL code
              </label>
              <input
                id="code"
                value={code}
                onChange={(event) => setCode(normalizeCode(event.target.value))}
                className="h-12 w-full rounded-md border border-white/15 bg-slate-950/70 px-3 text-base text-white outline-none ring-cyan-300/40 focus:ring-4"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-md bg-cyan-400 px-4 text-sm font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
              >
                Open
              </button>
            </form>

            <div className="mt-5 rounded-md border border-white/10 bg-slate-950/45 p-3">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Share link</p>
              <p className="mt-2 break-all text-sm text-slate-100">{shareLink}</p>
            </div>

            <button
              type="button"
              onClick={copyLink}
              className="mt-3 h-11 w-full rounded-md border border-white/15 px-4 text-sm font-bold text-slate-100 hover:bg-white/10"
            >
              Copy link
            </button>

            <p className="mt-5 text-sm text-slate-300">
              Status: <span className="text-slate-100">{status}</span>
            </p>
          </aside>

          <section className="rounded-lg border border-white/10 bg-white/[.05] shadow-2xl shadow-black/25">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
              <div>
                <p className="font-mono text-sm font-bold uppercase tracking-[.14em] text-cyan-200">
                  /{code}
                </p>
                <p className="text-sm text-slate-400">Max file size: 500 MB</p>
              </div>
              <button
                type="button"
                onClick={() => void loadFile(code)}
                disabled={isLoading}
                className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-slate-100 hover:bg-white/10 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm font-bold uppercase tracking-[.14em] text-cyan-200">Upload</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={chooseFile}
                  className="mt-4 block w-full text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:text-sm file:font-black file:text-slate-950 hover:file:bg-cyan-300"
                />
                {file ? (
                  <div className="mt-4 rounded-md border border-white/10 bg-white/[.04] p-3">
                    <p className="break-all font-bold text-slate-100">{file.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{formatBytes(file.size)}</p>
                  </div>
                ) : null}
                {uploadProgress > 0 ? (
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-cyan-400 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void uploadFile()}
                  disabled={!file || isLoading}
                  className="mt-4 h-12 w-full rounded-md bg-white px-4 text-sm font-black text-slate-950 hover:bg-slate-200 disabled:opacity-60"
                >
                  Upload file
                </button>
              </div>

              <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm font-bold uppercase tracking-[.14em] text-cyan-200">Download</p>
                {waitingFile ? (
                  <div className="mt-4">
                    <div className="rounded-md border border-white/10 bg-white/[.04] p-3">
                      <p className="break-all font-bold text-slate-100">{waitingFile.fileName}</p>
                      <p className="mt-1 text-sm text-slate-400">{formatBytes(waitingFile.fileSize)}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {waitingFile.downloadsRemaining} downloads left
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Expires {new Date(waitingFile.expiresAt).toLocaleString()}
                      </p>
                    </div>
                    <a
                      href={`/api/files/${code}/download`}
                      className="mt-4 block h-12 rounded-md bg-cyan-400 px-4 py-3 text-center text-sm font-black text-slate-950 hover:bg-cyan-300"
                    >
                      Download file
                    </a>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-white/15 p-5 text-sm text-slate-400">
                    No file is waiting for this code.
                  </div>
                )}
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
