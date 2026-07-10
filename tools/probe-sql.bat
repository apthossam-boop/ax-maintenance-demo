@echo off
set OUT=C:\Users\Public\ax_sql_probe.txt
echo PROBE_START> "%OUT%"
where sqlcmd >> "%OUT%" 2>&1
echo ---LOCALHOST--- >> "%OUT%"
sqlcmd -S localhost -E -Q "SELECT @@SERVERNAME AS Srv; SELECT name FROM sys.databases WHERE name LIKE '%%Dynamics%%';" >> "%OUT%" 2>&1
echo ---DOT--- >> "%OUT%"
sqlcmd -S . -E -Q "SELECT @@SERVERNAME AS Srv; SELECT name FROM sys.databases WHERE name LIKE '%%Dynamics%%';" >> "%OUT%" 2>&1
echo ---NETSTAT1433--- >> "%OUT%"
netstat -an | findstr 1433 >> "%OUT%" 2>&1
echo ---SERVICES--- >> "%OUT%"
sc query type= service state= all | findstr /I "SQL" >> "%OUT%" 2>&1
echo PROBE_END>> "%OUT%"
