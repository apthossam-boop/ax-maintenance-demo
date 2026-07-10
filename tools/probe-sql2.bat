@echo off
set OUT=C:\Users\Public\ax_sql_probe2.txt
echo PROBE2_START> "%OUT%"
echo ---APTALEX--- >> "%OUT%"
sqlcmd -S localhost\APTALEX -E -Q "SELECT @@SERVERNAME AS Srv; SELECT name FROM sys.databases ORDER BY name;" >> "%OUT%" 2>&1
echo ---DB CHECK--- >> "%OUT%"
sqlcmd -S localhost\APTALEX -E -d MicrosoftDynamicsAX -Q "SELECT DB_NAME() AS DbName;" >> "%OUT%" 2>&1
echo ---TABLES--- >> "%OUT%"
sqlcmd -S localhost\APTALEX -E -d MicrosoftDynamicsAX -Q "SELECT TOP 20 TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%%MBS_WorkShop%%' OR TABLE_NAME LIKE '%%WorkShop%%' ORDER BY TABLE_NAME;" >> "%OUT%" 2>&1
echo ---COLS SERVICES--- >> "%OUT%"
sqlcmd -S localhost\APTALEX -E -d MicrosoftDynamicsAX -Q "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'MBS_WorkShopOrdersServices' ORDER BY ORDINAL_POSITION;" >> "%OUT%" 2>&1
echo ---COLS OPS--- >> "%OUT%"
sqlcmd -S localhost\APTALEX -E -d MicrosoftDynamicsAX -Q "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'MBS_WorkShopOrderOperations' ORDER BY ORDINAL_POSITION;" >> "%OUT%" 2>&1
echo ---SAMPLE SERVICES--- >> "%OUT%"
sqlcmd -S localhost\APTALEX -E -d MicrosoftDynamicsAX -Q "SELECT TOP 5 * FROM MBS_WorkShopOrdersServices;" >> "%OUT%" 2>&1
echo ---SAMPLE OPS--- >> "%OUT%"
sqlcmd -S localhost\APTALEX -E -d MicrosoftDynamicsAX -Q "SELECT TOP 5 * FROM MBS_WorkShopOrderOperations;" >> "%OUT%" 2>&1
echo ---PORT--- >> "%OUT%"
powershell -NoProfile -Command "Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\*\MSSQLServer\SuperSocketNetLib\Tcp\IPAll' -ErrorAction SilentlyContinue | Format-List" >> "%OUT%" 2>&1
echo PROBE2_END>> "%OUT%"
