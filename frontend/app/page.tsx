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

  const exampleQuestions = [
    "What is my deductible for collision coverage?",
    "Does my policy cover rental car reimbursement?",
    "How do I file a claim for a stolen vehicle?",
    "Are there any exclusions for flood damage?",
    "What is the process for adding a new driver to my policy?",
  ];

  // PDF upload handler
  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) return;
    setPdfUploadStatus("Uploading...");
    const formData = new FormData();
    formData.append("file", pdfFile);
    formData.append("api_key", apiKey);
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
      <div className={styles.contentBg}>
        <div className={styles.card}>
          <main className={styles.main}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 0 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" style={{ verticalAlign: 'middle' }}>
                <path d="M12 3l7 4v5c0 5-3.5 9-7 9s-7-4-7-9V7l7-4z" fill="#1976d2" stroke="#1976d2" strokeWidth="1.5"/>
                <path d="M12 3v17" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <h1 style={{ margin: 0 }}>Insurance Policy Q&amp;A Assistant</h1>
            </div>
            <p style={{ maxWidth: 480, margin: '0 auto 16px', color: '#555' }}>
              Upload your car or home insurance policy PDF and ask questions about your coverage, deductibles, exclusions, and more. Try the example questions below!
            </p>
            <section style={{ width: "100%", maxWidth: 480, marginTop: 32 }}>
              <div style={{ marginBottom: 16 }}>
                <strong>Try with a sample insurance policy PDF:</strong>
                <a href="https://doi.nv.gov/uploadedFiles/doinvgov/_public-documents/Consumers/PP_00_01_06_98.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#0070f3', textDecoration: 'underline', marginLeft: 8 }}>
                  Download Sample Car Insurance Policy
                </a>
              </div>
              <form onSubmit={handlePdfUpload} style={{ marginBottom: 16 }}>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  required
                  style={{ marginBottom: 8 }}
                />
                <button type="submit" className={styles.primary} disabled={!pdfFile}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ verticalAlign: 'middle' }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" fill="#1976d2"/>
                      <text x="12" y="17" textAnchor="middle" fontSize="12" fill="#fff" fontWeight="bold">PDF</text>
                    </svg>
                    Upload &amp; Index PDF
                  </span>
                </button>
              </form>
              <div style={{ marginBottom: 16, minHeight: 24, display: 'flex', alignItems: 'center', gap: 8, background: '#f0f1f4', borderRadius: 8, padding: '6px 14px' }}>
                {pdfUploadStatus.startsWith('PDF uploaded') && (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="12" fill="#43a047"/>
                    <path d="M7 13l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {pdfUploadStatus}
              </div>
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
                  Ask a question about your policy:
                  <input
                    type="text"
                    value={pdfQuestion}
                    onChange={(e) => setPdfQuestion(e.target.value)}
                    required
                    style={{ width: "100%", minHeight: 32, marginTop: 4, marginBottom: 8 }}
                    disabled={!pdfUploadStatus.startsWith("PDF uploaded")}
                    placeholder="e.g. What is my deductible for collision coverage?"
                  />
                </label>
                <div style={{ marginBottom: 8 }}>
                  <strong>Example questions:</strong>
                  <ul style={{ paddingLeft: 16, margin: '8px 0' }}>
                    {exampleQuestions.map((q, i) => (
                      <li key={i} style={{ cursor: 'pointer', color: '#0070f3', textDecoration: 'underline' }}
                          onClick={() => setPdfQuestion(q)}>{q}</li>
                    ))}
                  </ul>
                </div>
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
      </div>
    </div>
  );
}
