// ============================================
// 后台管理 API 接口
// ============================================

import { getConfig, setConfig, generateId } from './db.js';
import { setWebhook, deleteWebhook, getMe } from './telegram.js';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function csvResponse(data, filename) {
  return new Response(data, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export async function handleApi(db, request, url) {
  const path = url.pathname;
  const method = request.method;

  try {
    // ===== 系统配置 =====
    if (path === '/api/config/password' && method === 'PUT') {
      const body = await request.json();
      const currentPassword = await getConfig(db, 'admin_password');
      if (body.old_password !== currentPassword) {
        return jsonResponse({ error: '当前密码错误' }, 400);
      }
      if (!body.new_password || body.new_password.length < 6) {
        return jsonResponse({ error: '新密码长度不能少于6位' }, 400);
      }
      await setConfig(db, 'admin_password', body.new_password);
      return jsonResponse({ success: true, message: '密码修改成功' });
    }

    if (path === '/api/config/default-password' && method === 'GET') {
      const password = await getConfig(db, 'admin_password');
      return jsonResponse({ password });
    }

    // ===== 机器人管理 =====
    if (path === '/api/bots' && method === 'GET') {
      const bots = await db.prepare("SELECT id, bot_id, name, token, status, webhook_url, admin_chat_id, created_at FROM bots ORDER BY created_at DESC").all();
      return jsonResponse({ bots: bots.results || [] });
    }

    if (path === '/api/bots' && method === 'POST') {
      const body = await request.json();
      if (!body.name || !body.token) {
        return jsonResponse({ error: '名称和Token不能为空' }, 400);
      }

      // 验证 Token 有效性
      const meResult = await getMe(body.token);
      if (!meResult.ok) {
        return jsonResponse({ error: 'Bot Token 无效，请检查后重试' }, 400);
      }

      const botId = String(meResult.result.id);

      // 检查是否已存在
      const existing = await db.prepare("SELECT * FROM bots WHERE bot_id = ?").bind(botId).first();
      if (existing) {
        return jsonResponse({ error: '该机器人已存在' }, 400);
      }

      await db.prepare(
        "INSERT INTO bots (bot_id, name, token, admin_chat_id) VALUES (?, ?, ?, ?)"
      ).bind(botId, body.name, body.token, body.admin_chat_id || '').run();

      // 设置 Webhook
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
        webhook_set: whResult.ok,
      });
    }

    // 单个机器人操作
    const botMatch = path.match(/^\/api\/bots\/([^/]+)$/);
    if (botMatch) {
      const botId = botMatch[1];

      if (method === 'GET') {
        const bot = await db.prepare("SELECT * FROM bots WHERE bot_id = ?").bind(botId).first();
        if (!bot) return jsonResponse({ error: '机器人不存在' }, 404);
        return jsonResponse({ bot });
      }

      if (method === 'PUT') {
        const body = await request.json();
        const updates = [];
        const params = [];

        if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
        if (body.admin_chat_id !== undefined) { updates.push('admin_chat_id = ?'); params.push(body.admin_chat_id); }
        if (body.status !== undefined) { updates.push('status = ?'); params.push(body.status); }

        if (updates.length > 0) {
          updates.push("updated_at = datetime('now')");
          params.push(botId);
          await db.prepare(`UPDATE bots SET ${updates.join(', ')} WHERE bot_id = ?`).bind(...params).run();
        }
        return jsonResponse({ success: true });
      }

      if (method === 'DELETE') {
        const bot = await db.prepare("SELECT * FROM bots WHERE bot_id = ?").bind(botId).first();
        if (bot) {
          await deleteWebhook(bot.token);
          // 级联删除所有关联数据
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

    // ===== 转发规则 =====
    const forwardRulesMatch = path.match(/^\/api\/bots\/([^/]+)\/forward-rules$/);
    if (forwardRulesMatch) {
      const botId = forwardRulesMatch[1];

      if (method === 'GET') {
        const rules = await db.prepare("SELECT * FROM forward_rules WHERE bot_id = ? ORDER BY created_at DESC").bind(botId).all();
        return jsonResponse({ rules: rules.results || [] });
      }

      if (method === 'POST') {
        const body = await request.json();
        if (!body.source_channel || !body.target_chats) {
          return jsonResponse({ error: '源频道和目标群不能为空' }, 400);
        }
        await db.prepare(
          "INSERT INTO forward_rules (bot_id, source_channel, target_chats, delay_seconds, skip_keywords, enabled) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(botId, body.source_channel, body.target_chats, body.delay_seconds || 5, body.skip_keywords || '', body.enabled !== undefined ? body.enabled : 1).run();
        return jsonResponse({ success: true });
      }
    }

    const forwardRuleMatch = path.match(/^\/api\/forward-rules\/(\d+)$/);
    if (forwardRuleMatch) {
      const ruleId = parseInt(forwardRuleMatch[1]);

      if (method === 'PUT') {
        const body = await request.json();
        const updates = [];
        const params = [];
        if (body.source_channel !== undefined) { updates.push('source_channel = ?'); params.push(body.source_channel); }
        if (body.target_chats !== undefined) { updates.push('target_chats = ?'); params.push(body.target_chats); }
        if (body.delay_seconds !== undefined) { updates.push('delay_seconds = ?'); params.push(body.delay_seconds); }
        if (body.skip_keywords !== undefined) { updates.push('skip_keywords = ?'); params.push(body.skip_keywords); }
        if (body.enabled !== undefined) { updates.push('enabled = ?'); params.push(body.enabled); }
        if (updates.length > 0) {
          updates.push("updated_at = datetime('now')");
          params.push(ruleId);
          await db.prepare(`UPDATE forward_rules SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
        }
        return jsonResponse({ success: true });
      }

      if (method === 'DELETE') {
        await db.prepare("DELETE FROM forward_rules WHERE id = ?").bind(ruleId).run();
        return jsonResponse({ success: true });
      }
    }

    // ===== 自动回复 =====
    const autoRepliesMatch = path.match(/^\/api\/bots\/([^/]+)\/auto-replies$/);
    if (autoRepliesMatch) {
      const botId = autoRepliesMatch[1];

      if (method === 'GET') {
        const replies = await db.prepare("SELECT * FROM auto_replies WHERE bot_id = ? ORDER BY created_at DESC").bind(botId).all();
        return jsonResponse({ replies: replies.results || [] });
      }

      if (method === 'POST') {
        const body = await request.json();
        if (!body.keyword || !body.reply_content) {
          return jsonResponse({ error: '关键词和回复内容不能为空' }, 400);
        }
        await db.prepare(
          "INSERT INTO auto_replies (bot_id, keyword, reply_content, match_mode, enabled) VALUES (?, ?, ?, ?, ?)"
        ).bind(botId, body.keyword, body.reply_content, body.match_mode || 'fuzzy', body.enabled !== undefined ? body.enabled : 1).run();
        return jsonResponse({ success: true });
      }
    }

    const autoReplyMatch = path.match(/^\/api\/auto-replies\/(\d+)$/);
    if (autoReplyMatch) {
      const replyId = parseInt(autoReplyMatch[1]);

      if (method === 'PUT') {
        const body = await request.json();
        const updates = [];
        const params = [];
        if (body.keyword !== undefined) { updates.push('keyword = ?'); params.push(body.keyword); }
        if (body.reply_content !== undefined) { updates.push('reply_content = ?'); params.push(body.reply_content); }
        if (body.match_mode !== undefined) { updates.push('match_mode = ?'); params.push(body.match_mode); }
        if (body.enabled !== undefined) { updates.push('enabled = ?'); params.push(body.enabled); }
        if (updates.length > 0) {
          params.push(replyId);
          await db.prepare(`UPDATE auto_replies SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
        }
        return jsonResponse({ success: true });
      }

      if (method === 'DELETE') {
        await db.prepare("DELETE FROM auto_replies WHERE id = ?").bind(replyId).run();
        return jsonResponse({ success: true });
      }
    }

    // ===== 群配置 =====
    const groupConfigsMatch = path.match(/^\/api\/bots\/([^/]+)\/group-configs$/);
    if (groupConfigsMatch) {
      const botId = groupConfigsMatch[1];

      if (method === 'GET') {
        const configs = await db.prepare("SELECT * FROM group_configs WHERE bot_id = ? ORDER BY created_at DESC").bind(botId).all();
        return jsonResponse({ configs: configs.results || [] });
      }

      if (method === 'POST') {
        const body = await request.json();
        if (!body.group_id) {
          return jsonResponse({ error: '群ID不能为空' }, 400);
        }
        // UPSERT
        await db.prepare(
          "INSERT INTO group_configs (bot_id, group_id, welcome_message, banned_words, enabled) VALUES (?, ?, ?, ?, ?) ON CONFLICT(bot_id, group_id) DO UPDATE SET welcome_message = ?, banned_words = ?, enabled = ?, updated_at = datetime('now')"
        ).bind(
          botId, body.group_id, body.welcome_message || '', body.banned_words || '', body.enabled !== undefined ? body.enabled : 1,
          body.welcome_message || '', body.banned_words || '', body.enabled !== undefined ? body.enabled : 1
        ).run();
        return jsonResponse({ success: true });
      }
    }

    const groupConfigMatch = path.match(/^\/api\/group-configs\/(\d+)$/);
    if (groupConfigMatch) {
      const configId = parseInt(groupConfigMatch[1]);

      if (method === 'PUT') {
        const body = await request.json();
        const updates = [];
        const params = [];
        if (body.welcome_message !== undefined) { updates.push('welcome_message = ?'); params.push(body.welcome_message); }
        if (body.banned_words !== undefined) { updates.push('banned_words = ?'); params.push(body.banned_words); }
        if (body.enabled !== undefined) { updates.push('enabled = ?'); params.push(body.enabled); }
        if (updates.length > 0) {
          updates.push("updated_at = datetime('now')");
          params.push(configId);
          await db.prepare(`UPDATE group_configs SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
        }
        return jsonResponse({ success: true });
      }

      if (method === 'DELETE') {
        await db.prepare("DELETE FROM group_configs WHERE id = ?").bind(configId).run();
        return jsonResponse({ success: true });
      }
    }

    // ===== 定时任务 =====
    const tasksMatch = path.match(/^\/api\/bots\/([^/]+)\/tasks$/);
    if (tasksMatch) {
      const botId = tasksMatch[1];

      if (method === 'GET') {
        const tasks = await db.prepare("SELECT * FROM scheduled_tasks WHERE bot_id = ? ORDER BY created_at DESC").bind(botId).all();
        return jsonResponse({ tasks: tasks.results || [] });
      }

      if (method === 'POST') {
        const body = await request.json();
        if (!body.target_chat || !body.content) {
          return jsonResponse({ error: '目标和内容不能为空' }, 400);
        }
        if (!body.next_run_at) {
          return jsonResponse({ error: '执行时间不能为空' }, 400);
        }
        await db.prepare(
          "INSERT INTO scheduled_tasks (bot_id, task_type, target_chat, content, repeat_mode, next_run_at, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(botId, body.task_type || 'send', body.target_chat, body.content, body.repeat_mode || 'once', body.next_run_at, body.enabled !== undefined ? body.enabled : 1).run();
        return jsonResponse({ success: true });
      }
    }

    const taskMatch = path.match(/^\/api\/tasks\/(\d+)$/);
    if (taskMatch) {
      const taskId = parseInt(taskMatch[1]);

      if (method === 'PUT') {
        const body = await request.json();
        const updates = [];
        const params = [];
        if (body.target_chat !== undefined) { updates.push('target_chat = ?'); params.push(body.target_chat); }
        if (body.content !== undefined) { updates.push('content = ?'); params.push(body.content); }
        if (body.repeat_mode !== undefined) { updates.push('repeat_mode = ?'); params.push(body.repeat_mode); }
        if (body.next_run_at !== undefined) { updates.push('next_run_at = ?'); params.push(body.next_run_at); }
        if (body.enabled !== undefined) { updates.push('enabled = ?'); params.push(body.enabled); }
        if (updates.length > 0) {
          params.push(taskId);
          await db.prepare(`UPDATE scheduled_tasks SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
        }
        return jsonResponse({ success: true });
      }

      if (method === 'DELETE') {
        await db.prepare("DELETE FROM scheduled_tasks WHERE id = ?").bind(taskId).run();
        return jsonResponse({ success: true });
      }
    }

    // ===== 消息日志 =====
    const logsMatch = path.match(/^\/api\/bots\/([^/]+)\/logs$/);
    if (logsMatch) {
      const botId = logsMatch[1];
      const params = url.searchParams;
      const page = parseInt(params.get('page') || '1');
      const limit = Math.min(parseInt(params.get('limit') || '50'), 200);
      const offset = (page - 1) * limit;

      const countResult = await db.prepare("SELECT COUNT(*) as total FROM message_logs WHERE bot_id = ?").bind(botId).first();
      const logs = await db.prepare(
        "SELECT * FROM message_logs WHERE bot_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      ).bind(botId, limit, offset).all();

      return jsonResponse({
        logs: logs.results || [],
        total: countResult.total,
        page,
        limit,
      });
    }

    // 消息日志CSV导出
    const logsCsvMatch = path.match(/^\/api\/bots\/([^/]+)\/logs\/export$/);
    if (logsCsvMatch) {
      const botId = logsCsvMatch[1];
      const logs = await db.prepare(
        "SELECT * FROM message_logs WHERE bot_id = ? ORDER BY created_at DESC"
      ).bind(botId).all();

      let csv = '\uFEFF' + 'ID,机器人ID,会话ID,会话类型,用户ID,用户名,姓名,消息内容,消息类型,时间\n';
      for (const log of (logs.results || [])) {
        csv += `${log.id},"${log.bot_id}","${log.chat_id}","${log.chat_type || ''}","${log.user_id || ''}","${log.username || ''}","${log.first_name || ''}","${(log.message_text || '').replace(/"/g, '""')}","${log.message_type}","${log.created_at}"\n`;
      }
      return csvResponse(csv, `messages_${botId}_${Date.now()}.csv`);
    }

    // ===== 成员事件 =====
    const eventsMatch = path.match(/^\/api\/bots\/([^/]+)\/events$/);
    if (eventsMatch) {
      const botId = eventsMatch[1];
      const params = url.searchParams;
      const page = parseInt(params.get('page') || '1');
      const limit = Math.min(parseInt(params.get('limit') || '50'), 200);
      const offset = (page - 1) * limit;

      const countResult = await db.prepare("SELECT COUNT(*) as total FROM member_events WHERE bot_id = ?").bind(botId).first();
      const events = await db.prepare(
        "SELECT * FROM member_events WHERE bot_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      ).bind(botId, limit, offset).all();

      return jsonResponse({
        events: events.results || [],
        total: countResult.total,
        page,
        limit,
      });
    }

    // 成员事件CSV导出
    const eventsCsvMatch = path.match(/^\/api\/bots\/([^/]+)\/events\/export$/);
    if (eventsCsvMatch) {
      const botId = eventsCsvMatch[1];
      const events = await db.prepare(
        "SELECT * FROM member_events WHERE bot_id = ? ORDER BY created_at DESC"
      ).bind(botId).all();

      let csv = '\uFEFF' + 'ID,机器人ID,群ID,用户ID,用户名,姓名,事件类型,时间\n';
      for (const evt of (events.results || [])) {
        csv += `${evt.id},"${evt.bot_id}","${evt.group_id}","${evt.user_id}","${evt.username || ''}","${evt.first_name || ''}","${evt.event_type}","${evt.created_at}"\n`;
      }
      return csvResponse(csv, `events_${botId}_${Date.now()}.csv`);
    }

    // ===== 清空日志 =====
    const clearLogsMatch = path.match(/^\/api\/bots\/([^/]+)\/logs\/clear$/);
    if (clearLogsMatch && method === 'DELETE') {
      const botId = clearLogsMatch[1];
      await db.prepare("DELETE FROM message_logs WHERE bot_id = ?").bind(botId).run();
      return jsonResponse({ success: true });
    }

    const clearEventsMatch = path.match(/^\/api\/bots\/([^/]+)\/events\/clear$/);
    if (clearEventsMatch && method === 'DELETE') {
      const botId = clearEventsMatch[1];
      await db.prepare("DELETE FROM member_events WHERE bot_id = ?").bind(botId).run();
      return jsonResponse({ success: true });
    }

    // ===== 统计数据 =====
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
        active_tasks: taskCount.c,
      });
    }

    // ===== 全局统计 =====
    if (path === '/api/stats' && method === 'GET') {
      const botCount = await db.prepare("SELECT COUNT(*) as c FROM bots").first();
      const msgCount = await db.prepare("SELECT COUNT(*) as c FROM message_logs").first();
      const taskCount = await db.prepare("SELECT COUNT(*) as c FROM scheduled_tasks WHERE enabled = 1").first();
      return jsonResponse({
        bots: botCount.c,
        messages: msgCount.c,
        active_tasks: taskCount.c,
      });
    }

    return jsonResponse({ error: 'API 接口不存在' }, 404);

  } catch (error) {
    console.error('[API Error]', error.message);
    return jsonResponse({ error: '服务器内部错误: ' + error.message }, 500);
  }
}
