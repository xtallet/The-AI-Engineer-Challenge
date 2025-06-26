"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import styles from "./page.module.css";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface Model {
  id: string;
  name: string;
  description: string;
  max_tokens: number;
  cost_per_1k_tokens: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [developerMessage, setDeveloperMessage] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModelInfo, setSelectedModelInfo] = useState<Model | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load available models on component mount
  useEffect(() => {
    fetchModels();
  }, []);

  // Update selected model info when model changes
  useEffect(() => {
    const modelInfo = models.find(m => m.id === model);
    setSelectedModelInfo(modelInfo || null);
  }, [model, models]);

  const fetchModels = async () => {
    try {
      const response = await fetch("/api/models");
      if (response.ok) {
        const data = await response.json();
        setModels(data.models);
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
    }
  };

  const validateApiKey = useCallback(async () => {
    if (!apiKey.trim()) return;
    
    setValidatingKey(true);
    try {
      const response = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developer_message: "Test",
          user_message: "Test",
          model: "gpt-3.5-turbo",
          api_key: apiKey,
        }),
      });
      
      const data = await response.json();
      setApiKeyValid(data.valid);
      
      if (!data.valid) {
        setError("Invalid API key. Please check your key and try again.");
      } else {
        setError("");
      }
    } catch {
      setApiKeyValid(false);
      setError("Failed to validate API key");
    } finally {
      setValidatingKey(false);
    }
  }, [apiKey]);

  // Validate API key when it changes
  useEffect(() => {
    if (apiKey.trim() && apiKey.startsWith('sk-')) {
      const timeoutId = setTimeout(validateApiKey, 1000);
      return () => clearTimeout(timeoutId);
    } else {
      setApiKeyValid(false);
    }
  }, [apiKey, validateApiKey]);

  const addMessage = (role: 'user' | 'assistant' | 'system', content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userMessage.trim() || !developerMessage.trim() || !apiKey.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    if (!apiKeyValid) {
      setError("Please enter a valid API key");
      return;
    }

    setError("");
    setLoading(true);
    setIsTyping(true);
    
    // Add user message to chat
    addMessage('user', userMessage);

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

      console.log("Response status:", res.status);
      console.log("Response headers:", Object.fromEntries(res.headers.entries()));

      if (!res.body) throw new Error("No response body");
      
      if (!res.ok) {
        let errorText = "Unknown error";
        try {
          const err = await res.json();
          console.log("Error response:", err);
          
          if (err.detail) {
            errorText = err.detail;
          } else if (err.message) {
            errorText = err.message;
          } else if (err.error) {
            errorText = err.error;
          } else if (typeof err === 'string') {
            errorText = err;
          } else if (typeof err === 'object') {
            errorText = JSON.stringify(err, null, 2);
          } else {
            errorText = 'Unknown error';
          }
        } catch {
          try {
            errorText = await res.text();
          } catch {
            errorText = `HTTP ${res.status}: ${res.statusText}`;
          }
        }
        throw new Error(String(errorText));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = "";
      
      // Add assistant message placeholder
      addMessage('assistant', '');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        if (value) {
          const chunk = decoder.decode(value);
          assistantResponse += chunk;
          
          // Update the last message (assistant's response)
          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length > 0) {
              newMessages[newMessages.length - 1].content = assistantResponse;
            }
            return newMessages;
          });
        }
      }
    } catch (err: unknown) {
      console.error("Chat error:", err);
      let errorMessage = "Something went wrong";

      if (err instanceof Error) {
        if (
          err.message === "[object Object]" &&
          typeof err === "object" &&
          err !== null &&
          "originalError" in err
        ) {
          errorMessage = JSON.stringify((err as Record<string, unknown>).originalError, null, 2);
        } else {
          errorMessage = err.message;
        }
      } else if (typeof err === "string") {
        errorMessage = err;
      } else if (err && typeof err === "object") {
        errorMessage = JSON.stringify(err, null, 2);
      }

      setError(errorMessage);
      addMessage("system", `Error: ${errorMessage}`);
    } finally {
      setLoading(false);
      setIsTyping(false);
      setUserMessage("");
      inputRef.current?.focus();
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError("");
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getCharacterCount = (text: string) => {
    return text.length;
  };

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <span className={styles.emoji}>🤖</span>
            AI Chat Assistant
          </h1>
          <div className={styles.headerActions}>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={styles.settingsButton}
            >
              ⚙️ Settings
            </button>
            <button 
              onClick={clearChat}
              className={styles.clearButton}
              disabled={messages.length === 0}
            >
              🗑️ Clear Chat
            </button>
          </div>
        </header>

        {showSettings && (
          <div className={styles.settingsPanel}>
            <h3>Configuration</h3>
            <div className={styles.settingsGrid}>
              <label>
                Developer Message (System Prompt):
                <textarea
                  value={developerMessage}
                  onChange={(e) => setDeveloperMessage(e.target.value)}
                  placeholder="Enter the system prompt that defines the AI&apos;s behavior..."
                  rows={3}
                  className={styles.settingsInput}
                />
                <div className={styles.inputStats}>
                  {getCharacterCount(developerMessage)} characters, {getWordCount(developerMessage)} words
                </div>
              </label>
              
              <label>
                Model:
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={styles.settingsInput}
                >
                  {models.map((modelOption) => (
                    <option key={modelOption.id} value={modelOption.id}>
                      {modelOption.name}
                    </option>
                  ))}
                </select>
                {selectedModelInfo && (
                  <div className={styles.modelInfo}>
                    <div className={styles.modelDescription}>{selectedModelInfo.description}</div>
                    <div className={styles.modelStats}>
                      Max tokens: {selectedModelInfo.max_tokens.toLocaleString()} | 
                      Cost: ${selectedModelInfo.cost_per_1k_tokens}/1K tokens
                    </div>
                  </div>
                )}
              </label>
              
              <label>
                OpenAI API Key:
                <div className={styles.apiKeyContainer}>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className={`${styles.settingsInput} ${apiKeyValid ? styles.validInput : apiKey.trim() ? styles.invalidInput : ''}`}
                  />
                  {validatingKey && <div className={styles.validatingIndicator}>🔍</div>}
                  {apiKeyValid && <div className={styles.validIndicator}>✅</div>}
                </div>
                <div className={styles.apiKeyStatus}>
                  {apiKeyValid ? "API key is valid" : apiKey.trim() ? "Invalid API key" : "Enter your OpenAI API key"}
                </div>
              </label>
            </div>
          </div>
        )}

        <div className={styles.chatContainer}>
          <div className={styles.messagesContainer}>
            {messages.length === 0 ? (
              <div className={styles.welcomeMessage}>
                <div className={styles.welcomeIcon}>👋</div>
                <h2>Welcome to AI Chat Assistant!</h2>
                <p>Configure your settings and start chatting with AI. Your conversations will appear here.</p>
                <div className={styles.welcomeTips}>
                  <div className={styles.tip}>
                    <span className={styles.tipIcon}>💡</span>
                    <span>Make sure to enter a valid OpenAI API key in settings</span>
                  </div>
                  <div className={styles.tip}>
                    <span className={styles.tipIcon}>🎯</span>
                    <span>Write a clear system prompt to guide the AI&apos;s behavior</span>
                  </div>
                  <div className={styles.tip}>
                    <span className={styles.tipIcon}>⚡</span>
                    <span>Try different models for various tasks and budgets</span>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`${styles.message} ${styles[message.role]}`}
                >
                  <div className={styles.messageHeader}>
                    <span className={styles.messageRole}>
                      {message.role === 'user' ? '👤 You' : 
                       message.role === 'assistant' ? '🤖 AI' : '⚠️ System'}
                    </span>
                    <span className={styles.messageTime}>
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  <div className={styles.messageContent}>
                    {message.content || (message.role === 'assistant' && isTyping ? (
                      <div className={styles.typingIndicator}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : null)}
                  </div>
                  {message.content && (
                    <div className={styles.messageActions}>
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className={styles.copyButton}
                        title="Copy to clipboard"
                      >
                        📋 Copy
                      </button>
                      <div className={styles.messageStats}>
                        {getCharacterCount(message.content)} chars, {getWordCount(message.content)} words
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            {isTyping && messages.length > 0 && (
              <div className={`${styles.message} ${styles.assistant}`}>
                <div className={styles.messageHeader}>
                  <span className={styles.messageRole}>🤖 AI</span>
                  <span className={styles.messageTime}>Now</span>
                </div>
                <div className={styles.messageContent}>
                  <div className={styles.typingIndicator}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className={styles.inputForm} onSubmit={handleSubmit}>
            <div className={styles.inputContainer}>
              <div className={styles.inputWrapper}>
                <textarea
                  ref={inputRef}
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={1}
                  className={styles.messageInput}
                  disabled={loading || !developerMessage.trim() || !apiKey.trim() || !apiKeyValid}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <div className={styles.inputStats}>
                  {getCharacterCount(userMessage)} characters, {getWordCount(userMessage)} words
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !userMessage.trim() || !developerMessage.trim() || !apiKey.trim() || !apiKeyValid}
                className={styles.sendButton}
              >
                {loading ? (
                  <div className={styles.spinner}></div>
                ) : (
                  '🚀'
                )}
              </button>
            </div>
            {error && (
              <div className={styles.errorMessage}>
                <span className={styles.errorIcon}>⚠️</span>
                {error}
              </div>
            )}
          </form>
        </div>
      </main>
      <footer className={styles.footer}>
        <a
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
