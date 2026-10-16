# Boudewijn Rooseboom — website

## Mappen

```
index.html      ← teksten (naam, subheader, tribute)
style.css       ← vormgeving
script.js       ← fotoroulette + muziekspeler (niet aankomen)
config.js       ← instellingen (snelheid, volume, shuffle)
photos/         ← zet hier je foto's
music/          ← zet hier je muziek
```

De bestandsnamen maken niet uit. De site leest zelf alles in wat in `photos/` en `music/` staat.

- **Foto's:** jpg, jpeg, png, webp, gif. iPhone-foto's (.HEIC) eerst exporteren als JPG. Ze worden automatisch zwart-wit en korrelig.
- **Muziek:** mp3 (aanbevolen), wav, m4a, ogg, flac. De titel in de speler komt uit de bestandsnaam. `03 - Late Night Brush.mp3` wordt dus **Late Night Brush**.

> Tip: gebruik mp3 (320 kbps). Een wav van 5 minuten is ±50 MB. Dat laadt traag voor bezoekers, en GitHub weigert bestanden boven 100 MB.
> Foto's: ±2000 px breed is genoeg en houdt de site snel.

---

## Online zetten met GitHub Pages (gratis, eenmalig ±5 min)

1. Ga naar **github.com** → rechtsboven **+** → **New repository**.
2. Naam: bijvoorbeeld `boudewijn` → zet op **Public** → **Create repository**.
3. Klik op **uploading an existing file**. Pak de zip uit en sleep de **inhoud** van de map (index.html, style.css, script.js, config.js, photos, music) in het venster → **Commit changes**.
4. Ga naar **Settings** → **Pages** (in het linkermenu).
   Bij *Source*: **Deploy from a branch** → Branch: **main** / **(root)** → **Save**.
5. Na 1–2 minuten staat de site online op:
   **`https://JOUWGEBRUIKERSNAAM.github.io/boudewijn/`**

### Later foto's of muziek toevoegen
Open de map `photos` of `music` in je repository → **Add file** → **Upload files** → sleep de bestanden erin → **Commit changes**. Binnen een minuut of twee staan ze live.
Verwijderen: klik het bestand aan → **⋯** → **Delete file**.

---

## Aanpassen

**Teksten:** open `index.html` (op GitHub: bestand aanklikken → potloodje ✎) en pas de tekst aan tussen de tags.

**Snelheid fotoroulette:** in `config.js`:
- `fastestSeconds: 3`: schuifje helemaal op *fast*
- `slowestSeconds: 10`: schuifje helemaal op *slow*
- `startSeconds: 6`: beginstand

**Eigen domein** (bijv. boudewijnrooseboom.nl): vul in `config.js` bij `github` je gebruikersnaam en reponaam in. Anders kan de site de mappen niet uitlezen.

**Ander lettertype voor de naam:** in `style.css`, regel `--f-script`. Alternatieven van Google Fonts: *Pinyon Script*, *Allura*, *La Belle Aurore*. Het lettertype moet dan ook in de Google Fonts-link bovenin `index.html` staan.

---

## Goed om te weten
- Browsers spelen pas geluid af na een klik. Daarom is er het **enter**-scherm. Daarna speelt de muziek non-stop door, track na track.
- Op iPhone werkt de volumeknop van de site niet. Daar gebruik je de knoppen van de telefoon (een beperking van iOS).
- Toetsenbord: **spatie** = play/pauze, **← →** = vorige/volgende.
- De speler werkt ook vanaf het vergrendelscherm van je telefoon.
