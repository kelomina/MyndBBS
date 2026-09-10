param([Parameter(Mandatory=$true)][string]$Repository,[Parameter(Mandatory=$true)][string]$Tag,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference = 'Stop'
$proxy = 'http://127.0.0.1:7897'
$headers = @{ 'User-Agent' = 'MyndBBS-deploy' }
$scope = "repository:$Repository`:pull"
$token = (Invoke-RestMethod -Uri "https://ghcr.io/token?scope=$([uri]::EscapeDataString($scope))&service=ghcr.io" -Headers $headers -Proxy $proxy).token
$auth = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json' }
$base = "https://ghcr.io/v2/$Repository"
$manifest = Invoke-RestMethod -Uri "$base/manifests/$Tag" -Headers $auth -Proxy $proxy
if ($manifest.manifests) {
  $amd64 = $manifest.manifests | Where-Object { $_.platform.os -eq 'linux' -and $_.platform.architecture -eq 'amd64' } | Select-Object -First 1
  if (-not $amd64) { throw "No linux/amd64 manifest found" }
  $manifest = Invoke-RestMethod -Uri "$base/manifests/$($amd64.digest)" -Headers $auth -Proxy $proxy
}
$tmp = Join-Path ([IO.Path]::GetTempPath()) ("ghcr-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force $tmp | Out-Null
try {
  $configDigest = $manifest.config.digest
  $configName = ($configDigest -replace '^sha256:','') + '.json'
  Invoke-WebRequest -Uri "$base/blobs/$configDigest" -Headers $auth -Proxy $proxy -OutFile (Join-Path $tmp $configName)
  $layers = @()
  foreach ($layer in $manifest.layers) {
    $name = ($layer.digest -replace '^sha256:','') + '.tar'
    Invoke-WebRequest -Uri "$base/blobs/$($layer.digest)" -Headers $auth -Proxy $proxy -OutFile (Join-Path $tmp $name)
    $layers += $name
  }
  $manifestEntry = @{ Config = $configName; RepoTags = @("$Repository`:$Tag"); Layers = $layers } | ConvertTo-Json -Compress
  Set-Content -LiteralPath (Join-Path $tmp 'manifest.json') -Value "[$manifestEntry]" -NoNewline -Encoding ascii
  if (Test-Path $Output) { Remove-Item -LiteralPath $Output -Force }
  tar -cf $Output -C $tmp .
  Get-Item $Output | Select-Object FullName,Length
} finally { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
