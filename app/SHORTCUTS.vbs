' Sozdanie yarlykov DRIFT ARENA. Vyzyvaetsya iz INSTALL.bat.
Dim w, dir, ico, tgt, arg, s
Set w = CreateObject("WScript.Shell")
dir = WScript.Arguments(0)
ico = WScript.Arguments(1)
tgt = WScript.Arguments(2)
arg = WScript.Arguments(3)

Set s = w.CreateShortcut(WScript.Arguments(4))
s.TargetPath = tgt
s.Arguments = arg
s.IconLocation = ico
s.WorkingDirectory = dir
s.Description = "DRIFT ARENA - 3D drift simulator"
s.Save()

Set s = w.CreateShortcut(WScript.Arguments(5))
s.TargetPath = tgt
s.Arguments = arg
s.IconLocation = ico
s.WorkingDirectory = dir
s.Description = "DRIFT ARENA - 3D drift simulator"
s.Save()

Set s = w.CreateShortcut(WScript.Arguments(6))
s.TargetPath = WScript.Arguments(7)
s.IconLocation = WScript.Arguments(8)
s.WorkingDirectory = dir
s.Description = "Uninstall DRIFT ARENA"
s.Save()

WScript.Quit 0
