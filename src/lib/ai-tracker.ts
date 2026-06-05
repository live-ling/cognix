import { supabase } from './supabase';

/**
 * Track an AI API call by logging usage data to Supabase.
 * This is fire-and-forget — failures are silently ignored.
 */
export async function trackAiUsage(
  action: string,
  responseData: any,
  fallbackModel: string,
): Promise<void> {
  try {
    const usage = responseData?.usage;
    if (!usage) return; // No usage data available

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('ai_usage_logs').insert({
      user_id: user.id,
      action,
      model: responseData?.model || fallbackModel || '',
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
    });
  } catch {
    // Silent fail — tracking should never break the main flow
  }
}
