' ============================================================
'  DRIFT ARENA - zapusk kak prilozhenie Windows (bez konsoli)
'  Dvoynoy klik = igra otkryvaetsya v okne bez adresnoy stroki,
'  kak obychnaya programma. Edge, Chrome i Yandeks.Brauzer.
' ============================================================
Dim fso, sh, here, url, html, i, running
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = here
url  = "http://localhost:3000"
html = here & "\${offlineHtml}"

running = PortBusy(3000)

If Not running Then
  ' probuem podnyat server skryto
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
  ' Node.js ne ustanovlen - igraem iz avtonomnogo faila
  sh.Run """" & html & """", 1, False
End If

' ------------------------------------------------------------
Function PortBusy(port)
  Dim exec, out
  Set exec = sh.Exec("cmd /c netstat -ano | findstr /r /c:\": \" & port & \" .*LISTENING\"\"")
  out = exec.StdOut.ReadAll
  PortBusy = (Len(Trim(out)) > 0)
End Function

Function HaveTool(name)
  HaveTool = (sh.Run("cmd /c where " & name, 0, True) = 0)
End Function

' Brauzer po umolchaniyu iz reestra: Yandex.HTML / ChromeHTML / MSEdgeHTM
Function DefaultProgid()
  Dim p
  On Error Resume Next
  p = sh.RegRead("HKCU\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice\Progid")
  On Error GoTo 0
  DefaultProgid = LCase(p)
End Function

Sub OpenApp(u)
  Dim prog, cand, i, b, ya
  ya = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Yandex\YandexBrowser\Application\browser.exe"
  prog = DefaultProgid()
  If InStr(prog, "yandex") > 0 Then
    If fso.FileExists(ya) Then cand = Array(ya, "msedge", "chrome") Else cand = Array("browser", "msedge", "chrome")
  ElseIf InStr(prog, "chrome") > 0 Then
    cand = Array("chrome", "msedge", "browser")
  Else
    cand = Array("msedge", "chrome", "browser")
  End If
  For i = 0 To UBound(cand)
    b = cand(i)
    If InStr(b, "\") > 0 Then
      If fso.FileExists(b) Then
        sh.Run """" & b & """ --app=" & u & " --window-size=1600,900", 1, False
        Exit Sub
      End If
    Else
      If HaveTool(b) Then
        sh.Run """" & b & """ --app=" & u & " --window-size=1600,900", 1, False
        Exit Sub
      End If
    End If
  Next
  ' inache - brauzer po umolchaniyu
  sh.Run u, 1, False
End Sub
