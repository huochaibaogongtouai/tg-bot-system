// ============================================
// 后台管理面板 - 主页面（SPA 架构）
// ============================================

export function dashboardPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TG Bot 管理系统</title>
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
      <h2>🤖 TG Bot 管理</h2>
      <p>多机器人集群管理平台</p>
    </div>
    <div class="sidebar-nav" id="sidebarNav">
      <div class="nav-item active" data-page="dashboard" onclick="navigate('dashboard')">📊 控制台</div>
      <div class="nav-item" data-page="bots" onclick="navigate('bots')">🤖 机器人管理</div>
      <div class="nav-section">系统</div>
      <div class="nav-item" data-page="settings" onclick="navigate('settings')">⚙️ 系统设置</div>
    </div>
    <div class="sidebar-footer">
      <button onclick="logout()">🚪 退出登录</button>
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
  if (!res.ok) throw new Error(data.error || '请求失败');
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
        <h1>📊 控制台</h1>
        <p>系统概览与快速操作</p>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="number">\${stats.bots || 0}</div>
          <div class="label">接入机器人</div>
        </div>
        <div class="stat-card">
          <div class="number">\${stats.messages || 0}</div>
          <div class="label">消息总量</div>
        </div>
        <div class="stat-card">
          <div class="number">\${stats.active_tasks || 0}</div>
          <div class="label">活跃任务</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>🤖 机器人列表</h3>
          <button class="btn btn-primary" onclick="showAddBotModal()">+ 新增机器人</button>
        </div>
        \${bots.length === 0 ? '<div class="empty"><div class="icon">🤖</div><p>暂无机器人，点击上方按钮添加</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>名称</th><th>Bot ID</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>' +
        bots.map(b => '<tr><td><strong>' + esc(b.name) + '</strong></td><td><code>' + b.bot_id + '</code></td><td><span class="badge badge-' + (b.status === 'active' ? 'active' : 'inactive') + '">' + (b.status === 'active' ? '运行中' : '已停用') + '</span></td><td>' + formatDate(b.created_at) + '</td><td><button class="btn btn-sm btn-primary" onclick="enterBot(\\'' + b.bot_id + '\\',\\'' + esc(b.name) + '\\')">配置</button> <button class="btn btn-sm btn-danger" onclick="deleteBot(\\'' + b.bot_id + '\\',\\'' + esc(b.name) + '\\')">删除</button></td></tr>').join('') +
        '</tbody></table></div>'}
      </div>
    \`;
  } catch(e) {
    document.getElementById('mainContent').innerHTML = '<div class="card"><p>加载失败: ' + e.message + '</p></div>';
  }
}

// ===== Bots Management =====
async function renderBots() {
  await renderDashboard();
}

function showAddBotModal() {
  openModal(\`
    <h3>🤖 新增机器人</h3>
    <div class="form-group">
      <label>机器人名称</label>
      <input type="text" id="botName" placeholder="例如：客服机器人">
    </div>
    <div class="form-group">
      <label>Bot Token</label>
      <input type="text" id="botToken" placeholder="从 @BotFather 获取的 Token">
      <div class="form-hint">格式如：123456789:ABCdefGHIjklMNOpqrsTUVwxyz</div>
    </div>
    <div class="form-group">
      <label>管理员 Chat ID（可选）</label>
      <input type="text" id="botAdminChatId" placeholder="用于接收客服消息转发">
      <div class="form-hint">管理员的 Telegram 用户 ID，用于私聊客服回复功能</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="addBot()">确认添加</button>
    </div>
  \`);
}

async function addBot() {
  const name = document.getElementById('botName').value.trim();
  const token = document.getElementById('botToken').value.trim();
  const adminChatId = document.getElementById('botAdminChatId').value.trim();

  if (!name || !token) { toast('请填写名称和Token', 'error'); return; }

  try {
    const result = await api('/api/bots', 'POST', { name, token, admin_chat_id: adminChatId });
    toast('机器人添加成功！Bot ID: ' + result.bot_id);
    closeModal();
    renderPage();
  } catch(e) {
    toast(e.message, 'error');
  }
}

async function deleteBot(botId, name) {
  if (!confirm('确定要删除机器人 "' + name + '" 吗？\\n\\n⚠️ 此操作将删除该机器人的所有数据、规则和日志，不可恢复！')) return;
  try {
    await api('/api/bots/' + botId, 'DELETE');
    toast('机器人已删除');
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
    { page: 'bot-config', icon: '⚙️', label: '机器人配置' },
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
        <h1>⚙️ \${esc(bot.name)}</h1>
        <p>Bot ID: <code>\${bot.bot_id}</code> &nbsp;|&nbsp; Webhook: <code>\${bot.webhook_url || '未设置'}</code></p>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="number">\${statsData.messages}</div><div class="label">消息数</div></div>
        <div class="stat-card"><div class="number">\${statsData.joins}</div><div class="label">入群</div></div>
        <div class="stat-card"><div class="number">\${statsData.leaves}</div><div class="label">退群</div></div>
        <div class="stat-card"><div class="number">\${statsData.forward_rules}</div><div class="label">转发规则</div></div>
        <div class="stat-card"><div class="number">\${statsData.auto_replies}</div><div class="label">自动回复</div></div>
        <div class="stat-card"><div class="number">\${statsData.active_tasks}</div><div class="label">定时任务</div></div>
      </div>

      <!-- Bot Basic Config -->
      <div class="card">
        <div class="card-header"><h3>📋 基本配置</h3></div>
        <div class="form-row">
          <div class="form-group">
            <label>机器人名称</label>
            <input type="text" id="editBotName" value="\${esc(bot.name)}">
          </div>
          <div class="form-group">
            <label>管理员 Chat ID</label>
            <input type="text" id="editAdminChatId" value="\${esc(bot.admin_chat_id || '')}">
            <div class="form-hint">用于私聊客服回复功能，填写管理员的 TG 用户 ID</div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="updateBotConfig()">保存配置</button>
      </div>

      <!-- Tabs for different config sections -->
      <div class="tabs">
        <div class="tab active" onclick="switchTab(this,'tab-forward')">📡 转发规则</div>
        <div class="tab" onclick="switchTab(this,'tab-reply')">💬 自动回复</div>
        <div class="tab" onclick="switchTab(this,'tab-group')">👥 群管控</div>
        <div class="tab" onclick="switchTab(this,'tab-tasks')">⏰ 定时任务</div>
        <div class="tab" onclick="switchTab(this,'tab-logs')">📝 消息日志</div>
        <div class="tab" onclick="switchTab(this,'tab-events')">🚪 成员变动</div>
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
    document.getElementById('mainContent').innerHTML = '<div class="card"><p>加载失败: ' + e.message + '</p></div>';
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
    toast('配置已保存');
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
          <h3>📡 频道转发规则</h3>
          <button class="btn btn-primary" onclick="showAddForwardRuleModal()">+ 新增规则</button>
        </div>
        \${rules.length === 0 ? '<div class="empty"><div class="icon">📡</div><p>暂无转发规则</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>源频道</th><th>目标群</th><th>延时(秒)</th><th>过滤词</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        rules.map(r => '<tr><td><code>' + esc(r.source_channel) + '</code></td><td>' + esc(r.target_chats) + '</td><td>' + r.delay_seconds + '</td><td>' + (r.skip_keywords ? esc(r.skip_keywords) : '<span style="color:var(--text2)">无</span>') + '</td><td><span class="badge badge-' + (r.enabled ? 'active' : 'inactive') + '">' + (r.enabled ? '启用' : '禁用') + '</span></td><td><button class="btn btn-sm btn-outline" onclick="toggleForwardRule(' + r.id + ',' + (r.enabled ? 0 : 1) + ')">' + (r.enabled ? '禁用' : '启用') + '</button> <button class="btn btn-sm btn-danger" onclick="deleteForwardRule(' + r.id + ')">删除</button></td></tr>').join('') +
        '</tbody></table></div>'}
      </div>
    \`;
  } catch(e) {
    container.innerHTML = '<div class="card"><p>加载失败: ' + e.message + '</p></div>';
  }
}

function showAddForwardRuleModal() {
  openModal(\`
    <h3>📡 新增转发规则</h3>
    <div class="form-group">
      <label>源频道 ID</label>
      <input type="text" id="fwdSource" placeholder="例如：-1001234567890">
      <div class="form-hint">频道的 Chat ID，可通过 /id 指令获取</div>
    </div>
    <div class="form-group">
      <label>目标群/频道 ID（多个用逗号分隔）</label>
      <input type="text" id="fwdTargets" placeholder="例如：-1009876543210,-1001111111111">
    </div>
    <div class="form-group">
      <label>转发延时（秒）</label>
      <input type="number" id="fwdDelay" value="5" min="1" max="60">
      <div class="form-hint">1-60 秒，防风控限流</div>
    </div>
    <div class="form-group">
      <label>过滤关键词（多个用逗号分隔）</label>
      <input type="text" id="fwdSkip" placeholder="含这些词的消息不转发">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="addForwardRule()">确认添加</button>
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
    toast('转发规则已添加');
    closeModal();
    loadForwardRules();
  } catch(e) {
    toast(e.message, 'error');
  }
}

async function toggleForwardRule(id, enabled) {
  try {
    await api('/api/forward-rules/' + id, 'PUT', { enabled });
    toast(enabled ? '规则已启用' : '规则已禁用');
    loadForwardRules();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteForwardRule(id) {
  if (!confirm('确定删除此转发规则？')) return;
  try {
    await api('/api/forward-rules/' + id, 'DELETE');
    toast('规则已删除');
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
          <h3>💬 自动回复规则</h3>
          <button class="btn btn-primary" onclick="showAddReplyModal()">+ 新增规则</button>
        </div>
        \${replies.length === 0 ? '<div class="empty"><div class="icon">💬</div><p>暂无自动回复规则</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>关键词</th><th>回复内容</th><th>匹配模式</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        replies.map(r => '<tr><td><code>' + esc(r.keyword) + '</code></td><td>' + esc(r.reply_content).substring(0,50) + (r.reply_content.length > 50 ? '...' : '') + '</td><td><span class="badge badge-' + (r.match_mode === 'exact' ? 'exact' : 'fuzzy') + '">' + (r.match_mode === 'exact' ? '精确匹配' : '模糊匹配') + '</span></td><td><span class="badge badge-' + (r.enabled ? 'active' : 'inactive') + '">' + (r.enabled ? '启用' : '禁用') + '</span></td><td><button class="btn btn-sm btn-outline" onclick="toggleReply(' + r.id + ',' + (r.enabled ? 0 : 1) + ')">' + (r.enabled ? '禁用' : '启用') + '</button> <button class="btn btn-sm btn-danger" onclick="deleteReply(' + r.id + ')">删除</button></td></tr>').join('') +
        '</tbody></table></div>'}
      </div>
    \`;
  } catch(e) {
    container.innerHTML = '<div class="card"><p>加载失败: ' + e.message + '</p></div>';
  }
}

function showAddReplyModal() {
  openModal(\`
    <h3>💬 新增自动回复</h3>
    <div class="form-group">
      <label>触发关键词</label>
      <input type="text" id="replyKeyword" placeholder="输入触发关键词">
    </div>
    <div class="form-group">
      <label>回复内容</label>
      <textarea id="replyContent" placeholder="输入回复内容，支持 HTML 格式"></textarea>
    </div>
    <div class="form-group">
      <label>匹配模式</label>
      <select id="replyMode">
        <option value="fuzzy">模糊匹配（包含即触发）</option>
        <option value="exact">精确匹配（完全一致）</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="addReply()">确认添加</button>
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
    toast('自动回复规则已添加');
    closeModal();
    loadAutoReplies();
  } catch(e) { toast(e.message, 'error'); }
}

async function toggleReply(id, enabled) {
  try {
    await api('/api/auto-replies/' + id, 'PUT', { enabled });
    toast(enabled ? '规则已启用' : '规则已禁用');
    loadAutoReplies();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteReply(id) {
  if (!confirm('确定删除此自动回复规则？')) return;
  try {
    await api('/api/auto-replies/' + id, 'DELETE');
    toast('规则已删除');
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
          <h3>👥 群管控配置</h3>
          <button class="btn btn-primary" onclick="showAddGroupConfigModal()">+ 新增群配置</button>
        </div>
        \${configs.length === 0 ? '<div class="empty"><div class="icon">👥</div><p>暂无群配置</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>群 ID</th><th>欢迎语</th><th>违禁词</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        configs.map(c => '<tr><td><code>' + esc(c.group_id) + '</code></td><td>' + (c.welcome_message ? esc(c.welcome_message).substring(0,40) + '...' : '<span style="color:var(--text2)">未设置</span>') + '</td><td>' + (c.banned_words ? esc(c.banned_words).substring(0,40) + '...' : '<span style="color:var(--text2)">无</span>') + '</td><td><span class="badge badge-' + (c.enabled ? 'active' : 'inactive') + '">' + (c.enabled ? '启用' : '禁用') + '</span></td><td><button class="btn btn-sm btn-outline" onclick="editGroupConfig(' + c.id + ')">编辑</button> <button class="btn btn-sm btn-danger" onclick="deleteGroupConfig(' + c.id + ')">删除</button></td></tr>').join('') +
        '</tbody></table></div>'}
      </div>
    \`;
  } catch(e) {
    container.innerHTML = '<div class="card"><p>加载失败: ' + e.message + '</p></div>';
  }
}

function showAddGroupConfigModal() {
  openModal(\`
    <h3>👥 新增群配置</h3>
    <div class="form-group">
      <label>群 ID</label>
      <input type="text" id="gcGroupId" placeholder="例如：-1001234567890">
    </div>
    <div class="form-group">
      <label>入群欢迎语</label>
      <textarea id="gcWelcome" placeholder="支持变量：{name} 姓名, {username} 用户名, {group} 群名"></textarea>
    </div>
    <div class="form-group">
      <label>违禁词（多个用逗号分隔）</label>
      <input type="text" id="gcBanned" placeholder="例如：广告,推广,代理">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="addGroupConfig()">确认添加</button>
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
    toast('群配置已添加');
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
    <h3>✏️ 编辑群配置</h3>
    <div class="form-group">
      <label>群 ID</label>
      <input type="text" value="\${esc(config.group_id)}" disabled>
    </div>
    <div class="form-group">
      <label>入群欢迎语</label>
      <textarea id="editGcWelcome">\${esc(config.welcome_message || '')}</textarea>
    </div>
    <div class="form-group">
      <label>违禁词</label>
      <input type="text" id="editGcBanned" value="\${esc(config.banned_words || '')}">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="updateGroupConfig(\${id})">保存</button>
    </div>
  \`);
}

async function updateGroupConfig(id) {
  try {
    await api('/api/group-configs/' + id, 'PUT', {
      welcome_message: document.getElementById('editGcWelcome').value.trim(),
      banned_words: document.getElementById('editGcBanned').value.trim(),
    });
    toast('群配置已更新');
    closeModal();
    loadGroupConfigs();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteGroupConfig(id) {
  if (!confirm('确定删除此群配置？')) return;
  try {
    await api('/api/group-configs/' + id, 'DELETE');
    toast('群配置已删除');
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
          <h3>⏰ 定时任务</h3>
          <button class="btn btn-primary" onclick="showAddTaskModal()">+ 新增任务</button>
        </div>
        \${tasks.length === 0 ? '<div class="empty"><div class="icon">⏰</div><p>暂无定时任务</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>类型</th><th>目标</th><th>内容</th><th>循环模式</th><th>下次执行</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        tasks.map(t => '<tr><td>' + esc(t.task_type) + '</td><td><code>' + esc(t.target_chat) + '</code></td><td>' + esc(t.content).substring(0,30) + '</td><td>' + getRepeatLabel(t.repeat_mode) + '</td><td>' + formatDate(t.next_run_at) + '</td><td><span class="badge badge-' + (t.enabled ? 'active' : 'inactive') + '">' + (t.enabled ? '启用' : '已完成') + '</span></td><td><button class="btn btn-sm btn-danger" onclick="deleteTask(' + t.id + ')">删除</button></td></tr>').join('') +
        '</tbody></table></div>'}
      </div>
    \`;
  } catch(e) {
    container.innerHTML = '<div class="card"><p>加载失败: ' + e.message + '</p></div>';
  }
}

function showAddTaskModal() {
  openModal(\`
    <h3>⏰ 新增定时任务</h3>
    <div class="form-group">
      <label>任务类型</label>
      <select id="taskType">
        <option value="send">定时群发</option>
        <option value="remind">个人提醒</option>
      </select>
    </div>
    <div class="form-group">
      <label>目标 Chat ID</label>
      <input type="text" id="taskTarget" placeholder="群ID 或 用户ID">
    </div>
    <div class="form-group">
      <label>发送内容</label>
      <textarea id="taskContent" placeholder="输入要发送的内容"></textarea>
    </div>
    <div class="form-group">
      <label>循环模式</label>
      <select id="taskRepeat">
        <option value="once">一次性</option>
        <option value="hourly">每小时</option>
        <option value="daily">每天</option>
      </select>
    </div>
    <div class="form-group">
      <label>首次执行时间</label>
      <input type="datetime-local" id="taskNextRun">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="addTask()">确认添加</button>
    </div>
  \`);

  // Set default time to now + 5 minutes
  const now = new Date(Date.now() + 5 * 60000);
  document.getElementById('taskNextRun').value = now.toISOString().slice(0, 16);
}

async function addTask() {
  const nextRun = document.getElementById('taskNextRun').value;
  if (!nextRun) { toast('请选择执行时间', 'error'); return; }

  try {
    await api('/api/bots/' + currentBotId + '/tasks', 'POST', {
      task_type: document.getElementById('taskType').value,
      target_chat: document.getElementById('taskTarget').value.trim(),
      content: document.getElementById('taskContent').value.trim(),
      repeat_mode: document.getElementById('taskRepeat').value,
      next_run_at: new Date(nextRun).toISOString(),
    });
    toast('定时任务已添加');
    closeModal();
    loadTasks();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteTask(id) {
  if (!confirm('确定删除此任务？')) return;
  try {
    await api('/api/tasks/' + id, 'DELETE');
    toast('任务已删除');
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
          <h3>📝 消息日志 (共 \${data.total} 条)</h3>
          <div>
            <button class="btn btn-sm btn-success" onclick="exportLogs()">📥 导出CSV</button>
            <button class="btn btn-sm btn-danger" onclick="clearLogs()">🗑️ 清空日志</button>
          </div>
        </div>
        \${logs.length === 0 ? '<div class="empty"><div class="icon">📝</div><p>暂无消息日志</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>时间</th><th>类型</th><th>用户</th><th>内容</th></tr></thead><tbody>' +
        logs.map(l => '<tr><td style="white-space:nowrap">' + formatDate(l.created_at) + '</td><td>' + esc(l.chat_type || '') + '</td><td>' + (l.first_name ? esc(l.first_name) : '') + (l.username ? ' @' + esc(l.username) : '') + '</td><td>' + esc(l.message_text || '').substring(0,80) + '</td></tr>').join('') +
        '</tbody></table></div>'}
        <div class="pagination">
          \${page > 1 ? '<button onclick="loadLogs(' + (page-1) + ')">上一页</button>' : ''}
          <span>第 \${page} / \${totalPages} 页</span>
          \${page < totalPages ? '<button onclick="loadLogs(' + (page+1) + ')">下一页</button>' : ''}
        </div>
      </div>
    \`;
  } catch(e) {
    container.innerHTML = '<div class="card"><p>加载失败: ' + e.message + '</p></div>';
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
      toast('日志导出成功');
    }
  } catch(e) { toast(e.message, 'error'); }
}

async function clearLogs() {
  if (!confirm('确定清空所有消息日志？此操作不可恢复！')) return;
  try {
    await api('/api/bots/' + currentBotId + '/logs/clear', 'DELETE');
    toast('日志已清空');
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
          <h3>🚪 成员变动 (共 \${data.total} 条)</h3>
          <div>
            <button class="btn btn-sm btn-success" onclick="exportEvents()">📥 导出CSV</button>
            <button class="btn btn-sm btn-danger" onclick="clearEvents()">🗑️ 清空记录</button>
          </div>
        </div>
        \${events.length === 0 ? '<div class="empty"><div class="icon">🚪</div><p>暂无成员变动记录</p></div>' :
        '<div class="table-wrap"><table><thead><tr><th>时间</th><th>群ID</th><th>用户</th><th>事件</th></tr></thead><tbody>' +
        events.map(e => '<tr><td style="white-space:nowrap">' + formatDate(e.created_at) + '</td><td><code>' + esc(e.group_id) + '</code></td><td>' + (e.first_name ? esc(e.first_name) : '') + (e.username ? ' @' + esc(e.username) : '') + '</td><td><span class="badge badge-' + (e.event_type === 'join' ? 'active' : 'inactive') + '">' + (e.event_type === 'join' ? '入群' : '退群') + '</span></td></tr>').join('') +
        '</tbody></table></div>'}
        <div class="pagination">
          \${page > 1 ? '<button onclick="loadEvents(' + (page-1) + ')">上一页</button>' : ''}
          <span>第 \${page} / \${totalPages} 页</span>
          \${page < totalPages ? '<button onclick="loadEvents(' + (page+1) + ')">下一页</button>' : ''}
        </div>
      </div>
    \`;
  } catch(e) {
    container.innerHTML = '<div class="card"><p>加载失败: ' + e.message + '</p></div>';
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
      toast('导出成功');
    }
  } catch(e) { toast(e.message, 'error'); }
}

async function clearEvents() {
  if (!confirm('确定清空所有成员变动记录？')) return;
  try {
    await api('/api/bots/' + currentBotId + '/events/clear', 'DELETE');
    toast('记录已清空');
    loadEvents(1);
  } catch(e) { toast(e.message, 'error'); }
}

// ===== Settings =====
async function renderSettings() {
  document.getElementById('mainContent').innerHTML = \`
    <div class="page-header">
      <h1>⚙️ 系统设置</h1>
      <p>管理员密码与系统配置</p>
    </div>
    <div class="card">
      <div class="card-header"><h3>🔑 修改管理员密码</h3></div>
      <div class="form-group">
        <label>当前密码</label>
        <input type="password" id="oldPassword" placeholder="输入当前密码">
      </div>
      <div class="form-group">
        <label>新密码</label>
        <input type="password" id="newPassword" placeholder="输入新密码（至少6位）">
      </div>
      <div class="form-group">
        <label>确认新密码</label>
        <input type="password" id="confirmPassword" placeholder="再次输入新密码">
      </div>
      <button class="btn btn-primary" onclick="changePassword()">修改密码</button>
    </div>
    <div class="card">
      <div class="card-header"><h3>📋 系统信息</h3></div>
      <p style="color:var(--text2);font-size:14px;line-height:1.8">
        运行环境：Cloudflare Workers<br>
        数据库：Cloudflare D1 (SQLite)<br>
        版本：1.0.0<br>
        架构：多机器人集群管理
      </p>
    </div>
  \`;
}

async function changePassword() {
  const oldPwd = document.getElementById('oldPassword').value;
  const newPwd = document.getElementById('newPassword').value;
  const confirmPwd = document.getElementById('confirmPassword').value;

  if (!oldPwd || !newPwd) { toast('请填写完整', 'error'); return; }
  if (newPwd !== confirmPwd) { toast('两次密码不一致', 'error'); return; }
  if (newPwd.length < 6) { toast('密码长度不能少于6位', 'error'); return; }

  try {
    await api('/api/config/password', 'PUT', { old_password: oldPwd, new_password: newPwd });
    toast('密码修改成功，请重新登录');
    setTimeout(() => location.href = '/logout', 1500);
  } catch(e) { toast(e.message, 'error'); }
}

// ===== Logout =====
async function logout() {
  if (!confirm('确定退出登录？')) return;
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
    case 'once': return '一次性';
    case 'hourly': return '每小时';
    case 'daily': return '每天';
    default: return mode;
  }
}

// ===== Init =====
renderPage();
</script>
</body>
</html>`;
}
