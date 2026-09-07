# Verzoek om instemming ex art. 27 lid 1 onder k en l WOR — activiteitenlog Investment Tracker

> **Bestuurder:** Dils Netherlands B.V. **Geen juridisch advies / Not legal advice.** Dit is een conceptverzoek. Het moet worden gecontroleerd door een Nederlandse arbeidsrechtjurist en, indien Dils NL een ondernemingsraad heeft, formeel worden ingediend bij die OR. **Datum concept:** 2026-09-07.

## Open items

- [[confirm: heeft Dils Netherlands B.V. een ondernemingsraad (OR)? Zo nee: dit document dient als vastlegging dat de beoordeling is gemaakt, voor het geval er later een OR wordt ingesteld.]]
- [[confirm: naam bestuurder / indiener]]
- [[confirm: naam OR-voorzitter / contactpersoon OR]]
- [[confirm: beoogde datum indiening bij de OR]]
- [[confirm: beoogde evaluatiedatum, voorstel: 12 maanden na instemming]]

---

**Aan:** de ondernemingsraad van Dils Netherlands B.V.
**Van:** [[confirm: naam bestuurder / indiener]]
**Betreft:** verzoek om instemming ex artikel 27 lid 1, onderdeel k (verwerking en bescherming van persoonsgegevens van de in de onderneming werkzame personen) en onderdeel l (voorziening gericht op of geschikt voor waarneming van of controle op aanwezigheid, gedrag of prestaties van de in de onderneming werkzame personen) van de Wet op de ondernemingsraden
**Datum:** [[confirm: beoogde datum indiening bij de OR]]

### 1. Onderwerp

Dit verzoek betreft het activiteitenlog (`ActivityLog`) en de wijzigingsgeschiedenis (`StageHistory`) van de Investment Tracker — de interne applicatie waarmee Dils NL vastgoeddeals van teaser tot afronding beheert — inclusief de tijdlijnpagina waarop deze gegevens per medewerker en per deal zichtbaar zijn gemaakt (`src/app/(protected)/assets/[id]/timeline/[trackingId]/page.tsx`).

### 2. Beschrijving van de voorziening

De voorziening registreert automatisch elke door een medewerker geïnitieerde actie in het deal-proces: het aanmaken, wijzigen en verwijderen van assets, bedrijven en trackings; statuswijzigingen en goedkeuringen van processtappen; documentacties (uploaden, ondertekenen, verwijderen, afwijzen); het versturen van uitnodigingen; en accountgerelateerde acties. Per actie wordt vastgelegd: welke medewerker de actie heeft uitgevoerd, welke actie het betreft, het tijdstip, en actie-specifieke details (bijvoorbeeld het e-mailadres van een ontvanger of de naam van een document). De volledige actielijst is opgenomen in [code-fact-sheet-2026-09.md §3](code-fact-sheet-2026-09.md). De gegevens zijn zichtbaar voor medewerkers met de rol ADMIN en EDITOR; de rol VIEWER (opdrachtgevers) ziet geen medewerker-identiteiten; investeerders hebben in het geheel geen toegang. Zie [staff-monitoring-protocol.md](staff-monitoring-protocol.md) voor de volledige technische en organisatorische beschrijving.

De voorziening is **reeds in productie in gebruik**. Dit verzoek dient om — achteraf — de vereiste instemming alsnog te verkrijgen en de voorziening voor de toekomst op een deugdelijke grondslag te zetten. Dat een voorziening al functioneert, doet niet af aan de instemmingsplicht: zonder instemming is het besluit tot invoering vernietigbaar gedurende een maand nadat de OR er kennis van heeft genomen of had kunnen nemen.

### 3. Doel van de voorziening

1. **Deal-governance** — traceerbaar maken wie een stap in het verkoopproces heeft goedgekeurd, gewijzigd of teruggedraaid, zodat fouten en geschillen kunnen worden opgehelderd.
2. **Beveiliging** — misbruik, fouten en ongeautoriseerde toegang kunnen worden gedetecteerd en onderzocht.
3. **Bewijs** — bij een geschil (bijvoorbeeld over een ondertekende NDA of een bod) aantoonbaar maken wie wat heeft gedaan en wanneer.

De voorziening dient **uitdrukkelijk niet** ter beoordeling van individuele medewerkers en wordt niet gebruikt voor functionerings- of beoordelingsgesprekken, tenzij aan de voorwaarden in §5 hieronder is voldaan.

### 4. Noodzaak, proportionaliteit en subsidiariteit

**Noodzaak.** Een auditspoor is voor een onderneming die vastgoedtransacties met aanzienlijke financiële belangen begeleidt een redelijk en gebruikelijk middel om verantwoording, fraude- en foutdetectie en bewijsvoering te kunnen waarborgen. Zonder een dergelijk spoor is niet vast te stellen wie een cruciale stap in het proces heeft gezet, wat zowel het bedrijf als de betrokken medewerkers kwetsbaar maakt bij een geschil.

**Proportionaliteit.** De vastgelegde gegevens zijn beperkt tot wat voor het doel noodzakelijk is: actie, actor, tijdstip en actie-specifieke metadata. Er wordt geen inhoud van communicatie, toetsenbord- of schermactiviteit, locatie, of enige vorm van continue observatie vastgelegd — uitsluitend discrete, door de medewerker zelf geïnitieerde acties binnen de applicatie.

**Subsidiariteit.** Een minder ingrijpend alternatief dat hetzelfde doel bereikt, is niet voorhanden: zonder enige vorm van actielogging is geen van de drie doelen in §3 haalbaar. De reikwijdte is al beperkt door rolgebaseerde toegang (zie §5 van [staff-monitoring-protocol.md](staff-monitoring-protocol.md)) en een bewaartermijn (§6 hieronder).

### 5. Waarborgen

Zie [staff-monitoring-protocol.md](staff-monitoring-protocol.md) voor het volledige protocol. Samengevat:
- Toegang beperkt tot ADMIN/EDITOR; VIEWER ziet geen medewerker-identiteiten; investeerders hebben geen toegang.
- Geen gebruik voor beoordeling, aanstelling of ontslag zonder een nieuw, specifiek besluit én een proportionaliteitstoets per geval.
- Medewerkers hebben recht op inzage, rectificatie en bezwaar (`privacy.netherlands@dils.com`).
- Een meldpunt voor vermoed misbruik via de klokkenluidersregeling.

### 6. Bewaartermijn

24 maanden vanaf vastlegging; 7 jaar voor logregels die horen bij een document met een wettelijke bewaarplicht (ondertekende NDA's/offers). Zie [data-retention-schedule.md](data-retention-schedule.md).

### 7. Evaluatiemoment

Dit besluit wordt uiterlijk [[confirm: beoogde evaluatiedatum, voorstel: 12 maanden na instemming]] geëvalueerd met de OR, waarbij in elk geval wordt bezien: is de voorziening gebruikt zoals hier beschreven; is het aantal inzageverzoeken/klachten; is de bewaartermijn technisch gehandhaafd (de purge-job moet dan zijn geautomatiseerd).

### 8. Verzoek

De bestuurder verzoekt de ondernemingsraad in te stemmen met de hierboven beschreven voorziening, onder de in §5 genoemde waarborgen en met het in §7 genoemde evaluatiemoment.

---

**Namens de bestuurder:** [[confirm: naam bestuurder / indiener]] — datum: __________ — handtekening: __________
**Namens de ondernemingsraad:** [[confirm: naam OR-voorzitter / contactpersoon OR]] — datum: __________ — handtekening: __________

---

*Indien Dils Netherlands B.V. geen ondernemingsraad heeft, geldt dit document als vastlegging dat de beoordeling volgens art. 27 lid 1 onder k en l WOR is gemaakt en dat, mocht op enig moment een OR worden ingesteld, dit de voorziening is die als eerste ter instemming moet worden voorgelegd.*
