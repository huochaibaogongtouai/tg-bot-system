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

// ===== 多媒体发送 =====
export async function sendPhoto(token, chatId, photoFileId, extra = {}) {
  return callTgApi(token, 'sendPhoto', {
    chat_id: chatId,
    photo: photoFileId,
    ...extra,
  });
}

export async function sendVideo(token, chatId, videoFileId, extra = {}) {
  return callTgApi(token, 'sendVideo', {
    chat_id: chatId,
    video: videoFileId,
    ...extra,
  });
}

export async function sendDocument(token, chatId, documentFileId, extra = {}) {
  return callTgApi(token, 'sendDocument', {
    chat_id: chatId,
    document: documentFileId,
    ...extra,
  });
}

export async function sendAudio(token, chatId, audioFileId, extra = {}) {
  return callTgApi(token, 'sendAudio', {
    chat_id: chatId,
    audio: audioFileId,
    ...extra,
  });
}

export async function sendVoice(token, chatId, voiceFileId, extra = {}) {
  return callTgApi(token, 'sendVoice', {
    chat_id: chatId,
    voice: voiceFileId,
    ...extra,
  });
}

export async function sendSticker(token, chatId, stickerFileId, extra = {}) {
  return callTgApi(token, 'sendSticker', {
    chat_id: chatId,
    sticker: stickerFileId,
    ...extra,
  });
}

export async function sendAnimation(token, chatId, animationFileId, extra = {}) {
  return callTgApi(token, 'sendAnimation', {
    chat_id: chatId,
    animation: animationFileId,
    ...extra,
  });
}

// ===== 通用多媒体回复（管理员回复用户，支持所有消息类型） =====
export async function sendMediaMessage(token, chatId, message) {
  // 根据消息类型转发对应的媒体
  if (message.photo && message.photo.length > 0) {
    const largestPhoto = message.photo[message.photo.length - 1];
    return sendPhoto(token, chatId, largestPhoto.file_id, {
      caption: message.caption || '',
      parse_mode: 'HTML',
    });
  }
  if (message.video) {
    return sendVideo(token, chatId, message.video.file_id, {
      caption: message.caption || '',
      parse_mode: 'HTML',
    });
  }
  if (message.document) {
    return sendDocument(token, chatId, message.document.file_id, {
      caption: message.caption || '',
      parse_mode: 'HTML',
    });
  }
  if (message.audio) {
    return sendAudio(token, chatId, message.audio.file_id, {
      caption: message.caption || '',
      parse_mode: 'HTML',
    });
  }
  if (message.voice) {
    return sendVoice(token, chatId, message.voice.file_id);
  }
  if (message.sticker) {
    return sendSticker(token, chatId, message.sticker.file_id);
  }
  if (message.animation) {
    return sendAnimation(token, chatId, message.animation.file_id, {
      caption: message.caption || '',
      parse_mode: 'HTML',
    });
  }
  // 纯文本
  if (message.text) {
    return sendMessage(token, chatId, message.text);
  }
  // 其他类型尝试 copyMessage
  return null;
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

// ===== 设置机器人命令菜单 =====
export async function setMyCommands(token, commands) {
  return callTgApi(token, 'setMyCommands', { commands });
}
