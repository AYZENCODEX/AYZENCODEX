import { Resend } from "resend";
import { logger } from "./logger";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "AYZEN <noreply@ayzen.tech>";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!resend) {
    logger.warn("RESEND_API_KEY not set — email not sent");
    return { success: false, error: "Email service not configured" };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) {
      logger.warn({ error }, "Resend error");
      return { success: false, error: error.message };
    }
    logger.info({ id: data?.id, to: opts.to }, "Email sent");
    return { success: true, id: data?.id };
  } catch (err: any) {
    logger.error({ err: err?.message }, "sendEmail failed");
    return { success: false, error: err?.message ?? "Unknown error" };
  }
}

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{margin:0;padding:0;background:#0a0d12;font-family:'Courier New',monospace;color:#e0f7f7;}
  .wrap{max-width:560px;margin:40px auto;background:#0d1117;border:1px solid #1a3a3a;border-radius:8px;overflow:hidden;}
  .header{padding:28px 32px;border-bottom:1px solid #1a3a3a;background:#070a0f;}
  .logo{font-size:22px;font-weight:bold;letter-spacing:4px;color:#00d4cc;}
  .sub{font-size:10px;letter-spacing:3px;color:#4a8080;margin-top:4px;text-transform:uppercase;}
  .body{padding:32px;}
  h2{color:#00d4cc;font-size:16px;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;}
  p{color:#a0c8c8;font-size:13px;line-height:1.7;margin:0 0 12px;}
  .code{background:#0a1a1a;border:1px solid #00d4cc40;border-radius:6px;padding:20px;text-align:center;margin:20px 0;}
  .code span{font-size:36px;letter-spacing:12px;color:#00d4cc;font-weight:bold;}
  .btn{display:inline-block;background:#00d4cc;color:#070a0f;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin:16px 0;}
  .footer{padding:20px 32px;border-top:1px solid #1a3a3a;font-size:10px;color:#2a5050;letter-spacing:1px;}
  .divider{height:1px;background:linear-gradient(to right,transparent,#00d4cc40,transparent);margin:24px 0;}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="logo">&gt;_ AYZEN</div>
    <div class="sub">Airdrop Command Center</div>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    &copy; 2026 AYZEN &mdash; Encrypted. Autonomous. Profitable.<br/>
    If you didn't request this, ignore this message.
  </div>
</div>
</body>
</html>`;
}

export async function sendWelcomeEmail(to: string, username: string): Promise<void> {
  const html = baseTemplate(`
    <h2>Access Granted, ${username}</h2>
    <p>Welcome to <strong>AYZEN</strong> — your encrypted airdrop command center.</p>
    <p>You now have access to:</p>
    <p>
      ✦ Real-time airdrop tracking across 20+ chains<br/>
      ✦ Task automation with ROI tracking<br/>
      ✦ Telegram bot integration (<a href="https://t.me/Airglowxbot" style="color:#00d4cc;">@Airglowxbot</a>)<br/>
      ✦ Leaderboard and referral rewards
    </p>
    <div class="divider"></div>
    <p style="font-size:11px;color:#4a8080;">Connect Telegram for live task notifications: go to Settings → Telegram Bot → /connect</p>
  `);
  await sendEmail({ to, subject: "Access Granted — Welcome to AYZEN", html });
}

export async function sendPasswordChangedEmail(to: string, username: string): Promise<void> {
  const html = baseTemplate(`
    <h2>Password Changed</h2>
    <p>Hi <strong>${username}</strong>, your AYZEN passphrase was successfully updated.</p>
    <p>If you did not make this change, contact support immediately at <a href="mailto:support@ayzen.tech" style="color:#00d4cc;">support@ayzen.tech</a>.</p>
    <div class="divider"></div>
    <p style="font-size:11px;color:#4a8080;">Security event logged at ${new Date().toUTCString()}</p>
  `);
  await sendEmail({ to, subject: "AYZEN — Passphrase Updated", html });
}

export async function sendTaskApprovedEmail(to: string, username: string, taskName: string, reward?: number | null): Promise<void> {
  const rewardStr = reward ? `<br/>💰 Reward: <strong style="color:#00d4cc;">$${reward}</strong>` : "";
  const html = baseTemplate(`
    <h2>Task Approved ✓</h2>
    <p>Hi <strong>${username}</strong>, your task submission has been verified!</p>
    <p>
      📋 Task: <strong>${taskName}</strong>${rewardStr}
    </p>
    <p>Your account has been credited. Keep executing tasks to climb the leaderboard.</p>
  `);
  await sendEmail({ to, subject: `AYZEN — Task Approved: ${taskName}`, html });
}

export async function sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
  const html = baseTemplate(`
    <h2>Test Transmission</h2>
    <p>This is a test email from your AYZEN platform.</p>
    <p>If you can read this, email delivery is working correctly.</p>
    <div class="divider"></div>
    <p style="font-size:11px;color:#4a8080;">Sent at ${new Date().toUTCString()}</p>
  `);
  return sendEmail({ to, subject: "AYZEN — Test Email ✓", html });
}
