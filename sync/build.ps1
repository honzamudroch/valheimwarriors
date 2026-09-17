# Build Valheim Warriors Sync: PyInstaller onedir -> (sign) -> verify -> ZIP
# .\build.ps1 -Version 0.1.9 [-Sign] [-Subject "Jan Mudroch"]
param(
  [Parameter(Mandatory = $true)][string]$Version,
  [switch]$Sign,
  [string]$Subject = "Jan Mudroch",          # subject (CN) of the code signing certificate in the user store
  [string]$Timestamp = "http://time.certum.pl",
  [string]$Out = "..\download\ValheimWarriorsSync.zip"
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# version in source and in app-config.json must match
(Get-Content vwsync.py -Raw) -replace "VERSION = '[0-9.]+'", "VERSION = '$Version'" | Set-Content vwsync.py -Encoding utf8 -NoNewline
$cfgPath = "..\app-config.json"
if (Test-Path $cfgPath) { (Get-Content $cfgPath -Raw) -replace '"version": *"[0-9.]+"', "`"version`": `"$Version`"" | Set-Content $cfgPath -Encoding utf8 -NoNewline }

Remove-Item dist_dir, build_dir -Recurse -Force -ErrorAction SilentlyContinue
pyinstaller --noconfirm --onedir --noconsole --name ValheimWarriorsSync --icon vw.ico --add-data "item-names.json;." --distpath dist_dir --workpath build_dir vwsync.py | Out-Null
if (-not (Test-Path dist_dir\ValheimWarriorsSync\ValheimWarriorsSync.exe)) { throw "build failed" }

$signtool = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe" | Sort-Object FullName | Select-Object -Last 1
if ($Sign) {
  if (-not $signtool) { throw "signtool.exe not found (install Windows SDK)" }
  # Smart App Control checks libraries too, so sign everything that is PE and not already signed
  $files = Get-ChildItem dist_dir\ValheimWarriorsSync -Recurse -Include *.exe, *.dll, *.pyd | Where-Object { (Get-AuthenticodeSignature $_.FullName).Status -ne 'Valid' }
  Write-Host "signing $($files.Count) files"
  foreach ($f in $files) {
    & $signtool.FullName sign /n "$Subject" /fd sha256 /tr $Timestamp /td sha256 /q $f.FullName
    if ($LASTEXITCODE -ne 0) { throw "sign failed: $($f.FullName)" }
  }
  $bad = Get-ChildItem dist_dir\ValheimWarriorsSync -Recurse -Include *.exe, *.dll, *.pyd | Where-Object { (Get-AuthenticodeSignature $_.FullName).Status -ne 'Valid' }
  if ($bad) { throw "unsigned after signing: $($bad.FullName -join ', ')" }
  & $signtool.FullName verify /pa /q dist_dir\ValheimWarriorsSync\ValheimWarriorsSync.exe
  if ($LASTEXITCODE -ne 0) { throw "verify failed" }
}

# Defender check before publishing
& "C:\Program Files\Windows Defender\MpCmdRun.exe" -Scan -ScanType 3 -File (Resolve-Path dist_dir\ValheimWarriorsSync) -DisableRemediation | Select-Object -Last 1

Remove-Item $Out -Force -ErrorAction SilentlyContinue
Compress-Archive -Path dist_dir\ValheimWarriorsSync -DestinationPath $Out -CompressionLevel Optimal
Write-Host ("done: {0} ({1:N1} MB), version {2}, signed: {3}" -f (Resolve-Path $Out), ((Get-Item $Out).Length / 1MB), $Version, [bool]$Sign)
