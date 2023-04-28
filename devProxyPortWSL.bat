wsl hostname -I
@echo off
set /p WSLIP=What is the current WSL IP address?
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=4000 connectaddress=%WSLIP% connectport=4000