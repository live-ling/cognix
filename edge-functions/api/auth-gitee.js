// EdgeOne Function: Gitee OAuth callback
// Handles: POST /api/auth-gitee { code } → { access_token, refresh_token }

function randomPassword() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + 'A1!b2@';
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

    // 3. Try to create user (will fail if exists)
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
    const createData = await createResp.json();

    let userId;

    if (createData.error === 'email_exists' || createData.error_code === 'email_exists') {
      // User exists — find them and update metadata
      const listResp = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(`email=eq.${email}`)}`,
        { headers: adminHeaders }
      );
      const listData = await listResp.json();
      if (!listData.users?.length) throw new Error('User not found after email_exists');
      userId = listData.users[0].id;

      // Update user metadata with Gitee info
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({
          user_metadata: { name, avatar_url: giteeUser.avatar_url || '' },
          app_metadata: { provider: 'gitee', gitee_id: giteeId },
        }),
      });
    } else if (createData.error) {
      throw new Error(createData.error_description || createData.error);
    } else {
      userId = createData.id;
    }

    // 4. Generate invite link to get session tokens
    //    This works for both new and existing users
    const linkResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ type: 'invite', email }),
    });
    const linkData = await linkResp.json();

    // If invite fails (user exists), try magiclink
    if (!linkResp.ok || linkData.error) {
      const magicResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ type: 'magiclink', email }),
      });
      const magicData = await magicResp.json();
      if (!magicResp.ok) throw new Error(`generate_link failed: ${JSON.stringify(magicData)}`);

      const actionLink = magicData.action_link || '';
      const hashIdx = actionLink.indexOf('#');
      if (hashIdx === -1) throw new Error('No hash in magiclink: ' + actionLink.slice(0, 100));

      const params = new URLSearchParams(actionLink.slice(hashIdx + 1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken) throw new Error('No access_token in magiclink');

      return new Response(JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract tokens from invite link
    const actionLink = linkData.action_link || '';
    const hashIdx = actionLink.indexOf('#');
    if (hashIdx === -1) throw new Error('No hash in invite link: ' + actionLink.slice(0, 100));

    const params = new URLSearchParams(actionLink.slice(hashIdx + 1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken) throw new Error('No access_token in invite link');

    return new Response(JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e).message }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
}
