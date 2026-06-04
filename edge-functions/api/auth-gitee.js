// EdgeOne Function: Gitee OAuth callback
// Handles: POST /api/auth-gitee { code } → { access_token, refresh_token }

function randomPassword() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + 'A1!b2@';
}

async function findUserByEmail(supabaseUrl, serviceKey, email) {
  // List users page by page to find by email
  let page = 1;
  const perPage = 1000;
  while (true) {
    const resp = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const users = data.users || [];
    const found = users.find(u => u.email === email);
    if (found) return found;
    if (users.length < perPage) return null; // no more pages
    page++;
  }
}

export default async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await context.request.json();
    const { code, redirect_uri } = body;
    if (!code) throw new Error('Missing code');

    const GITEE_CLIENT_ID = body.client_id || context.env.VITE_GITEE_CLIENT_ID || '';
    const GITEE_CLIENT_SECRET = context.env.VITE_GITEE_CLIENT_SECRET || '';
    const SUPABASE_URL = context.env.VITE_SUPABASE_URL || 'https://bbiwowuwlrneivycdqkf.supabase.co';
    const SERVICE_ROLE_KEY = context.env.SUPABASE_SERVICE_ROLE_KEY || '';

    // 1. Exchange code for Gitee access token
    const tokenResp = await fetch('https://gitee.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams([
        ['grant_type', 'authorization_code'],
        ['code', code],
        ['client_id', GITEE_CLIENT_ID],
        ['client_secret', GITEE_CLIENT_SECRET],
        ['redirect_uri', redirect_uri || ''],
      ]).toString(),
    });
    if (!tokenResp.ok) throw new Error(`Gitee token error: ${await tokenResp.text()}`);
    const tokenData = await tokenResp.json();
    const giteeToken = tokenData.access_token;
    if (!giteeToken) throw new Error('No access token from Gitee');

    // 2. Get Gitee user info
    const userResp = await fetch('https://gitee.com/api/v5/user', {
      headers: { Authorization: `Bearer ${giteeToken}` },
    });
    if (!userResp.ok) throw new Error('Failed to get Gitee user');
    const giteeUser = await userResp.json();
    const giteeId = String(giteeUser.id);
    const email = giteeUser.email || `gitee_${giteeId}@oauth.cognix`;
    const name = giteeUser.name || giteeUser.login || 'Gitee 用户';

    const adminHeaders = {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    };

    // 3. Find existing user or create new one
    let existingUser = await findUserByEmail(SUPABASE_URL, SERVICE_ROLE_KEY, email);
    let userId;
    const tempPass = randomPassword();

    if (existingUser) {
      // User exists — update metadata and set password
      userId = existingUser.id;
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({
          password: tempPass,
          email_confirm: true,
          user_metadata: { name, avatar_url: giteeUser.avatar_url || '' },
          app_metadata: { provider: 'gitee', gitee_id: giteeId },
        }),
      });
    } else {
      // Create new user
      const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          email,
          password: tempPass,
          email_confirm: true,
          user_metadata: { name, avatar_url: giteeUser.avatar_url || '' },
          app_metadata: { provider: 'gitee', gitee_id: giteeId },
        }),
      });
      const createData = await createResp.json();
      if (createData.error) throw new Error(createData.error_description || createData.error);
      userId = createData.id;
    }

    // 4. Sign in to get session tokens (password was set in step 3)

    const signInResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY },
      body: JSON.stringify({ email, password: tempPass, gotrue_meta_security: {} }),
    });
    const session = await signInResp.json();
    if (!session.access_token) {
      throw new Error(`Sign in failed: ${JSON.stringify(session)}`);
    }

    return new Response(JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e).message }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
}
