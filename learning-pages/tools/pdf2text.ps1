<#
  pdf2text.ps1 —— 把 PDF 提取成纯文本（自动准备 Python 环境）
  -------------------------------------------------------------------------
  用法：
      .\learning-pages\tools\pdf2text.ps1 -Pdf "C:\path\to\file.pdf" [-Out "C:\path\to\out.txt"]

  为什么需要这个包装脚本：
    * 本机没有可用的 python（只有 Microsoft Store 的占位符），所以用 uv 临时拉一个；
    * uv 默认把缓存和 Python 装到 %LOCALAPPDATA%，在沙箱里会被拒绝写入；
    * 但 %TEMP% 是可写的，所以这里把 uv 的工作目录指到临时目录，
      用完工作区不会多出几百 MB，OneDrive 也不会被同步撑爆。
#>
param(
  [Parameter(Mandatory = $true)][string]$Pdf,
  [string]$Out,
  # 指定一个「能跨命令保留」的缓存目录（如 learning-pages\.uvcache），
  # 下次提取就不用重新下载 Python 和 pymupdf。缺点是要占约 170MB，
  # 而工作区在 OneDrive 下会被同步，所以默认不用；用完记得删。
  [string]$CacheDir
)

$ErrorActionPreference = 'Continue'   # 不能设成 Stop：PS 5.1 下 uv 往 stderr 打下载进度
                                      # 会被当成致命错误，脚本会中途崩掉。
$cacheRoot = if ($CacheDir) { $CacheDir } else { $env:TEMP }
$env:PYTHONIOENCODING        = 'utf-8'
$env:UV_CACHE_DIR            = Join-Path $cacheRoot 'dsh-uv-cache'
$env:UV_PYTHON_INSTALL_DIR   = Join-Path $cacheRoot 'dsh-uv-python'

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Write-Host "找不到 uv。请先安装：https://docs.astral.sh/uv/  （或改用别的 PDF 提取工具）" -ForegroundColor Red
  exit 1
}

$script = Join-Path $PSScriptRoot 'pdf2text.py'
$args_ = @('run', '--with', 'pymupdf', 'python', $script, $Pdf)
if ($Out) { $args_ += $Out }

Write-Host "提取中（首次运行会下载 Python 和 pymupdf，约 40MB）…" -ForegroundColor Cyan
& uv @args_
exit $LASTEXITCODE
