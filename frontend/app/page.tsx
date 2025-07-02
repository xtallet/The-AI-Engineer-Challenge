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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploadStatus, setPdfUploadStatus] = useState<string>("");
  const [pdfQuestion, setPdfQuestion] = useState("");
  const [pdfAnswer, setPdfAnswer] = useState("");
  const [pdfContext, setPdfContext] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

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

  // PDF upload handler
  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) return;
    setPdfUploadStatus("Uploading...");
    const formData = new FormData();
    formData.append("file", pdfFile);
    try {
      const res = await fetch("/api/pdf/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setPdfUploadStatus(`PDF uploaded and indexed! Chunks: ${data.num_chunks}`);
      } else {
        setPdfUploadStatus("Error: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      setPdfUploadStatus("Error: " + err.message);
    }
  };

  // PDF chat handler
  const handlePdfChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setPdfLoading(true);
    setPdfAnswer("");
    setPdfContext("");
    try {
      const res = await fetch("/api/pdf/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: pdfQuestion,
          api_key: apiKey,
          k: 3,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPdfAnswer(data.answer);
        setPdfContext(data.context);
      } else {
        setPdfAnswer("Error: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      setPdfAnswer("Error: " + err.message);
    } finally {
      setPdfLoading(false);
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
        {/* PDF Upload and Chat Section */}
        <section style={{ width: "100%", maxWidth: 480, marginTop: 32 }}>
          <h2>Chat with your PDF</h2>
          <form onSubmit={handlePdfUpload} style={{ marginBottom: 16 }}>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              required
              style={{ marginBottom: 8 }}
            />
            <button type="submit" className={styles.primary} disabled={!pdfFile}>
              Upload & Index PDF
            </button>
          </form>
          <div style={{ marginBottom: 16, minHeight: 24 }}>{pdfUploadStatus}</div>
          <form onSubmit={handlePdfChat}>
            <label>
              Ask a question about your PDF:
              <input
                type="text"
                value={pdfQuestion}
                onChange={(e) => setPdfQuestion(e.target.value)}
                required
                style={{ width: "100%", minHeight: 32, marginTop: 4, marginBottom: 8 }}
                disabled={!pdfUploadStatus.startsWith("PDF uploaded")}
              />
            </label>
            <button type="submit" className={styles.primary} disabled={pdfLoading || !pdfUploadStatus.startsWith("PDF uploaded") || !pdfQuestion}>
              {pdfLoading ? "Thinking..." : "Ask PDF"}
            </button>
          </form>
          <div style={{ marginTop: 16, background: "var(--gray-alpha-100)", borderRadius: 8, padding: 12, minHeight: 40 }}>
            <strong>Answer:</strong>
            <div style={{ whiteSpace: "pre-wrap" }}>{pdfAnswer}</div>
            {pdfContext && (
              <details style={{ marginTop: 8 }}>
                <summary>Show RAG Context</summary>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4, whiteSpace: "pre-wrap" }}>{pdfContext}</div>
              </details>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
