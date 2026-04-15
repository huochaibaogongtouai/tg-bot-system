var st=`
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
`;function it(t=12){let n="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789",a="",e=new Uint8Array(t);crypto.getRandomValues(e);for(let r=0;r<t;r++)a+=n[e[r]%n.length];return a}async function C(t){let n=st.split(";").filter(e=>e.trim());for(let e of n)try{await t.prepare(e.trim()).run()}catch{}if(!await t.prepare("SELECT value FROM system_config WHERE key = 'admin_password'").first()){let e=it();await t.prepare("INSERT INTO system_config (key, value) VALUES ('admin_password', ?)").bind(e).run(),console.log(`[INIT] Default admin password generated: ${e}`)}}async function w(t,n){let a=await t.prepare("SELECT value FROM system_config WHERE key = ?").bind(n).first();return a?a.value:null}async function x(t,n,a){await t.prepare("INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')").bind(n,a,a).run()}function dt(){return crypto.randomUUID()+"-"+Date.now().toString(36)}async function P(t){let n=dt(),a=new Date(Date.now()+1440*60*1e3).toISOString();return await t.prepare("INSERT INTO sessions (session_id, expires_at) VALUES (?, ?)").bind(n,a).run(),n}async function ct(t,n){return n?!!await t.prepare("SELECT * FROM sessions WHERE session_id = ? AND expires_at > datetime('now')").bind(n).first():!1}async function H(t,n){n&&await t.prepare("DELETE FROM sessions WHERE session_id = ?").bind(n).run()}function N(t){let a=(t.headers.get("Cookie")||"").match(/session_id=([^;]+)/);return a?a[1]:null}function X(t){return`session_id=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`}function W(){return"session_id=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"}async function z(t,n){return await w(t,"admin_password")===n}async function G(t,n){let a=N(n);return await ct(t,a)}var lt="https://api.telegram.org/bot";async function f(t,n,a={}){let e=`${lt}${t}/${n}`;try{let i=await(await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)})).json();return i.ok||console.error(`[TG API Error] ${n}:`,i.description),i}catch(r){return console.error(`[TG API Exception] ${n}:`,r.message),{ok:!1,description:r.message}}}async function g(t,n,a,e={}){return f(t,"sendMessage",{chat_id:n,text:a,parse_mode:"HTML",...e})}async function j(t,n,a,e){return f(t,"forwardMessage",{chat_id:n,from_chat_id:a,message_id:e})}async function I(t,n,a,e){return f(t,"copyMessage",{chat_id:n,from_chat_id:a,message_id:e})}async function Y(t,n,a){return f(t,"deleteMessage",{chat_id:n,message_id:a})}async function pt(t,n,a,e={}){return f(t,"sendPhoto",{chat_id:n,photo:a,...e})}async function ut(t,n,a,e={}){return f(t,"sendVideo",{chat_id:n,video:a,...e})}async function mt(t,n,a,e={}){return f(t,"sendDocument",{chat_id:n,document:a,...e})}async function bt(t,n,a,e={}){return f(t,"sendAudio",{chat_id:n,audio:a,...e})}async function gt(t,n,a,e={}){return f(t,"sendVoice",{chat_id:n,voice:a,...e})}async function ft(t,n,a,e={}){return f(t,"sendSticker",{chat_id:n,sticker:a,...e})}async function ht(t,n,a,e={}){return f(t,"sendAnimation",{chat_id:n,animation:a,...e})}async function V(t,n,a){if(a.photo&&a.photo.length>0){let e=a.photo[a.photo.length-1];return pt(t,n,e.file_id,{caption:a.caption||"",parse_mode:"HTML"})}return a.video?ut(t,n,a.video.file_id,{caption:a.caption||"",parse_mode:"HTML"}):a.document?mt(t,n,a.document.file_id,{caption:a.caption||"",parse_mode:"HTML"}):a.audio?bt(t,n,a.audio.file_id,{caption:a.caption||"",parse_mode:"HTML"}):a.voice?gt(t,n,a.voice.file_id):a.sticker?ft(t,n,a.sticker.file_id):a.animation?ht(t,n,a.animation.file_id,{caption:a.caption||"",parse_mode:"HTML"}):a.text?g(t,n,a.text):null}async function K(t,n){return f(t,"setWebhook",{url:n,allowed_updates:["message","channel_post","chat_member","my_chat_member"]})}async function J(t){return f(t,"deleteWebhook",{drop_pending_updates:!1})}async function q(t){return f(t,"getMe")}async function k(t,n){return f(t,"setMyCommands",{commands:n})}function L(t){return t.text||t.caption||""}function tt(t){return t.text?"text":t.photo?"photo":t.video?"video":t.document?"document":t.audio?"audio":t.voice?"voice":t.sticker?"sticker":t.animation?"animation":t.poll?"poll":t.location?"location":t.contact?"contact":t.video_note?"video_note":"other"}async function et(t,n,a){let{bot_id:e,token:r,admin_chat_id:i}=n;try{if(a.channel_post){await Et(t,e,r,a.channel_post);return}if(a.message){let c=a.message;if(c.new_chat_members){await vt(t,e,r,c);return}if(c.left_chat_member){await _t(t,e,r,c);return}if(await wt(t,e,c),i&&c.reply_to_message&&String(c.chat.id)===String(i)){await It(t,e,r,c);return}if((c.chat.type==="group"||c.chat.type==="supergroup")&&await Tt(t,e,r,c))return;if(c.text&&c.text.startsWith("/")){await yt(t,e,r,c),c.text.startsWith("/start")&&c.chat.type==="private"&&await Q(t,e,r,c),c.chat.type==="private"&&i&&String(c.from.id)!==String(i)&&await Z(t,e,r,c,i);return}await Rt(t,e,r,c),c.chat.type==="private"&&i&&String(c.from.id)!==String(i)&&(await Q(t,e,r,c),await Z(t,e,r,c,i))}}catch(c){console.error(`[Webhook Error] bot=${e}:`,c.message)}}async function Et(t,n,a,e){let r=String(e.chat.id),i=L(e);await t.prepare("INSERT INTO message_logs (bot_id, chat_id, chat_type, user_id, username, message_text, message_type, created_at) VALUES (?, ?, 'channel', '', ?, ?, ?, datetime('now'))").bind(n,r,e.chat.title||"",i,tt(e)).run();let c=await t.prepare("SELECT * FROM forward_rules WHERE bot_id = ? AND enabled = 1 AND source_channel = ?").bind(n,r).all();if(!(!c.results||c.results.length===0))for(let u of c.results){if(u.skip_keywords&&u.skip_keywords.split(",").map(T=>T.trim()).filter(T=>T).some(T=>i.includes(T))){console.log(`[Forward] Skipped message due to keyword filter, rule=${u.id}`);continue}let b=u.target_chats.split(",").map(_=>_.trim()).filter(_=>_),m=u.delay_seconds||0,v=new Date(Date.now()+m*1e3).toISOString();for(let _ of b)await t.prepare("INSERT INTO forward_queue (bot_id, rule_id, source_chat_id, source_message_id, target_chat, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')").bind(n,u.id,r,String(e.message_id),_,v).run()}}async function vt(t,n,a,e){let r=String(e.chat.id);for(let i of e.new_chat_members){await t.prepare("INSERT INTO member_events (bot_id, group_id, user_id, username, first_name, event_type, created_at) VALUES (?, ?, ?, ?, ?, 'join', datetime('now'))").bind(n,r,String(i.id),i.username||"",i.first_name||"").run();let c=await t.prepare("SELECT * FROM group_configs WHERE bot_id = ? AND group_id = ? AND enabled = 1").bind(n,r).first();if(c&&c.welcome_message){let u=c.welcome_message.replace(/{name}/g,i.first_name||i.username||"\u65B0\u6210\u5458").replace(/{username}/g,i.username?`@${i.username}`:"").replace(/{group}/g,e.chat.title||"");await g(a,r,u)}}}async function _t(t,n,a,e){let r=String(e.chat.id),i=e.left_chat_member;await t.prepare("INSERT INTO member_events (bot_id, group_id, user_id, username, first_name, event_type, created_at) VALUES (?, ?, ?, ?, ?, 'leave', datetime('now'))").bind(n,r,String(i.id),i.username||"",i.first_name||"").run()}async function wt(t,n,a){let e=String(a.chat.id),r=a.chat.type,i=a.from?String(a.from.id):"",c=a.from&&a.from.username||"",u=a.from&&a.from.first_name||"",b=L(a),m=tt(a);await t.prepare("INSERT INTO message_logs (bot_id, chat_id, chat_type, user_id, username, first_name, message_text, message_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))").bind(n,e,r,i,c,u,b,m).run()}async function Tt(t,n,a,e){let r=String(e.chat.id),i=L(e).toLowerCase();if(!i)return!1;let c=await t.prepare("SELECT * FROM group_configs WHERE bot_id = ? AND group_id = ? AND enabled = 1").bind(n,r).first();if(!c||!c.banned_words)return!1;if(c.banned_words.split(",").map(m=>m.trim().toLowerCase()).filter(m=>m).find(m=>i.includes(m))){await Y(a,r,e.message_id);let m=e.from.first_name||e.from.username||"\u7528\u6237";return await g(a,r,`\u26A0\uFE0F <b>${m}</b> \u7684\u6D88\u606F\u5305\u542B\u8FDD\u7981\u5185\u5BB9\uFF0C\u5DF2\u81EA\u52A8\u62E6\u622A\u3002`),!0}return!1}async function yt(t,n,a,e){let r=e.text.trim(),i=String(e.chat.id),c=r.split(/\s+/);switch(c[0].split("@")[0].toLowerCase()){case"/start":let b=await w(t,`bot_${n}_start_reply`);b?await g(a,i,b):await g(a,i,`\u{1F44B} \u6B22\u8FCE\u4F7F\u7528\u672C\u673A\u5668\u4EBA\uFF01

\u53D1\u9001\u4EFB\u610F\u6D88\u606F\u5373\u53EF\u4E0E\u7BA1\u7406\u5458\u6C9F\u901A\u3002`);break;case"/help":let m=await w(t,`bot_${n}_help_reply`);m?await g(a,i,m):await g(a,i,`\u{1F4D6} <b>\u53EF\u7528\u6307\u4EE4</b>

/start - \u5F00\u59CB\u4F7F\u7528
/help - \u5E2E\u52A9\u4FE1\u606F
/id - \u83B7\u53D6\u5F53\u524D\u4F1A\u8BDDID`);break;case"/id":let v=e.from?e.from.id:"N/A";await g(a,i,`\u{1F4CB} <b>\u4F1A\u8BDD\u4FE1\u606F</b>

\u4F1A\u8BDDID: <code>${i}</code>
\u7528\u6237ID: <code>${v}</code>
\u7C7B\u578B: ${e.chat.type}`);break;case"/remind":await xt(t,n,a,e,c);break;default:break}}async function xt(t,n,a,e,r){let i=String(e.chat.id);if(r.length<3){await g(a,i,`\u26A0\uFE0F \u7528\u6CD5: /remind [\u5206\u949F\u6570] [\u63D0\u9192\u5185\u5BB9]
\u4F8B\u5982: /remind 30 \u5F00\u4F1A`);return}let c=parseInt(r[1]);if(isNaN(c)||c<1||c>10080){await g(a,i,"\u26A0\uFE0F \u5206\u949F\u6570\u5FC5\u987B\u5728 1-10080 \u4E4B\u95F4");return}let u=r.slice(2).join(" "),b=new Date(Date.now()+c*60*1e3).toISOString();await t.prepare("INSERT INTO scheduled_tasks (bot_id, task_type, target_chat, content, repeat_mode, next_run_at, enabled) VALUES (?, 'remind', ?, ?, 'once', ?, 1)").bind(n,i,u,b).run(),await g(a,i,`\u2705 \u63D0\u9192\u5DF2\u8BBE\u7F6E\uFF01\u5C06\u5728 ${c} \u5206\u949F\u540E\u63D0\u9192\u4F60\uFF1A
${u}`)}async function Rt(t,n,a,e){let r=L(e);if(!r)return;let i=String(e.chat.id),c=await t.prepare("SELECT * FROM auto_replies WHERE bot_id = ? AND enabled = 1").bind(n).all();if(!(!c.results||c.results.length===0))for(let u of c.results){let b=!1;if(u.match_mode==="exact"?b=r.trim()===u.keyword.trim():b=r.toLowerCase().includes(u.keyword.toLowerCase()),b){await g(a,i,u.reply_content,{reply_to_message_id:e.message_id});break}}}async function Q(t,n,a,e){let r=String(e.from.id),i=String(e.chat.id),c=await w(t,`bot_${n}_first_contact_reply`);if(!c)return;if(!await t.prepare("SELECT id FROM customer_messages WHERE bot_id = ? AND original_user_id = ? LIMIT 1").bind(n,r).first()){let b=e.from.first_name||e.from.username||"\u7528\u6237",m=c.replace(/{name}/g,b).replace(/{username}/g,e.from.username?`@${e.from.username}`:"");await g(a,i,m)}}async function Z(t,n,a,e,r){let i=await j(a,r,e.chat.id,e.message_id);i.ok&&await t.prepare("INSERT INTO customer_messages (bot_id, original_user_id, original_chat_id, forwarded_message_id, admin_chat_id) VALUES (?, ?, ?, ?, ?)").bind(n,String(e.from.id),String(e.chat.id),String(i.result.message_id),r).run()}async function It(t,n,a,e){let r=e.reply_to_message;if(!r)return;let i=await t.prepare("SELECT * FROM customer_messages WHERE bot_id = ? AND forwarded_message_id = ? ORDER BY created_at DESC LIMIT 1").bind(n,String(r.message_id)).first();i&&(await V(a,i.original_user_id,e)||await I(a,i.original_user_id,e.chat.id,e.message_id))}function p(t,n=200){return new Response(JSON.stringify(t),{status:n,headers:{"Content-Type":"application/json"}})}function at(t,n){return new Response(t,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${n}"`}})}async function ot(t,n,a){let e=a.pathname,r=n.method;try{if(e==="/api/config/password"&&r==="PUT"){let s=await n.json(),o=await w(t,"admin_password");return s.old_password!==o?p({error:"\u5F53\u524D\u5BC6\u7801\u9519\u8BEF"},400):!s.new_password||s.new_password.length<6?p({error:"\u65B0\u5BC6\u7801\u957F\u5EA6\u4E0D\u80FD\u5C11\u4E8E6\u4F4D"},400):(await x(t,"admin_password",s.new_password),p({success:!0,message:"\u5BC6\u7801\u4FEE\u6539\u6210\u529F"}))}if(e==="/api/config/default-password"&&r==="GET"){let s=await w(t,"admin_password");return p({password:s})}if(e==="/api/bots"&&r==="GET"){let s=await t.prepare("SELECT id, bot_id, name, token, status, webhook_url, admin_chat_id, created_at FROM bots ORDER BY created_at DESC").all();return p({bots:s.results||[]})}if(e==="/api/bots"&&r==="POST"){let s=await n.json();if(!s.name||!s.token)return p({error:"\u540D\u79F0\u548CToken\u4E0D\u80FD\u4E3A\u7A7A"},400);let o=await q(s.token);if(!o.ok)return p({error:"Bot Token \u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u540E\u91CD\u8BD5"},400);let l=String(o.result.id);if(await t.prepare("SELECT * FROM bots WHERE bot_id = ?").bind(l).first())return p({error:"\u8BE5\u673A\u5668\u4EBA\u5DF2\u5B58\u5728"},400);await t.prepare("INSERT INTO bots (bot_id, name, token, admin_chat_id) VALUES (?, ?, ?, ?)").bind(l,s.name,s.token,s.admin_chat_id||"").run();let E=`${a.origin}/webhook/${l}`,y=await K(s.token,E);return y.ok&&await t.prepare("UPDATE bots SET webhook_url = ? WHERE bot_id = ?").bind(E,l).run(),await k(s.token,[{command:"start",description:"\u5F00\u59CB\u4F7F\u7528 / \u542F\u52A8\u673A\u5668\u4EBA"},{command:"help",description:"\u5E2E\u52A9\u4FE1\u606F / \u529F\u80FD\u8BF4\u660E"},{command:"id",description:"\u83B7\u53D6\u5F53\u524D\u4F1A\u8BDDID"}]),p({success:!0,bot_id:l,bot_username:o.result.username,webhook_url:E,webhook_set:y.ok})}let i=e.match(/^\/api\/bots\/([^/]+)$/);if(i){let s=i[1];if(r==="GET"){let o=await t.prepare("SELECT * FROM bots WHERE bot_id = ?").bind(s).first();if(!o)return p({error:"\u673A\u5668\u4EBA\u4E0D\u5B58\u5728"},404);let l=await w(t,`bot_${s}_first_contact_reply`)||"",d=await w(t,`bot_${s}_start_reply`)||"",h=await w(t,`bot_${s}_help_reply`)||"";return p({bot:o,first_contact_reply:l,start_reply:d,help_reply:h})}if(r==="PUT"){let o=await n.json(),l=[],d=[];if(o.name!==void 0&&(l.push("name = ?"),d.push(o.name)),o.admin_chat_id!==void 0&&(l.push("admin_chat_id = ?"),d.push(o.admin_chat_id)),o.status!==void 0&&(l.push("status = ?"),d.push(o.status)),l.length>0&&(l.push("updated_at = datetime('now')"),d.push(s),await t.prepare(`UPDATE bots SET ${l.join(", ")} WHERE bot_id = ?`).bind(...d).run()),o.first_contact_reply!==void 0&&await x(t,`bot_${s}_first_contact_reply`,o.first_contact_reply),o.start_reply!==void 0&&await x(t,`bot_${s}_start_reply`,o.start_reply),o.help_reply!==void 0&&await x(t,`bot_${s}_help_reply`,o.help_reply),o.bot_commands!==void 0){let h=await t.prepare("SELECT token FROM bots WHERE bot_id = ?").bind(s).first();if(h)try{let E=JSON.parse(o.bot_commands);Array.isArray(E)&&E.length>0&&(await k(h.token,E),await x(t,`bot_${s}_commands`,o.bot_commands))}catch{}}return p({success:!0})}if(r==="DELETE"){let o=await t.prepare("SELECT * FROM bots WHERE bot_id = ?").bind(s).first();return o&&(await J(o.token),await t.prepare("DELETE FROM forward_rules WHERE bot_id = ?").bind(s).run(),await t.prepare("DELETE FROM auto_replies WHERE bot_id = ?").bind(s).run(),await t.prepare("DELETE FROM group_configs WHERE bot_id = ?").bind(s).run(),await t.prepare("DELETE FROM message_logs WHERE bot_id = ?").bind(s).run(),await t.prepare("DELETE FROM member_events WHERE bot_id = ?").bind(s).run(),await t.prepare("DELETE FROM scheduled_tasks WHERE bot_id = ?").bind(s).run(),await t.prepare("DELETE FROM customer_messages WHERE bot_id = ?").bind(s).run(),await t.prepare("DELETE FROM forward_queue WHERE bot_id = ?").bind(s).run(),await t.prepare("DELETE FROM system_config WHERE key LIKE ?").bind(`bot_${s}_%`).run(),await t.prepare("DELETE FROM bots WHERE bot_id = ?").bind(s).run()),p({success:!0})}}let c=e.match(/^\/api\/bots\/([^/]+)\/commands$/);if(c&&r==="PUT"){let s=c[1],o=await n.json(),l=await t.prepare("SELECT token FROM bots WHERE bot_id = ?").bind(s).first();if(!l)return p({error:"\u673A\u5668\u4EBA\u4E0D\u5B58\u5728"},404);let d=o.commands||[],h=await k(l.token,d);return h.ok?(await x(t,`bot_${s}_commands`,JSON.stringify(d)),p({success:!0,message:"\u547D\u4EE4\u83DC\u5355\u5DF2\u66F4\u65B0"})):p({error:"\u66F4\u65B0\u547D\u4EE4\u83DC\u5355\u5931\u8D25: "+(h.description||"")},400)}let u=e.match(/^\/api\/bots\/([^/]+)\/forward-rules$/);if(u){let s=u[1];if(r==="GET"){let o=await t.prepare("SELECT * FROM forward_rules WHERE bot_id = ? ORDER BY created_at DESC").bind(s).all();return p({rules:o.results||[]})}if(r==="POST"){let o=await n.json();return!o.source_channel||!o.target_chats?p({error:"\u6E90\u9891\u9053\u548C\u76EE\u6807\u7FA4\u4E0D\u80FD\u4E3A\u7A7A"},400):(await t.prepare("INSERT INTO forward_rules (bot_id, source_channel, target_chats, delay_seconds, skip_keywords, enabled) VALUES (?, ?, ?, ?, ?, ?)").bind(s,o.source_channel,o.target_chats,o.delay_seconds||5,o.skip_keywords||"",o.enabled!==void 0?o.enabled:1).run(),p({success:!0}))}}let b=e.match(/^\/api\/forward-rules\/(\d+)$/);if(b){let s=parseInt(b[1]);if(r==="PUT"){let o=await n.json(),l=[],d=[];return o.source_channel!==void 0&&(l.push("source_channel = ?"),d.push(o.source_channel)),o.target_chats!==void 0&&(l.push("target_chats = ?"),d.push(o.target_chats)),o.delay_seconds!==void 0&&(l.push("delay_seconds = ?"),d.push(o.delay_seconds)),o.skip_keywords!==void 0&&(l.push("skip_keywords = ?"),d.push(o.skip_keywords)),o.enabled!==void 0&&(l.push("enabled = ?"),d.push(o.enabled)),l.length>0&&(l.push("updated_at = datetime('now')"),d.push(s),await t.prepare(`UPDATE forward_rules SET ${l.join(", ")} WHERE id = ?`).bind(...d).run()),p({success:!0})}if(r==="DELETE")return await t.prepare("DELETE FROM forward_rules WHERE id = ?").bind(s).run(),p({success:!0})}let m=e.match(/^\/api\/bots\/([^/]+)\/auto-replies$/);if(m){let s=m[1];if(r==="GET"){let o=await t.prepare("SELECT * FROM auto_replies WHERE bot_id = ? ORDER BY created_at DESC").bind(s).all();return p({replies:o.results||[]})}if(r==="POST"){let o=await n.json();return!o.keyword||!o.reply_content?p({error:"\u5173\u952E\u8BCD\u548C\u56DE\u590D\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A"},400):(await t.prepare("INSERT INTO auto_replies (bot_id, keyword, reply_content, match_mode, enabled) VALUES (?, ?, ?, ?, ?)").bind(s,o.keyword,o.reply_content,o.match_mode||"fuzzy",o.enabled!==void 0?o.enabled:1).run(),p({success:!0}))}}let v=e.match(/^\/api\/auto-replies\/(\d+)$/);if(v){let s=parseInt(v[1]);if(r==="PUT"){let o=await n.json(),l=[],d=[];return o.keyword!==void 0&&(l.push("keyword = ?"),d.push(o.keyword)),o.reply_content!==void 0&&(l.push("reply_content = ?"),d.push(o.reply_content)),o.match_mode!==void 0&&(l.push("match_mode = ?"),d.push(o.match_mode)),o.enabled!==void 0&&(l.push("enabled = ?"),d.push(o.enabled)),l.length>0&&(d.push(s),await t.prepare(`UPDATE auto_replies SET ${l.join(", ")} WHERE id = ?`).bind(...d).run()),p({success:!0})}if(r==="DELETE")return await t.prepare("DELETE FROM auto_replies WHERE id = ?").bind(s).run(),p({success:!0})}let _=e.match(/^\/api\/bots\/([^/]+)\/group-configs$/);if(_){let s=_[1];if(r==="GET"){let o=await t.prepare("SELECT * FROM group_configs WHERE bot_id = ? ORDER BY created_at DESC").bind(s).all();return p({configs:o.results||[]})}if(r==="POST"){let o=await n.json();return o.group_id?(await t.prepare("INSERT INTO group_configs (bot_id, group_id, welcome_message, banned_words, enabled) VALUES (?, ?, ?, ?, ?) ON CONFLICT(bot_id, group_id) DO UPDATE SET welcome_message = ?, banned_words = ?, enabled = ?, updated_at = datetime('now')").bind(s,o.group_id,o.welcome_message||"",o.banned_words||"",o.enabled!==void 0?o.enabled:1,o.welcome_message||"",o.banned_words||"",o.enabled!==void 0?o.enabled:1).run(),p({success:!0})):p({error:"\u7FA4ID\u4E0D\u80FD\u4E3A\u7A7A"},400)}}let R=e.match(/^\/api\/group-configs\/(\d+)$/);if(R){let s=parseInt(R[1]);if(r==="PUT"){let o=await n.json(),l=[],d=[];return o.welcome_message!==void 0&&(l.push("welcome_message = ?"),d.push(o.welcome_message)),o.banned_words!==void 0&&(l.push("banned_words = ?"),d.push(o.banned_words)),o.enabled!==void 0&&(l.push("enabled = ?"),d.push(o.enabled)),l.length>0&&(l.push("updated_at = datetime('now')"),d.push(s),await t.prepare(`UPDATE group_configs SET ${l.join(", ")} WHERE id = ?`).bind(...d).run()),p({success:!0})}if(r==="DELETE")return await t.prepare("DELETE FROM group_configs WHERE id = ?").bind(s).run(),p({success:!0})}let T=e.match(/^\/api\/bots\/([^/]+)\/tasks$/);if(T){let s=T[1];if(r==="GET"){let o=await t.prepare("SELECT * FROM scheduled_tasks WHERE bot_id = ? ORDER BY created_at DESC").bind(s).all();return p({tasks:o.results||[]})}if(r==="POST"){let o=await n.json();return!o.target_chat||!o.content?p({error:"\u76EE\u6807\u548C\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A"},400):o.next_run_at?(await t.prepare("INSERT INTO scheduled_tasks (bot_id, task_type, target_chat, content, repeat_mode, next_run_at, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(s,o.task_type||"send",o.target_chat,o.content,o.repeat_mode||"once",o.next_run_at,o.enabled!==void 0?o.enabled:1).run(),p({success:!0})):p({error:"\u6267\u884C\u65F6\u95F4\u4E0D\u80FD\u4E3A\u7A7A"},400)}}let D=e.match(/^\/api\/tasks\/(\d+)$/);if(D){let s=parseInt(D[1]);if(r==="PUT"){let o=await n.json(),l=[],d=[];return o.target_chat!==void 0&&(l.push("target_chat = ?"),d.push(o.target_chat)),o.content!==void 0&&(l.push("content = ?"),d.push(o.content)),o.repeat_mode!==void 0&&(l.push("repeat_mode = ?"),d.push(o.repeat_mode)),o.next_run_at!==void 0&&(l.push("next_run_at = ?"),d.push(o.next_run_at)),o.enabled!==void 0&&(l.push("enabled = ?"),d.push(o.enabled)),l.length>0&&(d.push(s),await t.prepare(`UPDATE scheduled_tasks SET ${l.join(", ")} WHERE id = ?`).bind(...d).run()),p({success:!0})}if(r==="DELETE")return await t.prepare("DELETE FROM scheduled_tasks WHERE id = ?").bind(s).run(),p({success:!0})}let M=e.match(/^\/api\/bots\/([^/]+)\/logs$/);if(M){let s=M[1],o=a.searchParams,l=parseInt(o.get("page")||"1"),d=Math.min(parseInt(o.get("limit")||"50"),200),h=(l-1)*d,E=await t.prepare("SELECT COUNT(*) as total FROM message_logs WHERE bot_id = ?").bind(s).first(),y=await t.prepare("SELECT * FROM message_logs WHERE bot_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(s,d,h).all();return p({logs:y.results||[],total:E.total,page:l,limit:d})}let O=e.match(/^\/api\/bots\/([^/]+)\/logs\/export$/);if(O){let s=O[1],o=await t.prepare("SELECT * FROM message_logs WHERE bot_id = ? ORDER BY created_at DESC").bind(s).all(),l=`\uFEFFID,\u673A\u5668\u4EBAID,\u4F1A\u8BDDID,\u4F1A\u8BDD\u7C7B\u578B,\u7528\u6237ID,\u7528\u6237\u540D,\u59D3\u540D,\u6D88\u606F\u5185\u5BB9,\u6D88\u606F\u7C7B\u578B,\u65F6\u95F4
`;for(let d of o.results||[])l+=`${d.id},"${d.bot_id}","${d.chat_id}","${d.chat_type||""}","${d.user_id||""}","${d.username||""}","${d.first_name||""}","${(d.message_text||"").replace(/"/g,'""')}","${d.message_type}","${d.created_at}"
`;return at(l,`messages_${s}_${Date.now()}.csv`)}let A=e.match(/^\/api\/bots\/([^/]+)\/events$/);if(A){let s=A[1],o=a.searchParams,l=parseInt(o.get("page")||"1"),d=Math.min(parseInt(o.get("limit")||"50"),200),h=(l-1)*d,E=await t.prepare("SELECT COUNT(*) as total FROM member_events WHERE bot_id = ?").bind(s).first(),y=await t.prepare("SELECT * FROM member_events WHERE bot_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(s,d,h).all();return p({events:y.results||[],total:E.total,page:l,limit:d})}let B=e.match(/^\/api\/bots\/([^/]+)\/events\/export$/);if(B){let s=B[1],o=await t.prepare("SELECT * FROM member_events WHERE bot_id = ? ORDER BY created_at DESC").bind(s).all(),l=`\uFEFFID,\u673A\u5668\u4EBAID,\u7FA4ID,\u7528\u6237ID,\u7528\u6237\u540D,\u59D3\u540D,\u4E8B\u4EF6\u7C7B\u578B,\u65F6\u95F4
`;for(let d of o.results||[])l+=`${d.id},"${d.bot_id}","${d.group_id}","${d.user_id}","${d.username||""}","${d.first_name||""}","${d.event_type}","${d.created_at}"
`;return at(l,`events_${s}_${Date.now()}.csv`)}let U=e.match(/^\/api\/bots\/([^/]+)\/logs\/clear$/);if(U&&r==="DELETE"){let s=U[1];return await t.prepare("DELETE FROM message_logs WHERE bot_id = ?").bind(s).run(),p({success:!0})}let F=e.match(/^\/api\/bots\/([^/]+)\/events\/clear$/);if(F&&r==="DELETE"){let s=F[1];return await t.prepare("DELETE FROM member_events WHERE bot_id = ?").bind(s).run(),p({success:!0})}let $=e.match(/^\/api\/bots\/([^/]+)\/stats$/);if($){let s=$[1],o=await t.prepare("SELECT COUNT(*) as c FROM message_logs WHERE bot_id = ?").bind(s).first(),l=await t.prepare("SELECT COUNT(*) as c FROM member_events WHERE bot_id = ? AND event_type = 'join'").bind(s).first(),d=await t.prepare("SELECT COUNT(*) as c FROM member_events WHERE bot_id = ? AND event_type = 'leave'").bind(s).first(),h=await t.prepare("SELECT COUNT(*) as c FROM forward_rules WHERE bot_id = ?").bind(s).first(),E=await t.prepare("SELECT COUNT(*) as c FROM auto_replies WHERE bot_id = ?").bind(s).first(),y=await t.prepare("SELECT COUNT(*) as c FROM scheduled_tasks WHERE bot_id = ? AND enabled = 1").bind(s).first();return p({messages:o.c,joins:l.c,leaves:d.c,forward_rules:h.c,auto_replies:E.c,active_tasks:y.c})}if(e==="/api/stats"&&r==="GET"){let s=await t.prepare("SELECT COUNT(*) as c FROM bots").first(),o=await t.prepare("SELECT COUNT(*) as c FROM message_logs").first(),l=await t.prepare("SELECT COUNT(*) as c FROM scheduled_tasks WHERE enabled = 1").first();return p({bots:s.c,messages:o.c,active_tasks:l.c})}return p({error:"API \u63A5\u53E3\u4E0D\u5B58\u5728"},404)}catch(i){return console.error("[API Error]",i.message),p({error:"\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF: "+i.message},500)}}async function nt(t){let n=new Date().toISOString();try{await kt(t,n),await Lt(t,n),await t.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(n).run()}catch(a){console.error("[Cron Error]",a.message)}}async function kt(t,n){let a=await t.prepare("SELECT fq.*, b.token FROM forward_queue fq JOIN bots b ON fq.bot_id = b.bot_id WHERE fq.status = 'pending' AND fq.scheduled_at <= ? LIMIT 20").bind(n).all();if(!a.results||a.results.length===0)return;for(let r of a.results)try{let i=await I(r.token,r.target_chat,r.source_chat_id,r.source_message_id);i.ok?await t.prepare("UPDATE forward_queue SET status = 'sent' WHERE id = ?").bind(r.id).run():(await t.prepare("UPDATE forward_queue SET status = 'failed' WHERE id = ?").bind(r.id).run(),console.error(`[Forward Queue] Failed to forward message ${r.id}:`,i.description))}catch(i){await t.prepare("UPDATE forward_queue SET status = 'failed' WHERE id = ?").bind(r.id).run(),console.error(`[Forward Queue] Error processing ${r.id}:`,i.message)}let e=new Date(Date.now()-10080*60*1e3).toISOString();await t.prepare("DELETE FROM forward_queue WHERE status IN ('sent', 'failed') AND created_at < ?").bind(e).run()}async function Lt(t,n){let a=await t.prepare("SELECT st.*, b.token FROM scheduled_tasks st JOIN bots b ON st.bot_id = b.bot_id WHERE st.enabled = 1 AND st.next_run_at <= ? LIMIT 20").bind(n).all();if(!(!a.results||a.results.length===0))for(let e of a.results)try{if(e.task_type==="send"||e.task_type==="remind"){let i=e.content;e.task_type==="remind"&&(i=`\u23F0 <b>\u63D0\u9192</b>

${e.content}`),await g(e.token,e.target_chat,i)}let r=n;if(e.repeat_mode==="once")await t.prepare("UPDATE scheduled_tasks SET enabled = 0, last_run_at = ? WHERE id = ?").bind(r,e.id).run();else if(e.repeat_mode==="hourly"){let i=new Date(new Date(e.next_run_at).getTime()+36e5).toISOString();await t.prepare("UPDATE scheduled_tasks SET next_run_at = ?, last_run_at = ? WHERE id = ?").bind(i,r,e.id).run()}else if(e.repeat_mode==="daily"){let i=new Date(new Date(e.next_run_at).getTime()+864e5).toISOString();await t.prepare("UPDATE scheduled_tasks SET next_run_at = ?, last_run_at = ? WHERE id = ?").bind(i,r,e.id).run()}}catch(r){console.error(`[Scheduled Task] Error processing task ${e.id}:`,r.message)}}function S(t=""){return`<!DOCTYPE html>
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
  ${t?`<div class="error">${t}</div>`:""}
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
</html>`}function rt(){return`<!DOCTYPE html>
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
.btn-warning{background:rgba(255,167,38,0.15);color:var(--warning);border:1px solid rgba(255,167,38,0.2)}
.btn-warning:hover{background:rgba(255,167,38,0.25)}

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
.badge-photo{background:rgba(33,150,243,0.15);color:#2196f3}
.badge-video{background:rgba(156,39,176,0.15);color:#9c27b0}
.badge-document{background:rgba(255,152,0,0.15);color:#ff9800}

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
.tabs{display:flex;gap:4px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:0;flex-wrap:wrap}
.tab{padding:10px 20px;cursor:pointer;font-size:14px;color:var(--text2);border-bottom:2px solid transparent;transition:all .2s;margin-bottom:-1px}
.tab:hover{color:var(--text)}
.tab.active{color:var(--primary);border-bottom-color:var(--primary);font-weight:600}
.tab-content{display:none}
.tab-content.active{display:block}

/* Empty state */
.empty{text-align:center;padding:48px 20px;color:var(--text2)}
.empty .icon{font-size:48px;margin-bottom:12px}
.empty p{font-size:14px}

/* Command row */
.cmd-row{display:flex;gap:8px;margin-bottom:8px;align-items:center}
.cmd-row input{flex:1;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px}
.cmd-row button{padding:8px 12px;border-radius:6px;border:1px solid rgba(255,82,82,0.3);background:rgba(255,82,82,0.1);color:var(--danger);cursor:pointer;font-size:12px}

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

/* Info box */
.info-box{background:rgba(108,99,255,0.08);border:1px solid rgba(108,99,255,0.2);border-radius:8px;padding:14px 16px;margin-bottom:16px;font-size:13px;color:var(--text2);line-height:1.6}
.info-box strong{color:var(--text)}
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
        <div class="tab" onclick="switchTab(this,'tab-customer')">\u{1F3A7} \u5BA2\u670D\u8BBE\u7F6E</div>
        <div class="tab" onclick="switchTab(this,'tab-menu')">\u{1F4CB} \u547D\u4EE4\u83DC\u5355</div>
        <div class="tab" onclick="switchTab(this,'tab-group')">\u{1F465} \u7FA4\u7BA1\u63A7</div>
        <div class="tab" onclick="switchTab(this,'tab-tasks')">\u23F0 \u5B9A\u65F6\u4EFB\u52A1</div>
        <div class="tab" onclick="switchTab(this,'tab-logs')">\u{1F4DD} \u6D88\u606F\u65E5\u5FD7</div>
        <div class="tab" onclick="switchTab(this,'tab-events')">\u{1F6AA} \u6210\u5458\u53D8\u52A8</div>
      </div>

      <div id="tab-forward" class="tab-content active"></div>
      <div id="tab-reply" class="tab-content"></div>
      <div id="tab-customer" class="tab-content"></div>
      <div id="tab-menu" class="tab-content"></div>
      <div id="tab-group" class="tab-content"></div>
      <div id="tab-tasks" class="tab-content"></div>
      <div id="tab-logs" class="tab-content"></div>
      <div id="tab-events" class="tab-content"></div>
    \`;

    // Store bot data for customer/menu tabs
    window._currentBotData = botData;

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

  switch(tabId) {
    case 'tab-forward': loadForwardRules(); break;
    case 'tab-reply': loadAutoReplies(); break;
    case 'tab-customer': loadCustomerSettings(); break;
    case 'tab-menu': loadMenuSettings(); break;
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

// ===== Customer Service Settings (\u9996\u6B21\u5BA2\u6237\u81EA\u52A8\u56DE\u590D + /start /help \u81EA\u5B9A\u4E49) =====
async function loadCustomerSettings() {
  const container = document.getElementById('tab-customer');
  try {
    const botData = window._currentBotData || await api('/api/bots/' + currentBotId);

    container.innerHTML = \`
      <div class="card">
        <div class="card-header"><h3>\u{1F3A7} \u5BA2\u670D\u81EA\u52A8\u56DE\u590D\u8BBE\u7F6E</h3></div>
        <div class="info-box">
          <strong>\u529F\u80FD\u8BF4\u660E\uFF1A</strong><br>
          1. <strong>\u9996\u6B21\u8054\u7CFB\u81EA\u52A8\u56DE\u590D</strong>\uFF1A\u7528\u6237\u9996\u6B21\u79C1\u804A\u673A\u5668\u4EBA\u65F6\uFF0C\u81EA\u52A8\u53D1\u9001\u4E00\u6761\u6B22\u8FCE/\u5F15\u5BFC\u6D88\u606F\uFF08\u4EC5\u9996\u6B21\u89E6\u53D1\uFF09<br>
          2. <strong>/start \u56DE\u590D</strong>\uFF1A\u7528\u6237\u53D1\u9001 /start \u6307\u4EE4\u65F6\u7684\u81EA\u5B9A\u4E49\u56DE\u590D\u5185\u5BB9<br>
          3. <strong>/help \u56DE\u590D</strong>\uFF1A\u7528\u6237\u53D1\u9001 /help \u6307\u4EE4\u65F6\u7684\u81EA\u5B9A\u4E49\u5E2E\u52A9\u5185\u5BB9<br>
          4. <strong>\u591A\u5A92\u4F53\u652F\u6301</strong>\uFF1A\u7BA1\u7406\u5458\u56DE\u590D\u5BA2\u6237\u6D88\u606F\u65F6\uFF0C\u652F\u6301\u53D1\u9001\u56FE\u7247\u3001\u89C6\u9891\u3001\u6587\u4EF6\u3001\u8BED\u97F3\u3001\u8D34\u7EB8\u7B49\u6240\u6709\u6D88\u606F\u7C7B\u578B<br>
          \u652F\u6301\u53D8\u91CF\uFF1A<code>{name}</code> \u7528\u6237\u59D3\u540D\u3001<code>{username}</code> \u7528\u6237\u540D
        </div>

        <div class="form-group">
          <label>\u{1F4E9} \u9996\u6B21\u8054\u7CFB\u81EA\u52A8\u56DE\u590D</label>
          <textarea id="firstContactReply" rows="4" placeholder="\u7528\u6237\u9996\u6B21\u79C1\u804A\u673A\u5668\u4EBA\u65F6\u81EA\u52A8\u53D1\u9001\u7684\u6D88\u606F\uFF0C\u7559\u7A7A\u5219\u4E0D\u53D1\u9001">\${esc(botData.first_contact_reply || '')}</textarea>
          <div class="form-hint">\u4EC5\u5728\u7528\u6237\u9996\u6B21\u8054\u7CFB\u65F6\u89E6\u53D1\u4E00\u6B21\uFF0C\u652F\u6301 HTML \u683C\u5F0F\u548C\u53D8\u91CF\u66FF\u6362</div>
        </div>

        <div class="form-group">
          <label>\u{1F44B} /start \u6307\u4EE4\u56DE\u590D</label>
          <textarea id="startReply" rows="3" placeholder="\u81EA\u5B9A\u4E49 /start \u6307\u4EE4\u7684\u56DE\u590D\u5185\u5BB9\uFF0C\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4">\${esc(botData.start_reply || '')}</textarea>
          <div class="form-hint">\u7559\u7A7A\u5C06\u4F7F\u7528\u9ED8\u8BA4\u6B22\u8FCE\u8BED</div>
        </div>

        <div class="form-group">
          <label>\u{1F4D6} /help \u6307\u4EE4\u56DE\u590D</label>
          <textarea id="helpReply" rows="3" placeholder="\u81EA\u5B9A\u4E49 /help \u6307\u4EE4\u7684\u56DE\u590D\u5185\u5BB9\uFF0C\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4">\${esc(botData.help_reply || '')}</textarea>
          <div class="form-hint">\u7559\u7A7A\u5C06\u4F7F\u7528\u9ED8\u8BA4\u5E2E\u52A9\u4FE1\u606F</div>
        </div>

        <button class="btn btn-primary" onclick="saveCustomerSettings()">\u4FDD\u5B58\u5BA2\u670D\u8BBE\u7F6E</button>
      </div>

      <div class="card">
        <div class="card-header"><h3>\u{1F4A1} \u5BA2\u670D\u56DE\u590D\u4F7F\u7528\u8BF4\u660E</h3></div>
        <div style="color:var(--text2);font-size:14px;line-height:2">
          <p>1. \u5728\u300C\u57FA\u672C\u914D\u7F6E\u300D\u4E2D\u8BBE\u7F6E<strong>\u7BA1\u7406\u5458 Chat ID</strong></p>
          <p>2. \u7528\u6237\u79C1\u804A\u673A\u5668\u4EBA\u53D1\u9001\u7684\u6240\u6709\u6D88\u606F\uFF08\u6587\u5B57\u3001\u56FE\u7247\u3001\u89C6\u9891\u3001\u6587\u4EF6\u7B49\uFF09\u90FD\u4F1A\u81EA\u52A8\u8F6C\u53D1\u7ED9\u7BA1\u7406\u5458</p>
          <p>3. \u7BA1\u7406\u5458\u76F4\u63A5<strong>\u56DE\u590D</strong>\u8F6C\u53D1\u7684\u6D88\u606F\uFF0C\u673A\u5668\u4EBA\u4F1A\u81EA\u52A8\u5C06\u56DE\u590D\u5185\u5BB9\u53D1\u9001\u7ED9\u5BF9\u5E94\u7528\u6237</p>
          <p>4. \u7BA1\u7406\u5458\u56DE\u590D\u65F6\u652F\u6301\u53D1\u9001<strong>\u6587\u5B57\u3001\u56FE\u7247\u3001\u89C6\u9891\u3001\u6587\u4EF6\u3001\u8BED\u97F3\u3001\u8D34\u7EB8\u3001GIF</strong>\u7B49\u6240\u6709\u6D88\u606F\u7C7B\u578B</p>
          <p>5. \u83B7\u53D6\u7BA1\u7406\u5458 Chat ID\uFF1A\u5411\u673A\u5668\u4EBA\u53D1\u9001 <code>/id</code> \u6307\u4EE4\u5373\u53EF\u83B7\u53D6</p>
        </div>
      </div>
    \`;
  } catch(e) {
    container.innerHTML = '<div class="card"><p>\u52A0\u8F7D\u5931\u8D25: ' + e.message + '</p></div>';
  }
}

async function saveCustomerSettings() {
  try {
    await api('/api/bots/' + currentBotId, 'PUT', {
      first_contact_reply: document.getElementById('firstContactReply').value,
      start_reply: document.getElementById('startReply').value,
      help_reply: document.getElementById('helpReply').value,
    });
    // Update cached data
    if (window._currentBotData) {
      window._currentBotData.first_contact_reply = document.getElementById('firstContactReply').value;
      window._currentBotData.start_reply = document.getElementById('startReply').value;
      window._currentBotData.help_reply = document.getElementById('helpReply').value;
    }
    toast('\u5BA2\u670D\u8BBE\u7F6E\u5DF2\u4FDD\u5B58');
  } catch(e) {
    toast(e.message, 'error');
  }
}

// ===== Bot Menu Commands =====
let menuCommands = [];

async function loadMenuSettings() {
  const container = document.getElementById('tab-menu');
  try {
    // Load saved commands
    const botData = window._currentBotData || await api('/api/bots/' + currentBotId);
    
    // Default commands
    menuCommands = [
      { command: 'start', description: '\u5F00\u59CB\u4F7F\u7528 / \u542F\u52A8\u673A\u5668\u4EBA' },
      { command: 'help', description: '\u5E2E\u52A9\u4FE1\u606F / \u529F\u80FD\u8BF4\u660E' },
      { command: 'id', description: '\u83B7\u53D6\u5F53\u524D\u4F1A\u8BDDID' },
    ];

    container.innerHTML = \`
      <div class="card">
        <div class="card-header"><h3>\u{1F4CB} \u673A\u5668\u4EBA\u547D\u4EE4\u83DC\u5355</h3></div>
        <div class="info-box">
          <strong>\u529F\u80FD\u8BF4\u660E\uFF1A</strong>\u8BBE\u7F6E\u673A\u5668\u4EBA\u5728 Telegram \u5BF9\u8BDD\u6846\u4E2D\u663E\u793A\u7684\u547D\u4EE4\u83DC\u5355\uFF08\u70B9\u51FB\u8F93\u5165\u6846\u5DE6\u4FA7 "/" \u6309\u94AE\u53EF\u67E5\u770B\uFF09\u3002<br>
          \u4FEE\u6539\u540E\u5C06\u5B9E\u65F6\u540C\u6B65\u5230 Telegram\uFF0C\u7528\u6237\u53EF\u4EE5\u76F4\u63A5\u70B9\u51FB\u83DC\u5355\u4E2D\u7684\u547D\u4EE4\u4F7F\u7528\u3002
        </div>

        <div id="commandsList"></div>

        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="btn btn-outline" onclick="addCommandRow()">+ \u6DFB\u52A0\u547D\u4EE4</button>
          <button class="btn btn-primary" onclick="saveMenuCommands()">\u4FDD\u5B58\u5E76\u540C\u6B65\u5230 Telegram</button>
        </div>
      </div>
    \`;

    renderCommandRows();
  } catch(e) {
    container.innerHTML = '<div class="card"><p>\u52A0\u8F7D\u5931\u8D25: ' + e.message + '</p></div>';
  }
}

function renderCommandRows() {
  const list = document.getElementById('commandsList');
  if (!list) return;
  list.innerHTML = menuCommands.map((cmd, i) => \`
    <div class="cmd-row">
      <input type="text" placeholder="\u547D\u4EE4\uFF08\u4E0D\u542B/\uFF09" value="\${esc(cmd.command)}" onchange="menuCommands[\${i}].command=this.value.replace('/','')">
      <input type="text" placeholder="\u547D\u4EE4\u63CF\u8FF0" value="\${esc(cmd.description)}" onchange="menuCommands[\${i}].description=this.value">
      <button onclick="removeCommandRow(\${i})">\u2715</button>
    </div>
  \`).join('');
}

function addCommandRow() {
  menuCommands.push({ command: '', description: '' });
  renderCommandRows();
}

function removeCommandRow(index) {
  menuCommands.splice(index, 1);
  renderCommandRows();
}

async function saveMenuCommands() {
  const validCommands = menuCommands.filter(c => c.command.trim() && c.description.trim());
  if (validCommands.length === 0) {
    toast('\u8BF7\u81F3\u5C11\u6DFB\u52A0\u4E00\u6761\u547D\u4EE4', 'error');
    return;
  }

  try {
    await api('/api/bots/' + currentBotId + '/commands', 'PUT', {
      commands: validCommands.map(c => ({
        command: c.command.trim().toLowerCase().replace(/^//, ''),
        description: c.description.trim(),
      })),
    });
    toast('\u547D\u4EE4\u83DC\u5355\u5DF2\u540C\u6B65\u5230 Telegram');
  } catch(e) {
    toast(e.message, 'error');
  }
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
        '<div class="table-wrap"><table><thead><tr><th>\u65F6\u95F4</th><th>\u6D88\u606F\u7C7B\u578B</th><th>\u4F1A\u8BDD\u7C7B\u578B</th><th>\u7528\u6237</th><th>\u5185\u5BB9</th></tr></thead><tbody>' +
        logs.map(l => '<tr><td style="white-space:nowrap">' + formatDate(l.created_at) + '</td><td>' + getMsgTypeBadge(l.message_type) + '</td><td>' + esc(l.chat_type || '') + '</td><td>' + (l.first_name ? esc(l.first_name) : '') + (l.username ? ' @' + esc(l.username) : '') + '</td><td>' + esc(l.message_text || '').substring(0,80) + '</td></tr>').join('') +
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

function getMsgTypeBadge(type) {
  const map = {
    'text': ['\u6587\u5B57', 'active'],
    'photo': ['\u56FE\u7247', 'photo'],
    'video': ['\u89C6\u9891', 'video'],
    'document': ['\u6587\u4EF6', 'document'],
    'audio': ['\u97F3\u9891', 'fuzzy'],
    'voice': ['\u8BED\u97F3', 'fuzzy'],
    'sticker': ['\u8D34\u7EB8', 'exact'],
    'animation': ['GIF', 'exact'],
  };
  const m = map[type] || [type || '\u672A\u77E5', 'inactive'];
  return '<span class="badge badge-' + m[1] + '">' + m[0] + '</span>';
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
        \u7248\u672C\uFF1A1.1.0<br>
        \u67B6\u6784\uFF1A\u591A\u673A\u5668\u4EBA\u96C6\u7FA4\u7BA1\u7406<br>
        \u66F4\u65B0\uFF1A\u652F\u6301\u591A\u5A92\u4F53\u5BA2\u670D\u56DE\u590D\u3001\u9996\u6B21\u8054\u7CFB\u81EA\u52A8\u56DE\u590D\u3001\u547D\u4EE4\u83DC\u5355\u7BA1\u7406
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
</script>
</body>
</html>`}var qt={async fetch(t,n,a){let e=n.DB,r=new URL(t.url),i=r.pathname,c=t.method;await C(e);let u=i.match(/^\/webhook\/(.+)$/);if(u&&c==="POST"){let m=u[1];try{let v=await e.prepare("SELECT * FROM bots WHERE bot_id = ? AND status = 'active'").bind(m).first();if(!v)return new Response(JSON.stringify({error:"Bot not found"}),{status:404,headers:{"Content-Type":"application/json"}});let _=await t.json();return a.waitUntil(et(e,v,_)),new Response("OK",{status:200})}catch(v){return console.error("[Webhook Route Error]",v.message),new Response("OK",{status:200})}}if(i==="/health")return new Response(JSON.stringify({status:"ok",time:new Date().toISOString()}),{headers:{"Content-Type":"application/json"}});if(i==="/login"&&c==="GET")return new Response(S(),{headers:{"Content-Type":"text/html; charset=utf-8"}});if(i==="/login"&&c==="POST")try{let v=(await t.formData()).get("password");if(!await z(e,v))return new Response(S("\u5BC6\u7801\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5"),{headers:{"Content-Type":"text/html; charset=utf-8"}});let R=await P(e);return new Response(null,{status:302,headers:{Location:"/","Set-Cookie":X(R)}})}catch(m){return new Response(S("\u767B\u5F55\u5931\u8D25: "+m.message),{headers:{"Content-Type":"text/html; charset=utf-8"}})}if(i==="/logout"){let m=N(t);return await H(e,m),new Response(null,{status:302,headers:{Location:"/login","Set-Cookie":W()}})}let b=await G(e,t);return i.startsWith("/api/")?b?ot(e,t,r):new Response(JSON.stringify({error:"\u672A\u6388\u6743\uFF0C\u8BF7\u5148\u767B\u5F55"}),{status:401,headers:{"Content-Type":"application/json"}}):i==="/"||i==="/dashboard"?b?new Response(rt(),{headers:{"Content-Type":"text/html; charset=utf-8"}}):new Response(null,{status:302,headers:{Location:"/login"}}):i==="/favicon.ico"?new Response(null,{status:204}):new Response("Not Found",{status:404})},async scheduled(t,n,a){let e=n.DB;await C(e),a.waitUntil(nt(e))}};export{qt as default};
