# 🚀 Next.js Frontend for AI Chat (Vercel Advanced)

Welcome to the advanced, vibed-up frontend! This app features a modern UI, loading spinner, error handling, and is ready for both local and Vercel deployments.

## 🏃‍♂️ Running Locally

1. Open a terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. (Optional) Create a `.env.local` file to set a custom backend API URL:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
   If not set, defaults to relative `/api` (works with local proxy or Vercel serverless).
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🌐 Deploying to Vercel

1. Push your project to GitHub.
2. Import your repo into Vercel.
3. In Vercel dashboard, set `NEXT_PUBLIC_API_URL` in your project's Environment Variables if your backend is hosted elsewhere.
4. Deploy!

## 💡 Features
- Modern, gradient UI with extra vibes
- Loading spinner and error feedback
- Secure API key entry
- Streams responses from your backend in real time
- Footer links to GitHub and Vercel

Enjoy the vibes! ✨
