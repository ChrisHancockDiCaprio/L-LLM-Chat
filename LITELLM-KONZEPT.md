# LiteLLM-Anbindung – Konzept

Die Anwendung zeigt bereits eine eigene LiteLLM-Ansicht in den Einstellungen. Sie ist ausdrücklich ein Konzept und stellt keine Verbindung her. Es ist kein LiteLLM-Server installiert, kein Anbieter eingerichtet und kein Schlüssel gespeichert.

## Vorgesehene Bedienung

Eine LiteLLM-Verbindung erhält einen Anzeigenamen, eine Gateway-Adresse, einen Modellalias und optional einen vom Gateway vergebenen Zugangsschlüssel. Nach erfolgreicher Prüfung sollen angebotene Modelle auswählbar sein. Dieselben Schalter und dieselbe Chat-Auswahl wie bei Ollama können verwendet werden.

Der Modellalias ist der am Gateway veröffentlichte Name; die App muss den dahinterliegenden Anbieter nicht kennen. Die Providerkonfiguration und deren eigene Zugangsdaten bleiben am Gateway. [LiteLLM-Client-Dokumentation](https://docs.litellm.ai/docs/proxy/user_keys)

```text
Windows-Chat → LiteLLM-Gateway → freigegebenes lokales oder anderes Modell
```

## Geplante Umsetzung

- Den bisherigen Ollama-Transport durch einen zweiten Provideradapter ergänzen. LiteLLM verwendet die OpenAI-kompatible Chat-Completions-Schnittstelle; Ollama bleibt bei seiner nativen `/api/chat`-Schnittstelle. Den jeweils konfigurierten Basispfad korrekt erhalten; nicht pauschal `/v1` doppelt anhängen. [Schnittstellen und Beispiele](https://docs.litellm.ai/docs/proxy/user_keys)
- Die Modellliste über die vom Gateway angebotene [Model-Discovery-Schnittstelle](https://docs.litellm.ai/docs/proxy/model_discovery) beziehen und nur tatsächlich verfügbare Aliase anbieten. Eine lokale App-Deaktivierung bleibt unabhängig von der Modellverwaltung im Gateway.
- Den bereits für Ollama implementierten separaten Windows-Tresor und die HTTPS-Regeln für einen künftigen Gateway-Schlüssel wiederverwenden. Einstellungen und Historie sind ebenfalls verschlüsselt; die Oberfläche erhält keine gespeicherten Schlüssel. Der Zugriff auf LiteLLM selbst bleibt weiterhin ein Konzept. Schutzgrenzen und Sitzungsfreigabe stehen in `SICHERHEITSKONZEPT.md`. [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- Vor dem ersten Senden den ausgewählten Anbieter und das Ziel kenntlich machen. Der bisherige ausgewählte Gesprächskontext wird dann an das Gateway weitergegeben; Aktivieren allein sendet noch keine Unterhaltung.
- Abbrechen, Fristen, Fehler, Modellmetadaten und Historie über den gemeinsamen Chatablauf behandeln. Keine automatische Umleitung auf einen anderen Anbieter ohne vom Benutzer gewählte Regel.

## Was später geprüft werden muss

Erreichbarkeit, geschützte Schlüsselablage, korrekter Basispfad, angebotene Modellalias-Namen, erfolgreiche Antworten, ungültige Schlüssel, Rate-Limits, deaktivierte Verbindungen und Abbruch. Erst nach diesen Prüfungen soll der Verbindungsbutton aktiv sein.

Der LiteLLM-Gateway kann mehrere Provider bündeln. Modellkonfiguration, Routing und Zugangskontrolle wären dessen eigene Einrichtung; die Windows-App wäre sein Chat-Client. [Gateway-Übersicht](https://docs.litellm.ai/docs/simple_proxy)
