// ============================================
// TG Webhook 处理模块
// ============================================

import { sendMessage, forwardMessage, copyMessage, deleteMessage } from './telegram.js';

// 获取消息文本内容（兼容各种消息类型）
function getMessageText(message) {
  return message.text || message.caption || '';
}

// 获取消息类型
function getMessageType(message) {
  if (message.text) return 'text';
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.audio) return 'audio';
  if (message.voice) return 'voice';
  if (message.sticker) return 'sticker';
  if (message.animation) return 'animation';
  if (message.poll) return 'poll';
  if (message.location) return 'location';
  if (message.contact) return 'contact';
  return 'other';
}

export async function handleWebhook(db, botRecord, update) {
  const { bot_id, token, admin_chat_id } = botRecord;

  try {
    // 处理频道消息
    if (update.channel_post) {
      await handleChannelPost(db, bot_id, token, update.channel_post);
      return;
    }

    // 处理普通消息
    if (update.message) {
      const message = update.message;

      // 新成员入群
      if (message.new_chat_members) {
        await handleNewMembers(db, bot_id, token, message);
        return;
      }

      // 成员退群
      if (message.left_chat_member) {
        await handleLeftMember(db, bot_id, token, message);
        return;
      }

      // 记录消息日志
      await logMessage(db, bot_id, message);

      // 检查是否是管理员回复（客服功能）
      if (admin_chat_id && message.reply_to_message && String(message.chat.id) === String(admin_chat_id)) {
        await handleAdminReply(db, bot_id, token, message);
        return;
      }

      // 检查违禁词（群消息）
      if (message.chat.type === 'group' || message.chat.type === 'supergroup') {
        const blocked = await checkBannedWords(db, bot_id, token, message);
        if (blocked) return;
      }

      // 处理指令
      if (message.text && message.text.startsWith('/')) {
        await handleCommand(db, bot_id, token, message);
        return;
      }

      // 自动回复
      await handleAutoReply(db, bot_id, token, message);

      // 私聊消息转发给管理员（客服功能）
      if (message.chat.type === 'private' && admin_chat_id && String(message.from.id) !== String(admin_chat_id)) {
        await forwardToAdmin(db, bot_id, token, message, admin_chat_id);
      }
    }
  } catch (error) {
    console.error(`[Webhook Error] bot=${bot_id}:`, error.message);
  }
}

// 处理频道消息 - 延时转发
async function handleChannelPost(db, botId, token, post) {
  const chatId = String(post.chat.id);
  const messageText = getMessageText(post);

  // 记录频道消息日志
  await db.prepare(
    "INSERT INTO message_logs (bot_id, chat_id, chat_type, user_id, username, message_text, message_type, created_at) VALUES (?, ?, 'channel', '', ?, ?, ?, datetime('now'))"
  ).bind(botId, chatId, post.chat.title || '', messageText, getMessageType(post)).run();

  // 查找匹配的转发规则
  const rules = await db.prepare(
    "SELECT * FROM forward_rules WHERE bot_id = ? AND enabled = 1 AND source_channel = ?"
  ).bind(botId, chatId).all();

  if (!rules.results || rules.results.length === 0) return;

  for (const rule of rules.results) {
    // 检查跳过关键词
    if (rule.skip_keywords) {
      const keywords = rule.skip_keywords.split(',').map(k => k.trim()).filter(k => k);
      const shouldSkip = keywords.some(kw => messageText.includes(kw));
      if (shouldSkip) {
        console.log(`[Forward] Skipped message due to keyword filter, rule=${rule.id}`);
        continue;
      }
    }

    // 解析目标群列表
    const targets = rule.target_chats.split(',').map(t => t.trim()).filter(t => t);
    const delay = rule.delay_seconds || 0;
    const scheduledAt = new Date(Date.now() + delay * 1000).toISOString();

    // 加入转发队列
    for (const target of targets) {
      await db.prepare(
        "INSERT INTO forward_queue (bot_id, rule_id, source_chat_id, source_message_id, target_chat, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"
      ).bind(botId, rule.id, chatId, String(post.message_id), target, scheduledAt).run();
    }
  }
}

// 处理新成员入群
async function handleNewMembers(db, botId, token, message) {
  const groupId = String(message.chat.id);

  for (const member of message.new_chat_members) {
    // 记录入群事件
    await db.prepare(
      "INSERT INTO member_events (bot_id, group_id, user_id, username, first_name, event_type, created_at) VALUES (?, ?, ?, ?, ?, 'join', datetime('now'))"
    ).bind(botId, groupId, String(member.id), member.username || '', member.first_name || '').run();

    // 发送欢迎消息
    const config = await db.prepare(
      "SELECT * FROM group_configs WHERE bot_id = ? AND group_id = ? AND enabled = 1"
    ).bind(botId, groupId).first();

    if (config && config.welcome_message) {
      const welcomeText = config.welcome_message
        .replace(/{name}/g, member.first_name || member.username || '新成员')
        .replace(/{username}/g, member.username ? `@${member.username}` : '')
        .replace(/{group}/g, message.chat.title || '');
      await sendMessage(token, groupId, welcomeText);
    }
  }
}

// 处理成员退群
async function handleLeftMember(db, botId, token, message) {
  const groupId = String(message.chat.id);
  const member = message.left_chat_member;

  await db.prepare(
    "INSERT INTO member_events (bot_id, group_id, user_id, username, first_name, event_type, created_at) VALUES (?, ?, ?, ?, ?, 'leave', datetime('now'))"
  ).bind(botId, groupId, String(member.id), member.username || '', member.first_name || '').run();
}

// 记录消息日志
async function logMessage(db, botId, message) {
  const chatId = String(message.chat.id);
  const chatType = message.chat.type;
  const userId = message.from ? String(message.from.id) : '';
  const username = message.from ? (message.from.username || '') : '';
  const firstName = message.from ? (message.from.first_name || '') : '';
  const messageText = getMessageText(message);
  const messageType = getMessageType(message);

  await db.prepare(
    "INSERT INTO message_logs (bot_id, chat_id, chat_type, user_id, username, first_name, message_text, message_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
  ).bind(botId, chatId, chatType, userId, username, firstName, messageText, messageType).run();
}

// 检查违禁词
async function checkBannedWords(db, botId, token, message) {
  const groupId = String(message.chat.id);
  const text = getMessageText(message).toLowerCase();
  if (!text) return false;

  const config = await db.prepare(
    "SELECT * FROM group_configs WHERE bot_id = ? AND group_id = ? AND enabled = 1"
  ).bind(botId, groupId).first();

  if (!config || !config.banned_words) return false;

  const bannedWords = config.banned_words.split(',').map(w => w.trim().toLowerCase()).filter(w => w);
  const hit = bannedWords.find(w => text.includes(w));

  if (hit) {
    // 删除违规消息
    await deleteMessage(token, groupId, message.message_id);
    // 发送警告
    const userName = message.from.first_name || message.from.username || '用户';
    await sendMessage(token, groupId, `⚠️ <b>${userName}</b> 的消息包含违禁内容，已自动拦截。`);
    return true;
  }

  return false;
}

// 处理指令
async function handleCommand(db, botId, token, message) {
  const text = message.text.trim();
  const chatId = String(message.chat.id);
  const parts = text.split(/\s+/);
  const command = parts[0].split('@')[0].toLowerCase();

  switch (command) {
    case '/start':
      await sendMessage(token, chatId, '👋 欢迎使用本机器人！\n\n发送任意消息即可与管理员沟通。');
      break;

    case '/help':
      await sendMessage(token, chatId,
        '📖 <b>可用指令</b>\n\n' +
        '/start - 开始使用\n' +
        '/help - 帮助信息\n' +
        '/remind [分钟] [内容] - 设置提醒\n' +
        '/id - 获取当前会话ID'
      );
      break;

    case '/id':
      const userId = message.from ? message.from.id : 'N/A';
      await sendMessage(token, chatId,
        `📋 <b>会话信息</b>\n\n` +
        `会话ID: <code>${chatId}</code>\n` +
        `用户ID: <code>${userId}</code>\n` +
        `类型: ${message.chat.type}`
      );
      break;

    case '/remind':
      await handleRemindCommand(db, botId, token, message, parts);
      break;

    default:
      break;
  }
}

// 处理提醒指令
async function handleRemindCommand(db, botId, token, message, parts) {
  const chatId = String(message.chat.id);

  if (parts.length < 3) {
    await sendMessage(token, chatId, '⚠️ 用法: /remind [分钟数] [提醒内容]\n例如: /remind 30 开会');
    return;
  }

  const minutes = parseInt(parts[1]);
  if (isNaN(minutes) || minutes < 1 || minutes > 10080) {
    await sendMessage(token, chatId, '⚠️ 分钟数必须在 1-10080 之间');
    return;
  }

  const content = parts.slice(2).join(' ');
  const nextRunAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

  await db.prepare(
    "INSERT INTO scheduled_tasks (bot_id, task_type, target_chat, content, repeat_mode, next_run_at, enabled) VALUES (?, 'remind', ?, ?, 'once', ?, 1)"
  ).bind(botId, chatId, content, nextRunAt).run();

  await sendMessage(token, chatId, `✅ 提醒已设置！将在 ${minutes} 分钟后提醒你：\n${content}`);
}

// 自动回复
async function handleAutoReply(db, botId, token, message) {
  const text = getMessageText(message);
  if (!text) return;

  const chatId = String(message.chat.id);

  // 获取该机器人的所有启用的自动回复规则
  const rules = await db.prepare(
    "SELECT * FROM auto_replies WHERE bot_id = ? AND enabled = 1"
  ).bind(botId).all();

  if (!rules.results || rules.results.length === 0) return;

  for (const rule of rules.results) {
    let matched = false;

    if (rule.match_mode === 'exact') {
      matched = text.trim() === rule.keyword.trim();
    } else {
      // fuzzy - 模糊包含匹配
      matched = text.toLowerCase().includes(rule.keyword.toLowerCase());
    }

    if (matched) {
      await sendMessage(token, chatId, rule.reply_content, {
        reply_to_message_id: message.message_id,
      });
      break; // 只匹配第一条规则
    }
  }
}

// 转发私聊消息给管理员
async function forwardToAdmin(db, botId, token, message, adminChatId) {
  const result = await forwardMessage(token, adminChatId, message.chat.id, message.message_id);

  if (result.ok) {
    // 记录消息映射关系
    await db.prepare(
      "INSERT INTO customer_messages (bot_id, original_user_id, original_chat_id, forwarded_message_id, admin_chat_id) VALUES (?, ?, ?, ?, ?)"
    ).bind(botId, String(message.from.id), String(message.chat.id), String(result.result.message_id), adminChatId).run();
  }
}

// 管理员回复处理
async function handleAdminReply(db, botId, token, message) {
  const replyTo = message.reply_to_message;
  if (!replyTo) return;

  // 查找原始消息映射
  const mapping = await db.prepare(
    "SELECT * FROM customer_messages WHERE bot_id = ? AND forwarded_message_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(botId, String(replyTo.message_id)).first();

  if (mapping) {
    // 发送回复给原始用户
    await sendMessage(token, mapping.original_user_id, message.text || '');
  }
}
