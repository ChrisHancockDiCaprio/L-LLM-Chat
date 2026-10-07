; Stable external vault. Reject the vault, its parents and descendants as install directory.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customHeader
!ifndef BUILD_UNINSTALLER
Var VaultDirectoryUnsafe
Function CheckVaultDirectory
  Push $0
  Push $1
  Push $2
  Push $3
  StrCpy $VaultDirectoryUnsafe "0"
  ; Drive roots and drive-relative roots are never program directories.
  StrLen $2 $INSTDIR
  ${If} $2 <= 3
    Goto unsafe
  ${EndIf}
  ; The NSIS GetFullPathName instruction may return empty for a not-yet
  ; created directory. The Win32 API canonicalizes those paths as well.
  StrCpy $3 $INSTDIR
  System::Call 'kernel32::GetFullPathNameW(w r3, i ${NSIS_MAX_STRLEN}, w .r0, p 0) i .r2'
  ${If} $2 == 0
  ${OrIf} $2 >= ${NSIS_MAX_STRLEN}
    Goto unsafe
  ${EndIf}
  StrLen $2 $0
  ${If} $2 <= 3
    Goto unsafe
  ${EndIf}
  ; Match the app's derivation from Roaming AppData. LocalAppData can be
  ; redirected when an installer is launched inside a Windows app container.
  StrCpy $3 "$APPDATA\..\Local\QwenChat"
  System::Call 'kernel32::GetFullPathNameW(w r3, i ${NSIS_MAX_STRLEN}, w .r1, p 0) i .r2'
  ${If} $2 == 0
  ${OrIf} $2 >= ${NSIS_MAX_STRLEN}
    Goto unsafe
  ${EndIf}
  ; Compare complete path components, including drive roots, without relying
  ; on PathIsPrefixW's surprising treatment of trailing separators.
  StrCpy $2 $0 1 -1
  ${If} $2 != "\"
    StrCpy $0 "$0\"
  ${EndIf}
  StrCpy $2 $1 1 -1
  ${If} $2 != "\"
    StrCpy $1 "$1\"
  ${EndIf}
  StrLen $2 $1
  StrCpy $3 $0 $2
  StrCmp $3 $1 unsafe
  StrLen $2 $0
  StrCpy $3 $1 $2
  StrCmp $3 $0 unsafe
  Pop $3
  Pop $2
  Pop $1
  Pop $0
  Return
unsafe:
  StrCpy $VaultDirectoryUnsafe "1"
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd
Function .onVerifyInstDir
  Call CheckVaultDirectory
  ${If} $VaultDirectoryUnsafe == "1"
    Abort
  ${EndIf}
FunctionEnd
Function EnforceVaultDirectory
  Call CheckVaultDirectory
  ${If} $VaultDirectoryUnsafe == "1"
    IfSilent +2
      MessageBox MB_ICONSTOP "Der Programmordner darf den Tresor unter LocalAppData\QwenChat nicht enthalten und nicht darin liegen. Bitte Setup erneut mit einem anderen Ordner starten."
    SetErrorLevel 2
    Quit
  ${EndIf}
FunctionEnd
Function VaultGuardPage
  Call EnforceVaultDirectory
  Abort ; no visible extra page
FunctionEnd
!endif
!macroend

!macro customInit
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/VERIFYDIR=" $R1
  ${IfNot} ${Errors}
    StrCpy $INSTDIR $R1
    Call EnforceVaultDirectory
    SetErrorLevel 0
    Quit
  ${EndIf}
  Call EnforceVaultDirectory
!macroend
!macro customPageAfterChangeDir
  Page custom VaultGuardPage
!macroend
