-- Cloudflare D1 Database Schema for PrepWise

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  type TEXT NOT NULL,
  level TEXT NOT NULL,
  techstack TEXT NOT NULL,       -- JSON array string: ["React", "TypeScript"]
  questions TEXT NOT NULL,       -- JSON array string: ["Question 1", "Question 2"]
  userId TEXT NOT NULL,
  finalized INTEGER DEFAULT 1,   -- 1 for true, 0 for false
  coverImage TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  interviewId TEXT NOT NULL,
  userId TEXT NOT NULL,
  totalScore INTEGER NOT NULL,
  categoryScores TEXT NOT NULL,  -- JSON array string of category score objects
  strengths TEXT NOT NULL,       -- JSON array string
  areasForImprovement TEXT NOT NULL, -- JSON array string
  finalAssessment TEXT NOT NULL,
  questionReviews TEXT,          -- JSON array string of question-by-question candidate answer reviews & model answers
  createdAt TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_interviews_userId ON interviews(userId);
CREATE INDEX IF NOT EXISTS idx_interviews_createdAt ON interviews(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_interview_user ON feedback(interviewId, userId);
