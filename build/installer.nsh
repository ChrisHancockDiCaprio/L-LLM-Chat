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
  StrCpy $VaultDirectoryUnsafe "0"
  GetFullPathName $0 "$INSTDIR\"
  GetFullPathName $1 "$LOCALAPPDATA\QwenChat\"
  System::Call 'shlwapi::PathIsPrefixW(w r0, w r1) i .r2'
  ${If} $2 != 0
    Goto unsafe
  ${EndIf}
  System::Call 'shlwapi::PathIsPrefixW(w r1, w r0) i .r2'
  ${If} $2 != 0
    Goto unsafe
  ${EndIf}
  Pop $2
  Pop $1
  Pop $0
  Return
unsafe:
  StrCpy $VaultDirectoryUnsafe "1"
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
