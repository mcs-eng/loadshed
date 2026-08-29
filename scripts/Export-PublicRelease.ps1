[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = 'Stop'

$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\', '/')
$destinationRoot = [IO.Path]::GetFullPath($Destination).TrimEnd('\', '/')
$sourcePrefix = $sourceRoot + [IO.Path]::DirectorySeparatorChar

if ($destinationRoot -eq $sourceRoot -or $destinationRoot.StartsWith($sourcePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Destination must be outside the source repository.'
}

$releaseFiles = @(
    '.gitignore'
    'LICENSE'
    'README.md'
    'SUBMISSION.md'
    'index.html'
    'picker/index.html'
    'sale/index.html'
    'src/loadshed.js'
    'src/loadshed-README.md'
    'src/sale-lateness.js'
    'test/day4-regressions.test.js'
    'test/day5-regressions.test.js'
    'test/repository-readiness.test.js'
    'scripts/Export-PublicRelease.ps1'
)

foreach ($relativePath in $releaseFiles) {
    $sourcePath = Join-Path $sourceRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Required release file is missing: $relativePath"
    }
}

if (Test-Path -LiteralPath $destinationRoot) {
    if (Get-ChildItem -LiteralPath $destinationRoot -Force | Select-Object -First 1) {
        throw 'Destination must be empty.'
    }
}
else {
    New-Item -ItemType Directory -Path $destinationRoot | Out-Null
}

foreach ($relativePath in $releaseFiles) {
    $sourcePath = Join-Path $sourceRoot $relativePath
    $destinationPath = Join-Path $destinationRoot $relativePath
    $parent = Split-Path -Parent $destinationPath
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
}

Write-Output "Exported $($releaseFiles.Count) allowlisted files to $destinationRoot"
