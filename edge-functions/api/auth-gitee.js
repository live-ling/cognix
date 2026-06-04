// EdgeOne Function: Gitee OAuth callback
// Handles: POST /api/auth-gitee { code } → { access_token, refresh_token }

function randomPassword() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + 'A1!';
}

export default async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
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

    // 3. Find or create Supabase user
    const existingCheck = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(`email=eq.${email}`)}`,
      { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } }
    );
    if (!existingCheck.ok) {
      const errText = await existingCheck.text();
      throw new Error(`Supabase list users failed: ${existingCheck.status} ${errText.slice(0, 200)}`);
    }
    const existing = await existingCheck.json();
    let userId;

    if (existing?.users?.length > 0) {
      userId = existing.users[0].id;
      const updateResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({
          user_metadata: { name, avatar_url: giteeUser.avatar_url || '' },
          app_metadata: { provider: 'gitee', gitee_id: giteeId },
        }),
      });
      if (!updateResp.ok) {
        const errText = await updateResp.text();
        throw new Error(`Update user failed: ${updateResp.status} ${errText.slice(0, 200)}`);
      }
    } else {
      const tempPass = randomPassword();
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
      const newUser = await createResp.json();
      if (newUser.error) throw new Error(newUser.error_description || newUser.error);
      userId = newUser.id;
    }

    // 4. Generate link to get session tokens
    //    New users: invite, Existing users: recovery
    const isNewUser = !existing?.users?.length;
    const linkType = isNewUser ? 'invite' : 'recovery';
    const linkResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ type: linkType, email }),
    });
    const linkData = await linkResp.json();
    if (!linkResp.ok) throw new Error(`generate_link failed: ${JSON.stringify(linkData)}`);

    const actionLink = linkData.action_link || '';
    const hashIdx = actionLink.indexOf('#');
    if (hashIdx === -1) throw new Error('No hash in action_link: ' + actionLink.slice(0, 100));

    const params = new URLSearchParams(actionLink.slice(hashIdx + 1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken) throw new Error('No access_token in link');

    return new Response(JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e).message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
