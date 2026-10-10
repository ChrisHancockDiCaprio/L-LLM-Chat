# KAIROS Portable 0.5.1 für Windows x64

Die ZIP enthält das Programm mit Electron und seinen benötigten Bibliotheken. Node.js und ein Installer sind für den Start nicht erforderlich.

1. ZIP vollständig in einen beschreibbaren Ordner entpacken, beispielsweise `Dokumente\KAIROS-0.5.1`.
2. KAIROS.exe aus diesem Ordner starten. Die weiteren Dateien neben der EXE müssen erhalten bleiben.
3. Vorhandene Gespräche und Einstellungen werden aus dem bisherigen verschlüsselten Windows-Tresor geladen.

## Daten und manuelle Updates

Programmdateien lassen sich verschieben. Deine Daten liegen weiterhin unter `%LOCALAPPDATA%\QwenChat\Vault`; sie werden nicht neben die EXE verschoben oder mit der ZIP ausgeliefert. Die Verschlüsselung ist an dein Windows-Benutzerkonto gebunden. Eine Tresorkopie lässt sich nicht allein auf einem fremden PC oder mit einem anderen Konto entschlüsseln. USB-Nutzung des Programms ist möglich; deine vertraulichen Daten reisen dadurch nicht automatisch mit.

Unter Einstellungen → Updates kannst du auf neue GitHub-Veröffentlichungen prüfen. „Release-Seite öffnen“ öffnet die geprüfte Quelle im Browser. KAIROS lädt keine Programmupdates herunter, startet keinen Installer und ersetzt keine eigenen Dateien.

Für einen Wechsel: neue portable ZIP selbst herunterladen, vollständig in einen neuen Ordner entpacken, KAIROS beenden und dort KAIROS.exe starten. Den bisherigen Programmordner bis zur Prüfung behalten. Dieselbe Windows-Anmeldung nutzt weiterhin denselben Tresor. Vor einem Wechsel kann der vollständig geschlossene Tresorordner zusätzlich gesichert werden; diese Kopie bleibt ebenfalls an das Windows-Konto gebunden.

## Herkunft und aktueller Umfang

Die ZIP enthält originale Electron-/Chromium-Hinweise sowie KAIROS' Open-Source-Nachweise. `electron-updater` und `lazy-val` werden nicht mehr als Laufzeitbestandteile ausgeliefert. Die bisherige Nachweislücke wurde durch Entfernung der betreffenden Laufzeitabhängigkeit beseitigt; ein fehlender Originaltext wurde nicht erfunden.

Hancock, die ersten Groq-/OpenRouter-Anschlüsse und die bisherigen Chat-, Bild- und Sprachfunktionen sind enthalten. KittenTTS, Streaming und sichere Kostenlos-/Budgetregeln stehen weiterhin im Plan. Die Ausgabe wird vor dem GitHub-Release automatisiert gebaut und geprüft. Sie besitzt kein verifiziertes Windows-Herausgeberzertifikat; SHA-256 und Validierungsbericht werden beim Release mitgeliefert.
