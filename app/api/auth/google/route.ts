import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origin = new URL(request.url).origin;

  if (!clientId) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=Google+Sign-In+is+not+configured.+Please+add+GOOGLE_CLIENT_ID+in+.env`
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || origin}/api/auth/callback/google`;
  const scope = encodeURIComponent("openid email profile");

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scope}&access_type=offline&prompt=select_account`;

  return NextResponse.redirect(googleAuthUrl);
}
