"use client";
import { useState, useRef } from "react";
import styles from "./page.module.css";

export default function Home() {
  const [developerMessage, setDeveloperMessage] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [apiKey, setApiKey] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const responseRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResponse("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developer_message: developerMessage,
          user_message: userMessage,
          model,
          api_key: apiKey,
        }),
      });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          setResponse((prev) => prev + decoder.decode(value));
          // Scroll to bottom as new data comes in
          if (responseRef.current) {
            responseRef.current.scrollTop = responseRef.current.scrollHeight;
          }
        }
      }
    } catch (err: any) {
      setResponse("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>AI Chat (Single Exchange)</h1>
        <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 480 }}>
          <div style={{ marginBottom: 12 }}>
            <label>
              Developer Message
              <textarea
                value={developerMessage}
                onChange={(e) => setDeveloperMessage(e.target.value)}
                required
                style={{ width: "100%", minHeight: 40 }}
              />
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>
              User Message
              <textarea
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                required
                style={{ width: "100%", minHeight: 40 }}
              />
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>
              Model (optional)
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={{ width: "100%" }}
              />
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>
              OpenAI API Key
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                style={{ width: "100%" }}
                autoComplete="off"
              />
            </label>
          </div>
          <button
            type="submit"
            className={styles.primary}
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </form>
        <div
          ref={responseRef}
          style={{
            width: "100%",
            maxWidth: 480,
            minHeight: 60,
            background: "var(--gray-alpha-100)",
            borderRadius: 8,
            padding: 12,
            marginTop: 16,
            whiteSpace: "pre-wrap",
            fontFamily: "var(--font-geist-mono, monospace)",
            color: "var(--gray-rgb)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            overflowY: "auto",
            minHeight: 80,
            maxHeight: 240,
          }}
          aria-live="polite"
        >
          {response || (loading ? "Waiting for response..." : "Response will appear here.")}
        </div>
      </main>
    </div>
  );
}
