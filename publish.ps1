<#
  publish.ps1 —— 把本仓库推上 GitHub

  ── 最简单的用法：双击同目录下的 publish.cmd ──
  （.ps1 在这台机器上没有文件关联，双击不会运行，所以配了一个 .cmd 启动器）

  ── 命令行用法 ──
      .\publish.ps1                                 交互式问用户名，走 Git Credential Manager
      .\publish.ps1 -User MeteorNOX -Email me@x.com
      .\publish.ps1 -User MeteorNOX -Token ghp_xxx -CreateRepo
                                                    用访问令牌，自动建仓库，完全绕开 GCM

  ── 三种认证方式，从省事到最稳 ──
    1. 不给 -Token：走 Git Credential Manager，推送时弹浏览器让你登录 GitHub
    2. 给 -Token：直接用令牌推，不弹任何东西
    3. 给 -Token -CreateRepo：连仓库都帮你建好，一步到位（最不容易出岔子）

  ── 关于令牌 ──
  在 https://github.com/settings/tokens 生成 Classic token，勾选 repo 就够了。
  注意：令牌会出现在命令行里（本机进程列表可见）。用完可以在 GitHub 上随时吊销。
  本脚本**不会**把令牌写进 git 的配置文件或 remote 地址。
#>
param(
  [string]$User,
  [string]$Email,
  [string]$Token,
  [string]$Repo = 'dsh-learning-pages',
  [string]$Name,
  [switch]$CreateRepo,
  [switch]$Force
)

$ErrorActionPreference = 'Continue'   # 别用 Stop：git 往 stderr 写进度会被当致命错误
$root = $PSScriptRoot

function Say  ($m) { Write-Host $m }
function Ok   ($m) { Write-Host $m -ForegroundColor Green }
function Warn ($m) { Write-Host $m -ForegroundColor Yellow }
function Bad  ($m) { Write-Host $m -ForegroundColor Red }
function Head ($m) { Write-Host ""; Write-Host $m -ForegroundColor Cyan }

Say ""
Say "=============================================="
Say "  dsh-learning-pages  ->  GitHub"
Say "=============================================="

# ---------------------------------------------------------------- 前置检查
if (-not (Test-Path (Join-Path $root '.git'))) {
  Bad "[X] $root 不是一个 git 仓库"
  exit 1
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Bad "[X] 找不到 git"
  exit 1
}

# ---------------------------------------------------------------- 问用户名
if (-not $User) {
  Head "推到哪个 GitHub 账号下？"
  Say "（填用户名，不是邮箱。比如主页是 https://github.com/MeteorNOX 就填 MeteorNOX）"
  $User = (Read-Host "GitHub 用户名").Trim()
  if (-not $User) { Bad "[X] 没填用户名"; exit 1 }
}
if (-not $Name) { $Name = $User }
if (-not $Email) {
  $Email = "$User@users.noreply.github.com"
  Warn "[!] 没给邮箱，先用 $Email 占位"
}

# 代理（git 配了 http.proxy，Invoke-RestMethod 不会自动用它，得手动传）
$proxy = (git config --get http.proxy 2>$null)
if (-not $proxy) { $proxy = (git config --get https.proxy 2>$null) }

# ---------------------------------------------------------------- 1. 重新署名
Head "==> [1/5] 用 $Name <$Email> 重新署名提交"
git -C $root config user.name  $Name
git -C $root config user.email $Email
git -C $root add -A
if ($LASTEXITCODE -ne 0) { Bad "[X] git add 失败"; exit 1 }

$hasCommit = $false
git -C $root rev-parse --verify HEAD *> $null
if ($LASTEXITCODE -eq 0) { $hasCommit = $true }

if ($hasCommit) {
  git -C $root commit --amend --reset-author --no-edit | Out-Null
} else {
  git -C $root commit -m "init" | Out-Null
}
if ($LASTEXITCODE -ne 0) { Bad "[X] 提交失败"; exit 1 }
Ok "    提交: $(git -C $root log -1 --format='%h %an <%ae>')"

$clean = "https://github.com/$User/$Repo.git"
$repoExists = $false

# ---------------------------------------------------------------- 2. 仓库是否存在
Head "==> [2/5] 检查 GitHub 上有没有这个仓库"
$env:GIT_TERMINAL_PROMPT = '0'      # 这一步不要弹登录框
git ls-remote $clean HEAD *> $null
if ($LASTEXITCODE -eq 0) {
  $repoExists = $true
  Ok "    仓库已存在"
} else {
  Warn "    仓库还不存在，或者当前没有权限访问"
}
$env:GIT_TERMINAL_PROMPT = '1'

# ---------------------------------------------------------------- 3. 建仓库
if (-not $repoExists) {
  if ($Token -and $CreateRepo) {
    Head "==> [3/5] 用令牌在 GitHub 上创建仓库"
    try {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      $apiArgs = @{
        Uri     = 'https://api.github.com/user/repos'
        Method  = 'Post'
        Headers = @{
          Authorization = "token $Token"
          Accept        = 'application/vnd.github+json'
          'User-Agent'  = 'dsh-learning-pages'
        }
        Body        = (@{
          name        = $Repo
          description = '交互式学习页范式 + DSH 页面速览桌宠'
          private     = $false
          has_issues  = $true
        } | ConvertTo-Json)
        ContentType = 'application/json'
      }
      if ($proxy) { $apiArgs['Proxy'] = $proxy }
      $null = Invoke-RestMethod @apiArgs
      $repoExists = $true
      Ok "    已创建 https://github.com/$User/$Repo"
    } catch {
      Bad "    创建失败: $($_.Exception.Message)"
      Say "    你可以在浏览器里手建：https://github.com/new"
      Say "    仓库名填 $Repo，不要勾任何初始化文件"
      Warn "    （手工建好后重跑本脚本即可，它会自动跳过这一步）"
      exit 1
    }
  } else {
    Head "==> [3/5] 需要你先建一个空仓库"
    Say ""
    Say "    1. 浏览器打开：https://github.com/new"
    Say "    2. 仓库名填：$Repo"
    Say "    3. 不要勾 Add a README / .gitignore / license —— 必须是空仓库"
    Say "    4. 建好后重跑本脚本"
    Say ""
    Warn "    想省掉这一步：加 -Token <你的令牌> -CreateRepo，脚本会自动建。"
    Warn "    令牌在 https://github.com/settings/tokens 生成（Classic，勾 repo）"
    exit 1
  }
}

# ---------------------------------------------------------------- 4. remote + 分支
Head "==> [4/5] 设置 remote 和分支"
$existing = git -C $root remote 2>$null
if ($existing -contains 'origin') {
  git -C $root remote set-url origin $clean
} else {
  git -C $root remote add origin $clean
}
git -C $root branch -M main
Ok "    origin = $clean   （分支 main）"

# ---------------------------------------------------------------- 5. 推送
Head "==> [5/5] 推送"
$pushUrl = $clean
if ($Token) {
  # 令牌只用于这一次推送，remote 里仍然是干净地址
  $pushUrl = "https://$User`:$Token@github.com/$User/$Repo.git"
  Say "    使用访问令牌推送（不弹登录窗口）"
} else {
  Say "    走 Git Credential Manager —— 如果弹出浏览器，请登录你的 GitHub 账号"
  Say "    如果超过 30 秒毫无动静，按 Ctrl+C 中断，改用 -Token 方式"
}

$pushArgs = @('-C', $root, 'push', $pushUrl, 'main')
if ($Force) { $pushArgs += '--force' }
git @pushArgs
$code = $LASTEXITCODE

if ($code -eq 0) {
  git -C $root branch --set-upstream-to=origin/main main *> $null
  Say ""
  Ok "=============================================="
  Ok "  推送成功"
  Ok "  https://github.com/$User/$Repo"
  Ok "=============================================="
  exit 0
}

Bad ""
Bad "=============================================="
Bad "  推送失败"
Bad "=============================================="
Say "常见原因和做法："
Say "  * 没登录 / 登录被取消  -> 改用 -Token <令牌> 重跑"
Say "  * 仓库还没建          -> 加 -CreateRepo，或先去 https://github.com/new 建空仓库"
Say "  * 网络到不了 GitHub   -> 确认代理开着（git 当前 proxy = $proxy）"
Say "  * 远端已有内容冲突    -> 加 -Force 强制覆盖（确认远端是空的再用）"
exit 1
