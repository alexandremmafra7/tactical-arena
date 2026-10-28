Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
' Inicia o Jarvis em background invisível (sem janela preta de terminal)
WshShell.Run "pythonw """ & strPath & "\jarvis_techlead.py""", 0, False
