# Austauschbare Bild-Profile in KAIROS

1. Einstellungen → Server & Modelle: ComfyUI mit `http://<SERVER-IP>:8188` hinzufügen. HTTP nur als ausdrücklich erlaubte Heimnetz-Ausnahme; Zugänge erfordern HTTPS. ComfyUI wird separat über `/prompt`, `/history` und `/view` angesprochen.
2. In der ComfyUI-Karte **API-Workflow importieren** wählen. Für ein weiteres Modell auf demselben Server **Weiteres Bild-Profil** anklicken, über **Bearbeiten** benennen, anschließend dessen eigene Vorlage importieren. Das neue Profil bleibt deaktiviert.
3. **Workflow zuordnen**: Prompt-Eingang und Bild-Ausgabe-Node wählen. Negative Prompt, Breite, Höhe, Seed, Schritte und CFG nur zuordnen, wenn der Workflow sie unterstützt. Verbundene Node-Eingänge sind nicht direkt editierbar.
4. Für zugeordnete Zahlenfelder Standard, Minimum, Maximum und Schrittmaß einstellen. Grenzen werden beim Senden erneut geprüft. Sicherheitsobergrenzen: Größe 128–4096 in Vielfachen von 8, Schritte 1–150, Seed -1 oder 0–4294967295, CFG 0–100.
5. Profil aktivieren und im Chat auswählen. Dort erscheinen ausschließlich zugeordnete Parameter. Seed -1 erzeugt Zufall, sofern Seed zugeordnet ist. Die Modell- und Node-IDs sind vollständig profilabhängig, ohne Qwen-Sonderbehandlung.
6. Einen Workflow austauschen: im gewünschten Profil erneut importieren. Ein reiner API-Import setzt dessen Zuordnung zurück und deaktiviert nur dieses Profil. Andere Profile behalten ihre Vorlage. Erneut zuordnen und aktivieren.

Zusätzlich zum API-Graphen akzeptiert der Import vollständige Profil-Dateien mit folgenden Feldern:

```json
{
  "backendType": "comfyui",
  "baseUrl": "http://<SERVER-IP>:8188",
  "name": "Mein Bildmodell",
  "nodes": {},
  "mapping": {"prompt": {"nodeId": "<ID aus diesem Workflow>", "input": "<Eingang>"}, "outputNode": "<Bild-Ausgabe-ID>"},
  "options": {"steps": 20, "seed": -1, "cfg": 7},
  "limits": {"cfg": {"min": 0, "max": 20, "step": 0.5}}
}
```

Das ist eine Schema-Erklärung, kein ausführbarer Workflow: `nodes` muss den vollständigen API-Graphen enthalten. Nicht unterstützte Mapping-Felder weglassen oder auf `null` setzen. Backend und Server müssen zur ausgewählten Verbindung passen. Dateigröße höchstens 2 MB, maximal 300 Nodes. Es wird kein Workflow ausgeführt, nur weil er importiert wurde.

Nach Zuordnung werden die Prompt- und Negative-Prompt-Eingänge der gespeicherten Vorlage geleert. Importierter Beispieltext dient nur als Testinhalt. Jede Anfrage erhält eine eigene Kopie im Speicher. Benutzerprompts gehören zum verschlüsselten Chatverlauf, nicht zur Vorlage. Negative Prompt ist ein Auftragsparameter und wird nicht als dauerhafter Textstandard gespeichert. Andere nicht zugeordnete Konstanten des Graphen bleiben erhalten.

Vorlagen, Zuordnungen, Profilmetadaten und Grenzen liegen verschlüsselt in `workflows.vault`, pro Profil-ID. Bestehende Vorlagen aus 0.2.2 werden automatisch auf die zugehörigen Profile übernommen. API-Schlüssel liegen separat in `credentials.vault` und werden nur für den passenden HTTPS-Ursprung verwendet. Bekannte Schlüssel-/Passwortfelder mit eingetragenen Geheimnissen werden beim Workflow-Import abgewiesen; eigene Workflow-Nodes dürfen ebenfalls keine Geheimnisse enthalten.

Die Produktionslaufzeit ist derzeit Windows/Electron. `safeStorage` verwendet Windows-DPAPI mit einem vom Windows-Konto geschützten Schlüssel. Es gibt keinen fest eingebauten Schlüssel und keine Base64-Verschleierung der Tresordateien. Entschlüsselte Daten sind während der Nutzung im Arbeitsspeicher nötig. Andere Laufzeiten sind mangels verlässlich angebundenem Schlüsselspeicher gesperrt, ohne Klartext-Fallback. Original-JSON-Dateien außerhalb der App werden nicht automatisch verschlüsselt oder gelöscht.

Einstellungen je Modell: Text-/Code-Dateien und Fotos einzeln aktivieren/deaktivieren. Die Freigabe ersetzt keine Modellfähigkeit; Fotos brauchen ein Vision-Modell bzw. eine unterstützte Bildbearbeitungs-API. ComfyUI bleibt derzeit Text-zu-Bild, ohne Bild-Input-Mapping. Bei deaktivierten Uploads werden vorhandene entsprechende Anhänge weiterhin angezeigt, aber nicht erneut an das Modell gesendet. Dateien derzeit UTF-8-Text/Code, kein PDF/Office.

Beim Wechsel des Chatmodells bleibt das geöffnete Gespräch erhalten und wird innerhalb der Kontextgrenzen mitgesendet. Bildgenerierungs-Backends erhalten nur den aktuellen Bildauftrag. **Chat löschen** entfernt das Gespräch und ungenutzte Anhänge aus dem aktiven Tresor; Update-Sicherungen bleiben vorhanden.

Updates: Repository weiterhin frei konfigurierbar. **Beta** berücksichtigt versionierte öffentliche Releases und Pre-Releases unabhängig vom Kanalnamen, sortiert nach SemVer. Veröffentlichungen ohne Windows-Setup/`latest.yml` erscheinen mit Hinweis; nur installierbare neuere Versionen werden angeboten. Keine Downgrades, keine Release-Entwürfe. Die Liste wird mit maximal 1000 Veröffentlichungen gelesen; bei Überschreitung bricht die Prüfung mit einer Meldung ab.
