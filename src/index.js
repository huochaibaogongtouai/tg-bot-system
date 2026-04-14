// ============================================
// TG 多机器人转发系统 - 主入口
// Cloudflare Workers + D1 SQLite
// ============================================

import { initDatabase } from './db.js';
import {
  requireAuth,
  verifyPassword,
  createSession,
  destroySession,
  getSessionFromCookie,
  setSessionCookie,
  clearSessionCookie,
} from './auth.js';
import { handleWebhook } from './webhook.js';
import { handleApi } from './api.js';
import { handleCron } from './cron.js';
import { loginPage } from './pages/login.js';
import { dashboardPage } from './pages/dashboard.js';

export default {
  // ===== HTTP 请求处理 =====
  async fetch(request, env, ctx) {
    const db = env.DB;
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 初始化数据库（幂等操作）
    await initDatabase(db);

    // ===== Webhook 接口（无需登录） =====
    const webhookMatch = path.match(/^\/webhook\/(.+)$/);
    if (webhookMatch && method === 'POST') {
      const botId = webhookMatch[1];
      try {
        // 查找机器人
        const bot = await db.prepare(
          "SELECT * FROM bots WHERE bot_id = ? AND status = 'active'"
        ).bind(botId).first();

        if (!bot) {
          return new Response(JSON.stringify({ error: 'Bot not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const update = await request.json();
        // 异步处理 webhook，立即返回 200
        ctx.waitUntil(handleWebhook(db, bot, update));

        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('[Webhook Route Error]', error.message);
        return new Response('OK', { status: 200 });
      }
    }

    // ===== 健康检查 =====
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ===== 登录页面 =====
    if (path === '/login' && method === 'GET') {
      return new Response(loginPage(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // ===== 登录提交 =====
    if (path === '/login' && method === 'POST') {
      try {
        const formData = await request.formData();
        const password = formData.get('password');

        const valid = await verifyPassword(db, password);
        if (!valid) {
          return new Response(loginPage('密码错误，请重试'), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }

        const sessionId = await createSession(db);
        return new Response(null, {
          status: 302,
          headers: {
            'Location': '/',
            'Set-Cookie': setSessionCookie(sessionId),
          },
        });
      } catch (error) {
        return new Response(loginPage('登录失败: ' + error.message), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
    }

    // ===== 退出登录 =====
    if (path === '/logout') {
      const sessionId = getSessionFromCookie(request);
      await destroySession(db, sessionId);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/login',
          'Set-Cookie': clearSessionCookie(),
        },
      });
    }

    // ===== 以下路由需要登录 =====
    const isAuthed = await requireAuth(db, request);

    // API 接口
    if (path.startsWith('/api/')) {
      if (!isAuthed) {
        return new Response(JSON.stringify({ error: '未授权，请先登录' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return handleApi(db, request, url);
    }

    // 后台管理面板
    if (path === '/' || path === '/dashboard') {
      if (!isAuthed) {
        return new Response(null, {
          status: 302,
          headers: { 'Location': '/login' },
        });
      }
      return new Response(dashboardPage(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Favicon
    if (path === '/favicon.ico') {
      return new Response(null, { status: 204 });
    }

    // 404
    return new Response('Not Found', { status: 404 });
  },

  // ===== 定时任务触发 =====
  async scheduled(event, env, ctx) {
    const db = env.DB;
    await initDatabase(db);
    ctx.waitUntil(handleCron(db));
  },
};
