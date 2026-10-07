param([Parameter(ValueFromRemainingArguments=$true)][string[]]$CaptureArguments)
$ErrorActionPreference = 'Stop'
$env:PATH = (Join-Path $PSScriptRoot 'tools\node-v24.21.0-win-x64') + ';' + $env:PATH
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PSScriptRoot 'tools\browsers'
Remove-Item Env:BAY_BROWSER_EXECUTABLE -ErrorAction SilentlyContinue
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class RenderWake { [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags); }'
if ([RenderWake]::SetThreadExecutionState(2147483649) -eq 0) { throw 'Could not prevent automatic sleep during render' }
Push-Location (Join-Path $PSScriptRoot 'dronebeachshot')
try {
    & node ../capture-opengl.mjs @CaptureArguments
    if ($LASTEXITCODE -ne 0) { throw "Capture failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
    [void][RenderWake]::SetThreadExecutionState(2147483648)
}
