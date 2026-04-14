// src/db.js
var SCHEMA = `
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    token TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    webhook_url TEXT,
    admin_chat_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS forward_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    source_channel TEXT NOT NULL,
    target_chats TEXT NOT NULL,
    delay_seconds INTEGER DEFAULT 5,
    skip_keywords TEXT DEFAULT '',
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS auto_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    reply_content TEXT NOT NULL,
    match_mode TEXT DEFAULT 'fuzzy',
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS group_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    welcome_message TEXT DEFAULT '',
    banned_words TEXT DEFAULT '',
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(bot_id, group_id)
);
CREATE TABLE IF NOT EXISTS message_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    chat_type TEXT,
    user_id TEXT,
    username TEXT,
    first_name TEXT,
    message_text TEXT,
    message_type TEXT DEFAULT 'text',
    raw_data TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS member_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT,
    first_name TEXT,
    event_type TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    task_type TEXT NOT NULL,
    target_chat TEXT NOT NULL,
    content TEXT NOT NULL,
    repeat_mode TEXT DEFAULT 'once',
    next_run_at TEXT NOT NULL,
    last_run_at TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS customer_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    original_user_id TEXT NOT NULL,
    original_chat_id TEXT NOT NULL,
    forwarded_message_id TEXT,
    admin_chat_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS forward_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    rule_id INTEGER NOT NULL,
    source_chat_id TEXT NOT NULL,
    source_message_id TEXT NOT NULL,
    target_chat TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_message_logs_bot ON message_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_chat ON message_logs(chat_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_created ON message_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_member_events_bot ON member_events(bot_id);
CREATE INDEX IF NOT EXISTS idx_forward_rules_bot ON forward_rules(bot_id);
CREATE INDEX IF NOT EXISTS idx_auto_replies_bot ON auto_replies(bot_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next ON scheduled_tasks(next_run_at);
CREATE INDEX IF NOT EXISTS idx_forward_queue_scheduled ON forward_queue(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_customer_messages_bot ON customer_messages(bot_id, forwarded_message_id);
`;
function generateRandomPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}
async function initDatabase(db) {
  const statements = SCHEMA.split(";").filter((s) => s.trim());
  for (const stmt of statements) {
    try {
      await db.prepare(stmt.trim()).run();
    } catch (e) {
    }
  }
  const existing = await db.prepare("SELECT value FROM system_config WHERE key = 'admin_password'").first();
  if (!existing) {
    const defaultPassword = generateRandomPassword();
    await db.prepare("INSERT INTO system_config (key, value) VALUES ('admin_password', ?)").bind(defaultPassword).run();
    console.log(`[INIT] Default admin password generated: ${defaultPassword}`);
  }
}
async function getConfig(db, key) {
  const row = await db.prepare("SELECT value FROM system_config WHERE key = ?").bind(key).first();
  return row ? row.value : null;
}
async function setConfig(db, key, value) {
  await db.prepare(
    "INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')"
  ).bind(key, value, value).run();
}

// src/auth.js
function generateSessionId() {
  return crypto.randomUUID() + "-" + Date.now().toString(36);
}
async function createSession(db) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString();
  await db.prepare("INSERT INTO sessions (session_id, expires_at) VALUES (?, ?)").bind(sessionId, expiresAt).run();
  return sessionId;
}
async function validateSession(db, sessionId) {
  if (!sessionId) return false;
  const session = await db.prepare(
    "SELECT * FROM sessions WHERE session_id = ? AND expires_at > datetime('now')"
  ).bind(sessionId).first();
  return !!session;
}
async function destroySession(db, sessionId) {
  if (!sessionId) return;
  await db.prepare("DELETE FROM sessions WHERE session_id = ?").bind(sessionId).run();
}
function getSessionFromCookie(request) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session_id=([^;]+)/);
  return match ? match[1] : null;
}
function setSessionCookie(sessionId) {
  return `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`;
}
function clearSessionCookie() {
  return "session_id=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";
}
async function verifyPassword(db, password) {
  const stored = await getConfig(db, "admin_password");
  return stored === password;
}
async function requireAuth(db, request) {
  const sessionId = getSessionFromCookie(request);
  return await validateSession(db, sessionId);
}

// src/telegram.js
var TG_API_BASE = "https://api.telegram.org/bot";
async function callTgApi(token, method, params = {}) {
  const url = `${TG_API_BASE}${token}/${method}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    const data = await response.json();
    if (!data.ok) {
      console.error(`[TG API Error] ${method}:`, data.description);
    }
    return data;
  } catch (error) {
    console.error(`[TG API Exception] ${method}:`, error.message);
    return { ok: false, description: error.message };
  }
}
async function sendMessage(token, chatId, text, extra = {}) {
  return callTgApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra
  });
}
async function forwardMessage(token, chatId, fromChatId, messageId) {
  return callTgApi(token, "forwardMessage", {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId
  });
}
async function copyMessage(token, chatId, fromChatId, messageId) {
  return callTgApi(token, "copyMessage", {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId
  });
}
async function deleteMessage(token, chatId, messageId) {
  return callTgApi(token, "deleteMessage", {
    chat_id: chatId,
    message_id: messageId
  });
}
async function setWebhook(token, url) {
  return callTgApi(token, "setWebhook", {
    url,
    allowed_updates: ["message", "channel_post", "chat_member", "my_chat_member"]
  });
}
async function deleteWebhook(token) {
  return callTgApi(token, "deleteWebhook", { drop_pending_updates: false });
}
async function getMe(token) {
  return callTgApi(token, "getMe");
}

// src/webhook.js
function getMessageText(message) {
  return message.text || message.caption || "";
}
function getMessageType(message) {
  if (message.text) return "text";
  if (message.photo) return "photo";
  if (message.video) return "video";
  if (message.document) return "document";
  if (message.audio) return "audio";
  if (message.voice) return "voice";
  if (message.sticker) return "sticker";
  if (message.animation) return "animation";
  if (message.poll) return "poll";
  if (message.location) return "location";
  if (message.contact) return "contact";
  return "other";
}
async function handleWebhook(db, botRecord, update) {
  const { bot_id, token, admin_chat_id } = botRecord;
  try {
    if (update.channel_post) {
      await handleChannelPost(db, bot_id, token, update.channel_post);
      return;
    }
    if (update.message) {
      const message = update.message;
      if (message.new_chat_members) {
        await handleNewMembers(db, bot_id, token, message);
        return;
      }
      if (message.left_chat_member) {
        await handleLeftMember(db, bot_id, token, message);
        return;
      }
      await logMessage(db, bot_id, message);
      if (admin_chat_id && message.reply_to_message && String(message.chat.id) === String(admin_chat_id)) {
        await handleAdminReply(db, bot_id, token, message);
        return;
      }
      if (message.chat.type === "group" || message.chat.type === "supergroup") {
        const blocked = await checkBannedWords(db, bot_id, token, message);
        if (blocked) return;
      }
      if (message.text && message.text.startsWith("/")) {
        await handleCommand(db, bot_id, token, message);
        return;
      }
      await handleAutoReply(db, bot_id, token, message);
      if (message.chat.type === "private" && admin_chat_id && String(message.from.id) !== String(admin_chat_id)) {
        await forwardToAdmin(db, bot_id, token, message, admin_chat_id);
      }
    }
  } catch (error) {
    console.error(`[Webhook Error] bot=${bot_id}:`, error.message);
  }
}
async function handleChannelPost(db, botId, token, post) {
  const chatId = String(post.chat.id);
  const messageText = getMessageText(post);
  await db.prepare(
    "INSERT INTO message_logs (bot_id, chat_id, chat_type, user_id, username, message_text, message_type, created_at) VALUES (?, ?, 'channel', '', ?, ?, ?, datetime('now'))"
  ).bind(botId, chatId, post.chat.title || "", messageText, getMessageType(post)).run();
  const rules = await db.prepare(
    "SELECT * FROM forward_rules WHERE bot_id = ? AND enabled = 1 AND source_channel = ?"
  ).bind(botId, chatId).all();
  if (!rules.results || rules.results.length === 0) return;
  for (const rule of rules.results) {
    if (rule.skip_keywords) {
      const keywords = rule.skip_keywords.split(",").map((k) => k.trim()).filter((k) => k);
      const shouldSkip = keywords.some((kw) => messageText.includes(kw));
      if (shouldSkip) {
        console.log(`[Forward] Skipped message due to keyword filter, rule=${rule.id}`);
        continue;
      }
    }
    const targets = rule.target_chats.split(",").map((t) => t.trim()).filter((t) => t);
    const delay = rule.delay_seconds || 0;
    const scheduledAt = new Date(Date.now() + delay * 1e3).toISOString();
    for (const target of targets) {
      await db.prepare(
        "INSERT INTO forward_queue (bot_id, rule_id, source_chat_id, source_message_id, target_chat, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"
      ).bind(botId, rule.id, chatId, String(post.message_id), target, scheduledAt).run();
    }
  }
}
async function handleNewMembers(db, botId, token, message) {
  const groupId = String(message.chat.id);
  for (const member of message.new_chat_members) {
    await db.prepare(
      "INSERT INTO member_events (bot_id, group_id, user_id, username, first_name, event_type, created_at) VALUES (?, ?, ?, ?, ?, 'join', datetime('now'))"
    ).bind(botId, groupId, String(member.id), member.username || "", member.first_name || "").run();
    const config = await db.prepare(
      "SELECT * FROM group_configs WHERE bot_id = ? AND group_id = ? AND enabled = 1"
    ).bind(botId, groupId).first();
    if (config && config.welcome_message) {
      const welcomeText = config.welcome_message.replace(/{name}/g, member.first_name || member.username || "\u65B0\u6210\u5458").replace(/{username}/g, member.username ? `@${member.username}` : "").replace(/{group}/g, message.chat.title || "");
      await sendMessage(token, groupId, welcomeText);
    }
  }
}
async function handleLeftMember(db, botId, token, message) {
  const groupId = String(message.chat.id);
  const member = message.left_chat_member;
  await db.prepare(
    "INSERT INTO member_events (bot_id, group_id, user_id, username, first_name, event_type, created_at) VALUES (?, ?, ?, ?, ?, 'leave', datetime('now'))"
  ).bind(botId, groupId, String(member.id), member.username || "", member.first_name || "").run();
}
async function logMessage(db, botId, message) {
  const chatId = String(message.chat.id);
  const chatType = message.chat.type;
  const userId = message.from ? String(message.from.id) : "";
  const username = message.from ? message.from.username || "" : "";
  const firstName = message.from ? message.from.first_name || "" : "";
  const messageText = getMessageText(message);
  const messageType = getMessageType(message);
  await db.prepare(
    "INSERT INTO message_logs (bot_id, chat_id, chat_type, user_id, username, first_name, message_text, message_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
  ).bind(botId, chatId, chatType, userId, username, firstName, messageText, messageType).run();
}
async function checkBannedWords(db, botId, token, message) {
  const groupId = String(message.chat.id);
  const text = getMessageText(message).toLowerCase();
  if (!text) return false;
  const config = await db.prepare(
    "SELECT * FROM group_configs WHERE bot_id = ? AND group_id = ? AND enabled = 1"
  ).bind(botId, groupId).first();
  if (!config || !config.banned_words) return false;
  const bannedWords = config.banned_words.split(",").map((w) => w.trim().toLowerCase()).filter((w) => w);
  const hit = bannedWords.find((w) => text.includes(w));
  if (hit) {
    await deleteMessage(token, groupId, message.message_id);
    const userName = message.from.first_name || message.from.username || "\u7528\u6237";
    await sendMessage(token, groupId, `\u26A0\uFE0F <b>${userName}</b> \u7684\u6D88\u606F\u5305\u542B\u8FDD\u7981\u5185\u5BB9\uFF0C\u5DF2\u81EA\u52A8\u62E6\u622A\u3002`);
    return true;
  }
  return false;
}
async function handleCommand(db, botId, token, message) {
  const text = message.text.trim();
  const chatId = String(message.chat.id);
  const parts = text.split(/\s+/);
  const command = parts[0].split("@")[0].toLowerCase();
  switch (command) {
    case "/start":
      await sendMessage(token, chatId, "\u{1F44B} \u6B22\u8FCE\u4F7F\u7528\u672C\u673A\u5668\u4EBA\uFF01\n\n\u53D1\u9001\u4EFB\u610F\u6D88\u606F\u5373\u53EF\u4E0E\u7BA1\u7406\u5458\u6C9F\u901A\u3002");
      break;
    case "/help":
      await sendMessage(
        token,
        chatId,
        "\u{1F4D6} <b>\u53EF\u7528\u6307\u4EE4</b>\n\n/start - \u5F00\u59CB\u4F7F\u7528\n/help - \u5E2E\u52A9\u4FE1\u606F\n/remind [\u5206\u949F] [\u5185\u5BB9] - \u8BBE\u7F6E\u63D0\u9192\n/id - \u83B7\u53D6\u5F53\u524D\u4F1A\u8BDDID"
      );
      break;
    case "/id":
      const userId = message.from ? message.from.id : "N/A";
      await sendMessage(
        token,
        chatId,
        `\u{1F4CB} <b>\u4F1A\u8BDD\u4FE1\u606F</b>

\u4F1A\u8BDDID: <code>${chatId}</code>
\u7528\u6237ID: <code>${userId}</code>
\u7C7B\u578B: ${message.chat.type}`
      );
      break;
    case "/remind":
      await handleRemindCommand(db, botId, token, message, parts);
      break;
    default:
      break;
  }
}
async function handleRemindCommand(db, botId, token, message, parts) {
  const chatId = String(message.chat.id);
  if (parts.length < 3) {
    await sendMessage(token, chatId, "\u26A0\uFE0F \u7528\u6CD5: /remind [\u5206\u949F\u6570] [\u63D0\u9192\u5185\u5BB9]\n\u4F8B\u5982: /remind 30 \u5F00\u4F1A");
    return;
  }
  const minutes = parseInt(parts[1]);
  if (isNaN(minutes) || minutes < 1 || minutes > 10080) {
    await sendMessage(token, chatId, "\u26A0\uFE0F \u5206\u949F\u6570\u5FC5\u987B\u5728 1-10080 \u4E4B\u95F4");
    return;
  }
  const content = parts.slice(2).join(" ");
  const nextRunAt = new Date(Date.now() + minutes * 60 * 1e3).toISOString();
  await db.prepare(
    "INSERT INTO scheduled_tasks (bot_id, task_type, target_chat, content, repeat_mode, next_run_at, enabled) VALUES (?, 'remind', ?, ?, 'once', ?, 1)"
  ).bind(botId, chatId, content, nextRunAt).run();
  await sendMessage(token, chatId, `\u2705 \u63D0\u9192\u5DF2\u8BBE\u7F6E\uFF01\u5C06\u5728 ${minutes} \u5206\u949F\u540E\u63D0\u9192\u4F60\uFF1A
${content}`);
}
async function handleAutoReply(db, botId, token, message) {
  const text = getMessageText(message);
  if (!text) return;
  const chatId = String(message.chat.id);
  const rules = await db.prepare(
    "SELECT * FROM auto_replies WHERE bot_id = ? AND enabled = 1"
  ).bind(botId).all();
  if (!rules.results || rules.results.length === 0) return;
  for (const rule of rules.results) {
    let matched = false;
    if (rule.match_mode === "exact") {
      matched = text.trim() === rule.keyword.trim();
    } else {
      matched = text.toLowerCase().includes(rule.keyword.toLowerCase());
    }
    if (matched) {
      await sendMessage(token, chatId, rule.reply_content, {
        reply_to_message_id: message.message_id
      });
      break;
    }
  }
}
async function forwardToAdmin(db, botId, token, message, adminChatId) {
  const result = await forwardMessage(token, adminChatId, message.chat.id, message.message_id);
  if (result.ok) {
    await db.prepare(
      "INSERT INTO customer_messages (bot_id, original_user_id, original_chat_id, forwarded_message_id, admin_chat_id) VALUES (?, ?, ?, ?, ?)"
    ).bind(botId, String(message.from.id), String(message.chat.id), String(result.result.message_id), adminChatId).run();
  }
}
async function handleAdminReply(db, botId, token, message) {
  const replyTo = message.reply_to_message;
  if (!replyTo) return;
  const mapping = await db.prepare(
    "SELECT * FROM customer_messages WHERE bot_id = ? AND forwarded_message_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(botId, String(replyTo.message_id)).first();
  if (mapping) {
    await sendMessage(token, mapping.original_user_id, message.text || "");
  }
}

// src/api.js
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
function csvResponse(data, filename) {
  return new Response(data, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
async function handleApi(db, request, url) {
  const path = url.pathname;
  const method = request.method;
  try {
    if (path === "/api/config/password" && method === "PUT") {
      const body = await request.json();
      const currentPassword = await getConfig(db, "admin_password");
      if (body.old_password !== currentPassword) {
        return jsonResponse({ error: "\u5F53\u524D\u5BC6\u7801\u9519\u8BEF" }, 400);
      }
      if (!body.new_password || body.new_password.length < 6) {
        return jsonResponse({ error: "\u65B0\u5BC6\u7801\u957F\u5EA6\u4E0D\u80FD\u5C11\u4E8E6\u4F4D" }, 400);
      }
      await setConfig(db, "admin_password", body.new_password);
      return jsonResponse({ success: true, message: "\u5BC6\u7801\u4FEE\u6539\u6210\u529F" });
    }
    if (path === "/api/config/default-password" && method === "GET") {
      const password = await getConfig(db, "admin_password");
      return jsonResponse({ password });
    }
    if (path === "/api/bots" && method === "GET") {
      const bots = await db.prepare("SELECT id, bot_id, name, token, status, webhook_url, admin_chat_id, created_at FROM bots ORDER BY created_at DESC").all();
      return jsonResponse({ bots: bots.results || [] });
    }
    if (path === "/api/bots" && method === "POST") {
      const body = await request.json();
      if (!body.name || !body.token) {
        return jsonResponse({ error: "\u540D\u79F0\u548CToken\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
      }
      const meResult = await getMe(body.token);
      if (!meResult.ok) {
        return jsonResponse({ error: "Bot Token \u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u540E\u91CD\u8BD5" }, 400);
      }
      const botId = String(meResult.result.id);
      const existing = await db.prepare("SELECT * FROM bots WHERE bot_id = ?").bind(botId).first();
      if (existing) {
        return jsonResponse({ error: "\u8BE5\u673A\u5668\u4EBA\u5DF2\u5B58\u5728" }, 400);
      }
      await db.prepare(
        "INSERT INTO bots (bot_id, name, token, admin_chat_id) VALUES (?, ?, ?, ?)"
      ).bind(botId, body.name, body.token, body.admin_chat_id || "").run();
      const workerUrl = url.origin;
      const webhookUrl = `${workerUrl}/webhook/${botId}`;
      const whResult = await setWebhook(body.token, webhookUrl);
      if (whResult.ok) {
        await db.prepare("UPDATE bots SET webhook_url = ? WHERE bot_id = ?").bind(webhookUrl, botId).run();
      }
      return jsonResponse({
        success: true,
        bot_id: botId,
        bot_username: meResult.result.username,
        webhook_url: webhookUrl,
        webhook_set: whResult.ok
      });
    }
    const botMatch = path.match(/^\/api\/bots\/([^/]+)$/);
    if (botMatch) {
      const botId = botMatch[1];
      if (method === "GET") {
        const bot = await db.prepare("SELECT * FROM bots WHERE bot_id = ?").bind(botId).first();
        if (!bot) return jsonResponse({ error: "\u673A\u5668\u4EBA\u4E0D\u5B58\u5728" }, 404);
        return jsonResponse({ bot });
      }
      if (method === "PUT") {
        const body = await request.json();
        const updates = [];
        const params = [];
        if (body.name !== void 0) {
          updates.push("name = ?");
          params.push(body.name);
        }
        if (body.admin_chat_id !== void 0) {
          updates.push("admin_chat_id = ?");
          params.push(body.admin_chat_id);
        }
        if (body.status !== void 0) {
          updates.push("status = ?");
          params.push(body.status);
        }
        if (updates.length > 0) {
          updates.push("updated_at = datetime('now')");
          params.push(botId);
          await db.prepare(`UPDATE bots SET ${updates.join(", ")} WHERE bot_id = ?`).bind(...params).run();
        }
        return jsonResponse({ success: true });
      }
      if (method === "DELETE") {
        const bot = await db.prepare("SELECT * FROM bots WHERE bot_id = ?").bind(botId).first();
        if (bot) {
          await deleteWebhook(bot.token);
          await db.prepare("DELETE FROM forward_rules WHERE bot_id = ?").bind(botId).run();
          await db.prepare("DELETE FROM auto_replies WHERE bot_id = ?").bind(botId).run();
          await db.prepare("DELETE FROM group_configs WHERE bot_id = ?").bind(botId).run();
          await db.prepare("DELETE FROM message_logs WHERE bot_id = ?").bind(botId).run();
          await db.prepare("DELETE FROM member_events WHERE bot_id = ?").bind(botId).run();
          await db.prepare("DELETE FROM scheduled_tasks WHERE bot_id = ?").bind(botId).run();
          await db.prepare("DELETE FROM customer_messages WHERE bot_id = ?").bind(botId).run();
          await db.prepare("DELETE FROM forward_queue WHERE bot_id = ?").bind(botId).run();
          await db.prepare("DELETE FROM bots WHERE bot_id = ?").bind(botId).run();
        }
        return jsonResponse({ success: true });
      }
    }
    const forwardRulesMatch = path.match(/^\/api\/bots\/([^/]+)\/forward-rules$/);
    if (forwardRulesMatch) {
      const botId = forwardRulesMatch[1];
      if (method === "GET") {
        const rules = await db.prepare("SELECT * FROM forward_rules WHERE bot_id = ? ORDER BY created_at DESC").bind(botId).all();
        return jsonResponse({ rules: rules.results || [] });
      }
      if (method === "POST") {
        const body = await request.json();
        if (!body.source_channel || !body.target_chats) {
          return jsonResponse({ error: "\u6E90\u9891\u9053\u548C\u76EE\u6807\u7FA4\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
        }
        await db.prepare(
          "INSERT INTO forward_rules (bot_id, source_channel, target_chats, delay_seconds, skip_keywords, enabled) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(botId, body.source_channel, body.target_chats, body.delay_seconds || 5, body.skip_keywords || "", body.enabled !== void 0 ? body.enabled : 1).run();
        return jsonResponse({ success: true });
      }
    }
    const forwardRuleMatch = path.match(/^\/api\/forward-rules\/(\d+)$/);
    if (forwardRuleMatch) {
      const ruleId = parseInt(forwardRuleMatch[1]);
      if (method === "PUT") {
        const body = await request.json();
        const updates = [];
        const params = [];
        if (body.source_channel !== void 0) {
          updates.push("source_channel = ?");
          params.push(body.source_channel);
        }
        if (body.target_chats !== void 0) {
          updates.push("target_chats = ?");
          params.push(body.target_chats);
        }
        if (body.delay_seconds !== void 0) {
          updates.push("delay_seconds = ?");
          params.push(body.delay_seconds);
        }
        if (body.skip_keywords !== void 0) {
          updates.push("skip_keywords = ?");
          params.push(body.skip_keywords);
        }
        if (body.enabled !== void 0) {
          updates.push("enabled = ?");
          params.push(body.enabled);
        }
        if (updates.length > 0) {
          updates.push("updated_at = datetime('now')");
          params.push(ruleId);
          await db.prepare(`UPDATE forward_rules SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
        }
        return jsonResponse({ success: true });
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM forward_rules WHERE id = ?").bind(ruleId).run();
        return jsonResponse({ success: true });
      }
    }
    const autoRepliesMatch = path.match(/^\/api\/bots\/([^/]+)\/auto-replies$/);
    if (autoRepliesMatch) {
      const botId = autoRepliesMatch[1];
      if (method === "GET") {
        const replies = await db.prepare("SELECT * FROM auto_replies WHERE bot_id = ? ORDER BY created_at DESC").bind(botId).all();
        return jsonResponse({ replies: replies.results || [] });
      }
      if (method === "POST") {
        const body = await request.json();
        if (!body.keyword || !body.reply_content) {
          return jsonResponse({ error: "\u5173\u952E\u8BCD\u548C\u56DE\u590D\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
        }
        await db.prepare(
          "INSERT INTO auto_replies (bot_id, keyword, reply_content, match_mode, enabled) VALUES (?, ?, ?, ?, ?)"
        ).bind(botId, body.keyword, body.reply_content, body.match_mode || "fuzzy", body.enabled !== void 0 ? body.enabled : 1).run();
        return jsonResponse({ success: true });
      }
    }
    const autoReplyMatch = path.match(/^\/api\/auto-replies\/(\d+)$/);
    if (autoReplyMatch) {
      const replyId = parseInt(autoReplyMatch[1]);
      if (method === "PUT") {
        const body = await request.json();
        const updates = [];
        const params = [];
        if (body.keyword !== void 0) {
          updates.push("keyword = ?");
          params.push(body.keyword);
        }
        if (body.reply_content !== void 0) {
          updates.push("reply_content = ?");
          params.push(body.reply_content);
        }
        if (body.match_mode !== void 0) {
          updates.push("match_mode = ?");
          params.push(body.match_mode);
        }
        if (body.enabled !== void 0) {
          updates.push("enabled = ?");
          params.push(body.enabled);
        }
        if (updates.length > 0) {
          params.push(replyId);
          await db.prepare(`UPDATE auto_replies SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
        }
        return jsonResponse({ success: true });
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM auto_replies WHERE id = ?").bind(replyId).run();
        return jsonResponse({ success: true });
      }
    }
    const groupConfigsMatch = path.match(/^\/api\/bots\/([^/]+)\/group-configs$/);
    if (groupConfigsMatch) {
      const botId = groupConfigsMatch[1];
      if (method === "GET") {
        const configs = await db.prepare("SELECT * FROM group_configs WHERE bot_id = ? ORDER BY created_at DESC").bind(botId).all();
        return jsonResponse({ configs: configs.results || [] });
      }
      if (method === "POST") {
        const body = await request.json();
        if (!body.group_id) {
          return jsonResponse({ error: "\u7FA4ID\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
        }
        await db.prepare(
          "INSERT INTO group_configs (bot_id, group_id, welcome_message, banned_words, enabled) VALUES (?, ?, ?, ?, ?) ON CONFLICT(bot_id, group_id) DO UPDATE SET welcome_message = ?, banned_words = ?, enabled = ?, updated_at = datetime('now')"
        ).bind(
          botId,
          body.group_id,
          body.welcome_message || "",
          body.banned_words || "",
          body.enabled !== void 0 ? body.enabled : 1,
          body.welcome_message || "",
          body.banned_words || "",
          body.enabled !== void 0 ? body.enabled : 1
        ).run();
        return jsonResponse({ success: true });
      }
    }
    const groupConfigMatch = path.match(/^\/api\/group-configs\/(\d+)$/);
    if (groupConfigMatch) {
      const configId = parseInt(groupConfigMatch[1]);
      if (method === "PUT") {
        const body = await request.json();
        const updates = [];
        const params = [];
        if (body.welcome_message !== void 0) {
          updates.push("welcome_message = ?");
          params.push(body.welcome_message);
        }
        if (body.banned_words !== void 0) {
          updates.push("banned_words = ?");
          params.push(body.banned_words);
        }
        if (body.enabled !== void 0) {
          updates.push("enabled = ?");
          params.push(body.enabled);
        }
        if (updates.length > 0) {
          updates.push("updated_at = datetime('now')");
          params.push(configId);
          await db.prepare(`UPDATE group_configs SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
        }
        return jsonResponse({ success: true });
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM group_configs WHERE id = ?").bind(configId).run();
        return jsonResponse({ success: true });
      }
    }
    const tasksMatch = path.match(/^\/api\/bots\/([^/]+)\/tasks$/);
    if (tasksMatch) {
      const botId = tasksMatch[1];
      if (method === "GET") {
        const tasks = await db.prepare("SELECT * FROM scheduled_tasks WHERE bot_id = ? ORDER BY created_at DESC").bind(botId).all();
        return jsonResponse({ tasks: tasks.results || [] });
      }
      if (method === "POST") {
        const body = await request.json();
        if (!body.target_chat || !body.content) {
          return jsonResponse({ error: "\u76EE\u6807\u548C\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
        }
        if (!body.next_run_at) {
          return jsonResponse({ error: "\u6267\u884C\u65F6\u95F4\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
        }
        await db.prepare(
          "INSERT INTO scheduled_tasks (bot_id, task_type, target_chat, content, repeat_mode, next_run_at, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(botId, body.task_type || "send", body.target_chat, body.content, body.repeat_mode || "once", body.next_run_at, body.enabled !== void 0 ? body.enabled : 1).run();
        return jsonResponse({ success: true });
      }
    }
    const taskMatch = path.match(/^\/api\/tasks\/(\d+)$/);
    if (taskMatch) {
      const taskId = parseInt(taskMatch[1]);
      if (method === "PUT") {
        const body = await request.json();
        const updates = [];
        const params = [];
        if (body.target_chat !== void 0) {
          updates.push("target_chat = ?");
          params.push(body.target_chat);
        }
        if (body.content !== void 0) {
          updates.push("content = ?");
          params.push(body.content);
        }
        if (body.repeat_mode !== void 0) {
          updates.push("repeat_mode = ?");
          params.push(body.repeat_mode);
        }
        if (body.next_run_at !== void 0) {
          updates.push("next_run_at = ?");
          params.push(body.next_run_at);
        }
        if (body.enabled !== void 0) {
          updates.push("enabled = ?");
          params.push(body.enabled);
        }
        if (updates.length > 0) {
          params.push(taskId);
          await db.prepare(`UPDATE scheduled_tasks SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
        }
        return jsonResponse({ success: true });
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM scheduled_tasks WHERE id = ?").bind(taskId).run();
        return jsonResponse({ success: true });
      }
    }
    const logsMatch = path.match(/^\/api\/bots\/([^/]+)\/logs$/);
    if (logsMatch) {
      const botId = logsMatch[1];
      const params = url.searchParams;
      const page = parseInt(params.get("page") || "1");
      const limit = Math.min(parseInt(params.get("limit") || "50"), 200);
      const offset = (page - 1) * limit;
      const countResult = await db.prepare("SELECT COUNT(*) as total FROM message_logs WHERE bot_id = ?").bind(botId).first();
      const logs = await db.prepare(
        "SELECT * FROM message_logs WHERE bot_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      ).bind(botId, limit, offset).all();
      return jsonResponse({
        logs: logs.results || [],
        total: countResult.total,
        page,
        limit
      });
    }
    const logsCsvMatch = path.match(/^\/api\/bots\/([^/]+)\/logs\/export$/);
    if (logsCsvMatch) {
      const botId = logsCsvMatch[1];
      const logs = await db.prepare(
        "SELECT * FROM message_logs WHERE bot_id = ? ORDER BY created_at DESC"
      ).bind(botId).all();
      let csv = "\uFEFFID,\u673A\u5668\u4EBAID,\u4F1A\u8BDDID,\u4F1A\u8BDD\u7C7B\u578B,\u7528\u6237ID,\u7528\u6237\u540D,\u59D3\u540D,\u6D88\u606F\u5185\u5BB9,\u6D88\u606F\u7C7B\u578B,\u65F6\u95F4\n";
      for (const log of logs.results || []) {
        csv += `${log.id},"${log.bot_id}","${log.chat_id}","${log.chat_type || ""}","${log.user_id || ""}","${log.username || ""}","${log.first_name || ""}","${(log.message_text || "").replace(/"/g, '""')}","${log.message_type}","${log.created_at}"
`;
      }
      return csvResponse(csv, `messages_${botId}_${Date.now()}.csv`);
    }
    const eventsMatch = path.match(/^\/api\/bots\/([^/]+)\/events$/);
    if (eventsMatch) {
      const botId = eventsMatch[1];
      const params = url.searchParams;
      const page = parseInt(params.get("page") || "1");
      const limit = Math.min(parseInt(params.get("limit") || "50"), 200);
      const offset = (page - 1) * limit;
      const countResult = await db.prepare("SELECT COUNT(*) as total FROM member_events WHERE bot_id = ?").bind(botId).first();
      const events = await db.prepare(
        "SELECT * FROM member_events WHERE bot_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      ).bind(botId, limit, offset).all();
      return jsonResponse({
        events: events.results || [],
        total: countResult.total,
        page,
        limit
      });
    }
    const eventsCsvMatch = path.match(/^\/api\/bots\/([^/]+)\/events\/export$/);
    if (eventsCsvMatch) {
      const botId = eventsCsvMatch[1];
      const events = await db.prepare(
        "SELECT * FROM member_events WHERE bot_id = ? ORDER BY created_at DESC"
      ).bind(botId).all();
      let csv = "\uFEFFID,\u673A\u5668\u4EBAID,\u7FA4ID,\u7528\u6237ID,\u7528\u6237\u540D,\u59D3\u540D,\u4E8B\u4EF6\u7C7B\u578B,\u65F6\u95F4\n";
      for (const evt of events.results || []) {
        csv += `${evt.id},"${evt.bot_id}","${evt.group_id}","${evt.user_id}","${evt.username || ""}","${evt.first_name || ""}","${evt.event_type}","${evt.created_at}"
`;
      }
      return csvResponse(csv, `events_${botId}_${Date.now()}.csv`);
    }
    const clearLogsMatch = path.match(/^\/api\/bots\/([^/]+)\/logs\/clear$/);
    if (clearLogsMatch && method === "DELETE") {
      const botId = clearLogsMatch[1];
      await db.prepare("DELETE FROM message_logs WHERE bot_id = ?").bind(botId).run();
      return jsonResponse({ success: true });
    }
    const clearEventsMatch = path.match(/^\/api\/bots\/([^/]+)\/events\/clear$/);
    if (clearEventsMatch && method === "DELETE") {
      const botId = clearEventsMatch[1];
      await db.prepare("DELETE FROM member_events WHERE bot_id = ?").bind(botId).run();
      return jsonResponse({ success: true });
    }
    const statsMatch = path.match(/^\/api\/bots\/([^/]+)\/stats$/);
    if (statsMatch) {
      const botId = statsMatch[1];
      const msgCount = await db.prepare("SELECT COUNT(*) as c FROM message_logs WHERE bot_id = ?").bind(botId).first();
      const joinCount = await db.prepare("SELECT COUNT(*) as c FROM member_events WHERE bot_id = ? AND event_type = 'join'").bind(botId).first();
      const leaveCount = await db.prepare("SELECT COUNT(*) as c FROM member_events WHERE bot_id = ? AND event_type = 'leave'").bind(botId).first();
      const ruleCount = await db.prepare("SELECT COUNT(*) as c FROM forward_rules WHERE bot_id = ?").bind(botId).first();
      const replyCount = await db.prepare("SELECT COUNT(*) as c FROM auto_replies WHERE bot_id = ?").bind(botId).first();
      const taskCount = await db.prepare("SELECT COUNT(*) as c FROM scheduled_tasks WHERE bot_id = ? AND enabled = 1").bind(botId).first();
      return jsonResponse({
        messages: msgCount.c,
        joins: joinCount.c,
        leaves: leaveCount.c,
        forward_rules: ruleCount.c,
        auto_replies: replyCount.c,
        active_tasks: taskCount.c
      });
    }
    if (path === "/api/stats" && method === "GET") {
      const botCount = await db.prepare("SELECT COUNT(*) as c FROM bots").first();
      const msgCount = await db.prepare("SELECT COUNT(*) as c FROM message_logs").first();
      const taskCount = await db.prepare("SELECT COUNT(*) as c FROM scheduled_tasks WHERE enabled = 1").first();
      return jsonResponse({
        bots: botCount.c,
        messages: msgCount.c,
        active_tasks: taskCount.c
      });
    }
    return jsonResponse({ error: "API \u63A5\u53E3\u4E0D\u5B58\u5728" }, 404);
  } catch (error) {
    console.error("[API Error]", error.message);
    return jsonResponse({ error: "\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF: " + error.message }, 500);
  }
}

// src/cron.js
async function handleCron(db) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    await processForwardQueue(db, now);
    await processScheduledTasks(db, now);
    await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now).run();
  } catch (error) {
    console.error("[Cron Error]", error.message);
  }
}
async function processForwardQueue(db, now) {
  const pending = await db.prepare(
    "SELECT fq.*, b.token FROM forward_queue fq JOIN bots b ON fq.bot_id = b.bot_id WHERE fq.status = 'pending' AND fq.scheduled_at <= ? LIMIT 20"
  ).bind(now).all();
  if (!pending.results || pending.results.length === 0) return;
  for (const item of pending.results) {
    try {
      const result = await copyMessage(item.token, item.target_chat, item.source_chat_id, item.source_message_id);
      if (result.ok) {
        await db.prepare("UPDATE forward_queue SET status = 'sent' WHERE id = ?").bind(item.id).run();
      } else {
        await db.prepare("UPDATE forward_queue SET status = 'failed' WHERE id = ?").bind(item.id).run();
        console.error(`[Forward Queue] Failed to forward message ${item.id}:`, result.description);
      }
    } catch (error) {
      await db.prepare("UPDATE forward_queue SET status = 'failed' WHERE id = ?").bind(item.id).run();
      console.error(`[Forward Queue] Error processing ${item.id}:`, error.message);
    }
  }
  const cleanDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString();
  await db.prepare("DELETE FROM forward_queue WHERE status IN ('sent', 'failed') AND created_at < ?").bind(cleanDate).run();
}
async function processScheduledTasks(db, now) {
  const tasks = await db.prepare(
    "SELECT st.*, b.token FROM scheduled_tasks st JOIN bots b ON st.bot_id = b.bot_id WHERE st.enabled = 1 AND st.next_run_at <= ? LIMIT 20"
  ).bind(now).all();
  if (!tasks.results || tasks.results.length === 0) return;
  for (const task of tasks.results) {
    try {
      if (task.task_type === "send" || task.task_type === "remind") {
        let content = task.content;
        if (task.task_type === "remind") {
          content = `\u23F0 <b>\u63D0\u9192</b>

${task.content}`;
        }
        await sendMessage(task.token, task.target_chat, content);
      }
      const lastRunAt = now;
      if (task.repeat_mode === "once") {
        await db.prepare(
          "UPDATE scheduled_tasks SET enabled = 0, last_run_at = ? WHERE id = ?"
        ).bind(lastRunAt, task.id).run();
      } else if (task.repeat_mode === "hourly") {
        const nextRun = new Date(new Date(task.next_run_at).getTime() + 60 * 60 * 1e3).toISOString();
        await db.prepare(
          "UPDATE scheduled_tasks SET next_run_at = ?, last_run_at = ? WHERE id = ?"
        ).bind(nextRun, lastRunAt, task.id).run();
      } else if (task.repeat_mode === "daily") {
        const nextRun = new Date(new Date(task.next_run_at).getTime() + 24 * 60 * 60 * 1e3).toISOString();
        await db.prepare(
          "UPDATE scheduled_tasks SET next_run_at = ?, last_run_at = ? WHERE id = ?"
        ).bind(nextRun, lastRunAt, task.id).run();
      }
    } catch (error) {
      console.error(`[Scheduled Task] Error processing task ${task.id}:`, error.message);
    }
  }
}

// src/pages/login.js
function loginPage(error = "") {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TG Bot \u7BA1\u7406\u7CFB\u7EDF - \u767B\u5F55</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);min-height:100vh;display:flex;align-items:center;justify-content:center}
.login-card{background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:48px 40px;width:100%;max-width:420px;box-shadow:0 25px 50px rgba(0,0,0,0.3)}
.logo{text-align:center;margin-bottom:32px}
.logo h1{color:#fff;font-size:28px;font-weight:700;letter-spacing:1px}
.logo p{color:rgba(255,255,255,0.5);font-size:14px;margin-top:8px}
.form-group{margin-bottom:24px}
.form-group label{display:block;color:rgba(255,255,255,0.7);font-size:13px;margin-bottom:8px;font-weight:500}
.form-group input{width:100%;padding:14px 16px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:12px;color:#fff;font-size:15px;outline:none;transition:all .3s}
.form-group input:focus{border-color:#6c63ff;background:rgba(255,255,255,0.12);box-shadow:0 0 0 3px rgba(108,99,255,0.2)}
.form-group input::placeholder{color:rgba(255,255,255,0.3)}
.btn{width:100%;padding:14px;background:linear-gradient(135deg,#6c63ff,#5a52d5);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;transition:all .3s;letter-spacing:1px}
.btn:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(108,99,255,0.4)}
.btn:active{transform:translateY(0)}
.error{background:rgba(255,82,82,0.15);border:1px solid rgba(255,82,82,0.3);color:#ff5252;padding:12px 16px;border-radius:10px;font-size:14px;margin-bottom:20px;text-align:center}
.footer{text-align:center;margin-top:24px;color:rgba(255,255,255,0.3);font-size:12px}
</style>
</head>
<body>
<div class="login-card">
  <div class="logo">
    <h1>\u{1F916} TG Bot \u7BA1\u7406\u7CFB\u7EDF</h1>
    <p>\u591A\u673A\u5668\u4EBA\u96C6\u7FA4\u7BA1\u7406\u5E73\u53F0</p>
  </div>
  ${error ? `<div class="error">${error}</div>` : ""}
  <form method="POST" action="/login">
    <div class="form-group">
      <label>\u7BA1\u7406\u5458\u5BC6\u7801</label>
      <input type="password" name="password" placeholder="\u8BF7\u8F93\u5165\u7BA1\u7406\u5458\u5BC6\u7801" required autofocus>
    </div>
    <button type="submit" class="btn">\u767B \u5F55</button>
  </form>
  <div class="footer">Powered by Cloudflare Workers + D1</div>
</div>
</body>
</html>`;
}

// src/pages/dashboard.js
function dashboardPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TG Bot \u7BA1\u7406\u7CFB\u7EDF</title>
<style>
:root{--bg:#0f0e17;--surface:#1a1a2e;--surface2:#16213e;--border:rgba(255,255,255,0.08);--text:#fff;--text2:rgba(255,255,255,0.6);--primary:#6c63ff;--primary-hover:#5a52d5;--success:#00c853;--danger:#ff5252;--warning:#ffa726;--radius:12px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
a{color:var(--primary);text-decoration:none}

/* Layout */
.app{display:flex;min-height:100vh}
.sidebar{width:260px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;height:100vh;z-index:100}
.sidebar-header{padding:24px 20px;border-bottom:1px solid var(--border)}
.sidebar-header h2{font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px}
.sidebar-header p{font-size:12px;color:var(--text2);margin-top:4px}
.sidebar-nav{flex:1;padding:12px;overflow-y:auto}
.nav-item{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:var(--radius);cursor:pointer;transition:all .2s;color:var(--text2);font-size:14px;margin-bottom:2px}
.nav-item:hover,.nav-item.active{background:rgba(108,99,255,0.15);color:var(--text)}
.nav-item.active{color:var(--primary);font-weight:600}
.nav-section{padding:8px 16px;font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-top:12px}
.sidebar-footer{padding:16px 20px;border-top:1px solid var(--border)}
.sidebar-footer button{width:100%;padding:10px;background:rgba(255,82,82,0.15);color:var(--danger);border:1px solid rgba(255,82,82,0.2);border-radius:var(--radius);cursor:pointer;font-size:13px;transition:all .2s}
.sidebar-footer button:hover{background:rgba(255,82,82,0.25)}

.main{flex:1;margin-left:260px;padding:24px 32px}
.page-header{margin-bottom:24px}
.page-header h1{font-size:24px;font-weight:700}
.page-header p{color:var(--text2);font-size:14px;margin-top:4px}

/* Cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:20px}
.card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.card-header h3{font-size:16px;font-weight:600}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;text-align:center}
.stat-card .number{font-size:32px;font-weight:700;color:var(--primary)}
.stat-card .label{font-size:13px;color:var(--text2);margin-top:4px}

/* Buttons */
.btn{padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:500;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
.btn-primary{background:var(--primary);color:#fff}
.btn-primary:hover{background:var(--primary-hover)}
.btn-danger{background:rgba(255,82,82,0.15);color:var(--danger);border:1px solid rgba(255,82,82,0.2)}
.btn-danger:hover{background:rgba(255,82,82,0.25)}
.btn-success{background:rgba(0,200,83,0.15);color:var(--success);border:1px solid rgba(0,200,83,0.2)}
.btn-success:hover{background:rgba(0,200,83,0.25)}
.btn-sm{padding:6px 12px;font-size:12px}
.btn-outline{background:transparent;color:var(--text2);border:1px solid var(--border)}
.btn-outline:hover{border-color:var(--primary);color:var(--primary)}

/* Forms */
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:13px;color:var(--text2);margin-bottom:6px;font-weight:500}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;outline:none;transition:all .2s}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(108,99,255,0.15)}
.form-group textarea{resize:vertical;min-height:80px}
.form-group select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
.form-group select option{background:var(--surface);color:var(--text)}
.form-hint{font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px}

/* Table */
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:12px 16px;font-size:12px;color:var(--text2);font-weight:600;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border)}
td{padding:12px 16px;font-size:13px;border-bottom:1px solid var(--border);color:rgba(255,255,255,0.8)}
tr:hover td{background:rgba(255,255,255,0.02)}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
.badge-active{background:rgba(0,200,83,0.15);color:var(--success)}
.badge-inactive{background:rgba(255,82,82,0.15);color:var(--danger)}
.badge-exact{background:rgba(108,99,255,0.15);color:var(--primary)}
.badge-fuzzy{background:rgba(255,167,38,0.15);color:var(--warning)}

/* Modal */
.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:1000}
.modal-overlay.show{display:flex}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:32px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto}
.modal h3{font-size:18px;margin-bottom:20px}
.modal-actions{display:flex;gap:12px;justify-content:flex-end;margin-top:24px}

/* Toast */
.toast{position:fixed;top:20px;right:20px;padding:14px 20px;border-radius:var(--radius);font-size:14px;z-index:2000;animation:slideIn .3s ease;max-width:400px}
.toast-success{background:rgba(0,200,83,0.9);color:#fff}
.toast-error{background:rgba(255,82,82,0.9);color:#fff}
@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}

/* Pagination */
.pagination{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px}
.pagination button{padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer;font-size:13px}
.pagination button:hover{border-color:var(--primary);color:var(--primary)}
.pagination button.active{background:var(--primary);color:#fff;border-color:var(--primary)}
.pagination span{color:var(--text2);font-size:13px}

/* Tabs */
.tabs{display:flex;gap:4px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:0}
.tab{padding:10px 20px;cursor:pointer;font-size:14px;color:var(--text2);border-bottom:2px solid transparent;transition:all .2s;margin-bottom:-1px}
.tab:hover{color:var(--text)}
.tab.active{color:var(--primary);border-bottom-color:var(--primary);font-weight:600}
.tab-content{display:none}
.tab-content.active{display:block}

/* Empty state */
.empty{text-align:center;padding:48px 20px;color:var(--text2)}
.empty .icon{font-size:48px;margin-bottom:12px}
.empty p{font-size:14px}

/* Responsive */
@media(max-width:768px){
  .sidebar{width:100%;height:auto;position:relative;flex-direction:row;overflow-x:auto}
  .sidebar-header{display:none}
  .sidebar-nav{display:flex;padding:8px;gap:4px;flex-wrap:nowrap}
  .nav-section{display:none}
  .nav-item{white-space:nowrap;padding:8px 12px;font-size:12px}
  .sidebar-footer{display:none}
  .main{margin-left:0;padding:16px}
  .app{flex-direction:column}
  .form-row{grid-template-columns:1fr}
  .stats-grid{grid-template-columns:repeat(2,1fr)}
}

/* Loading */
.loading{display:flex;align-items:center;justify-content:center;padding:40px}
.spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* Code */
code{background:rgba(255,255,255,0.08);padding:2px 8px;border-radius:4px;font-size:12px;font-family:'SF Mono',Monaco,monospace}
</style>
</head>
<body>
<div class="app">
  <!-- Sidebar -->
  <div class="sidebar">
    <div class="sidebar-header">
      <h2>\u{1F916} TG Bot \u7BA1\u7406</h2>
      <p>\u591A\u673A\u5668\u4EBA\u96C6\u7FA4\u7BA1\u7406\u5E73\u53F0</p>
    </div>
    <div class="sidebar-nav" id="sidebarNav">
      <div class="nav-item active" data-page="dashboard" onclick="navigate('dashboard')">\u{1F4CA} \u63A7\u5236\u53F0</div>
      <div class="nav-item" data-page="bots" onclick="navigate('bots')">\u{1F916} \u673A\u5668\u4EBA\u7BA1\u7406</div>
      <div class="nav-section">\u7CFB\u7EDF</div>
      <div class="nav-item" data-page="settings" onclick="navigate('settings')">\u2699\uFE0F \u7CFB\u7EDF\u8BBE\u7F6E</div>
    </div>
    <div class="sidebar-footer">
      <button onclick="logout()">\u{1F6AA} \u9000\u51FA\u767B\u5F55</button>
    </div>
  </div>

  <!-- Main Content -->
  <div class="main" id="mainContent">
    <!-- Dynamic content loaded here -->
  </div>
</div>

<!-- Modal -->
<div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this)closeModal()">
  <div class="modal" id="modalContent"></div>
</div>

<!-- Toast Container -->
<div id="toastContainer"></div>

<script>
// ===== Global State =====
let currentPage = 'dashboard';
let currentBotId = null;
let currentBotName = '';

// ===== API Helper =====
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (res.headers.get('content-type')?.includes('text/csv')) {
    return { blob: await res.blob(), ok: true };
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '\u8BF7\u6C42\u5931\u8D25');
  return data;
}

// ===== Toast =====
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ===== Modal =====
function openModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('show');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

// ===== Navigation =====
function navigate(page, botId = null) {
  currentPage = page;
  if (botId) currentBotId = botId;

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.querySelector('[data-page="' + page + '"]');
  if (navEl) navEl.classList.add('active');

  renderPage();
}

function renderPage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  switch(currentPage) {
    case 'dashboard': renderDashboard(); break;
    case 'bots': renderBots(); break;
    case 'bot-config': renderBotConfig(); break;
    case 'settings': renderSettings(); break;
    default: renderDashboard();
  }
}

// ===== Dashboard =====
async function renderDashboard() {
  try {
    const stats = await api('/api/stats');
    const botsData = await api('/api/bots');
    const bots = botsData.bots || [];

    document.getElementById('mainContent').innerHTML = \`
      <div class="page-header">
        <h1>\u{1F4CA} \u63A7\u5236\u53F0</h1>
        <p>\u7CFB\u7EDF\u6982\u89C8\u4E0E\u5FEB\u901F\u64CD\u4F5C</p>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="number">\${stats.bots || 0}</div>
          <div class="label">\u63A5\u5165\u673A\u5668\u4EBA</div>
        </div>
        <div class="stat-card">
          <div class="number">\${stats.messages || 0}</div>
          <div class="label">\u6D88\u606F\u603B\u91CF</div>
        </div>
        <div class="stat-card">
          <div class="number">\${stats.active_tasks || 0}</div>
          <div class="label">\u6D3B\u8DC3\u4EFB\u52A1</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>\u{1F916} \u673A\u5668\u4EBA\u5217\u8868</h3>
          <button class="btn btn-primary" onclick="showAddBotModal()">+ \u65B0\u589E\u673A\u5668\u4EBA</button>
        </div>
        \${bots.length === 0 ? '<div class="empty"><div class="icon">\u{1F916}</div><p>\u6682\u65E0\u673A\u5668\u4EBA\uFF0C\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE\u6DFB\u52A0</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>\u540D\u79F0</th><th>Bot ID</th><th>\u72B6\u6001</th><th>\u521B\u5EFA\u65F6\u95F4</th><th>\u64CD\u4F5C</th></tr></thead><tbody>' +
        bots.map(b => '<tr><td><strong>' + esc(b.name) + '</strong></td><td><code>' + b.bot_id + '</code></td><td><span class="badge badge-' + (b.status === 'active' ? 'active' : 'inactive') + '">' + (b.status === 'active' ? '\u8FD0\u884C\u4E2D' : '\u5DF2\u505C\u7528') + '</span></td><td>' + formatDate(b.created_at) + '</td><td><button class="btn btn-sm btn-primary" onclick="enterBot(\\'' + b.bot_id + '\\',\\'' + esc(b.name) + '\\')">\u914D\u7F6E</button> <button class="btn btn-sm btn-danger" onclick="deleteBot(\\'' + b.bot_id + '\\',\\'' + esc(b.name) + '\\')">\u5220\u9664</button></td></tr>').join('') +
        '</tbody></table></div>'}
      </div>
    \`;
  } catch(e) {
    document.getElementById('mainContent').innerHTML = '<div class="card"><p>\u52A0\u8F7D\u5931\u8D25: ' + e.message + '</p></div>';
  }
}

// ===== Bots Management =====
async function renderBots() {
  await renderDashboard();
}

function showAddBotModal() {
  openModal(\`
    <h3>\u{1F916} \u65B0\u589E\u673A\u5668\u4EBA</h3>
    <div class="form-group">
      <label>\u673A\u5668\u4EBA\u540D\u79F0</label>
      <input type="text" id="botName" placeholder="\u4F8B\u5982\uFF1A\u5BA2\u670D\u673A\u5668\u4EBA">
    </div>
    <div class="form-group">
      <label>Bot Token</label>
      <input type="text" id="botToken" placeholder="\u4ECE @BotFather \u83B7\u53D6\u7684 Token">
      <div class="form-hint">\u683C\u5F0F\u5982\uFF1A123456789:ABCdefGHIjklMNOpqrsTUVwxyz</div>
    </div>
    <div class="form-group">
      <label>\u7BA1\u7406\u5458 Chat ID\uFF08\u53EF\u9009\uFF09</label>
      <input type="text" id="botAdminChatId" placeholder="\u7528\u4E8E\u63A5\u6536\u5BA2\u670D\u6D88\u606F\u8F6C\u53D1">
      <div class="form-hint">\u7BA1\u7406\u5458\u7684 Telegram \u7528\u6237 ID\uFF0C\u7528\u4E8E\u79C1\u804A\u5BA2\u670D\u56DE\u590D\u529F\u80FD</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">\u53D6\u6D88</button>
      <button class="btn btn-primary" onclick="addBot()">\u786E\u8BA4\u6DFB\u52A0</button>
    </div>
  \`);
}

async function addBot() {
  const name = document.getElementById('botName').value.trim();
  const token = document.getElementById('botToken').value.trim();
  const adminChatId = document.getElementById('botAdminChatId').value.trim();

  if (!name || !token) { toast('\u8BF7\u586B\u5199\u540D\u79F0\u548CToken', 'error'); return; }

  try {
    const result = await api('/api/bots', 'POST', { name, token, admin_chat_id: adminChatId });
    toast('\u673A\u5668\u4EBA\u6DFB\u52A0\u6210\u529F\uFF01Bot ID: ' + result.bot_id);
    closeModal();
    renderPage();
  } catch(e) {
    toast(e.message, 'error');
  }
}

async function deleteBot(botId, name) {
  if (!confirm('\u786E\u5B9A\u8981\u5220\u9664\u673A\u5668\u4EBA "' + name + '" \u5417\uFF1F\\n\\n\u26A0\uFE0F \u6B64\u64CD\u4F5C\u5C06\u5220\u9664\u8BE5\u673A\u5668\u4EBA\u7684\u6240\u6709\u6570\u636E\u3001\u89C4\u5219\u548C\u65E5\u5FD7\uFF0C\u4E0D\u53EF\u6062\u590D\uFF01')) return;
  try {
    await api('/api/bots/' + botId, 'DELETE');
    toast('\u673A\u5668\u4EBA\u5DF2\u5220\u9664');
    renderPage();
  } catch(e) {
    toast(e.message, 'error');
  }
}

function enterBot(botId, name) {
  currentBotId = botId;
  currentBotName = name;

  // Update sidebar
  const nav = document.getElementById('sidebarNav');
  // Remove old bot nav items
  document.querySelectorAll('.bot-nav-item').forEach(el => el.remove());

  const section = document.createElement('div');
  section.className = 'nav-section bot-nav-item';
  section.textContent = name;
  nav.appendChild(section);

  const items = [
    { page: 'bot-config', icon: '\u2699\uFE0F', label: '\u673A\u5668\u4EBA\u914D\u7F6E' },
  ];
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'nav-item bot-nav-item';
    el.dataset.page = item.page;
    el.innerHTML = item.icon + ' ' + item.label;
    el.onclick = () => navigate(item.page, botId);
    nav.appendChild(el);
  });

  navigate('bot-config', botId);
}

// ===== Bot Config Page =====
async function renderBotConfig() {
  if (!currentBotId) { navigate('dashboard'); return; }

  try {
    const [botData, statsData] = await Promise.all([
      api('/api/bots/' + currentBotId),
      api('/api/bots/' + currentBotId + '/stats')
    ]);
    const bot = botData.bot;

    document.getElementById('mainContent').innerHTML = \`
      <div class="page-header">
        <h1>\u2699\uFE0F \${esc(bot.name)}</h1>
        <p>Bot ID: <code>\${bot.bot_id}</code> &nbsp;|&nbsp; Webhook: <code>\${bot.webhook_url || '\u672A\u8BBE\u7F6E'}</code></p>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="number">\${statsData.messages}</div><div class="label">\u6D88\u606F\u6570</div></div>
        <div class="stat-card"><div class="number">\${statsData.joins}</div><div class="label">\u5165\u7FA4</div></div>
        <div class="stat-card"><div class="number">\${statsData.leaves}</div><div class="label">\u9000\u7FA4</div></div>
        <div class="stat-card"><div class="number">\${statsData.forward_rules}</div><div class="label">\u8F6C\u53D1\u89C4\u5219</div></div>
        <div class="stat-card"><div class="number">\${statsData.auto_replies}</div><div class="label">\u81EA\u52A8\u56DE\u590D</div></div>
        <div class="stat-card"><div class="number">\${statsData.active_tasks}</div><div class="label">\u5B9A\u65F6\u4EFB\u52A1</div></div>
      </div>

      <!-- Bot Basic Config -->
      <div class="card">
        <div class="card-header"><h3>\u{1F4CB} \u57FA\u672C\u914D\u7F6E</h3></div>
        <div class="form-row">
          <div class="form-group">
            <label>\u673A\u5668\u4EBA\u540D\u79F0</label>
            <input type="text" id="editBotName" value="\${esc(bot.name)}">
          </div>
          <div class="form-group">
            <label>\u7BA1\u7406\u5458 Chat ID</label>
            <input type="text" id="editAdminChatId" value="\${esc(bot.admin_chat_id || '')}">
            <div class="form-hint">\u7528\u4E8E\u79C1\u804A\u5BA2\u670D\u56DE\u590D\u529F\u80FD\uFF0C\u586B\u5199\u7BA1\u7406\u5458\u7684 TG \u7528\u6237 ID</div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="updateBotConfig()">\u4FDD\u5B58\u914D\u7F6E</button>
      </div>

      <!-- Tabs for different config sections -->
      <div class="tabs">
        <div class="tab active" onclick="switchTab(this,'tab-forward')">\u{1F4E1} \u8F6C\u53D1\u89C4\u5219</div>
        <div class="tab" onclick="switchTab(this,'tab-reply')">\u{1F4AC} \u81EA\u52A8\u56DE\u590D</div>
        <div class="tab" onclick="switchTab(this,'tab-group')">\u{1F465} \u7FA4\u7BA1\u63A7</div>
        <div class="tab" onclick="switchTab(this,'tab-tasks')">\u23F0 \u5B9A\u65F6\u4EFB\u52A1</div>
        <div class="tab" onclick="switchTab(this,'tab-logs')">\u{1F4DD} \u6D88\u606F\u65E5\u5FD7</div>
        <div class="tab" onclick="switchTab(this,'tab-events')">\u{1F6AA} \u6210\u5458\u53D8\u52A8</div>
      </div>

      <div id="tab-forward" class="tab-content active"></div>
      <div id="tab-reply" class="tab-content"></div>
      <div id="tab-group" class="tab-content"></div>
      <div id="tab-tasks" class="tab-content"></div>
      <div id="tab-logs" class="tab-content"></div>
      <div id="tab-events" class="tab-content"></div>
    \`;

    // Load first tab
    loadForwardRules();
  } catch(e) {
    document.getElementById('mainContent').innerHTML = '<div class="card"><p>\u52A0\u8F7D\u5931\u8D25: ' + e.message + '</p></div>';
  }
}

function switchTab(el, tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(tabId).classList.add('active');

  // Load tab content
  switch(tabId) {
    case 'tab-forward': loadForwardRules(); break;
    case 'tab-reply': loadAutoReplies(); break;
    case 'tab-group': loadGroupConfigs(); break;
    case 'tab-tasks': loadTasks(); break;
    case 'tab-logs': loadLogs(1); break;
    case 'tab-events': loadEvents(1); break;
  }
}

async function updateBotConfig() {
  try {
    await api('/api/bots/' + currentBotId, 'PUT', {
      name: document.getElementById('editBotName').value.trim(),
      admin_chat_id: document.getElementById('editAdminChatId').value.trim(),
    });
    toast('\u914D\u7F6E\u5DF2\u4FDD\u5B58');
    currentBotName = document.getElementById('editBotName').value.trim();
  } catch(e) {
    toast(e.message, 'error');
  }
}

// ===== Forward Rules =====
async function loadForwardRules() {
  const container = document.getElementById('tab-forward');
  try {
    const data = await api('/api/bots/' + currentBotId + '/forward-rules');
    const rules = data.rules || [];

    container.innerHTML = \`
      <div class="card">
        <div class="card-header">
          <h3>\u{1F4E1} \u9891\u9053\u8F6C\u53D1\u89C4\u5219</h3>
          <button class="btn btn-primary" onclick="showAddForwardRuleModal()">+ \u65B0\u589E\u89C4\u5219</button>
        </div>
        \${rules.length === 0 ? '<div class="empty"><div class="icon">\u{1F4E1}</div><p>\u6682\u65E0\u8F6C\u53D1\u89C4\u5219</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>\u6E90\u9891\u9053</th><th>\u76EE\u6807\u7FA4</th><th>\u5EF6\u65F6(\u79D2)</th><th>\u8FC7\u6EE4\u8BCD</th><th>\u72B6\u6001</th><th>\u64CD\u4F5C</th></tr></thead><tbody>' +
        rules.map(r => '<tr><td><code>' + esc(r.source_channel) + '</code></td><td>' + esc(r.target_chats) + '</td><td>' + r.delay_seconds + '</td><td>' + (r.skip_keywords ? esc(r.skip_keywords) : '<span style="color:var(--text2)">\u65E0</span>') + '</td><td><span class="badge badge-' + (r.enabled ? 'active' : 'inactive') + '">' + (r.enabled ? '\u542F\u7528' : '\u7981\u7528') + '</span></td><td><button class="btn btn-sm btn-outline" onclick="toggleForwardRule(' + r.id + ',' + (r.enabled ? 0 : 1) + ')">' + (r.enabled ? '\u7981\u7528' : '\u542F\u7528') + '</button> <button class="btn btn-sm btn-danger" onclick="deleteForwardRule(' + r.id + ')">\u5220\u9664</button></td></tr>').join('') +
        '</tbody></table></div>'}
      </div>
    \`;
  } catch(e) {
    container.innerHTML = '<div class="card"><p>\u52A0\u8F7D\u5931\u8D25: ' + e.message + '</p></div>';
  }
}

function showAddForwardRuleModal() {
  openModal(\`
    <h3>\u{1F4E1} \u65B0\u589E\u8F6C\u53D1\u89C4\u5219</h3>
    <div class="form-group">
      <label>\u6E90\u9891\u9053 ID</label>
      <input type="text" id="fwdSource" placeholder="\u4F8B\u5982\uFF1A-1001234567890">
      <div class="form-hint">\u9891\u9053\u7684 Chat ID\uFF0C\u53EF\u901A\u8FC7 /id \u6307\u4EE4\u83B7\u53D6</div>
    </div>
    <div class="form-group">
      <label>\u76EE\u6807\u7FA4/\u9891\u9053 ID\uFF08\u591A\u4E2A\u7528\u9017\u53F7\u5206\u9694\uFF09</label>
      <input type="text" id="fwdTargets" placeholder="\u4F8B\u5982\uFF1A-1009876543210,-1001111111111">
    </div>
    <div class="form-group">
      <label>\u8F6C\u53D1\u5EF6\u65F6\uFF08\u79D2\uFF09</label>
      <input type="number" id="fwdDelay" value="5" min="1" max="60">
      <div class="form-hint">1-60 \u79D2\uFF0C\u9632\u98CE\u63A7\u9650\u6D41</div>
    </div>
    <div class="form-group">
      <label>\u8FC7\u6EE4\u5173\u952E\u8BCD\uFF08\u591A\u4E2A\u7528\u9017\u53F7\u5206\u9694\uFF09</label>
      <input type="text" id="fwdSkip" placeholder="\u542B\u8FD9\u4E9B\u8BCD\u7684\u6D88\u606F\u4E0D\u8F6C\u53D1">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">\u53D6\u6D88</button>
      <button class="btn btn-primary" onclick="addForwardRule()">\u786E\u8BA4\u6DFB\u52A0</button>
    </div>
  \`);
}

async function addForwardRule() {
  try {
    await api('/api/bots/' + currentBotId + '/forward-rules', 'POST', {
      source_channel: document.getElementById('fwdSource').value.trim(),
      target_chats: document.getElementById('fwdTargets').value.trim(),
      delay_seconds: parseInt(document.getElementById('fwdDelay').value) || 5,
      skip_keywords: document.getElementById('fwdSkip').value.trim(),
    });
    toast('\u8F6C\u53D1\u89C4\u5219\u5DF2\u6DFB\u52A0');
    closeModal();
    loadForwardRules();
  } catch(e) {
    toast(e.message, 'error');
  }
}

async function toggleForwardRule(id, enabled) {
  try {
    await api('/api/forward-rules/' + id, 'PUT', { enabled });
    toast(enabled ? '\u89C4\u5219\u5DF2\u542F\u7528' : '\u89C4\u5219\u5DF2\u7981\u7528');
    loadForwardRules();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteForwardRule(id) {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u6B64\u8F6C\u53D1\u89C4\u5219\uFF1F')) return;
  try {
    await api('/api/forward-rules/' + id, 'DELETE');
    toast('\u89C4\u5219\u5DF2\u5220\u9664');
    loadForwardRules();
  } catch(e) { toast(e.message, 'error'); }
}

// ===== Auto Replies =====
async function loadAutoReplies() {
  const container = document.getElementById('tab-reply');
  try {
    const data = await api('/api/bots/' + currentBotId + '/auto-replies');
    const replies = data.replies || [];

    container.innerHTML = \`
      <div class="card">
        <div class="card-header">
          <h3>\u{1F4AC} \u81EA\u52A8\u56DE\u590D\u89C4\u5219</h3>
          <button class="btn btn-primary" onclick="showAddReplyModal()">+ \u65B0\u589E\u89C4\u5219</button>
        </div>
        \${replies.length === 0 ? '<div class="empty"><div class="icon">\u{1F4AC}</div><p>\u6682\u65E0\u81EA\u52A8\u56DE\u590D\u89C4\u5219</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>\u5173\u952E\u8BCD</th><th>\u56DE\u590D\u5185\u5BB9</th><th>\u5339\u914D\u6A21\u5F0F</th><th>\u72B6\u6001</th><th>\u64CD\u4F5C</th></tr></thead><tbody>' +
        replies.map(r => '<tr><td><code>' + esc(r.keyword) + '</code></td><td>' + esc(r.reply_content).substring(0,50) + (r.reply_content.length > 50 ? '...' : '') + '</td><td><span class="badge badge-' + (r.match_mode === 'exact' ? 'exact' : 'fuzzy') + '">' + (r.match_mode === 'exact' ? '\u7CBE\u786E\u5339\u914D' : '\u6A21\u7CCA\u5339\u914D') + '</span></td><td><span class="badge badge-' + (r.enabled ? 'active' : 'inactive') + '">' + (r.enabled ? '\u542F\u7528' : '\u7981\u7528') + '</span></td><td><button class="btn btn-sm btn-outline" onclick="toggleReply(' + r.id + ',' + (r.enabled ? 0 : 1) + ')">' + (r.enabled ? '\u7981\u7528' : '\u542F\u7528') + '</button> <button class="btn btn-sm btn-danger" onclick="deleteReply(' + r.id + ')">\u5220\u9664</button></td></tr>').join('') +
        '</tbody></table></div>'}
      </div>
    \`;
  } catch(e) {
    container.innerHTML = '<div class="card"><p>\u52A0\u8F7D\u5931\u8D25: ' + e.message + '</p></div>';
  }
}

function showAddReplyModal() {
  openModal(\`
    <h3>\u{1F4AC} \u65B0\u589E\u81EA\u52A8\u56DE\u590D</h3>
    <div class="form-group">
      <label>\u89E6\u53D1\u5173\u952E\u8BCD</label>
      <input type="text" id="replyKeyword" placeholder="\u8F93\u5165\u89E6\u53D1\u5173\u952E\u8BCD">
    </div>
    <div class="form-group">
      <label>\u56DE\u590D\u5185\u5BB9</label>
      <textarea id="replyContent" placeholder="\u8F93\u5165\u56DE\u590D\u5185\u5BB9\uFF0C\u652F\u6301 HTML \u683C\u5F0F"></textarea>
    </div>
    <div class="form-group">
      <label>\u5339\u914D\u6A21\u5F0F</label>
      <select id="replyMode">
        <option value="fuzzy">\u6A21\u7CCA\u5339\u914D\uFF08\u5305\u542B\u5373\u89E6\u53D1\uFF09</option>
        <option value="exact">\u7CBE\u786E\u5339\u914D\uFF08\u5B8C\u5168\u4E00\u81F4\uFF09</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">\u53D6\u6D88</button>
      <button class="btn btn-primary" onclick="addReply()">\u786E\u8BA4\u6DFB\u52A0</button>
    </div>
  \`);
}

async function addReply() {
  try {
    await api('/api/bots/' + currentBotId + '/auto-replies', 'POST', {
      keyword: document.getElementById('replyKeyword').value.trim(),
      reply_content: document.getElementById('replyContent').value.trim(),
      match_mode: document.getElementById('replyMode').value,
    });
    toast('\u81EA\u52A8\u56DE\u590D\u89C4\u5219\u5DF2\u6DFB\u52A0');
    closeModal();
    loadAutoReplies();
  } catch(e) { toast(e.message, 'error'); }
}

async function toggleReply(id, enabled) {
  try {
    await api('/api/auto-replies/' + id, 'PUT', { enabled });
    toast(enabled ? '\u89C4\u5219\u5DF2\u542F\u7528' : '\u89C4\u5219\u5DF2\u7981\u7528');
    loadAutoReplies();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteReply(id) {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u6B64\u81EA\u52A8\u56DE\u590D\u89C4\u5219\uFF1F')) return;
  try {
    await api('/api/auto-replies/' + id, 'DELETE');
    toast('\u89C4\u5219\u5DF2\u5220\u9664');
    loadAutoReplies();
  } catch(e) { toast(e.message, 'error'); }
}

// ===== Group Configs =====
async function loadGroupConfigs() {
  const container = document.getElementById('tab-group');
  try {
    const data = await api('/api/bots/' + currentBotId + '/group-configs');
    const configs = data.configs || [];

    container.innerHTML = \`
      <div class="card">
        <div class="card-header">
          <h3>\u{1F465} \u7FA4\u7BA1\u63A7\u914D\u7F6E</h3>
          <button class="btn btn-primary" onclick="showAddGroupConfigModal()">+ \u65B0\u589E\u7FA4\u914D\u7F6E</button>
        </div>
        \${configs.length === 0 ? '<div class="empty"><div class="icon">\u{1F465}</div><p>\u6682\u65E0\u7FA4\u914D\u7F6E</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>\u7FA4 ID</th><th>\u6B22\u8FCE\u8BED</th><th>\u8FDD\u7981\u8BCD</th><th>\u72B6\u6001</th><th>\u64CD\u4F5C</th></tr></thead><tbody>' +
        configs.map(c => '<tr><td><code>' + esc(c.group_id) + '</code></td><td>' + (c.welcome_message ? esc(c.welcome_message).substring(0,40) + '...' : '<span style="color:var(--text2)">\u672A\u8BBE\u7F6E</span>') + '</td><td>' + (c.banned_words ? esc(c.banned_words).substring(0,40) + '...' : '<span style="color:var(--text2)">\u65E0</span>') + '</td><td><span class="badge badge-' + (c.enabled ? 'active' : 'inactive') + '">' + (c.enabled ? '\u542F\u7528' : '\u7981\u7528') + '</span></td><td><button class="btn btn-sm btn-outline" onclick="editGroupConfig(' + c.id + ')">\u7F16\u8F91</button> <button class="btn btn-sm btn-danger" onclick="deleteGroupConfig(' + c.id + ')">\u5220\u9664</button></td></tr>').join('') +
        '</tbody></table></div>'}
      </div>
    \`;
  } catch(e) {
    container.innerHTML = '<div class="card"><p>\u52A0\u8F7D\u5931\u8D25: ' + e.message + '</p></div>';
  }
}

function showAddGroupConfigModal() {
  openModal(\`
    <h3>\u{1F465} \u65B0\u589E\u7FA4\u914D\u7F6E</h3>
    <div class="form-group">
      <label>\u7FA4 ID</label>
      <input type="text" id="gcGroupId" placeholder="\u4F8B\u5982\uFF1A-1001234567890">
    </div>
    <div class="form-group">
      <label>\u5165\u7FA4\u6B22\u8FCE\u8BED</label>
      <textarea id="gcWelcome" placeholder="\u652F\u6301\u53D8\u91CF\uFF1A{name} \u59D3\u540D, {username} \u7528\u6237\u540D, {group} \u7FA4\u540D"></textarea>
    </div>
    <div class="form-group">
      <label>\u8FDD\u7981\u8BCD\uFF08\u591A\u4E2A\u7528\u9017\u53F7\u5206\u9694\uFF09</label>
      <input type="text" id="gcBanned" placeholder="\u4F8B\u5982\uFF1A\u5E7F\u544A,\u63A8\u5E7F,\u4EE3\u7406">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">\u53D6\u6D88</button>
      <button class="btn btn-primary" onclick="addGroupConfig()">\u786E\u8BA4\u6DFB\u52A0</button>
    </div>
  \`);
}

async function addGroupConfig() {
  try {
    await api('/api/bots/' + currentBotId + '/group-configs', 'POST', {
      group_id: document.getElementById('gcGroupId').value.trim(),
      welcome_message: document.getElementById('gcWelcome').value.trim(),
      banned_words: document.getElementById('gcBanned').value.trim(),
    });
    toast('\u7FA4\u914D\u7F6E\u5DF2\u6DFB\u52A0');
    closeModal();
    loadGroupConfigs();
  } catch(e) { toast(e.message, 'error'); }
}

async function editGroupConfig(id) {
  // Fetch current config data from the table (simplified - refetch all)
  const data = await api('/api/bots/' + currentBotId + '/group-configs');
  const config = (data.configs || []).find(c => c.id === id);
  if (!config) return;

  openModal(\`
    <h3>\u270F\uFE0F \u7F16\u8F91\u7FA4\u914D\u7F6E</h3>
    <div class="form-group">
      <label>\u7FA4 ID</label>
      <input type="text" value="\${esc(config.group_id)}" disabled>
    </div>
    <div class="form-group">
      <label>\u5165\u7FA4\u6B22\u8FCE\u8BED</label>
      <textarea id="editGcWelcome">\${esc(config.welcome_message || '')}</textarea>
    </div>
    <div class="form-group">
      <label>\u8FDD\u7981\u8BCD</label>
      <input type="text" id="editGcBanned" value="\${esc(config.banned_words || '')}">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">\u53D6\u6D88</button>
      <button class="btn btn-primary" onclick="updateGroupConfig(\${id})">\u4FDD\u5B58</button>
    </div>
  \`);
}

async function updateGroupConfig(id) {
  try {
    await api('/api/group-configs/' + id, 'PUT', {
      welcome_message: document.getElementById('editGcWelcome').value.trim(),
      banned_words: document.getElementById('editGcBanned').value.trim(),
    });
    toast('\u7FA4\u914D\u7F6E\u5DF2\u66F4\u65B0');
    closeModal();
    loadGroupConfigs();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteGroupConfig(id) {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u6B64\u7FA4\u914D\u7F6E\uFF1F')) return;
  try {
    await api('/api/group-configs/' + id, 'DELETE');
    toast('\u7FA4\u914D\u7F6E\u5DF2\u5220\u9664');
    loadGroupConfigs();
  } catch(e) { toast(e.message, 'error'); }
}

// ===== Scheduled Tasks =====
async function loadTasks() {
  const container = document.getElementById('tab-tasks');
  try {
    const data = await api('/api/bots/' + currentBotId + '/tasks');
    const tasks = data.tasks || [];

    container.innerHTML = \`
      <div class="card">
        <div class="card-header">
          <h3>\u23F0 \u5B9A\u65F6\u4EFB\u52A1</h3>
          <button class="btn btn-primary" onclick="showAddTaskModal()">+ \u65B0\u589E\u4EFB\u52A1</button>
        </div>
        \${tasks.length === 0 ? '<div class="empty"><div class="icon">\u23F0</div><p>\u6682\u65E0\u5B9A\u65F6\u4EFB\u52A1</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>\u7C7B\u578B</th><th>\u76EE\u6807</th><th>\u5185\u5BB9</th><th>\u5FAA\u73AF\u6A21\u5F0F</th><th>\u4E0B\u6B21\u6267\u884C</th><th>\u72B6\u6001</th><th>\u64CD\u4F5C</th></tr></thead><tbody>' +
        tasks.map(t => '<tr><td>' + esc(t.task_type) + '</td><td><code>' + esc(t.target_chat) + '</code></td><td>' + esc(t.content).substring(0,30) + '</td><td>' + getRepeatLabel(t.repeat_mode) + '</td><td>' + formatDate(t.next_run_at) + '</td><td><span class="badge badge-' + (t.enabled ? 'active' : 'inactive') + '">' + (t.enabled ? '\u542F\u7528' : '\u5DF2\u5B8C\u6210') + '</span></td><td><button class="btn btn-sm btn-danger" onclick="deleteTask(' + t.id + ')">\u5220\u9664</button></td></tr>').join('') +
        '</tbody></table></div>'}
      </div>
    \`;
  } catch(e) {
    container.innerHTML = '<div class="card"><p>\u52A0\u8F7D\u5931\u8D25: ' + e.message + '</p></div>';
  }
}

function showAddTaskModal() {
  openModal(\`
    <h3>\u23F0 \u65B0\u589E\u5B9A\u65F6\u4EFB\u52A1</h3>
    <div class="form-group">
      <label>\u4EFB\u52A1\u7C7B\u578B</label>
      <select id="taskType">
        <option value="send">\u5B9A\u65F6\u7FA4\u53D1</option>
        <option value="remind">\u4E2A\u4EBA\u63D0\u9192</option>
      </select>
    </div>
    <div class="form-group">
      <label>\u76EE\u6807 Chat ID</label>
      <input type="text" id="taskTarget" placeholder="\u7FA4ID \u6216 \u7528\u6237ID">
    </div>
    <div class="form-group">
      <label>\u53D1\u9001\u5185\u5BB9</label>
      <textarea id="taskContent" placeholder="\u8F93\u5165\u8981\u53D1\u9001\u7684\u5185\u5BB9"></textarea>
    </div>
    <div class="form-group">
      <label>\u5FAA\u73AF\u6A21\u5F0F</label>
      <select id="taskRepeat">
        <option value="once">\u4E00\u6B21\u6027</option>
        <option value="hourly">\u6BCF\u5C0F\u65F6</option>
        <option value="daily">\u6BCF\u5929</option>
      </select>
    </div>
    <div class="form-group">
      <label>\u9996\u6B21\u6267\u884C\u65F6\u95F4</label>
      <input type="datetime-local" id="taskNextRun">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">\u53D6\u6D88</button>
      <button class="btn btn-primary" onclick="addTask()">\u786E\u8BA4\u6DFB\u52A0</button>
    </div>
  \`);

  // Set default time to now + 5 minutes
  const now = new Date(Date.now() + 5 * 60000);
  document.getElementById('taskNextRun').value = now.toISOString().slice(0, 16);
}

async function addTask() {
  const nextRun = document.getElementById('taskNextRun').value;
  if (!nextRun) { toast('\u8BF7\u9009\u62E9\u6267\u884C\u65F6\u95F4', 'error'); return; }

  try {
    await api('/api/bots/' + currentBotId + '/tasks', 'POST', {
      task_type: document.getElementById('taskType').value,
      target_chat: document.getElementById('taskTarget').value.trim(),
      content: document.getElementById('taskContent').value.trim(),
      repeat_mode: document.getElementById('taskRepeat').value,
      next_run_at: new Date(nextRun).toISOString(),
    });
    toast('\u5B9A\u65F6\u4EFB\u52A1\u5DF2\u6DFB\u52A0');
    closeModal();
    loadTasks();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteTask(id) {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u6B64\u4EFB\u52A1\uFF1F')) return;
  try {
    await api('/api/tasks/' + id, 'DELETE');
    toast('\u4EFB\u52A1\u5DF2\u5220\u9664');
    loadTasks();
  } catch(e) { toast(e.message, 'error'); }
}

// ===== Message Logs =====
async function loadLogs(page) {
  const container = document.getElementById('tab-logs');
  try {
    const data = await api('/api/bots/' + currentBotId + '/logs?page=' + page + '&limit=30');
    const logs = data.logs || [];
    const totalPages = Math.ceil(data.total / data.limit) || 1;

    container.innerHTML = \`
      <div class="card">
        <div class="card-header">
          <h3>\u{1F4DD} \u6D88\u606F\u65E5\u5FD7 (\u5171 \${data.total} \u6761)</h3>
          <div>
            <button class="btn btn-sm btn-success" onclick="exportLogs()">\u{1F4E5} \u5BFC\u51FACSV</button>
            <button class="btn btn-sm btn-danger" onclick="clearLogs()">\u{1F5D1}\uFE0F \u6E05\u7A7A\u65E5\u5FD7</button>
          </div>
        </div>
        \${logs.length === 0 ? '<div class="empty"><div class="icon">\u{1F4DD}</div><p>\u6682\u65E0\u6D88\u606F\u65E5\u5FD7</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>\u65F6\u95F4</th><th>\u7C7B\u578B</th><th>\u7528\u6237</th><th>\u5185\u5BB9</th></tr></thead><tbody>' +
        logs.map(l => '<tr><td style="white-space:nowrap">' + formatDate(l.created_at) + '</td><td>' + esc(l.chat_type || '') + '</td><td>' + (l.first_name ? esc(l.first_name) : '') + (l.username ? ' @' + esc(l.username) : '') + '</td><td>' + esc(l.message_text || '').substring(0,80) + '</td></tr>').join('') +
        '</tbody></table></div>'}
        <div class="pagination">
          \${page > 1 ? '<button onclick="loadLogs(' + (page-1) + ')">\u4E0A\u4E00\u9875</button>' : ''}
          <span>\u7B2C \${page} / \${totalPages} \u9875</span>
          \${page < totalPages ? '<button onclick="loadLogs(' + (page+1) + ')">\u4E0B\u4E00\u9875</button>' : ''}
        </div>
      </div>
    \`;
  } catch(e) {
    container.innerHTML = '<div class="card"><p>\u52A0\u8F7D\u5931\u8D25: ' + e.message + '</p></div>';
  }
}

async function exportLogs() {
  try {
    const result = await api('/api/bots/' + currentBotId + '/logs/export');
    if (result.blob) {
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'messages_' + currentBotId + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast('\u65E5\u5FD7\u5BFC\u51FA\u6210\u529F');
    }
  } catch(e) { toast(e.message, 'error'); }
}

async function clearLogs() {
  if (!confirm('\u786E\u5B9A\u6E05\u7A7A\u6240\u6709\u6D88\u606F\u65E5\u5FD7\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\uFF01')) return;
  try {
    await api('/api/bots/' + currentBotId + '/logs/clear', 'DELETE');
    toast('\u65E5\u5FD7\u5DF2\u6E05\u7A7A');
    loadLogs(1);
  } catch(e) { toast(e.message, 'error'); }
}

// ===== Member Events =====
async function loadEvents(page) {
  const container = document.getElementById('tab-events');
  try {
    const data = await api('/api/bots/' + currentBotId + '/events?page=' + page + '&limit=30');
    const events = data.events || [];
    const totalPages = Math.ceil(data.total / data.limit) || 1;

    container.innerHTML = \`
      <div class="card">
        <div class="card-header">
          <h3>\u{1F6AA} \u6210\u5458\u53D8\u52A8 (\u5171 \${data.total} \u6761)</h3>
          <div>
            <button class="btn btn-sm btn-success" onclick="exportEvents()">\u{1F4E5} \u5BFC\u51FACSV</button>
            <button class="btn btn-sm btn-danger" onclick="clearEvents()">\u{1F5D1}\uFE0F \u6E05\u7A7A\u8BB0\u5F55</button>
          </div>
        </div>
        \${events.length === 0 ? '<div class="empty"><div class="icon">\u{1F6AA}</div><p>\u6682\u65E0\u6210\u5458\u53D8\u52A8\u8BB0\u5F55</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>\u65F6\u95F4</th><th>\u7FA4ID</th><th>\u7528\u6237</th><th>\u4E8B\u4EF6</th></tr></thead><tbody>' +
        events.map(e => '<tr><td style="white-space:nowrap">' + formatDate(e.created_at) + '</td><td><code>' + esc(e.group_id) + '</code></td><td>' + (e.first_name ? esc(e.first_name) : '') + (e.username ? ' @' + esc(e.username) : '') + '</td><td><span class="badge badge-' + (e.event_type === 'join' ? 'active' : 'inactive') + '">' + (e.event_type === 'join' ? '\u5165\u7FA4' : '\u9000\u7FA4') + '</span></td></tr>').join('') +
        '</tbody></table></div>'}
        <div class="pagination">
          \${page > 1 ? '<button onclick="loadEvents(' + (page-1) + ')">\u4E0A\u4E00\u9875</button>' : ''}
          <span>\u7B2C \${page} / \${totalPages} \u9875</span>
          \${page < totalPages ? '<button onclick="loadEvents(' + (page+1) + ')">\u4E0B\u4E00\u9875</button>' : ''}
        </div>
      </div>
    \`;
  } catch(e) {
    container.innerHTML = '<div class="card"><p>\u52A0\u8F7D\u5931\u8D25: ' + e.message + '</p></div>';
  }
}

async function exportEvents() {
  try {
    const result = await api('/api/bots/' + currentBotId + '/events/export');
    if (result.blob) {
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'events_' + currentBotId + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast('\u5BFC\u51FA\u6210\u529F');
    }
  } catch(e) { toast(e.message, 'error'); }
}

async function clearEvents() {
  if (!confirm('\u786E\u5B9A\u6E05\u7A7A\u6240\u6709\u6210\u5458\u53D8\u52A8\u8BB0\u5F55\uFF1F')) return;
  try {
    await api('/api/bots/' + currentBotId + '/events/clear', 'DELETE');
    toast('\u8BB0\u5F55\u5DF2\u6E05\u7A7A');
    loadEvents(1);
  } catch(e) { toast(e.message, 'error'); }
}

// ===== Settings =====
async function renderSettings() {
  document.getElementById('mainContent').innerHTML = \`
    <div class="page-header">
      <h1>\u2699\uFE0F \u7CFB\u7EDF\u8BBE\u7F6E</h1>
      <p>\u7BA1\u7406\u5458\u5BC6\u7801\u4E0E\u7CFB\u7EDF\u914D\u7F6E</p>
    </div>
    <div class="card">
      <div class="card-header"><h3>\u{1F511} \u4FEE\u6539\u7BA1\u7406\u5458\u5BC6\u7801</h3></div>
      <div class="form-group">
        <label>\u5F53\u524D\u5BC6\u7801</label>
        <input type="password" id="oldPassword" placeholder="\u8F93\u5165\u5F53\u524D\u5BC6\u7801">
      </div>
      <div class="form-group">
        <label>\u65B0\u5BC6\u7801</label>
        <input type="password" id="newPassword" placeholder="\u8F93\u5165\u65B0\u5BC6\u7801\uFF08\u81F3\u5C116\u4F4D\uFF09">
      </div>
      <div class="form-group">
        <label>\u786E\u8BA4\u65B0\u5BC6\u7801</label>
        <input type="password" id="confirmPassword" placeholder="\u518D\u6B21\u8F93\u5165\u65B0\u5BC6\u7801">
      </div>
      <button class="btn btn-primary" onclick="changePassword()">\u4FEE\u6539\u5BC6\u7801</button>
    </div>
    <div class="card">
      <div class="card-header"><h3>\u{1F4CB} \u7CFB\u7EDF\u4FE1\u606F</h3></div>
      <p style="color:var(--text2);font-size:14px;line-height:1.8">
        \u8FD0\u884C\u73AF\u5883\uFF1ACloudflare Workers<br>
        \u6570\u636E\u5E93\uFF1ACloudflare D1 (SQLite)<br>
        \u7248\u672C\uFF1A1.0.0<br>
        \u67B6\u6784\uFF1A\u591A\u673A\u5668\u4EBA\u96C6\u7FA4\u7BA1\u7406
      </p>
    </div>
  \`;
}

async function changePassword() {
  const oldPwd = document.getElementById('oldPassword').value;
  const newPwd = document.getElementById('newPassword').value;
  const confirmPwd = document.getElementById('confirmPassword').value;

  if (!oldPwd || !newPwd) { toast('\u8BF7\u586B\u5199\u5B8C\u6574', 'error'); return; }
  if (newPwd !== confirmPwd) { toast('\u4E24\u6B21\u5BC6\u7801\u4E0D\u4E00\u81F4', 'error'); return; }
  if (newPwd.length < 6) { toast('\u5BC6\u7801\u957F\u5EA6\u4E0D\u80FD\u5C11\u4E8E6\u4F4D', 'error'); return; }

  try {
    await api('/api/config/password', 'PUT', { old_password: oldPwd, new_password: newPwd });
    toast('\u5BC6\u7801\u4FEE\u6539\u6210\u529F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55');
    setTimeout(() => location.href = '/logout', 1500);
  } catch(e) { toast(e.message, 'error'); }
}

// ===== Logout =====
async function logout() {
  if (!confirm('\u786E\u5B9A\u9000\u51FA\u767B\u5F55\uFF1F')) return;
  location.href = '/logout';
}

// ===== Utilities =====
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch(e) { return dateStr; }
}

function getRepeatLabel(mode) {
  switch(mode) {
    case 'once': return '\u4E00\u6B21\u6027';
    case 'hourly': return '\u6BCF\u5C0F\u65F6';
    case 'daily': return '\u6BCF\u5929';
    default: return mode;
  }
}

// ===== Init =====
renderPage();
<\/script>
</body>
</html>`;
}

// src/index.js
var index_default = {
  // ===== HTTP 请求处理 =====
  async fetch(request, env, ctx) {
    const db = env.DB;
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    await initDatabase(db);
    const webhookMatch = path.match(/^\/webhook\/(.+)$/);
    if (webhookMatch && method === "POST") {
      const botId = webhookMatch[1];
      try {
        const bot = await db.prepare(
          "SELECT * FROM bots WHERE bot_id = ? AND status = 'active'"
        ).bind(botId).first();
        if (!bot) {
          return new Response(JSON.stringify({ error: "Bot not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
          });
        }
        const update = await request.json();
        ctx.waitUntil(handleWebhook(db, bot, update));
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("[Webhook Route Error]", error.message);
        return new Response("OK", { status: 200 });
      }
    }
    if (path === "/health") {
      return new Response(JSON.stringify({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (path === "/login" && method === "GET") {
      return new Response(loginPage(), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    if (path === "/login" && method === "POST") {
      try {
        const formData = await request.formData();
        const password = formData.get("password");
        const valid = await verifyPassword(db, password);
        if (!valid) {
          return new Response(loginPage("\u5BC6\u7801\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5"), {
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }
        const sessionId = await createSession(db);
        return new Response(null, {
          status: 302,
          headers: {
            "Location": "/",
            "Set-Cookie": setSessionCookie(sessionId)
          }
        });
      } catch (error) {
        return new Response(loginPage("\u767B\u5F55\u5931\u8D25: " + error.message), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
    }
    if (path === "/logout") {
      const sessionId = getSessionFromCookie(request);
      await destroySession(db, sessionId);
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/login",
          "Set-Cookie": clearSessionCookie()
        }
      });
    }
    const isAuthed = await requireAuth(db, request);
    if (path.startsWith("/api/")) {
      if (!isAuthed) {
        return new Response(JSON.stringify({ error: "\u672A\u6388\u6743\uFF0C\u8BF7\u5148\u767B\u5F55" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
      return handleApi(db, request, url);
    }
    if (path === "/" || path === "/dashboard") {
      if (!isAuthed) {
        return new Response(null, {
          status: 302,
          headers: { "Location": "/login" }
        });
      }
      return new Response(dashboardPage(), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    if (path === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }
    return new Response("Not Found", { status: 404 });
  },
  // ===== 定时任务触发 =====
  async scheduled(event, env, ctx) {
    const db = env.DB;
    await initDatabase(db);
    ctx.waitUntil(handleCron(db));
  }
};
export {
  index_default as default
};
