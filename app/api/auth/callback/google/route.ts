import { NextResponse } from "next/server";
import { queryFirst, execute } from "@/lib/db";
import { setSessionCookie } from "@/lib/actions/auth.action";

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfoResponse {
  id?: string;
  name?: string;
  email?: string;
  picture?: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || origin}/api/auth/callback/google`;

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=No+authorization+code+received`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=Google+OAuth+credentials+missing+on+server`
    );
  }

  try {
    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Google token exchange error:", tokenData);
      return NextResponse.redirect(
        `${origin}/sign-in?error=Failed+to+authenticate+with+Google`
      );
    }

    // 2. Fetch user profile from Google UserInfo endpoint
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = (await userInfoRes.json()) as GoogleUserInfoResponse;

    if (!profile.email) {
      return NextResponse.redirect(
        `${origin}/sign-in?error=Google+account+email+not+found`
      );
    }

    const email = profile.email.toLowerCase().trim();
    const name = profile.name || email.split("@")[0];

    // 3. Find or create user in Cloudflare D1
    let user = await queryFirst<{ id: string; name: string; email: string }>(
      "SELECT id, name, email FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (!user) {
      const newUserId = profile.id ? `google_${profile.id}` : crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await execute(
        "INSERT INTO users (id, name, email, password, createdAt) VALUES (?, ?, ?, ?, ?)",
        [newUserId, name, email, "oauth_google", createdAt]
      );

      user = { id: newUserId, name, email };
    }

    // 4. Set JWT session cookie
    await setSessionCookie(user);

    // 5. Redirect to dashboard
    return NextResponse.redirect(`${origin}/`);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(
      `${origin}/sign-in?error=An+unexpected+error+occurred+during+Google+sign-in`
    );
  }
}
