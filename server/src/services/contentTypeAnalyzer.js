const db = require('../config/database');

class ContentTypeAnalyzer {
  
  /**
   * Analyze plot/overview to determine TRUE content type
   * This can override surface-level genre labels when needed
   */
  analyze(metadata) {
    const overview = (metadata.overview || '').toLowerCase();
    const title = (metadata.title || '').toLowerCase();
    const genres = (metadata.genres || []).map(g => g.toLowerCase());
    const keywords = (metadata.keywords || []).map(k => k.toLowerCase());
    const certification = metadata.certification || '';
    
    const analysis = {
      detected_type: null,
      confidence: 0,
      reasoning: [],
      overrides_genre: false,
      original_genres: metadata.genres || [],
      suggested_labels: []
    };
    
    // ═══════════════════════════════════════════════════════════
    // STAND-UP COMEDY vs DOCUMENTARY ABOUT COMEDIANS
    // ═══════════════════════════════════════════════════════════
    if (this.hasComedyIndicators(metadata)) {
      const performanceScore = this.scoreRecordedPerformance(overview, title);
      const biographicalScore = this.scoreBiographical(overview);
      
      if (performanceScore > biographicalScore && performanceScore >= 3) {
        analysis.detected_type = 'standup_special';
        analysis.confidence = Math.min(95, 60 + performanceScore * 10);
        analysis.reasoning.push('Plot indicates recorded live stand-up performance');
        analysis.reasoning.push(`Performance indicators: ${performanceScore}, Biographical indicators: ${biographicalScore}`);
        analysis.suggested_labels = ['standup', 'comedy_special', 'live_performance'];
        if (genres.includes('documentary')) {
          analysis.overrides_genre = true;
          analysis.reasoning.push('Overriding Documentary genre - this is a performance recording');
        }
      } else if (biographicalScore > performanceScore && biographicalScore >= 3) {
        analysis.detected_type = 'documentary';
        analysis.confidence = Math.min(95, 60 + biographicalScore * 10);
        analysis.reasoning.push('Plot indicates biographical documentary about a comedian');
        analysis.reasoning.push(`Biographical indicators: ${biographicalScore}, Performance indicators: ${performanceScore}`);
        analysis.suggested_labels = ['documentary', 'biography'];
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // CONCERT FILM vs MUSIC DOCUMENTARY vs BIOPIC
    // ═══════════════════════════════════════════════════════════
    if (this.hasMusicIndicators(metadata)) {
      const concertScore = this.scoreConcertFilm(overview, title);
      const musicDocScore = this.scoreMusicDocumentary(overview);
      const biopicScore = this.scoreBiopic(overview, genres);
      
      const maxScore = Math.max(concertScore, musicDocScore, biopicScore);
      
      if (concertScore === maxScore && concertScore >= 3) {
        analysis.detected_type = 'concert_film';
        analysis.confidence = Math.min(95, 60 + concertScore * 10);
        analysis.reasoning.push('Plot indicates recorded concert or tour performance');
        analysis.suggested_labels = ['concert', 'live_performance', 'music'];
        if (genres.includes('documentary')) {
          analysis.overrides_genre = true;
          analysis.reasoning.push('Overriding Documentary genre - this is a concert recording');
        }
      } else if (biopicScore === maxScore && biopicScore >= 3) {
        analysis.detected_type = 'biopic';
        analysis.confidence = Math.min(95, 60 + biopicScore * 10);
        analysis.reasoning.push('Plot indicates dramatized biopic about a musician');
        analysis.suggested_labels = ['biopic', 'drama', 'biography'];
      } else if (musicDocScore === maxScore && musicDocScore >= 3) {
        analysis.detected_type = 'music_documentary';
        analysis.confidence = Math.min(95, 60 + musicDocScore * 10);
        analysis.reasoning.push('Plot indicates music documentary');
        analysis.suggested_labels = ['documentary', 'music'];
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // ANIME vs WESTERN ANIMATION vs ADULT ANIMATION
    // ═══════════════════════════════════════════════════════════
    if (genres.includes('animation')) {
      const isJapaneseAnimation = this.isAnime(metadata);
      const isAdult = this.isAdultContent(metadata, overview);
      
      if (isJapaneseAnimation) {
        analysis.detected_type = isAdult ? 'anime_adult' : 'anime';
        analysis.confidence = 85;
        analysis.reasoning.push('Japanese animation detected');
        analysis.suggested_labels = isAdult ? ['anime', 'adult', 'mature'] : ['anime'];
        if (genres.includes('family') && isAdult) {
          analysis.overrides_genre = true;
          analysis.reasoning.push('Overriding Family genre - this is adult anime');
        }
      } else if (isAdult) {
        analysis.detected_type = 'adult_animation';
        analysis.confidence = 85;
        analysis.reasoning.push('Adult-oriented animated content detected');
        analysis.suggested_labels = ['adult_animation', 'mature'];
        if (genres.includes('family')) {
          analysis.overrides_genre = true;
          analysis.reasoning.push('Overriding Family genre - this is adult animation');
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // REALITY TV vs DOCUMENTARY SERIES
    // ═══════════════════════════════════════════════════════════
    if (metadata.media_type === 'tv' && genres.includes('documentary')) {
      const realityScore = this.scoreRealityTV(overview, keywords);
      
      if (realityScore >= 3) {
        analysis.detected_type = 'reality_tv';
        analysis.confidence = Math.min(90, 60 + realityScore * 10);
        analysis.reasoning.push('Reality TV format detected, not traditional documentary');
        analysis.suggested_labels = ['reality', 'unscripted'];
        analysis.overrides_genre = true;
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // TRUE CRIME vs GENERAL DOCUMENTARY
    // ═══════════════════════════════════════════════════════════
    if (genres.includes('documentary') || genres.includes('crime')) {
      const trueCrimeScore = this.scoreTrueCrime(overview, keywords);
      
      if (trueCrimeScore >= 3) {
        analysis.detected_type = 'true_crime';
        analysis.confidence = Math.min(90, 60 + trueCrimeScore * 10);
        analysis.reasoning.push('True crime content detected');
        analysis.suggested_labels = ['true_crime', 'documentary', 'crime'];
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // SPORTS DOCUMENTARY vs RECORDED GAME/MATCH
    // ═══════════════════════════════════════════════════════════
    if (this.hasSportsIndicators(metadata)) {
      const recordedGameScore = this.scoreRecordedGame(overview, title);
      const sportsDocScore = this.scoreSportsDocumentary(overview);
      
      if (recordedGameScore > sportsDocScore && recordedGameScore >= 3) {
        analysis.detected_type = 'sports_event';
        analysis.confidence = Math.min(90, 60 + recordedGameScore * 10);
        analysis.reasoning.push('Recorded sports event/game detected');
        analysis.suggested_labels = ['sports', 'live_event'];
        if (genres.includes('documentary')) {
          analysis.overrides_genre = true;
        }
      } else if (sportsDocScore >= 3) {
        analysis.detected_type = 'sports_documentary';
        analysis.confidence = Math.min(90, 60 + sportsDocScore * 10);
        analysis.reasoning.push('Sports documentary detected');
        analysis.suggested_labels = ['documentary', 'sports'];
      }
    }
    
    return analysis;
  }
  
  // ─────────────────────────────────────────────────────────────
  // SCORING METHODS - Return numeric scores based on indicator matches
  // ─────────────────────────────────────────────────────────────
  
  scoreRecordedPerformance(overview, title) {
    let score = 0;
    const performanceIndicators = [
      { pattern: /\bperforms\b/, weight: 2 },
      { pattern: /\bperformance\b/, weight: 1 },
      { pattern: /\blive at\b/, weight: 2 },
      { pattern: /\brecorded (at|live)\b/, weight: 2 },
      { pattern: /\bfilmed (at|live|in front)\b/, weight: 2 },
      { pattern: /\bstand-?up (routine|special|show)\b/, weight: 3 },
      { pattern: /\bcomedy (routine|special|show)\b/, weight: 2 },
      { pattern: /\btakes the stage\b/, weight: 2 },
      { pattern: /\bin front of (a |an )?(live )?audience\b/, weight: 2 },
      { pattern: /\bone-(wo)?man show\b/, weight: 2 },
      { pattern: /\bsolo show\b/, weight: 2 },
      { pattern: /\bcomedy club\b/, weight: 1 },
      { pattern: /\btheater\b/, weight: 1 },
      { pattern: /\btheatre\b/, weight: 1 }
    ];
    
    for (const { pattern, weight } of performanceIndicators) {
      if (pattern.test(overview) || pattern.test(title)) {
        score += weight;
      }
    }
    
    return score;
  }
  
  scoreBiographical(overview) {
    let score = 0;
    const bioIndicators = [
      { pattern: /\b(the )?life (of|and)\b/, weight: 2 },
      { pattern: /\bstory of\b/, weight: 2 },
      { pattern: /\bjourney of\b/, weight: 2 },
      { pattern: /\brise (of|to)\b/, weight: 2 },
      { pattern: /\bchronicles\b/, weight: 2 },
      { pattern: /\bexplores the life\b/, weight: 2 },
      { pattern: /\bintimate (look|portrait)\b/, weight: 2 },
      { pattern: /\bbehind the scenes\b/, weight: 1 },
      { pattern: /\bearly (days|years|life)\b/, weight: 2 },
      { pattern: /\bcareer of\b/, weight: 2 },
      { pattern: /\blegacy of\b/, weight: 2 },
      { pattern: /\bfrom humble beginnings\b/, weight: 2 },
      { pattern: /\bbiography\b/, weight: 3 },
      { pattern: /\bgrew up\b/, weight: 1 },
      { pattern: /\bchildhood\b/, weight: 1 },
      { pattern: /\bpath to (fame|success|stardom)\b/, weight: 2 },
      { pattern: /\bthrough the years\b/, weight: 1 },
      { pattern: /\bpersonal (life|journey|struggles)\b/, weight: 2 }
    ];
    
    for (const { pattern, weight } of bioIndicators) {
      if (pattern.test(overview)) {
        score += weight;
      }
    }
    
    return score;
  }
  
  scoreConcertFilm(overview, title) {
    let score = 0;
    const concertIndicators = [
      { pattern: /\bconcert\b/, weight: 3 },
      { pattern: /\btour\b/, weight: 2 },
      { pattern: /\blive performance\b/, weight: 2 },
      { pattern: /\bperforms live\b/, weight: 2 },
      { pattern: /\bstadium\b/, weight: 2 },
      { pattern: /\barena\b/, weight: 2 },
      { pattern: /\bon stage\b/, weight: 2 },
      { pattern: /\bsetlist\b/, weight: 2 },
      { pattern: /\bworld tour\b/, weight: 3 },
      { pattern: /\beras tour\b/, weight: 3 },
      { pattern: /\bfarewell tour\b/, weight: 3 },
      { pattern: /\breunion tour\b/, weight: 3 },
      { pattern: /\bsold[- ]out (show|concert)\b/, weight: 2 },
      { pattern: /\bnight(s)? of music\b/, weight: 2 }
    ];
    
    for (const { pattern, weight } of concertIndicators) {
      if (pattern.test(overview) || pattern.test(title)) {
        score += weight;
      }
    }
    
    return score;
  }
  
  scoreMusicDocumentary(overview) {
    let score = 0;
    const docIndicators = [
      { pattern: /\bdocumentary\b/, weight: 2 },
      { pattern: /\bexplores\b/, weight: 1 },
      { pattern: /\bexamines\b/, weight: 1 },
      { pattern: /\bchronicles\b/, weight: 2 },
      { pattern: /\bhistory of\b/, weight: 2 },
      { pattern: /\bmaking of\b/, weight: 2 },
      { pattern: /\binside look\b/, weight: 2 },
      { pattern: /\barchive footage\b/, weight: 2 },
      { pattern: /\binterviews\b/, weight: 2 },
      { pattern: /\brare footage\b/, weight: 2 },
      { pattern: /\bnever[- ]before[- ]seen\b/, weight: 2 }
    ];
    
    for (const { pattern, weight } of docIndicators) {
      if (pattern.test(overview)) {
        score += weight;
      }
    }
    
    return score;
  }
  
  scoreBiopic(overview, genres) {
    let score = 0;
    
    // Biopics typically have Drama genre
    if (genres.includes('drama')) {
      score += 2;
    }
    
    const biopicIndicators = [
      { pattern: /\bportrays\b/, weight: 2 },
      { pattern: /\bstars as\b/, weight: 2 },
      { pattern: /\brise to fame\b/, weight: 2 },
      { pattern: /\bstruggles\b/, weight: 1 },
      { pattern: /\bbased on the (true |real )?life\b/, weight: 3 },
      { pattern: /\btrue story\b/, weight: 2 },
      { pattern: /\binspired by\b/, weight: 1 },
      { pattern: /\bdramatizes\b/, weight: 2 },
      { pattern: /\bdramatic retelling\b/, weight: 2 },
      { pattern: /\bfrom rags to riches\b/, weight: 2 }
    ];
    
    for (const { pattern, weight } of biopicIndicators) {
      if (pattern.test(overview)) {
        score += weight;
      }
    }
    
    return score;
  }
  
  scoreRealityTV(overview, keywords) {
    let score = 0;
    const realityIndicators = [
      { pattern: /\bcompetition\b/, weight: 2 },
      { pattern: /\bcontestants\b/, weight: 3 },
      { pattern: /\belimination\b/, weight: 3 },
      { pattern: /\bchallenges\b/, weight: 2 },
      { pattern: /\bdating\b/, weight: 2 },
      { pattern: /\bbachelor(ette)?\b/, weight: 3 },
      { pattern: /\bhousewives\b/, weight: 3 },
      { pattern: /\breal lives\b/, weight: 2 },
      { pattern: /\bfollows the\b/, weight: 1 },
      { pattern: /\bcameras follow\b/, weight: 2 },
      { pattern: /\breality\b/, weight: 2 },
      { pattern: /\bunscripted\b/, weight: 2 },
      { pattern: /\bcompete for\b/, weight: 2 },
      { pattern: /\bvote(d)? off\b/, weight: 3 },
      { pattern: /\brose ceremony\b/, weight: 3 }
    ];
    
    for (const { pattern, weight } of realityIndicators) {
      if (pattern.test(overview)) {
        score += weight;
      }
    }
    
    // Check keywords too
    const realityKeywords = ['reality', 'reality tv', 'competition', 'game show', 'dating show'];
    for (const kw of keywords) {
      if (realityKeywords.some(rk => kw.includes(rk))) {
        score += 2;
      }
    }
    
    return score;
  }
  
  scoreTrueCrime(overview, keywords) {
    let score = 0;
    const trueCrimeIndicators = [
      { pattern: /\bmurder(s|er|ed)?\b/, weight: 2 },
      { pattern: /\bkill(ing|er|ed)?\b/, weight: 2 },
      { pattern: /\bserial killer\b/, weight: 3 },
      { pattern: /\binvestigation\b/, weight: 2 },
      { pattern: /\bdetective(s)?\b/, weight: 1 },
      { pattern: /\bcrime scene\b/, weight: 2 },
      { pattern: /\bvictim(s)?\b/, weight: 1 },
      { pattern: /\bsuspect(s)?\b/, weight: 1 },
      { pattern: /\btrial\b/, weight: 1 },
      { pattern: /\bconvicted\b/, weight: 2 },
      { pattern: /\bunsolved\b/, weight: 2 },
      { pattern: /\bcold case\b/, weight: 3 },
      { pattern: /\btrue crime\b/, weight: 3 },
      { pattern: /\bdisappearance\b/, weight: 2 },
      { pattern: /\bforensic\b/, weight: 2 }
    ];
    
    for (const { pattern, weight } of trueCrimeIndicators) {
      if (pattern.test(overview)) {
        score += weight;
      }
    }
    
    const trueCrimeKeywords = ['true crime', 'crime documentary', 'murder', 'investigation'];
    for (const kw of keywords) {
      if (trueCrimeKeywords.some(tc => kw.includes(tc))) {
        score += 2;
      }
    }
    
    return score;
  }
  
  scoreRecordedGame(overview, title) {
    let score = 0;
    const gameIndicators = [
      { pattern: /\b(super ?bowl|world series|world cup|stanley cup|nba finals)\b/i, weight: 3 },
      { pattern: /\bchampionship (game|match|final)\b/, weight: 3 },
      { pattern: /\bfinal(s)? (game|match)\b/, weight: 2 },
      { pattern: /\bplayoff(s)?\b/, weight: 2 },
      { pattern: /\b(game|match) \d+\b/, weight: 2 },
      { pattern: /\bvs\.?\b/, weight: 1 },
      { pattern: /\bversus\b/, weight: 1 },
      { pattern: /\bfull (game|match)\b/, weight: 3 },
      { pattern: /\bhighlights\b/, weight: 2 }
    ];
    
    for (const { pattern, weight } of gameIndicators) {
      if (pattern.test(overview) || pattern.test(title)) {
        score += weight;
      }
    }
    
    return score;
  }
  
  scoreSportsDocumentary(overview) {
    let score = 0;
    const sportsDocIndicators = [
      { pattern: /\blegendary\b/, weight: 1 },
      { pattern: /\bcareer\b/, weight: 1 },
      { pattern: /\bathlete(s)?\b/, weight: 1 },
      { pattern: /\bteam('s)? (story|journey|history)\b/, weight: 2 },
      { pattern: /\bbehind the scenes\b/, weight: 2 },
      { pattern: /\brises? to\b/, weight: 1 },
      { pattern: /\btriumph\b/, weight: 1 },
      { pattern: /\bdefeat\b/, weight: 1 },
      { pattern: /\binterviews\b/, weight: 1 },
      { pattern: /\barchive footage\b/, weight: 2 }
    ];
    
    for (const { pattern, weight } of sportsDocIndicators) {
      if (pattern.test(overview)) {
        score += weight;
      }
    }
    
    return score;
  }
  
  // ─────────────────────────────────────────────────────────────
  // INDICATOR DETECTION METHODS
  // ─────────────────────────────────────────────────────────────
  
  hasComedyIndicators(metadata) {
    const keywords = (metadata.keywords || []).map(k => k.toLowerCase());
    const genres = (metadata.genres || []).map(g => g.toLowerCase());
    
    return keywords.some(k => 
      ['stand-up', 'standup', 'comedian', 'comedy special', 'stand up comedy'].includes(k)
    ) || genres.includes('comedy');
  }
  
  hasMusicIndicators(metadata) {
    const genres = (metadata.genres || []).map(g => g.toLowerCase());
    const keywords = (metadata.keywords || []).map(k => k.toLowerCase());
    
    return genres.includes('music') || 
           keywords.some(k => 
             ['concert', 'musician', 'singer', 'band', 'tour', 'rock', 'pop', 'hip hop', 'rap'].includes(k)
           );
  }
  
  hasSportsIndicators(metadata) {
    const genres = (metadata.genres || []).map(g => g.toLowerCase());
    const keywords = (metadata.keywords || []).map(k => k.toLowerCase());
    
    return keywords.some(k => 
      ['sports', 'football', 'basketball', 'baseball', 'soccer', 'hockey', 'tennis', 'golf', 'boxing', 'mma', 'wrestling', 'olympics'].includes(k)
    ) || genres.includes('sport');
  }
  
  isAnime(metadata) {
    const keywords = (metadata.keywords || []).map(k => k.toLowerCase());
    
    return metadata.original_language === 'ja' ||
           keywords.includes('anime') ||
           keywords.some(k => ['shounen', 'shoujo', 'seinen', 'josei', 'isekai', 'mecha', 'slice of life'].includes(k));
  }
  
  isAdultContent(metadata, overview) {
    const adultCertifications = ['R', 'NC-17', 'TV-MA', '18+', 'X', 'NR'];
    const hasAdultCert = adultCertifications.includes(metadata.certification);
    
    const adultIndicators = [
      /\badult\b/,
      /\bmature\b/,
      /\bexplicit\b/,
      /\bprofanity\b/,
      /\bcrude humor\b/,
      /\bsexual\b/,
      /\bviolent\b/,
      /\bgraphic\b/,
      /\bdark comedy\b/,
      /\br-rated\b/
    ];
    
    const hasAdultOverview = adultIndicators.some(pattern => pattern.test(overview));
    
    const adultKeywords = ['adult animation', 'adult swim', 'mature themes', 'adult content'];
    const hasAdultKeywords = (metadata.keywords || []).some(k => 
      adultKeywords.some(ak => k.toLowerCase().includes(ak))
    );
    
    return hasAdultCert || hasAdultOverview || hasAdultKeywords;
  }
}

module.exports = new ContentTypeAnalyzer();
