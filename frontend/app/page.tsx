"use client";
import { useState, useRef } from "react";
import styles from "./page.module.css";

// Contexts and their developer messages
const CONTEXTS = [
  {
    key: "programmer",
    label: "Programmer",
    prompt:
      "You are an experienced programmer, specialized in Python and object-oriented programming.",
  },
  {
    key: "summarization",
    label: "Summarization",
    prompt:
      "You are a summarization assistant. Read paragraphs carefully and provide concise, accurate summaries that capture the key points without adding extra interpretation or commentary. Keep the summary neutral, clear, and to the point.",
  },
  {
    key: "writing",
    label: "Writing Assistant",
    prompt:
      "You are a creative writing assistant. Write vivid, emotionally resonant stories with clear structure and imaginative detail. Prioritize originality and human-like emotion.",
  },
  {
    key: "math",
    label: "Math Tutor",
    prompt:
      "You are a math tutor. Provide clear, direct answers to arithmetic and word problems. Explain the steps simply and briefly when appropriate.",
  },
  {
    key: "language",
    label: "Language Assistant",
    prompt:
      "You are a language assistant skilled in rewriting texts. Rewrite the given paragraph in a professional and formal tone, using clear and precise language. Maintain the original meaning while enhancing the style to be suitable for business or academic contexts.",
  },
];

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 32 }}>
      <div style={{
        width: 24, height: 24, border: "3px solid #ccc", borderTop: "3px solid #0070f3", borderRadius: "50%",
        animation: "spin 1s linear infinite"
      }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function Home() {
  const [context, setContext] = useState(CONTEXTS[0].key);
  const [userMessage, setUserMessage] = useState("");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [apiKey, setApiKey] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const responseRef = useRef<HTMLDivElement>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResponse("");
    setError("");
    setLoading(true);
    try {
      const developerMessage = CONTEXTS.find((c) => c.key === context)?.prompt || "";
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developer_message: developerMessage,
          user_message: userMessage,
          model,
          api_key: apiKey,
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          setResponse((prev) => prev + decoder.decode(value));
          if (responseRef.current) {
            responseRef.current.scrollTop = responseRef.current.scrollHeight;
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page} style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 50%, #f9fafb 100%)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }}>
      <header style={{ width: "100%", padding: "32px 0 16px 0", textAlign: "center" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, color: "#222" }}>
          <span role="img" aria-label="sparkles">✨</span> AI Chat Vibe <span role="img" aria-label="robot">🤖</span>
        </h1>
        <p style={{ color: "#555", fontSize: 18, marginTop: 8 }}>A single-exchange chat with OpenAI, now with context selection!</p>
      </header>
      <main className={styles.main}>
        <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.06)", padding: 24, margin: "0 auto" }} aria-label="Chat form">
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="context" style={{ fontWeight: 500, color: '#222' }}>Context</label>
            <select
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6 }}
            >
              {CONTEXTS.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="userMsg" style={{ fontWeight: 500, color: '#222' }}>User Message</label>
            <textarea
              id="userMsg"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              required
              style={{ width: "100%", minHeight: 40, marginTop: 4 }}
              aria-required="true"
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="model" style={{ fontWeight: 500, color: '#222' }}>Model (optional)</label>
            <input
              id="model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{ width: "100%", marginTop: 4 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="apiKey" style={{ fontWeight: 500, color: '#222' }}>OpenAI API Key</label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              style={{ width: "100%", marginTop: 4 }}
              autoComplete="off"
              aria-required="true"
            />
          </div>
          <button
            type="submit"
            className={styles.primary}
            disabled={loading}
            style={{ width: "100%", marginTop: 8, fontWeight: 700, fontSize: 18 }}
            aria-busy={loading}
          >
            {loading ? <Spinner /> : "Send"}
          </button>
        </form>
        {error && <div style={{ color: "#d32f2f", marginTop: 16, fontWeight: 600 }} role="alert">{error}</div>}
        <div
          ref={responseRef}
          style={{
            width: "100%",
            maxWidth: 480,
            background: "#f3f6fd",
            borderRadius: 8,
            padding: 12,
            margin: "24px auto 0 auto",
            whiteSpace: "pre-wrap",
            fontFamily: "var(--font-geist-mono, monospace)",
            color: "#222",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            overflowY: "auto",
            minHeight: 80,
            maxHeight: 240,
          }}
          aria-live="polite"
        >
          {response || (loading ? <span style={{ color: "#888" }}>Waiting for response...</span> : "Response will appear here.")}
        </div>
      </main>
      <footer className={styles.footer}>
        <span>Made with <span role="img" aria-label="love">❤️</span> for the AI Engineer Challenge &middot; </span>
        <a href="https://github.com/xtallet/The-AI-Engineer-Challenge" target="_blank" rel="noopener noreferrer" style={{ color: "#0070f3", textDecoration: "underline" }}>GitHub</a>
        <span> &middot; </span>
        <a href="https://vercel.com/xtallets-projects/ai-engineering-challenge" target="_blank" rel="noopener noreferrer" style={{ color: "#0070f3", textDecoration: "underline" }}>Vercel</a>
      </footer>
    </div>
  );
}
