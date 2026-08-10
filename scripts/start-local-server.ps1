[CmdletBinding()]
param(
    [int]$Port = 4317
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outputs = Join-Path $root 'outputs'
$existing = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue

if ($existing) {
    Write-Output "Port $Port is already in use."
    exit 2
}

New-Item -ItemType Directory -Path $outputs -Force | Out-Null
$node = (Get-Command node).Source
$process = Start-Process `
    -FilePath $node `
    -ArgumentList @('src/cli.mjs', 'serve') `
    -WorkingDirectory $root `
    -RedirectStandardOutput (Join-Path $outputs 'server.stdout.log') `
    -RedirectStandardError (Join-Path $outputs 'server.stderr.log') `
    -WindowStyle Hidden `
    -PassThru

[System.IO.File]::WriteAllText(
    (Join-Path $outputs 'server.pid'),
    $process.Id.ToString(),
    [System.Text.Encoding]::ASCII
)

Start-Sleep -Seconds 2
if ($process.HasExited) {
    throw "Server exited during startup. Check outputs/server.stderr.log."
}

Write-Output "Started PID $($process.Id) on http://127.0.0.1:$Port"
