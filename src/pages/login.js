// ============================================
// 登录页面
// ============================================

export function loginPage(error = '') {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TG Bot 管理系统 - 登录</title>
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
    <h1>🤖 TG Bot 管理系统</h1>
    <p>多机器人集群管理平台</p>
  </div>
  ${error ? `<div class="error">${error}</div>` : ''}
  <form method="POST" action="/login">
    <div class="form-group">
      <label>管理员密码</label>
      <input type="password" name="password" placeholder="请输入管理员密码" required autofocus>
    </div>
    <button type="submit" class="btn">登 录</button>
  </form>
  <div class="footer">Powered by Cloudflare Workers + D1</div>
</div>
</body>
</html>`;
}
