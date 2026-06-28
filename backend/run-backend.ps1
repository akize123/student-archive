$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot

$candidates = @(
  'mvn',
  'C:\Program Files\Apache Software Foundation\apache-maven-3.9.12\bin\mvn.cmd',
  'C:\Program Files\JetBrains\IntelliJ IDEA Community Edition 2025.2.6\plugins\maven\lib\maven3\bin\mvn.cmd'
)

$mvn = $null
foreach ($candidate in $candidates) {
  if ($candidate -eq 'mvn') {
    if (Get-Command mvn -ErrorAction SilentlyContinue) {
      $mvn = 'mvn'
      break
    }
    continue
  }

  if (Test-Path -LiteralPath $candidate) {
    $mvn = $candidate
    break
  }
}

if (-not $mvn) {
  throw 'Maven was not found. Install Maven or add it to PATH, then run this script again.'
}

Push-Location $PSScriptRoot
try {
  $springBootJvmArguments = '-Xms32m -Xmx256m -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC'
  & $mvn "-Dspring-boot.run.jvmArguments=$springBootJvmArguments" spring-boot:run
} finally {
  Pop-Location
}
