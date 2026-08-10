[CmdletBinding()]
param(
    [int]$Port = 4317
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path $root 'outputs\server.pid'

if (-not (Test-Path -LiteralPath $pidPath)) {
    Write-Output 'No server PID file found.'
    exit 0
}

$serverPid = [int](Get-Content -LiteralPath $pidPath -Raw)
$process = Get-Process -Id $serverPid -ErrorAction Stop
$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    Where-Object { $_.OwningProcess -eq $serverPid }

if ($process.ProcessName -notlike 'node*' -or -not $listener) {
    throw "PID $serverPid is not the verified Node listener on port $Port."
}

Stop-Process -Id $serverPid -ErrorAction Stop
Remove-Item -LiteralPath $pidPath -Force
Write-Output "Stopped PID $serverPid on port $Port."
