@echo off
set "PROJECT_ROOT=%~dp0.."
set "MAVEN=%PROJECT_ROOT%\.tools\apache-maven-3.9.12\bin\mvn.cmd"

if not exist "%MAVEN%" (
  echo Local Maven was not found at "%MAVEN%".
  exit /b 1
)

call "%MAVEN%" "-Dspring-boot.run.jvmArguments=-Xms32m -Xmx256m -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC" spring-boot:run
