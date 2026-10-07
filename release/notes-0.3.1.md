# KAIROS 0.3.1

- Optionale SSH-Tunnel je Server: Agent, importierter Schlüssel oder Passwort; Geheimnisse mit Windows-DPAPI geschützt, explizite Fingerprint-Bestätigung und Sperre bei geändertem Hostschlüssel. Lokaler Listener nur 127.0.0.1, freier Ersatzport bei Konflikten. Keine entfernten Shellbefehle oder Serververwaltung.
- Keine automatische Beendigung nach 240 Sekunden; ursprüngliche Generierung weiter abwarten, ehrliche Statushinweise, keine automatischen Wiederholungen.
- Verschlüsselte Auftragszuordnung und ComfyUI-Wiederabruf nach Neustart, lokalem Abbruch oder Verbindungsausfall. Mehrfacher Abruf erzeugt keine doppelten Bilder. Geänderte Serverziele blockieren alte Zuordnungen.
- Eigene wartende ComfyUI-Aufträge gezielt entfernen. Laufende Jobs werden nicht global unterbrochen. Ohne nachgewiesenen Serverabbruch heißt die Aktion „Nicht mehr warten“.
- Offline-Modelle nicht aktivierbar; Einstellungen bei laufenden Anfragen gesperrt. Bestehende Workflowprofile, Chats und verschlüsselte Tresore bleiben erhalten.

Details und überprüfte Grenzen: SSH-UND-AUFTRAEGE.md. Colibri auf Ubuntu konnte mangels nutzbaren SSH-Zugangs nicht live untersucht werden; Ollama/Colibri besitzen keinen hier nachgewiesenen dauerhaften Ergebnis-Wiederabruf. Kein paralleler Betrieb mehrerer Chat-Aufträge.

Weiterhin unsignierte Windows-Pilotversion: Updates prüfen und herunterladen; Setup anschließend manuell installieren. Der vorhandene Tresor bleibt außerhalb des Programmordners.

Validierung: 86 Tests sowie isolierte Electron-Prüfungen bestanden. SSH-Fehlerfälle wurden mit lokalen echten SSH-Testservern geprüft.
