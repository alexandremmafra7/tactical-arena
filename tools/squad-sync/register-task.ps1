# Registra uma tarefa semanal (domingo 03:00) que baixa dados e gera os CSVs. Não aplica nada no jogo.
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$cmd = "cd '$repo'; npm run squads:sync; if (`$env:API_FOOTBALL_KEY) { npm run squads:api }"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -Command `"$cmd`""
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3am
Register-ScheduledTask -TaskName 'TacticalArena-SquadSync' -Action $action -Trigger $trigger -Force
