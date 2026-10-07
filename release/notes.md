# KAIROS 0.3.0

Knowledge & AI Runtime Orchestration System – bisher Qwen Chat.

- Austauschbare ComfyUI-Profile, auch mehrere auf demselben Server. API-Workflow oder vollständiges Profil importieren und austauschen; Zuordnungen, Standardwerte und Grenzen pro Profil.
- Prompt sowie optionale Zuordnungen für Negative Prompt, Breite, Höhe, Schritte, Seed und CFG. Im Chat erscheinen nur zugeordnete Parameter. Jeder Auftrag befüllt eine Kopie; gespeicherte Prompt-Eingänge werden geleert.
- Windows-DPAPI schützt Workflow-Vorlagen, Einstellungen und Chatverlauf. API-Zugänge bleiben in einem separaten verschlüsselten Tresor. Keine eingebauten Schlüssel und kein Klartext-Fallback.
- Foto- sowie Text-/Code-Uploads pro Modell einzeln freigeben. Deaktivierte Anhänge werden auch aus dem mitgesendeten Verlauf ausgeschlossen.
- Chats mit Bestätigung löschen, einschließlich ungenutzter Anhänge im aktiven Tresor. Bereits angelegte Update-Sicherungen bleiben erhalten.
- Gemeinsame Verlaufsliste: Beim Modellwechsel wird das aktuelle Gespräch im Rahmen des Kontextfensters an das neue Chatmodell übergeben.
- Beta-Option zeigt alle neueren versionierten öffentlichen Releases einschließlich beliebig benannter Pre-Releases. Entwürfe sind keine öffentlichen Updates. Download wählt die höchste neuere Version mit Windows-Updatedateien.

Dieses Release wird regulär veröffentlicht, damit bisherige Versionen mit Stable-Prüfung 0.3.0 finden. Für spätere Pre-Releases danach die Beta-Option aktivieren.

Setup: `KAIROS-Setup-0.3.0-x64.exe` über die bestehende EXE-Installation installieren. MSI-Anwender verwenden das neue MSI. App-ID, MSI-Upgrade-ID und externer Tresorpfad bleiben erhalten. Nicht zwischen EXE und MSI wechseln, ohne die bisherige Programm-Installation zu entfernen; der externe Tresor bleibt erhalten.

72 automatisierte Tests und isolierter Electron-Fenstertest bestanden: Profile, optionale Felder, Bilddarstellung und Export, Upload-Einstellungen, Beta-Speicherung und Chat-Löschen. Der konkrete Qwen-Image-2.1-Workflow fehlt noch; kein echter Bildgenerierungslauf behauptet.

Weiterhin unsignierte Windows-Pilotversion: Updateprüfung und Download verfügbar, automatische Installation in der App gesperrt. Setup manuell starten, sofern Windows dies erlaubt. Außerhalb Windows ist kein zuverlässiger Schlüsselspeicher implementiert; die App verweigert dort den Start.
