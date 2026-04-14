// ============================================
// Telegram Bot API 封装
// ============================================

const TG_API_BASE = 'https://api.telegram.org/bot';

export async function callTgApi(token, method, params = {}) {
  const url = `${TG_API_BASE}${token}/${method}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
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

export async function sendMessage(token, chatId, text, extra = {}) {
  return callTgApi(token, 'sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    ...extra,
  });
}

export async function forwardMessage(token, chatId, fromChatId, messageId) {
  return callTgApi(token, 'forwardMessage', {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId,
  });
}

export async function copyMessage(token, chatId, fromChatId, messageId) {
  return callTgApi(token, 'copyMessage', {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId,
  });
}

export async function deleteMessage(token, chatId, messageId) {
  return callTgApi(token, 'deleteMessage', {
    chat_id: chatId,
    message_id: messageId,
  });
}

export async function setWebhook(token, url) {
  return callTgApi(token, 'setWebhook', {
    url: url,
    allowed_updates: ['message', 'channel_post', 'chat_member', 'my_chat_member'],
  });
}

export async function deleteWebhook(token) {
  return callTgApi(token, 'deleteWebhook', { drop_pending_updates: false });
}

export async function getMe(token) {
  return callTgApi(token, 'getMe');
}

export async function getChatMember(token, chatId, userId) {
  return callTgApi(token, 'getChatMember', {
    chat_id: chatId,
    user_id: userId,
  });
}
