import TelegramBot from "node-telegram-bot-api";
import { db, usersTable, projectsTable, tasksTable, broadcastsTable } from "@workspace/db";
import { eq, desc, count, isNotNull } from "drizzle-orm";
import { logger } from "./logger";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

let bot: TelegramBot | null = null;

// Pending link sessions: telegramChatId → { code, expires }
const pendingLinks = new Map<string, { code: string; expires: number }>();

function genCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function md(text: string): string {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

export function getBot(): TelegramBot | null {
  return bot;
}

export async function sendToUser(chatId: string, text: string): Promise<void> {
  if (!bot) return;
  try {
    await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  } catch (err: any) {
    logger.warn({ err: err?.message, chatId }, "Telegram sendToUser failed");
  }
}

export async function broadcastToAll(text: string): Promise<number> {
  if (!bot) return 0;
  const users = await db
    .select({ telegramChatId: usersTable.telegramChatId })
    .from(usersTable)
    .where(isNotNull(usersTable.telegramChatId));
  let sent = 0;
  for (const u of users) {
    if (!u.telegramChatId) continue;
    try {
      await bot.sendMessage(u.telegramChatId, text, { parse_mode: "Markdown" });
      sent++;
    } catch {
      // user may have blocked bot — skip silently
    }
  }
  return sent;
}

async function isAdminChat(chatId: string): Promise<boolean> {
  const rows = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.telegramChatId, chatId))
    .limit(1);
  return rows[0]?.role === "admin";
}

async function getLinkedUser(chatId: string) {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramChatId, chatId))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleStart(msg: { chat: { id: number }; from?: { first_name?: string } }): Promise<void> {
  const chatId = String(msg.chat.id);
  const first = msg.from?.first_name ?? "Operator";
  const linked = await getLinkedUser(chatId);

  const greeting = linked
    ? `✅ *Welcome back, ${linked.username}!*\n\nYour AYZEN account is connected.`
    : `🚀 *Welcome to AYZEN, ${first}!*\n\n_Crypto Airdrop Command Center_\n\nLink your account to receive broadcasts and track airdrops in real-time.`;

  await bot!.sendMessage(chatId, greeting, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📊 Projects", callback_data: "projects" },
          { text: "🏆 Leaderboard", callback_data: "leaderboard" },
        ],
        [
          { text: "🔗 Link Account", callback_data: "link" },
          { text: "💡 Help", callback_data: "help" },
        ],
        [{ text: "📡 Platform Status", callback_data: "status" }],
      ],
    },
  });
}

async function handleHelp(chatId: string): Promise<void> {
  const text = [
    "*AYZEN Bot — Command Reference*",
    "",
    "📌 *General*",
    "/start — Main menu",
    "/help — This message",
    "/status — Platform health",
    "/ping — Quick alive check",
    "",
    "📊 *Airdrop Intel*",
    "/projects — Active airdrop projects",
    "/leaderboard — Top operators by ROI",
    "/tasks — Recent tasks",
    "",
    "👤 *Account*",
    "/connect — Link your AYZEN account",
    "/disconnect — Unlink account",
    "/me — Your stats",
    "",
    "🔐 *Admin Only*",
    "/broadcast <message> — Push to all users",
    "/stats — Platform statistics",
  ].join("\n");

  await bot!.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

async function handleStatus(chatId: string): Promise<void> {
  const [{ userCount }] = await db.select({ userCount: count() }).from(usersTable);
  const [{ projectCount }] = await db.select({ projectCount: count() }).from(projectsTable);
  const [{ taskCount }] = await db.select({ taskCount: count() }).from(tasksTable);
  const [{ connectedCount }] = await db
    .select({ connectedCount: count() })
    .from(usersTable)
    .where(isNotNull(usersTable.telegramChatId));

  const text = [
    "*⚡ AYZEN Platform Status*",
    "",
    "🟢 API: Online",
    `👥 Users: ${userCount}`,
    `📱 Telegram connected: ${connectedCount}`,
    `📂 Projects: ${projectCount}`,
    `✅ Tasks: ${taskCount}`,
    "",
    "_All systems operational_",
  ].join("\n");

  await bot!.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

async function handleProjects(chatId: string): Promise<void> {
  const projects = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      tier: projectsTable.tier,
      rewardEstimate: projectsTable.rewardEstimate,
      fundingAmount: projectsTable.fundingAmount,
    })
    .from(projectsTable)
    .limit(8);

  if (!projects.length) {
    await bot!.sendMessage(chatId, "No projects found at the moment. Check back soon!");
    return;
  }

  const lines = projects.map(
    (p, i) =>
      `${i + 1}. *${p.name}* [Tier ${p.tier}]\n   Reward: ~$${p.rewardEstimate} • Funding: $${p.fundingAmount}`
  );

  await bot!.sendMessage(
    chatId,
    `*📊 Active Airdrop Projects*\n\n${lines.join("\n\n")}`,
    { parse_mode: "Markdown" }
  );
}

async function handleLeaderboard(chatId: string): Promise<void> {
  const users = await db
    .select({
      username: usersTable.username,
      totalRoi: usersTable.totalRoi,
      streak: usersTable.streak,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.totalRoi))
    .limit(10);

  if (!users.length) {
    await bot!.sendMessage(chatId, "Leaderboard is empty. Be the first to earn ROI!");
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = users.map(
    (u, i) =>
      `${medals[i] ?? `${i + 1}.`} *${u.username}* — ${u.totalRoi.toFixed(1)}% ROI • 🔥 ${u.streak}d`
  );

  await bot!.sendMessage(
    chatId,
    `*🏆 AYZEN Leaderboard*\n\n${lines.join("\n")}`,
    { parse_mode: "Markdown" }
  );
}

async function handleTasks(chatId: string): Promise<void> {
  const tasks = await db
    .select({
      name: tasksTable.name,
      taskType: tasksTable.taskType,
      rewardAmount: tasksTable.rewardAmount,
      verificationType: tasksTable.verificationType,
    })
    .from(tasksTable)
    .orderBy(desc(tasksTable.createdAt))
    .limit(8);

  if (!tasks.length) {
    await bot!.sendMessage(chatId, "No tasks found.");
    return;
  }

  const lines = tasks.map(
    (t) => `• *${t.name}* [${t.taskType}] — $${t.rewardAmount ?? 0} reward`
  );

  await bot!.sendMessage(
    chatId,
    `*✅ Recent Tasks*\n\n${lines.join("\n")}`,
    { parse_mode: "Markdown" }
  );
}

async function handleMe(chatId: string): Promise<void> {
  const user = await getLinkedUser(chatId);
  if (!user) {
    await bot!.sendMessage(
      chatId,
      "❌ No linked account. Use /connect to link your AYZEN account."
    );
    return;
  }
  const text = [
    "*👤 Your AYZEN Profile*",
    "",
    `🔑 Username: ${user.username}`,
    `📧 Email: ${user.email}`,
    `💰 ROI: ${user.totalRoi.toFixed(1)}%`,
    `🔥 Streak: ${user.streak} days`,
    `🎭 Role: ${user.role}`,
    `📱 Telegram: @${user.telegramUsername ?? "linked"}`,
  ].join("\n");

  await bot!.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

async function handleStats(chatId: string): Promise<void> {
  if (!(await isAdminChat(chatId))) {
    await bot!.sendMessage(chatId, "⛔ This command is for admins only.");
    return;
  }
  const [{ userCount }] = await db.select({ userCount: count() }).from(usersTable);
  const [{ projectCount }] = await db.select({ projectCount: count() }).from(projectsTable);
  const [{ taskCount }] = await db.select({ taskCount: count() }).from(tasksTable);
  const [{ broadcastCount }] = await db.select({ broadcastCount: count() }).from(broadcastsTable);
  const [{ connectedCount }] = await db
    .select({ connectedCount: count() })
    .from(usersTable)
    .where(isNotNull(usersTable.telegramChatId));

  const text = [
    "*📈 Platform Statistics*",
    "",
    `👥 Total users: ${userCount}`,
    `📱 Telegram connected: ${connectedCount}`,
    `📂 Projects: ${projectCount}`,
    `✅ Tasks: ${taskCount}`,
    `📣 Broadcasts sent: ${broadcastCount}`,
  ].join("\n");

  await bot!.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

async function handleConnect(chatId: string): Promise<void> {
  const code = genCode();
  pendingLinks.set(chatId, { code, expires: Date.now() + 10 * 60 * 1000 });

  const text = [
    "*🔗 Link Your AYZEN Account*",
    "",
    `Your one-time code: \`${code}\``,
    "",
    "Enter this code in your AYZEN dashboard under *Settings → Telegram Connect*.",
    "",
    "_Expires in 10 minutes._",
  ].join("\n");

  await bot!.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

async function handleDisconnect(chatId: string): Promise<void> {
  const user = await getLinkedUser(chatId);
  if (!user) {
    await bot!.sendMessage(chatId, "No linked account found.");
    return;
  }
  await db
    .update(usersTable)
    .set({ telegramChatId: null, telegramUsername: null })
    .where(eq(usersTable.id, user.id));
  await bot!.sendMessage(chatId, "✅ Your AYZEN account has been disconnected.");
}

async function handleBroadcastCmd(chatId: string, fullText: string): Promise<void> {
  if (!(await isAdminChat(chatId))) {
    await bot!.sendMessage(chatId, "⛔ This command is for admins only.");
    return;
  }
  const message = fullText.replace(/^\/broadcast\s*/i, "").trim();
  if (!message) {
    await bot!.sendMessage(chatId, "Usage: /broadcast <your message here>");
    return;
  }
  const sent = await broadcastToAll(`📣 *AYZEN Broadcast*\n\n${message}`);
  await bot!.sendMessage(chatId, `✅ Broadcast delivered to ${sent} connected user(s).`);
}

// ─── Register all handlers ────────────────────────────────────────────────────

function registerHandlers(b: TelegramBot): void {
  b.onText(/^\/start/, (msg) => handleStart(msg));
  b.onText(/^\/help/, (msg) => handleHelp(String(msg.chat.id)));
  b.onText(/^\/status/, (msg) => handleStatus(String(msg.chat.id)));
  b.onText(/^\/projects/, (msg) => handleProjects(String(msg.chat.id)));
  b.onText(/^\/leaderboard/, (msg) => handleLeaderboard(String(msg.chat.id)));
  b.onText(/^\/tasks/, (msg) => handleTasks(String(msg.chat.id)));
  b.onText(/^\/me/, (msg) => handleMe(String(msg.chat.id)));
  b.onText(/^\/stats/, (msg) => handleStats(String(msg.chat.id)));
  b.onText(/^\/connect/, (msg) => handleConnect(String(msg.chat.id)));
  b.onText(/^\/disconnect/, (msg) => handleDisconnect(String(msg.chat.id)));
  b.onText(/^\/broadcast/, (msg) => handleBroadcastCmd(String(msg.chat.id), msg.text ?? ""));
  b.onText(/^\/ping/, (msg) => b.sendMessage(msg.chat.id, "🟢 AYZEN Bot is online!"));

  // Inline keyboard callbacks
  b.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id;
    if (!chatId) return;
    await b.answerCallbackQuery(query.id);
    const id = String(chatId);
    switch (query.data) {
      case "projects":    return handleProjects(id);
      case "leaderboard": return handleLeaderboard(id);
      case "link":        return handleConnect(id);
      case "help":        return handleHelp(id);
      case "status":      return handleStatus(id);
    }
  });

  // Fallback: non-command text
  b.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    await b.sendMessage(msg.chat.id, "Type /help to see all available commands.");
  });

  b.on("polling_error", (err: any) => {
    const msg: string = err?.message ?? "";
    // 404 = token invalid/revoked — stop polling immediately, no point retrying
    if (msg.includes("404")) {
      logger.error("Telegram bot token is invalid (404). Stop polling. Re-create the bot via @BotFather and update TELEGRAM_BOT_TOKEN.");
      b.stopPolling().catch(() => {});
      bot = null;
      return;
    }
    // 409 = another instance is polling — common in dev restarts
    if (msg.includes("409")) {
      logger.warn("Telegram 409: another polling session is already running. Will retry.");
      return;
    }
    logger.warn({ err: msg }, "Telegram polling error");
  });
}

// ─── Exported for route use ───────────────────────────────────────────────────

export async function verifyTelegramCode(
  chatId: string,
  code: string,
  userId: number
): Promise<boolean> {
  const pending = pendingLinks.get(chatId);
  if (!pending || pending.expires < Date.now() || pending.code !== code) return false;
  pendingLinks.delete(chatId);
  let tgUsername: string | null = null;
  try {
    const chat = await bot?.getChat(chatId);
    tgUsername = (chat as any)?.username ?? null;
  } catch { /* ignore */ }
  await db
    .update(usersTable)
    .set({ telegramChatId: chatId, telegramUsername: tgUsername })
    .where(eq(usersTable.id, userId));
  return true;
}

export function initTelegramBot(): void {
  if (!TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return;
  }
  try {
    bot = new TelegramBot(TOKEN, { polling: true });
    registerHandlers(bot);
    logger.info("Telegram bot started (polling mode)");

    // Send startup notification to all connected users
    broadcastToAll(
      "🚀 *AYZEN is online!*\n\nThe Airdrop Command Center is up and running.\nUse /status to check platform health."
    ).catch(() => {});
  } catch (err: any) {
    logger.error({ err: err?.message }, "Failed to start Telegram bot");
  }
}
