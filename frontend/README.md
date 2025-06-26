# 🚀 Next.js Frontend for AI Chat

Welcome to your snazzy new frontend! This app lets you chat with your FastAPI backend (in `/api/app.py`) using a single-exchange chat UI. 

## 🏃‍♂️ Running Locally

1. Open a terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies (just once):
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** Make sure your FastAPI backend is running and accessible at `/api/chat` and `/api/health` (see `/api/app.py`).

## 🌐 Deploying to Vercel

1. [Sign up for Vercel](https://vercel.com/) if you haven't already.
2. Push your project to GitHub (or your favorite git host).
3. Import your repo into Vercel and follow the prompts. Vercel will auto-detect the Next.js app in `frontend/`.
4. Set up your backend as a Vercel Serverless Function or deploy it separately (see Vercel docs for Python backends).

## 💡 Features
- Clean, modern UI
- Secure API key entry
- Streams responses from your backend in real time

Have fun building! ✨
