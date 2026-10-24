param()
$ErrorActionPreference = 'Stop'

Write-Host 'Super Audio Control - Silent Microphone Check' -ForegroundColor Cyan
Write-Host ''

$matches = Get-PnpDevice -PresentOnly -Class AudioEndpoint -ErrorAction SilentlyContinue |
    Where-Object { $_.FriendlyName -match 'CABLE Output|VB-Audio|Virtual Audio Cable|Silent Microphone|SAC Silent Mic' }

if ($matches) {
    Write-Host 'Silent capture endpoint detected:' -ForegroundColor Green
    $matches | Select-Object Status, FriendlyName, InstanceId | Format-Table -AutoSize
    exit 0
}

Write-Host 'No supported silent capture endpoint was detected.' -ForegroundColor Yellow
Write-Host 'Install/enable a virtual capture device such as VB-Audio Virtual Cable,'
Write-Host 'then refresh Audio Devices in Super Audio Control.'
exit 2
