// Edge Function: Gitee OAuth token exchange
// POST { code } → returns { access_token, refresh_token }

const GITEE_CLIENT_ID = Deno.env.get("GITEE_CLIENT_ID") || "";
const GITEE_CLIENT_SECRET = Deno.env.get("GITEE_CLIENT_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Simple random password for OAuth users — they'll never need to type it
function randomPassword(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { code, redirect_uri } = await req.json();
    if (!code) throw new Error("Missing code");

    // 1. Exchange code for Gitee access token
    const tokenResp = await fetch("https://gitee.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: GITEE_CLIENT_ID,
        client_secret: GITEE_CLIENT_SECRET,
        redirect_uri: redirect_uri || "",
      }),
    });
    if (!tokenResp.ok) throw new Error(`Gitee token error: ${await tokenResp.text()}`);
    const tokenData = await tokenResp.json();
    const giteeToken = tokenData.access_token;
    if (!giteeToken) throw new Error("No access token from Gitee");

    // 2. Get Gitee user info
    const userResp = await fetch("https://gitee.com/api/v5/user", {
      headers: { Authorization: `Bearer ${giteeToken}` },
    });
    if (!userResp.ok) throw new Error("Failed to get Gitee user");
    const giteeUser = await userResp.json();
    const giteeId = String(giteeUser.id);
    const email = giteeUser.email || `gitee_${giteeId}@oauth.cognix`;
    const name = giteeUser.name || giteeUser.login || "Gitee 用户";

    // 3. Find or create Supabase user
    const adminHeaders = {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    };

    // Look up by app_metadata.gitee_id
    const listResp = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(`identities IS NOT NULL`)}`,
      { headers: { ...adminHeaders, "Content-Type": undefined } as any }
    );

    let userId: string;
    const tempPass = randomPassword();

    // Try to find existing user by email
    const existingCheck = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(`email==eq.${email}`)}`,
      {
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
        } as any,
      }
    );
    const existing = await existingCheck.json();

    if (existing?.users?.length > 0) {
      userId = existing.users[0].id;
    } else {
      // Create new user
      const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          email,
          password: tempPass,
          email_confirm: true,
          user_metadata: { name, avatar_url: giteeUser.avatar_url || "" },
          app_metadata: { provider: "gitee", gitee_id: giteeId },
        }),
      });
      const newUser = await createResp.json();
      if (newUser.error) throw new Error(newUser.error_description || newUser.error || "Failed to create user");
      userId = newUser.id;
    }

    // 4. Reset password to a known temp password so we can sign in
    // For new users, password is already tempPass
    if (existing?.users?.length > 0) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify({
          password: tempPass,
          user_metadata: { name, avatar_url: giteeUser.avatar_url || "" },
          app_metadata: { provider: "gitee", gitee_id: giteeId },
        }),
      });
    }

    // 5. Sign in to get session tokens
    const signInResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SERVICE_ROLE_KEY },
      body: JSON.stringify({ email, password: tempPass, gotrue_meta_security: {} }),
    });
    const session = await signInResp.json();
    if (!session.access_token) throw new Error("Failed to create session");

    return new Response(JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }));
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 400 });
  }
});
