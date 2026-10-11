export interface NotificationPayload {
  subject: string;
  lines: string[];
}

export async function sendNotification(env: Env, payload: NotificationPayload): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const to = env.NOTIFY_EMAIL;
  if (!apiKey || !to) {
    return;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'blog@resend.dev',
        to: [to],
        subject: payload.subject,
        text: payload.lines.join('\n')
      })
    });
    if (!response.ok) {
      console.error('[notify] Resend 返回异常状态', response.status);
    }
  } catch (error) {
    console.error('[notify] 邮件发送失败（业务继续）', error);
  }
}

interface WaitUntilContext {
  executionCtx: {
    waitUntil(promise: Promise<unknown>): void;
  };
}

export function notify(env: Env, c: WaitUntilContext, payload: NotificationPayload): void {
  try {
    c.executionCtx.waitUntil(sendNotification(env, payload));
  } catch {
    void sendNotification(env, payload);
  }
}
