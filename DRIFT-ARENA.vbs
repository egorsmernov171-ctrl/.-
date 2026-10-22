' ============================================================
'  DRIFT ARENA - запуск как приложение Windows (без консоли)
'  Двойной клик по этому файлу = игра открывается в окне без
'  адресной строки, как обычная программа.
' ============================================================
Dim fso, sh, here, url, html, i, running
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = here
url  = "http://localhost:3000"
html = here & "\DRIFT-ARENA.html"

running = PortBusy(3000)

If Not running Then
  ' пробуем поднять сервер скрыто
  On Error Resume Next
  sh.Run "node server.js", 0, False
  On Error GoTo 0
  For i = 1 To 24
    WScript.Sleep 500
    running = PortBusy(3000)
    If running Then Exit For
  Next
End If

If running Then
  OpenApp url
Else
  ' Node.js не установлен — играем из автономного файла
  sh.Run """" & html & """", 1, False
End If

' ------------------------------------------------------------
Function PortBusy(port)
  Dim exec, out
  Set exec = sh.Exec("cmd /c netstat -ano | findstr /r /c:"": " & port & " .*LISTENING""")
  out = exec.StdOut.ReadAll
  PortBusy = (Len(Trim(out)) > 0)
End Function

Function HaveTool(name)
  HaveTool = (sh.Run("cmd /c where " & name, 0, True) = 0)
End Function

Sub OpenApp(u)
  Dim b
  For Each b In Array("msedge", "chrome")
    If HaveTool(b) Then
      sh.Run """" & b & """ --app=" & u & " --window-size=1600,900", 1, False
      Exit Sub
    End If
  Next
  ' иначе — браузер по умолчанию
  sh.Run u, 1, False
End Sub
