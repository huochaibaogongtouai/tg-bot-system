// ============================================
// 定时任务处理模块（Cron Trigger）
// ============================================

import { sendMessage, copyMessage } from './telegram.js';

export async function handleCron(db) {
  const now = new Date().toISOString();

  try {
    // 1. 处理转发队列
    await processForwardQueue(db, now);

    // 2. 处理定时任务
    await processScheduledTasks(db, now);

    // 3. 清理过期会话
    await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now).run();

  } catch (error) {
    console.error('[Cron Error]', error.message);
  }
}

// 处理延时转发队列
async function processForwardQueue(db, now) {
  // 获取到期的待转发消息
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

  // 清理已完成的旧队列记录（保留7天）
  const cleanDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare("DELETE FROM forward_queue WHERE status IN ('sent', 'failed') AND created_at < ?").bind(cleanDate).run();
}

// 处理定时任务
async function processScheduledTasks(db, now) {
  const tasks = await db.prepare(
    "SELECT st.*, b.token FROM scheduled_tasks st JOIN bots b ON st.bot_id = b.bot_id WHERE st.enabled = 1 AND st.next_run_at <= ? LIMIT 20"
  ).bind(now).all();

  if (!tasks.results || tasks.results.length === 0) return;

  for (const task of tasks.results) {
    try {
      // 执行任务
      if (task.task_type === 'send' || task.task_type === 'remind') {
        let content = task.content;
        if (task.task_type === 'remind') {
          content = `⏰ <b>提醒</b>\n\n${task.content}`;
        }
        await sendMessage(task.token, task.target_chat, content);
      }

      // 更新任务状态
      const lastRunAt = now;

      if (task.repeat_mode === 'once') {
        // 一次性任务，执行后禁用
        await db.prepare(
          "UPDATE scheduled_tasks SET enabled = 0, last_run_at = ? WHERE id = ?"
        ).bind(lastRunAt, task.id).run();
      } else if (task.repeat_mode === 'hourly') {
        // 每小时循环
        const nextRun = new Date(new Date(task.next_run_at).getTime() + 60 * 60 * 1000).toISOString();
        await db.prepare(
          "UPDATE scheduled_tasks SET next_run_at = ?, last_run_at = ? WHERE id = ?"
        ).bind(nextRun, lastRunAt, task.id).run();
      } else if (task.repeat_mode === 'daily') {
        // 每日循环
        const nextRun = new Date(new Date(task.next_run_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
        await db.prepare(
          "UPDATE scheduled_tasks SET next_run_at = ?, last_run_at = ? WHERE id = ?"
        ).bind(nextRun, lastRunAt, task.id).run();
      }

    } catch (error) {
      console.error(`[Scheduled Task] Error processing task ${task.id}:`, error.message);
    }
  }
}
