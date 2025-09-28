# KreaCAD Auto Versioning Script

# Read current version
$versionFile = "version.json"
if (Test-Path $versionFile) {
    $versionData = Get-Content $versionFile | ConvertFrom-Json
} else {
    $versionData = @{
        version = "1.0.0"
        build = 1
        timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
    }
}

# Increment build number
$versionData.build = [int]$versionData.build + 1
$versionData.timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")

# Write back to version.json
$versionData | ConvertTo-Json | Set-Content $versionFile

# Generate version.js for website
$versionJs = @"
// Auto-generated version file - Do not edit manually
export const KreaCAD_VERSION = {
    version: '$($versionData.version)',
    build: $($versionData.build),
    timestamp: '$($versionData.timestamp)',
    fullVersion: 'v$($versionData.version).build.$($versionData.build)'
};
"@

$versionJs | Set-Content "source\website\version.js"

Write-Host "KreaCAD version updated: v$($versionData.version).build.$($versionData.build)" -ForegroundColor Green
