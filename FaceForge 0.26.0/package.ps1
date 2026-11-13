[CmdletBinding()]
param(
    [string]$Runtime = "win-x64"
)

# One source of version truth: the first line of VERSION.txt.
$ErrorActionPreference = "Stop"
$snapshotRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $snapshotRoot
$artifactRoot = Join-Path $snapshotRoot "artifacts"
$publishRoot = Join-Path $artifactRoot "publish\$Runtime"
$stageRoot = Join-Path $artifactRoot "release-stage"
$uploadRoot = Join-Path $snapshotRoot "NEXUS-UPLOAD"
$desktopProject = Join-Path $snapshotRoot "src\FaceForge.Desktop\FaceForge.Desktop.csproj"
$snapshotReadme = Join-Path $snapshotRoot "README.md"

$version = (Get-Content -LiteralPath (Join-Path $snapshotRoot "VERSION.txt") -TotalCount 1).Trim() -replace '^FaceForge\s+', ''
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "VERSION.txt does not start with 'FaceForge <x.y.z>'; got '$version'." }

$standaloneName = "FaceForge-$version-STANDALONE.exe"
$artifactExe = Join-Path $artifactRoot $standaloneName
$shareExe = Join-Path $projectRoot $standaloneName
$zipName = "FaceForge-$version-STANDALONE.zip"
$zipPath = Join-Path $uploadRoot $zipName

& (Join-Path $snapshotRoot "build.ps1") -Configuration Release
if ($LASTEXITCODE -ne 0) { throw "Build gate failed." }

if (Test-Path -LiteralPath $publishRoot) {
    $resolvedArtifact = [IO.Path]::GetFullPath($artifactRoot)
    $resolvedPublish = [IO.Path]::GetFullPath($publishRoot)
    if (-not $resolvedPublish.StartsWith($resolvedArtifact, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to clear publish output outside the artifact root."
    }
    Remove-Item -Recurse -Force -LiteralPath $publishRoot
}

dotnet publish $desktopProject -c Release -r $Runtime --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -p:PublishReadyToRun=true -p:DebugType=None -p:DebugSymbols=false -o $publishRoot
if ($LASTEXITCODE -ne 0) { throw "Desktop publish failed." }

$webViewDocumentation = @(
    "Microsoft.Web.WebView2.Core.xml",
    "Microsoft.Web.WebView2.WinForms.xml",
    "Microsoft.Web.WebView2.Wpf.xml"
)
foreach ($name in $webViewDocumentation) {
    $documentationPath = Join-Path $publishRoot $name
    if (Test-Path -LiteralPath $documentationPath) {
        Remove-Item -Force -LiteralPath $documentationPath
    }
}

$publishedFiles = @(Get-ChildItem -LiteralPath $publishRoot -File)
if ($publishedFiles.Count -ne 1 -or $publishedFiles[0].Name -ne "FaceForge.exe") {
    $inventory = ($publishedFiles.Name | Sort-Object) -join ", "
    throw "Single-file gate failed. Publish contained: $inventory"
}
# The published FileVersion must match VERSION.txt, or the download lies about what it is.
$fileVersion = (Get-Item -LiteralPath $publishedFiles[0].FullName).VersionInfo.FileVersion
if ($fileVersion -notlike "$version.*") {
    throw "Built EXE reports FileVersion '$fileVersion' but VERSION.txt says $version."
}

Copy-Item -LiteralPath $publishedFiles[0].FullName -Destination $artifactExe -Force
Copy-Item -LiteralPath $publishedFiles[0].FullName -Destination $shareExe -Force

# Stage the two files that ship, under the names a user sees, then gate the inventory before zipping.
if (Test-Path -LiteralPath $stageRoot) { Remove-Item -Recurse -Force -LiteralPath $stageRoot }
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
Copy-Item -LiteralPath $publishedFiles[0].FullName -Destination (Join-Path $stageRoot $standaloneName) -Force
Copy-Item -LiteralPath $snapshotReadme -Destination (Join-Path $stageRoot "README.md") -Force

$staged = @(Get-ChildItem -LiteralPath $stageRoot -File | Sort-Object Name)
$expected = @("README.md", $standaloneName) | Sort-Object
if (($staged.Name -join ",") -ne ($expected -join ",")) {
    throw "Release inventory drifted: $($staged.Name -join ', ')"
}
foreach ($file in $staged) {
    if ($file.Extension -in @(".pdb", ".log", ".json") -or $file.Extension -eq ".zip") {
        throw "Release inventory contains a build artifact: $($file.Name)"
    }
}

New-Item -ItemType Directory -Path $uploadRoot -Force | Out-Null
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $stageRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal

$exeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $shareExe).Hash
$zipHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash
[pscustomobject]@{
    Version = $version
    FileVersion = $fileVersion
    Exe = $shareExe
    ExeBytes = (Get-Item -LiteralPath $shareExe).Length
    ExeSHA256 = $exeHash
    Zip = $zipPath
    ZipBytes = (Get-Item -LiteralPath $zipPath).Length
    ZipSHA256 = $zipHash
    ZipInventory = ($staged.Name -join ", ")
} | Format-List
