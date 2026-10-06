# Harekær Golfklub · Danmarksturneringen 2026

Statisk website med pointoversigt for klubbens fire hold.

## Åbn sitet

Åbn `index.html` direkte i en browser. Ingen server eller build-værktøjer nødvendige.

## Filer

| Fil | Formål |
|---|---|
| `index.html` | Sidens struktur |
| `styles.css` | Styling |
| `app.js` | Rendering, sortering og faner |
| `data.js` | Genereret datafil som sitet indlæser |
| `data.json` | Rådata hentet fra GolfBox |
| `scrape.js` | Henter data fra GolfBox' livescoring-API |
| `build.js` | Konverterer `data.json` til `data.js` |
| `verify.js` | Headless smoke test af rendering og pointberegning |

## Opdater data

```bash
node scrape.js   # henter friske resultater -> data.json
node build.js    # genererer data.js
node verify.js   # kontrollerer at alt stadig stemmer
```

## Hold

| Hold | Pulje | Competition ID |
|---|---|---|
| 1. hold | Pulje 3 | 5361058 |
| 2. hold | Pulje 4 | 5361157 |
| 3. hold | Pulje 5 | 5361479 |
| Senior hold | Pulje 2 | 5368054 |

## Pointberegning

- Sejr: **2 point**
- Delt kamp: **1 point**
- Nederlag: **0 point**

Single og foursome vægter ens.

Begge spillere i en foursome tildeles kampens fulde pointværdi.

1.–3. hold spiller 3 singler + 2 foursomes pr. holdkamp. Seniorholdet spiller
5 singler + 1 foursome.

Kolonnen **Udbytte** viser hvor stor en andel af spillerens mulige point der
blev hentet hjem — det gør spillere med forskelligt antal kampe sammenlignelige.

## Rangering

Spillere rangeres på point. **Ved lige point vinder den med størst procentvis
udbytte**, altså den der har hentet flest point pr. spillet kamp. Står de også
lige dér, sorteres alfabetisk.
