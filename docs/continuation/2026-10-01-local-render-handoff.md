# Lokaler GPU-Render: Übergabe an den Laptop-Agenten

**Profil festgelegt:** Verwende den übergebenen `main`-Stand mit `profiles/last-light-bay.json` und notiere seine Commit-SHA. Das Profil liegt im Projekt vor; diese Anleitung ist keine Bestätigung eines bereits erfolgten Pushs oder eines erfolgreichen Hardware-Renders auf dem Laptop.

Ziel bleiben **20 Sekunden als 2560×1440/60-fps-Master plus 1920×1080/60-fps-Webversion**. Das gespeicherte Profil verwendet `linearMainOutput:true` und **`linearMainSampleScale:1`** für Testbilder und Master. Die unterbrochene Cloud-Aufnahme war nur ein Zwischenstand bei 24 fps. Die 2×-Vergleichsbilder bei 640 Pixeln begründen keine automatische Verdoppelung des höher aufgelösten Laptop-Masters.

## Kurzer Prompt zum Einfügen

> Rendere das aktuelle `main` von https://github.com/Leonxlnx/dronebeachshot auf meinem Laptop. Befolge `docs/continuation/2026-10-01-local-render-handoff.md` und verwende exakt `profiles/last-light-bay.json`. Bewahre vorhandene Änderungen und richte die beschriebenen Werkzeuge ein. Prüfe zuerst vier Bilder bei 1280×720 zu 0, 6, 10,5 und 19,5 Sekunden mit `backend=hardware` und bestätigtem GPU-Renderer. Danach rendere 20 Sekunden in 2560×1440 bei 60 fps und erzeuge daraus die 1080p60-Webversion. Verwende lineare Ausgabe mit Abtastung 1; ändere weder Szene noch Profil und übernimm keine Cloud-Browserpfade. Nutze bei Unterbrechungen die Checkpoints mit `resume`. Prüfe beide Videos auf 1200 Frames, 20 Sekunden, fehlerfreie Dekodierung und sichtbare Probleme. Gib mir beide MP4s bzw. ihre lokalen Pfade sowie Commit, GPU und Prüfergebnisse. Bei einem Hardware-Blocker berichte die konkrete Ursache; wechsle nicht still auf Software. Veröffentliche nichts und behaupte keine finale Realismusfreigabe.

## 1. Repository und Werkzeuge

Alle Befehle laufen im Repository-Verzeichnis. Bei einem vorhandenen **sauberen, nicht abweichenden** Checkout:

```sh
git switch main
git pull --ff-only origin main
git rev-parse HEAD
```

Andernfalls separat klonen, ohne lokale Arbeit zurückzusetzen:

```sh
git clone --branch main https://github.com/Leonxlnx/dronebeachshot.git
cd dronebeachshot
git rev-parse HEAD
```

Verwende Node.js 24. `ffmpeg` mit `libx264` sowie `ffprobe` müssen im PATH liegen. Prüfe das tatsächliche Betriebssystem und installiere fehlende Werkzeuge auf dessen üblichem Weg. Danach:

```sh
node --version
ffmpeg -version
ffprobe -version
npm ci
npx --no-install playwright install chromium
npm run build
```

Diese Befehle sind für POSIX-Shells unter macOS/Linux und PowerShell unter Windows geeignet. Falls PowerShell ausschließlich das npm/npx-Startskript durch seine Ausführungsrichtlinie blockiert, nutze `npm.cmd` bzw. `npx.cmd`; ändere dafür keine globale Richtlinie. Linux benötigt außerdem die von Playwright gemeldeten Chromium-Systembibliotheken. Behebe konkrete Startfehler, statt Sandbox oder GPU-Prüfung abzuschalten.

Netzwerk wird für Git, npm, Browser-Download und gegebenenfalls fehlende Werkzeuge benötigt. `npm run build` führt vor TypeScript/Vite automatisch `recovery/restore-assets.mjs` aus: Modelle und Texturen kommen mit Prüfsummen aus den eingecheckten Archiven in `recovery/archives.json`. Dafür sind weder Python noch externe Asset-Downloads erforderlich. Eine abweichende vorhandene Asset-Datei wird bewahrt und als Fehler gemeldet. Der Capture-Runner startet seinen eigenen HTTP-Server für den Produktionsbuild und schaltet den Browser nach dem Laden offline. Kein zusätzlicher Dev-Server und keine Installation unter `docs/native-render` sind nötig.

## 2. Profil und echter lokaler GPU-Renderer

Lies `profiles/last-light-bay.json`. Übernimm das festgelegte Profil exakt, einschließlich ausdrücklich ausgewählter Studien; aktiviere keine weiteren Varianten. Es schaltet unter anderem Küstenreflexion, Island-Direktlichtantwort und die gewählte Wolkenform bei `cloudCoverage:0.4` ein; Gras- und Sandpalette stehen auf 1. Far-Crown-Blending, zusätzliche Küstenbüsche und Sandfilmtrocknung bleiben aus. Maßgeblich ist die JSON-Datei. Der aktuelle Realismus ist nicht als fertiges Ergebnis freigegeben.

Verwende das lokal von Playwright installierte Chromium. Entferne einen eventuell geerbten Browserpfad in einer POSIX-Shell:

```sh
unset BAY_BROWSER_EXECUTABLE
```

Unter Windows/PowerShell stattdessen:

```powershell
Remove-Item Env:BAY_BROWSER_EXECUTABLE -ErrorAction SilentlyContinue
```

`backend=hardware` verwendet Chromium mit Sandbox und prüft vor der Szene einen kleinen WebGL2-Kontext. Bekannte Software-Renderer wie SwiftShader/llvmpipe sowie ein nicht überprüfbarer unmaskierter Renderer werden abgelehnt. Der tatsächliche Szenen-Renderer wird erneut geprüft und dokumentiert. CPU- und simulierte Ablaufprüfungen bestehen; ein konkreter Laptop-GPU-Lauf wurde hier nicht durchgeführt. Der unveränderte Standard ohne `backend=hardware` ist weiterhin Software-Rendering.

Übernimm keine Cloud-Werte für `memoryStartMiB`, `memoryLimitMiB`, `memoryMetric=working` oder `jsHeapMiB`. Der optionale Speicherwächter liest Linux-cgroup-Dateien und ist kein allgemeiner Laptop-RAM-Wächter. Beobachte den lokalen Speicherbedarf mit Systemwerkzeugen; halte Netzteil, genügend freien Speicherplatz und einen wachen Laptop bereit.

## 3. Zuerst vier Testbilder

```sh
node scripts/progress-capture.mjs width=1280 height=720 views=0,6,10.5,19.5 backend=hardware profile=profiles/last-light-bay.json out=artifacts/local-hardware-stills
```

Prüfe `manifest.json` und alle vier Bilder (`flight-0.000.png`, `flight-6.000.png`, `flight-10.500.png`, `flight-19.500.png`) auf korrekte Szene, Zeit, Produktionsidentität und Fehlerfreiheit. Der kleine GPU-Test allein belegt noch keinen fehlerfreien Szenen-Render. Bei Software-Fallback oder fehlendem WebGL2 Diagnose bewahren und stoppen, statt still auf Software umzuschalten.

Jeder neue Lauf braucht einen neuen Ausgabeordner. Einzelbildserien unterstützen kein `resume`: nach einem Fehler die Belege behalten und in einem anderen Ordner neu starten. Die alte Cloud-Serie mit 296 Bildern bis 12,29166667 Sekunden gehört zu einem anderen Software-Render und wird nicht beigemischt.

## 4. Master: 20 Sekunden, 1440p60

**Empfohlen: `linearMainOutput:true`, `linearMainSampleScale:1`**, exakt wie im eingecheckten Profil. Prüfe den lokalen Speicherbedarf; bei Bedarf zuerst ein einzelnes Bild in Master-Auflösung mit diesem Profil und einem neuen Ausgabeordner. Eine optionale 2×-Studie würde intern 5120×2880 erzeugen und darf erst nach einem einzelnen Testbild mit GPU-/VRAM-/Kapazitätsprüfung erfolgen. Dafür ein ausdrücklich kopiertes Profil und einen frischen Ausgabeordner verwenden. Die 2×-Einstellung ist keine Vorgabe für diesen Master und wird niemals mitten im Lauf oder beim Resume eingeschaltet.

```sh
node scripts/progress-capture.mjs video width=2560 height=1440 fps=60 duration=20 start=0 backend=hardware profile=profiles/last-light-bay.json out=artifacts/local-render-1440p60
```

Der Runner rendert 1200 tatsächliche Zeitpunkte in hoher Szenenqualität und schreibt vor dem Encoder jeweils ein PNG dauerhaft weg. Plane Platz für PNGs, eingefrorenen Build mit Assets und beide MP4s ein. Keine Zwischenbild-Interpolation, ausgelassenen Renderdurchgänge oder Geometrievereinfachung einführen. Die Laufzeit ist ohne lokale Messung unbekannt.

## 5. Unterbrochenen Master fortsetzen

Bewahre den kompletten Ausgabeordner und verwende denselben Befehl mit `resume`:

```sh
node scripts/progress-capture.mjs video width=2560 height=1440 fps=60 duration=20 start=0 backend=hardware profile=profiles/last-light-bay.json out=artifacts/local-render-1440p60 resume
```

Commit, Profil, Auflösung, Timing, Backend, Laptop/GPU-Konfiguration und Ausgabeordner bleiben gleich. Der Runner prüft gespeicherte PNGs und `render-bundle`, spielt den vorhandenen Anfang in einen neuen Encoder und rendert den fehlenden Rest. Hardware-Resume verlangt dieselben Angaben für Renderer, WebGL-Version, MSAA-Samplezahl und Backend. Ein geänderter GPU-/Browserzustand verlangt einen neuen Ausgabeordner; Software- und Hardware-Präfixe werden nicht kombiniert.

Linux verwendet die bestehende geprüfte Prozessidentität. macOS/Windows verwenden einen konservativen exklusiven Lock ohne automatische Entfernung alter Locks. Nach einem harten Abbruch befolge `docs/portable-capture-locks.md`: erst das tatsächliche Ende des ursprünglichen Capture-Prozesses und seines Renderers sicherstellen, dann gegebenenfalls nur dessen Lock gezielt entfernen. Bei unklarer Eigentümerschaft einen neuen Ausgabeordner verwenden. Die Wiederaufnahmeprüfungen bleiben bestehen. Fehlerdetails stehen in `capture-status.json`, `manifest.json` und gegebenenfalls `last-resume-rejection.json`.

## 6. Master prüfen und Webversion erzeugen

Erwartet werden im Master-Ordner `last-light-bay-progress.mp4`, `manifest.json`, `capture-status.json`, `render-bundle/` sowie `frames/000000.png` bis `frames/001199.png`. Der Exporter behält seinen bisherigen Dateinamen. Verlange `captureSucceeded: true`, 1200 Frame-Einträge, richtigen Vertrag und Produktionsidentität, `offlineAfterLoad: true`, dokumentierte Hardware-Grafik und keine aktuellen Browser-/Ladefehler. Ein erfolgreich fortgesetzter Lauf darf frühere Fehlerprotokolle weiterhin enthalten.

```sh
ffprobe -v error -count_frames -show_streams -show_format -of json artifacts/local-render-1440p60/last-light-bay-progress.mp4
ffmpeg -v error -xerror -i artifacts/local-render-1440p60/last-light-bay-progress.mp4 -map 0:v:0 -f null -
```

Prüfkriterien: genau ein Videostream, kein Audio, H.264, `yuv420p`, 2560×1440, `avg_frame_rate: 60/1`, 1200 dekodierte Frames, ungefähr 20,000 Sekunden und vollständiges Dekodieren ohne Fehler. Der letzte Szenenzeitpunkt ist 19,98333333 Sekunden. Sieh den gesamten Film sowie insbesondere die Frames `000000`, `000360`, `000630` und `001170` bei 0/6/10,5/19,5 Sekunden an. Technischer Erfolg ersetzt keine Realismusfreigabe oder die übrigen finalen Projekt-Gates.

Lasse die Checkpoint-Datei unverändert, kopiere den geprüften Master auf den Auslieferungsnamen und erzeuge daraus die Webversion ohne neue Zeitpunkte:

```sh
node -e "require('node:fs').copyFileSync('artifacts/local-render-1440p60/last-light-bay-progress.mp4','artifacts/local-render-1440p60/last-light-bay-1440p60.mp4',require('node:fs').constants.COPYFILE_EXCL)"
ffmpeg -hide_banner -n -i artifacts/local-render-1440p60/last-light-bay-1440p60.mp4 -map 0:v:0 -an -vf scale=1920:1080:flags=lanczos -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart artifacts/local-render-1440p60/last-light-bay-1080p60.mp4
ffprobe -v error -count_frames -show_streams -show_format -of json artifacts/local-render-1440p60/last-light-bay-1080p60.mp4
ffmpeg -v error -xerror -i artifacts/local-render-1440p60/last-light-bay-1080p60.mp4 -map 0:v:0 -f null -
```

Für die Webversion gelten 1920×1080, 60/1 fps, 1200 dekodierte Frames, dieselbe Dauer und kein Audio. Prüfe beide Dateien auch beim Abspielen auf sichtbare Farb-/Helligkeitsabweichungen. Füge keine Farbraum-Tags ohne passende Umwandlung hinzu und verändere den Master-Exporter nicht. Kopier- und Ableitungsbefehle überschreiben vorhandene Auslieferungsdateien absichtlich nicht.

Gib beide MP4-Pfade, Testbilder-/Checkpoint-Ordner, Commit-SHA, Profilpfad, GPU-Renderer, Prüfergebnisse und offene sichtbare Probleme zurück. Bewahre die Checkpoints. Kein Upload, Push der Videos oder Veröffentlichungsauftrag ist Teil dieses lokalen Render-Prompts.

## Optionale schnelle Vorschau

Nur falls zusätzlich gewünscht: 1080p24 ist eine separate Vorschau mit 480 Frames und ersetzt keines der beiden 60-fps-Ziele.

```sh
node scripts/progress-capture.mjs video width=1920 height=1080 fps=24 duration=20 start=0 backend=hardware profile=profiles/last-light-bay.json out=artifacts/local-preview-1080p24
```
