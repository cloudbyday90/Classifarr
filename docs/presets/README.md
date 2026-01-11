# Content Presets Reference

## Overview

Content presets are pre-built signal definitions that describe specific types of content. Classifarr ships with **168 system presets** covering genres, ratings, themes, studios, eras, languages, and special content types.

---

## Preset Categories

### Audience (8 presets)

Content rated by target age group and maturity level.

| Key | Name | Certifications | Description |
|-----|------|----------------|-------------|
| `family_friendly` | Family Friendly | G, PG | Safe for all ages |
| `kids_only` | Kids Only | G, TV-Y, TV-Y7 | Specifically for children |
| `kids_older` | Kids (Older) | PG, TV-Y7-FV | Ages 7+ |
| `young_adult` | Young Adult | PG-13, TV-14 | Teens and young adults |
| `teen` | Teen | PG-13, TV-14 | Teenage audience |
| `adult_only` | Adult Only | R, NC-17, TV-MA | Mature content |
| `date_night` | Date Night | PG-13, R | Romantic/entertaining |
| `background` | Background Viewing | - | Low-attention content |

---

### Genres (60 presets)

#### Core Genres (20)

| Key | Name | Genres |
|-----|------|--------|
| `action` | Action | Action |
| `adventure` | Adventure | Adventure |
| `comedy` | Comedy | Comedy |
| `drama` | Drama | Drama |
| `horror` | Horror | Horror |
| `scifi` | Science Fiction | Science Fiction |
| `fantasy` | Fantasy | Fantasy |
| `thriller` | Thriller | Thriller |
| `mystery` | Mystery | Mystery |
| `romance` | Romance | Romance |
| `crime` | Crime | Crime |
| `animated` | Animated | Animation |
| `anime` | Anime | Animation + Japanese |
| `documentary` | Documentary | Documentary |
| `western` | Western | Western |
| `musical` | Musical | Music |
| `war` | War | War |
| `history` | History | History |
| `biographical` | Biographical | Biography |
| `sports` | Sports | Sport |

#### Subgenres (25)

| Key | Name | Description |
|-----|------|-------------|
| `action_comedy` | Action Comedy | Action + Comedy blend |
| `romantic_comedy` | Romantic Comedy | Romance + Comedy |
| `dark_comedy` | Dark Comedy | Dark humor |
| `standup` | Stand-up Comedy | Comedy specials |
| `horror_comedy` | Horror Comedy | Horror + Comedy |
| `slasher` | Slasher | Slasher horror |
| `psychological_horror` | Psychological Horror | Mind-bending horror |
| `supernatural` | Supernatural | Ghosts, demons |
| `monster` | Monster Movies | Creature features |
| `zombie` | Zombie | Undead horror |
| `vampire` | Vampire | Vampire content |
| `psychological_thriller` | Psychological Thriller | Mind games |
| `spy` | Spy/Espionage | Secret agents |
| `heist` | Heist | Robbery plots |
| `disaster` | Disaster | Natural disasters |
| `martial_arts` | Martial Arts | Combat action |
| `noir` | Film Noir | Dark detective |
| `cyberpunk` | Cyberpunk | Futuristic tech |
| `space_opera` | Space Opera | Epic space adventure |
| `post_apocalyptic` | Post-Apocalyptic | After the end |
| `dystopian` | Dystopian | Oppressive future |
| `superhero` | Superhero | Comic book heroes |
| `courtroom` | Courtroom Drama | Legal drama |
| `medical` | Medical | Hospital drama |
| `political` | Political | Politics |

#### Special Interest (15)

| Key | Name | Description |
|-----|------|-------------|
| `true_crime` | True Crime | Real crime stories |
| `nature` | Nature | Wildlife, outdoors |
| `science` | Science | Scientific docs |
| `travel` | Travel | Travel shows |
| `food` | Food & Cooking | Culinary |
| `music_doc` | Music Documentary | Music history |
| `art_culture` | Art & Culture | Arts, culture |
| `faith_spiritual` | Faith & Spiritual | Religious |
| `educational` | Educational | Learning content |
| `conspiracy` | Conspiracy | Conspiracy theories |
| `sports_doc` | Sports Documentary | Sports history |
| `concert` | Concert | Live performances |
| `behind_scenes` | Behind the Scenes | Making-of |
| `interview` | Interview | Talk/interview |
| `essay` | Video Essay | Analysis |

---

### Quality (10 presets)

| Key | Name | Criteria |
|-----|------|----------|
| `highly_rated` | Highly Rated | Vote average ≥ 7.5 |
| `critically_acclaimed` | Critically Acclaimed | Vote average ≥ 8.0 |
| `popular` | Popular | High vote count |
| `cult_classic` | Cult Classic | Niche following |
| `award_winners` | Award Winners | Major awards |
| `indie` | Independent Films | Indie studios |
| `blockbuster` | Blockbuster | High budget |
| `underrated` | Underrated Gems | Low-key quality |
| `so_bad_good` | So Bad It's Good | Campy fun |
| `hidden_gems` | Hidden Gems | Vote avg 7.0-8.0, low votes |

---

### Franchise (25 presets)

#### Animation Studios (11)

| Key | Name | Studio |
|-----|------|--------|
| `pixar` | Pixar | Pixar Animation Studios |
| `disney` | Disney Animation | Walt Disney Animation Studios |
| `ghibli` | Studio Ghibli | Studio Ghibli |
| `dreamworks` | DreamWorks | DreamWorks Animation |
| `illumination` | Illumination | Illumination Entertainment |
| `sony_animation` | Sony Animation | Sony Pictures Animation |
| `laika` | Laika | Laika |
| `blue_sky` | Blue Sky | Blue Sky Studios |
| `marvel_animated` | Marvel Animated | Marvel Animation |
| `dc_animated` | DC Animated | DC Animation |
| `nickelodeon` | Nickelodeon | Nickelodeon Movies |

#### Live Action Franchises (14)

| Key | Name | Keywords |
|-----|------|----------|
| `marvel_mcu` | Marvel Cinematic Universe | MCU, Avengers |
| `marvel_other` | Marvel (Non-MCU) | X-Men, Spider-Man |
| `dc_universe` | DC Universe | Batman, Superman |
| `star_wars` | Star Wars | Star Wars |
| `star_trek` | Star Trek | Star Trek |
| `harry_potter` | Harry Potter | Harry Potter, Wizarding World |
| `lotr` | Lord of the Rings | LOTR, Middle-earth |
| `james_bond` | James Bond | 007, Bond |
| `fast_furious` | Fast & Furious | Fast, Furious |
| `jurassic` | Jurassic Park/World | Jurassic |
| `monsterverse` | MonsterVerse | Godzilla, Kong |
| `conjuring` | The Conjuring Universe | Conjuring, Annabelle |
| `a24` | A24 Films | A24 studio |
| `blumhouse` | Blumhouse | Blumhouse Productions |

---

### Temporal (12 presets)

| Key | Name | Year Range |
|-----|------|------------|
| `silent_era` | Silent Era | Pre-1930 |
| `classic_films` | Classic Films | 1930-1960 |
| `golden_age` | Golden Age | 1960-1979 |
| `new_hollywood` | New Hollywood | 1970-1989 |
| `80s` | 80s Classics | 1980-1989 |
| `90s` | 90s Classics | 1990-1999 |
| `2000s` | 2000s | 2000-2009 |
| `2010s` | 2010s | 2010-2019 |
| `2020s` | 2020s | 2020+ |
| `retro` | Retro | Pre-2000 |
| `modern` | Modern | 2000+ |
| `recent_releases` | Recent Releases | Last 2 years |

---

### Regional (25 presets)

| Key | Name | Language | Studios |
|-----|------|----------|---------|
| `hollywood` | Hollywood | en | Major US studios |
| `british` | British | en | BBC, ITV |
| `australian` | Australian | en | Australian studios |
| `canadian` | Canadian | en, fr | CBC, NFB |
| `english` | English Language | en | - |
| `bollywood` | Bollywood | hi | Indian studios |
| `korean` | Korean | ko | Korean studios |
| `japanese` | Japanese | ja | Japanese studios |
| `anime` | Anime | ja | Animation |
| `chinese` | Chinese | zh | Chinese studios |
| `hong_kong` | Hong Kong | zh | HK studios |
| `taiwanese` | Taiwanese | zh | Taiwan studios |
| `indian` | Indian | hi, ta, te | Indian studios |
| `spanish` | Spanish | es | Spanish studios |
| `latin_american` | Latin American | es | Latin studios |
| `mexican` | Mexican | es | Mexican studios |
| `brazilian` | Brazilian | pt | Brazilian studios |
| `french` | French | fr | French studios |
| `german` | German | de | German studios |
| `italian` | Italian | it | Italian studios |
| `scandinavian` | Scandinavian | sv, no, da | Nordic studios |
| `russian` | Russian | ru | Russian studios |
| `turkish` | Turkish | tr | Turkish studios |
| `thai` | Thai | th | Thai studios |
| `arabic` | Arabic | ar | Middle Eastern studios |

---

### Seasonal (8 presets)

| Key | Name | Keywords |
|-----|------|----------|
| `christmas_holiday` | Christmas/Holiday | christmas, holiday, santa |
| `halloween` | Halloween | halloween, spooky |
| `thanksgiving` | Thanksgiving | thanksgiving, turkey |
| `valentines` | Valentine's Day | valentine, love |
| `easter` | Easter | easter, bunny |
| `new_years` | New Year's | new year, resolution |
| `summer` | Summer | summer, beach |
| `winter` | Winter | winter, snow |

---

### TV-Specific (20 presets)

| Key | Name | Genres | Description |
|-----|------|--------|-------------|
| `tv_sitcom` | TV Sitcom | Comedy | Situational comedy |
| `tv_drama` | TV Drama | Drama | Serialized drama |
| `tv_procedural` | TV Procedural | Crime, Mystery | Case-of-week |
| `tv_soap` | TV Soap Opera | Drama, Romance | Daytime soap |
| `tv_anthology` | TV Anthology | Various | Different stories |
| `tv_reality` | TV Reality | Reality | Reality shows |
| `tv_animated` | TV Animated | Animation | Animated series |
| `tv_anime` | TV Anime | Animation | Japanese anime |
| `tv_miniseries` | TV Miniseries | Various | Limited series |
| `tv_variety` | TV Variety | Entertainment | Variety shows |
| `tv_talk` | TV Talk Show | Talk | Talk shows |
| `tv_game` | TV Game Show | Game Show | Game shows |
| `tv_news` | TV News | News | News programs |
| `tv_kids` | TV Kids | Children | Kids shows |
| `tv_dating` | TV Dating | Reality, Romance | Dating shows |
| `tv_cooking` | TV Cooking | Food | Cooking shows |
| `tv_true_crime` | TV True Crime | Crime, Documentary | True crime |
| `tv_late_night` | TV Late Night | Comedy, Talk | Late night |
| `tv_daytime` | TV Daytime | Various | Daytime TV |
| `tv_documentary` | TV Documentary | Documentary | Doc series |

---

## Signal Types

Each preset defines signals using JSONB:

### Certifications

```json
{
  "mode": "include",  // or "exclude", "max"
  "values": ["G", "PG", "PG-13"]
}
```

**Modes:**
- `include`: Must have one of these ratings
- `exclude`: Must NOT have these ratings
- `max`: Rating must be at most this level

---

### Genres

```json
{
  "mode": "require_any",  // or "require_all", "prefer", "exclude"
  "values": ["Action", "Adventure"],
  "weight": 0.8
}
```

**Modes:**
- `require_any`: At least one genre must match
- `require_all`: All genres must match
- `prefer`: Boost score if matches
- `exclude`: Penalty if matches

---

### Keywords

```json
{
  "mode": "require_any",  // or "prefer", "exclude"
  "values": ["superhero", "marvel", "comic"]
}
```

Searches in title, overview, and TMDB keywords.

---

### Studios

```json
{
  "mode": "prefer",  // or "require", "exclude"
  "values": ["Pixar Animation Studios", "Walt Disney Animation Studios"]
}
```

Matches production companies.

---

### Release Year

```json
{
  "min": 2000,
  "max": 2024,
  "weight": 0.5
}
```

---

### Vote Average

```json
{
  "min": 7.0,
  "max": 10.0
}
```

TMDB rating (0-10 scale).

---

### Runtime

```json
{
  "min": 60,
  "max": 180
}
```

Length in minutes.

---

### Language

```json
{
  "mode": "require",  // or "prefer", "exclude"
  "values": ["en", "ja"]
}
```

ISO 639-1 language codes.

---

### Media Type

```json
{
  "mode": "require",
  "value": "movie"  // or "tv"
}
```

---

## Using Presets

### In Policy Builder

1. Select presets from categorized picker
2. Adjust per-preset weight (0.0-2.0)
3. Presets combine based on policy's `combination_mode`

### Combination Modes

- **best_match**: Use highest-scoring preset
- **average**: Average all preset scores
- **weighted_average**: Weighted average by preset weight
- **require_all**: All presets must score >0

---

## Creating Custom Presets

Users can create custom presets via the UI or API:

```bash
POST /api/presets
{
  "key": "my_custom_preset",
  "name": "My Custom Preset",
  "category": "custom",
  "user_id": 1,
  "signals": {
    "genres": {
      "mode": "require_any",
      "values": ["Sci-Fi", "Thriller"]
    }
  }
}
```

---

## Preset Weight Tuning

Adjust individual preset weights to boost/reduce their influence:

- **1.0**: Normal weight (default)
- **0.5**: Half influence
- **1.5**: 50% boost
- **0.0**: Disabled (ignore this preset)

**Example:**

If `family_friendly` preset scores 80% and has weight 1.5:

```
Final contribution = 80% × 1.5 = 120% (capped at 100%)
```

---

## Related Documentation

- [Policy Engine Architecture](../architecture/policy-engine.md)
- [Policies API](../api/policies.md)
- [Migration Guide](../migration/v037.md)
