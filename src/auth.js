// ============================================
// 认证与会话管理模块
// ============================================

import { getConfig } from './db.js';

export function generateSessionId() {
  return crypto.randomUUID() + '-' + Date.now().toString(36);
}

export async function createSession(db) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db.prepare("INSERT INTO sessions (session_id, expires_at) VALUES (?, ?)").bind(sessionId, expiresAt).run();
  return sessionId;
}

export async function validateSession(db, sessionId) {
  if (!sessionId) return false;
  const session = await db.prepare(
    "SELECT * FROM sessions WHERE session_id = ? AND expires_at > datetime('now')"
  ).bind(sessionId).first();
  return !!session;
}

export async function destroySession(db, sessionId) {
  if (!sessionId) return;
  await db.prepare("DELETE FROM sessions WHERE session_id = ?").bind(sessionId).run();
}

export async function cleanExpiredSessions(db) {
  await db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
}

export function getSessionFromCookie(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session_id=([^;]+)/);
  return match ? match[1] : null;
}

export function setSessionCookie(sessionId) {
  return `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`;
}

export function clearSessionCookie() {
  return 'session_id=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0';
}

export async function verifyPassword(db, password) {
  const stored = await getConfig(db, 'admin_password');
  return stored === password;
}

// 鉴权中间件 - 检查是否需要登录
export async function requireAuth(db, request) {
  const sessionId = getSessionFromCookie(request);
  return await validateSession(db, sessionId);
}
