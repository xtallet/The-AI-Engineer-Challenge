"use client";
import { useState, useRef } from "react";
import styles from "./page.module.css";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploadStatus, setPdfUploadStatus] = useState<string>("");
  const [pdfQuestion, setPdfQuestion] = useState("");
  const [pdfAnswer, setPdfAnswer] = useState("");
  const [pdfContext, setPdfContext] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

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
          model,
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
        <h1>Chat with your PDF</h1>
        <section style={{ width: "100%", maxWidth: 480, marginTop: 32 }}>
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
              OpenAI API Key
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                style={{ width: "100%", marginBottom: 8 }}
                autoComplete="off"
              />
            </label>
            <label>
              Model
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={{ width: "100%", marginBottom: 8 }}
              />
            </label>
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
