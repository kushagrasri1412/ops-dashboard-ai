"use client";

import { useEffect, useState } from "react";
import { Bot, Send, ShieldAlert } from "lucide-react";
import CopilotResult from "./CopilotResult";

function CopilotSkeleton() {
  return (
    <div className="mt-5 space-y-4" aria-hidden="true">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}

function buildCopilotNotice({ openaiMode, fallbackReason }) {
  if (openaiMode === "demo") {
    return {
      message: "Demo Copilot mode: OpenAI key not configured.",
      variant: "info",
    };
  }

  if (openaiMode === "live" && fallbackReason === "openai_error") {
    return {
      message: "Live Copilot is temporarily unavailable. Showing a safe fallback.",
      variant: "info",
    };
  }

  if (openaiMode === "live" && fallbackReason === "schema_invalid") {
    return {
      message: "Copilot response failed schema validation. Showing a safe fallback.",
      variant: "info",
    };
  }

  return null;
}

export default function CopilotPanel() {
  const [query, setQuery] = useState(
    "Why did revenue dip last week and what should ops do next?"
  );
  const [promptVersion, setPromptVersion] = useState("v1");
  const [apiKey, setApiKey] = useState("dev_local_key");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [noticeVariant, setNoticeVariant] = useState("info");
  const [result, setResult] = useState(null);

  useEffect(() => {
    try {
      const storedKey = window.localStorage.getItem("copilot_api_key");
      const storedPrompt = window.localStorage.getItem("copilot_prompt_version");

      if (storedKey) setApiKey(storedKey);
      if (storedPrompt === "v1" || storedPrompt === "v2") {
        setPromptVersion(storedPrompt);
      }
    } catch (error) {
      // Ignore localStorage issues (private mode, etc.)
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("copilot_api_key", apiKey);
    } catch (error) {
      // Ignore localStorage issues
    }
  }, [apiKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem("copilot_prompt_version", promptVersion);
    } catch (error) {
      // Ignore localStorage issues
    }
  }, [promptVersion]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setNotice(null);

    const trimmed = query.trim();
    if (!trimmed) {
      setError("Enter a question for the copilot.");
      return;
    }

    if (trimmed.length > 600) {
      setError("Query is too long (max 600 characters).");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ query: trimmed, prompt_version: promptVersion }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Copilot request failed.");
      }

      const metaMode =
        payload?.meta?.mode === "demo" || payload?.meta?.mode === "live"
          ? payload.meta.mode
          : "";

      const metaFallback =
        typeof payload?.meta?.fallback_reason === "string"
          ? payload.meta.fallback_reason
          : "";

      const openaiMode = metaMode || response.headers.get("x-openai-mode") || "";
      const fallbackReason =
        metaFallback || response.headers.get("x-copilot-fallback") || "none";
      const nextNotice = buildCopilotNotice({ openaiMode, fallbackReason });
      if (nextNotice?.message) {
        setNotice(nextNotice.message);
        setNoticeVariant(nextNotice.variant);
      }

      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">AI Ops Copilot</p>
          <p className="text-sm text-slate-500">
            Explain anomalies and suggest next best actions
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2 text-slate-500">
          <Bot className="h-4 w-4" />
        </div>
      </div>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Prompt Version
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
              value={promptVersion}
              onChange={(event) => setPromptVersion(event.target.value)}
            >
              <option value="v1">v1</option>
              <option value="v2">v2</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Copilot API Key
            <input
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="dev_local_key"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Question
          <textarea
            className="min-h-[110px] resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask about revenue shifts, store performance, or action plans…"
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Uses server-side data (revenue, forecast, anomalies) and returns
            structured JSON.
          </p>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {loading ? "Running…" : "Ask"}
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <ShieldAlert className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? <CopilotSkeleton /> : null}

      <CopilotResult
        key={result ? String(result.summary || "").slice(0, 80) : "empty"}
        result={result}
        notice={notice}
        noticeVariant={noticeVariant}
      />
    </div>
  );
}
