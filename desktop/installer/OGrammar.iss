; OGrammar desktop installer (Inno Setup).
;
; Build:  copy the release binary to this folder as OGrammar.exe, then run
;           ISCC.exe OGrammar.iss            (optionally /DAppVersion=x.y.z)
;         or use build-installer.ps1, which does both.
; Output: Output\OGrammar-<version>-setup.exe
;
; Per-user install — no admin / UAC prompt. Autostart-at-logon is owned by the
; app itself (Settings -> start at logon), so the installer never touches the
; HKCU \Run key; uninstalling leaves %APPDATA%\OGrammar (your config) intact.

#ifndef AppVersion
  #define AppVersion "0.9.0"
#endif
#define AppName "OGrammar"
#define AppPublisher "zazzn"
#define AppURL "https://github.com/zazzn/opengrammar"
#define AppExe "OGrammar.exe"

[Setup]
; Stable AppId so version upgrades replace in place and uninstall is tracked.
AppId={{A3F1B2C4-5D6E-4F70-8192-A3B4C5D6E7F8}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
WizardStyle=modern
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename={#AppName}-{#AppVersion}-setup
Compression=lzma2
SolidCompression=yes
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "Launch {#AppName} now"; Flags: nowait postinstall skipifsilent
