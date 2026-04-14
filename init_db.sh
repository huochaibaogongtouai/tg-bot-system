#!/bin/bash
DB_ID="031ade0f-a5b4-421e-a7e8-fc0635129264"

run_sql() {
  echo "Running: $1"
  manus-mcp-cli tool call -s cloudflare d1_database_query -i "{\"database_id\":\"$DB_ID\",\"sql\":\"$1\"}" 2>&1
  echo "---"
}

run_sql "CREATE TABLE IF NOT EXISTS system_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))"
run_sql "CREATE TABLE IF NOT EXISTS sessions (session_id TEXT PRIMARY KEY, created_at TEXT DEFAULT (datetime('now')), expires_at TEXT NOT NULL)"
run_sql "CREATE TABLE IF NOT EXISTS bots (id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL, token TEXT NOT NULL, status TEXT DEFAULT 'active', webhook_url TEXT, admin_chat_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))"
run_sql "CREATE TABLE IF NOT EXISTS forward_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT NOT NULL, source_channel TEXT NOT NULL, target_chats TEXT NOT NULL, delay_seconds INTEGER DEFAULT 5, skip_keywords TEXT DEFAULT '', enabled INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))"
run_sql "CREATE TABLE IF NOT EXISTS auto_replies (id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT NOT NULL, keyword TEXT NOT NULL, reply_content TEXT NOT NULL, match_mode TEXT DEFAULT 'fuzzy', enabled INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))"
run_sql "CREATE TABLE IF NOT EXISTS group_configs (id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT NOT NULL, group_id TEXT NOT NULL, welcome_message TEXT DEFAULT '', banned_words TEXT DEFAULT '', enabled INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), UNIQUE(bot_id, group_id))"
run_sql "CREATE TABLE IF NOT EXISTS message_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT NOT NULL, chat_id TEXT NOT NULL, chat_type TEXT, user_id TEXT, username TEXT, first_name TEXT, message_text TEXT, message_type TEXT DEFAULT 'text', raw_data TEXT, created_at TEXT DEFAULT (datetime('now')))"
run_sql "CREATE TABLE IF NOT EXISTS member_events (id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT NOT NULL, group_id TEXT NOT NULL, user_id TEXT NOT NULL, username TEXT, first_name TEXT, event_type TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))"
run_sql "CREATE TABLE IF NOT EXISTS scheduled_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT NOT NULL, task_type TEXT NOT NULL, target_chat TEXT NOT NULL, content TEXT NOT NULL, repeat_mode TEXT DEFAULT 'once', next_run_at TEXT NOT NULL, last_run_at TEXT, enabled INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))"
run_sql "CREATE TABLE IF NOT EXISTS customer_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT NOT NULL, original_user_id TEXT NOT NULL, original_chat_id TEXT NOT NULL, forwarded_message_id TEXT, admin_chat_id TEXT, created_at TEXT DEFAULT (datetime('now')))"
run_sql "CREATE TABLE IF NOT EXISTS forward_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT NOT NULL, rule_id INTEGER NOT NULL, source_chat_id TEXT NOT NULL, source_message_id TEXT NOT NULL, target_chat TEXT NOT NULL, scheduled_at TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')))"

echo "All tables created. Creating indexes..."

run_sql "CREATE INDEX IF NOT EXISTS idx_message_logs_bot ON message_logs(bot_id)"
run_sql "CREATE INDEX IF NOT EXISTS idx_message_logs_chat ON message_logs(chat_id)"
run_sql "CREATE INDEX IF NOT EXISTS idx_message_logs_created ON message_logs(created_at)"
run_sql "CREATE INDEX IF NOT EXISTS idx_member_events_bot ON member_events(bot_id)"
run_sql "CREATE INDEX IF NOT EXISTS idx_forward_rules_bot ON forward_rules(bot_id)"
run_sql "CREATE INDEX IF NOT EXISTS idx_auto_replies_bot ON auto_replies(bot_id)"
run_sql "CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next ON scheduled_tasks(next_run_at)"
run_sql "CREATE INDEX IF NOT EXISTS idx_forward_queue_scheduled ON forward_queue(scheduled_at, status)"
run_sql "CREATE INDEX IF NOT EXISTS idx_customer_messages_bot ON customer_messages(bot_id, forwarded_message_id)"

echo "Database initialization complete!"
