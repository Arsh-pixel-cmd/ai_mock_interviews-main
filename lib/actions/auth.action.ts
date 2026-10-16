"use server";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { hashSync, compareSync } from "bcrypt-ts";
import { queryFirst, execute } from "@/lib/db";

// Session duration: 7 days
const SESSION_DURATION = 60 * 60 * 24 * 7;
const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "prepwise-cloudflare-secret-key-change-in-production-min-32-chars"
);

// Create and set JWT session cookie
export async function setSessionCookie(user: { id: string; name: string; email: string }) {
  const cookieStore = await cookies();

  const token = await new SignJWT({
    name: user.name,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(JWT_SECRET);

  cookieStore.set("session", token, {
    maxAge: SESSION_DURATION,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });
}

export async function signUp(params: SignUpParams) {
  const { name, email, password } = params;

  try {
    // Check if user already exists
    const existingUser = await queryFirst<{ id: string }>(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email.toLowerCase().trim()]
    );

    if (existingUser) {
      return {
        success: false,
        message: "An account with this email already exists. Please sign in.",
      };
    }

    const userId = crypto.randomUUID();
    const hashedPassword = hashSync(password, 10);
    const createdAt = new Date().toISOString();

    await execute(
      "INSERT INTO users (id, name, email, password, createdAt) VALUES (?, ?, ?, ?, ?)",
      [userId, name.trim(), email.toLowerCase().trim(), hashedPassword, createdAt]
    );

    await setSessionCookie({ id: userId, name: name.trim(), email: email.toLowerCase().trim() });

    return {
      success: true,
      message: "Account created successfully.",
    };
  } catch (error) {
    console.error("Error creating user:", error);
    const message = error instanceof Error ? error.message : "Failed to create account. Please try again.";
    return {
      success: false,
      message,
    };
  }
}

export async function signIn(params: SignInParams) {
  const { email, password } = params;

  try {
    const user = await queryFirst<{ id: string; name: string; email: string; password: string }>(
      "SELECT id, name, email, password FROM users WHERE email = ? LIMIT 1",
      [email.toLowerCase().trim()]
    );

    if (!user) {
      return {
        success: false,
        message: "No account found with this email. Please sign up.",
      };
    }

    const isPasswordValid = compareSync(password, user.password);
    if (!isPasswordValid) {
      return {
        success: false,
        message: "Invalid password. Please try again.",
      };
    }

    await setSessionCookie({ id: user.id, name: user.name, email: user.email });

    return {
      success: true,
      message: "Signed in successfully.",
    };
  } catch (error) {
    console.error("Error signing in:", error);
    return {
      success: false,
      message: "Failed to log in. Please try again.",
    };
  }
}

// Sign out user by clearing the session cookie
export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

// Get current user from session cookie
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (!sessionToken) return null;

  try {
    const { payload } = await jwtVerify(sessionToken, JWT_SECRET);

    if (!payload.sub) return null;

    return {
      id: payload.sub,
      name: (payload.name as string) || "",
      email: (payload.email as string) || "",
    };
  } catch {
    // Expired or invalid session token
    return null;
  }
}

// Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}
