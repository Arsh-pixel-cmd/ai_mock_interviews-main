<div align="center">
  <br />
    <a href="https://www.youtube.com/watch?v=8GK8R77Bd7g" target="_blank">
      <img src="https://github.com/user-attachments/assets/1c0131c7-9f2d-4e3b-b47c-9679e76d8f9a" alt="Project Banner">
    </a>
  <br />
  
  <div>
    <img src="https://img.shields.io/badge/-Next.JS-black?style=for-the-badge&logoColor=white&logo=nextdotjs&color=black" alt="next.js" />
    <img src="https://img.shields.io/badge/-Vapi-white?style=for-the-badge&color=5dfeca" alt="vapi" />
    <img src="https://img.shields.io/badge/-Tailwind_CSS-black?style=for-the-badge&logoColor=white&logo=tailwindcss&color=06B6D4" alt="tailwindcss" />
    <img src="https://img.shields.io/badge/-Firebase-black?style=for-the-badge&logoColor=white&logo=firebase&color=DD2C00" alt="firebase" />
    <img src="https://img.shields.io/badge/-Gemini_AI-blue?style=for-the-badge&logoColor=white&logo=google&color=4285F4" alt="gemini" />
  </div>

  <h3 align="center">Prepwise: The Ultimate AI Interview Coach</h3>
  
  <p align="center">
    Voice Interviews, ATS Resume Analysis, and Detailed Feedback â€” all powered by AI.
  </p>
</div>

## <a name="table">📋 Table of Contents</a>

1. 🤖 [Introduction](#introduction)
2. ⚙️ [Tech Stack](#tech-stack)
3. 🔋 [Features](#features)
4. 🤸 [Quick Start](#quick-start)
5. ⚠️ [Important Note (Credits)](#credits)

## <a name="introduction">🤖 Introduction</a>

Prepwise is a cutting-edge platform designed to help you ace your job interviews. Built with the latest tech stack, it simulates real-time voice interviews using Vapi AI, analyzes your resume for ATS friendliness using Google Gemini, and provides comprehensive feedback to help you improve.

## <a name="tech-stack">⚙️ Tech Stack</a>

- **Frontend**: Next.js 15 (Turbopack), Tailwind CSS, Shadcn/UI
- **Backend**: Next.js Server Actions
- **Database & Auth**: Firebase (Admin SDK & Client SDK)
- **AI & Voice**: 
    -   **Vapi AI**: Real-time voice conversational agents.
    -   **Google Gemini**: Resume analysis and feedback generation.
- **Utilities**: 
    -   `react-to-print`: PDF generation.
    -   `pdf-parse`: Resume text extraction.
    -   `zod`: Schema validation.

## <a name="features">🔋 Features</a>

### 1. 🗣️ AI Voice Interviews
Conduct real-time, conversational interviews with an AI agent. It feels just like talking to a real recruiter! 
*(Powered by Vapi AI)*.

### 2. 📝 ATS Resume Analysis
Upload your PDF resume and get an instant score (out of 10). The AI checks for ATS friendliness and suggests specific improvements to help you get shortlisted.
*(Powered by Google Gemini)*.

### 3. 📊 Smart Feedback & PDF Download
After your interview, receive a detailed breakdown of your performance:
-   **Score**: Out of 100.
-   **Strengths & Weaknesses**: Actionable insights.
-   **Download as PDF**: Save your feedback report for later review.

### 4. 📈 Interview Tracking
Keep track of all your completed interviews on the dashboard. Monitor your progress over time.

### 5. 🔐 Secure Authentication
Seamless sign-up and sign-in using Firebase Authentication.

## <a name="quick-start">🤸 Quick Start</a>

1.  **Clone the Repo**
    ```bash
    git clone https://github.com/adrianhajdin/ai_mock_interviews.git
    cd ai_mock_interviews
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Set Up Environment Variables** (`.env.local`)
    ```env
    NEXT_PUBLIC_VAPI_WEB_TOKEN=your_vapi_public_key
    NEXT_PUBLIC_VAPI_WORKFLOW_ID=your_vapi_assistant_id
    GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
    # ... Firebase config ...
    ```

4.  **Run the App**
    ```bash
    npm run dev
    ```

---

## <a name="credits">⚠️ Important Note: The "Silent Treatment" Bug</a>

**Is the AI not talking? getting a 400 error?**

> [!WARNING]
> **Check your Vapi Credits!** 💸
> 
> If the voice agent suddenly goes mute or refuses to connect, it's 99.9% likely because the **Vapi credits have expired**.
> 
> The developer (me) spent all the budget building this cool "Resume Analyzer" feature, so if you want to chat, you might need to top up the wallet! 😂
> 
> *(But seriously, check your Vapi Dashboard > Billing if you see connection errors).*

---
<div align="center">
  Built with ❤️ for aspiring developers.
</div>
