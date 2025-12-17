/**
 * ContentTypeAnalyzer - Analyzes media metadata to determine TRUE content type
 * 
 * This service examines plot/overview text to detect the actual content type,
 * which can differ from surface-level TMDB genre labels. It helps prevent
 * false positives in media classification.
 * 
 * Key Features:
 * - Stand-up specials vs documentaries about comedians
 * - Concert films vs music documentaries vs biopics
 * - Adult animation vs family animation
 * - Reality TV vs documentary series
 * - True crime vs general documentaries
 * - Sports events vs sports documentaries
 * - Anime with adult content detection
 * 
 * @example
 * const analysis = contentTypeAnalyzer.analyze(metadata);
 * if (analysis.detected_type && analysis.confidence >= 75) {
 *   // Use analysis.suggested_labels for classification
 * }
 */
class ContentTypeAnalyzer {
  
  // Confidence calculation constants
  static MAX_CONFIDENCE = 95;
  static BASE_CONFIDENCE = 60;
  static SCORE_MULTIPLIER = 10;
  static MIN_DETECTION_SCORE = 3;
  
  // Scoring weights
  static WEIGHT_HIGH = 3;
  static WEIGHT_MEDIUM = 2;
  static WEIGHT_LOW = 1;
  
  // Anime genre keywords
  static ANIME_KEYWORDS = ['shounen', 'shoujo', 'seinen', 'josei', 'isekai', 'mecha', 'slice of life'];
  
  // Adult content keywords
  static ADULT_KEYWORDS = ['adult animation', 'adult swim', 'mature themes', 'adult content'];
  
  // Reality TV keywords
  static REALITY_KEYWORDS = ['reality', 'reality tv', 'competition', 'game show', 'dating show'];
  
  // True crime keywords
  static TRUE_CRIME_KEYWORDS = ['true crime', 'crime documentary', 'murder', 'investigation'];
  
  // Adult certifications
  static ADULT_CERTIFICATIONS = ['R', 'NC-17', 'TV-MA', '18+', 'X', 'NR'];
  
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
      
      if (performanceScore > biographicalScore && performanceScore >= ContentTypeAnalyzer.MIN_DETECTION_SCORE) {
        analysis.detected_type = 'standup_special';
        analysis.confidence = Math.min(
          ContentTypeAnalyzer.MAX_CONFIDENCE, 
          ContentTypeAnalyzer.BASE_CONFIDENCE + performanceScore * ContentTypeAnalyzer.SCORE_MULTIPLIER
        );
        analysis.reasoning.push('Plot indicates recorded live stand-up performance');
        analysis.reasoning.push(`Performance indicators: ${performanceScore}, Biographical indicators: ${biographicalScore}`);
        analysis.suggested_labels = ['standup', 'comedy_special', 'live_performance'];
        if (genres.includes('documentary')) {
          analysis.overrides_genre = true;
          analysis.reasoning.push('Overriding Documentary genre - this is a performance recording');
        }
      } else if (biographicalScore > performanceScore && biographicalScore >= ContentTypeAnalyzer.MIN_DETECTION_SCORE) {
        analysis.detected_type = 'documentary';
        analysis.confidence = Math.min(
          ContentTypeAnalyzer.MAX_CONFIDENCE, 
          ContentTypeAnalyzer.BASE_CONFIDENCE + biographicalScore * ContentTypeAnalyzer.SCORE_MULTIPLIER
        );
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
      
      if (concertScore === maxScore && concertScore >= ContentTypeAnalyzer.MIN_DETECTION_SCORE) {
        analysis.detected_type = 'concert_film';
        analysis.confidence = Math.min(
          ContentTypeAnalyzer.MAX_CONFIDENCE, 
          ContentTypeAnalyzer.BASE_CONFIDENCE + concertScore * ContentTypeAnalyzer.SCORE_MULTIPLIER
        );
        analysis.reasoning.push('Plot indicates recorded concert or tour performance');
        analysis.suggested_labels = ['concert', 'live_performance', 'music'];
        if (genres.includes('documentary')) {
          analysis.overrides_genre = true;
          analysis.reasoning.push('Overriding Documentary genre - this is a concert recording');
        }
      } else if (biopicScore === maxScore && biopicScore >= ContentTypeAnalyzer.MIN_DETECTION_SCORE) {
        analysis.detected_type = 'biopic';
        analysis.confidence = Math.min(
          ContentTypeAnalyzer.MAX_CONFIDENCE, 
          ContentTypeAnalyzer.BASE_CONFIDENCE + biopicScore * ContentTypeAnalyzer.SCORE_MULTIPLIER
        );
        analysis.reasoning.push('Plot indicates dramatized biopic about a musician');
        analysis.suggested_labels = ['biopic', 'drama', 'biography'];
      } else if (musicDocScore === maxScore && musicDocScore >= ContentTypeAnalyzer.MIN_DETECTION_SCORE) {
        analysis.detected_type = 'music_documentary';
        analysis.confidence = Math.min(
          ContentTypeAnalyzer.MAX_CONFIDENCE, 
          ContentTypeAnalyzer.BASE_CONFIDENCE + musicDocScore * ContentTypeAnalyzer.SCORE_MULTIPLIER
        );
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
      
      if (realityScore >= ContentTypeAnalyzer.MIN_DETECTION_SCORE) {
        analysis.detected_type = 'reality_tv';
        analysis.confidence = Math.min(
          90, 
          ContentTypeAnalyzer.BASE_CONFIDENCE + realityScore * ContentTypeAnalyzer.SCORE_MULTIPLIER
        );
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
      
      if (trueCrimeScore >= ContentTypeAnalyzer.MIN_DETECTION_SCORE) {
        analysis.detected_type = 'true_crime';
        analysis.confidence = Math.min(
          90, 
          ContentTypeAnalyzer.BASE_CONFIDENCE + trueCrimeScore * ContentTypeAnalyzer.SCORE_MULTIPLIER
        );
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
      
      if (recordedGameScore > sportsDocScore && recordedGameScore >= ContentTypeAnalyzer.MIN_DETECTION_SCORE) {
        analysis.detected_type = 'sports_event';
        analysis.confidence = Math.min(
          90, 
          ContentTypeAnalyzer.BASE_CONFIDENCE + recordedGameScore * ContentTypeAnalyzer.SCORE_MULTIPLIER
        );
        analysis.reasoning.push('Recorded sports event/game detected');
        analysis.suggested_labels = ['sports', 'live_event'];
        if (genres.includes('documentary')) {
          analysis.overrides_genre = true;
        }
      } else if (sportsDocScore >= ContentTypeAnalyzer.MIN_DETECTION_SCORE) {
        analysis.detected_type = 'sports_documentary';
        analysis.confidence = Math.min(
          90, 
          ContentTypeAnalyzer.BASE_CONFIDENCE + sportsDocScore * ContentTypeAnalyzer.SCORE_MULTIPLIER
        );
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
      { pattern: /\bperforms\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bperformance\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\blive at\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\brecorded (at|live)\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bfilmed (at|live|in front)\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bstand-?up (routine|special|show)\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\bcomedy (routine|special|show)\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\btakes the stage\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bin front of (a |an )?(live )?audience\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bone-(wo)?man show\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bsolo show\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bcomedy club\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\btheater\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\btheatre\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW }
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
      { pattern: /\b(the )?life (of|and)\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bstory of\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bjourney of\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\brise (of|to)\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bchronicles\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bexplores the life\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bintimate (look|portrait)\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bbehind the scenes\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bearly (days|years|life)\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bcareer of\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\blegacy of\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bfrom humble beginnings\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bbiography\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\bgrew up\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bchildhood\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bpath to (fame|success|stardom)\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bthrough the years\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bpersonal (life|journey|struggles)\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM }
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
      { pattern: /\bconcert\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\btour\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\blive performance\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bperforms live\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bstadium\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\barena\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bon stage\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bsetlist\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bworld tour\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\beras tour\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\bfarewell tour\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\breunion tour\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\bsold[- ]out (show|concert)\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bnight(s)? of music\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM }
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
      { pattern: /\bdocumentary\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bexplores\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bexamines\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bchronicles\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bhistory of\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bmaking of\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\binside look\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\barchive footage\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\binterviews\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\brare footage\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bnever[- ]before[- ]seen\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM }
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
      score += ContentTypeAnalyzer.WEIGHT_MEDIUM;
    }
    
    const biopicIndicators = [
      { pattern: /\bportrays\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bstars as\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\brise to fame\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bstruggles\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bbased on the (true |real )?life\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\btrue story\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\binspired by\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bdramatizes\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bdramatic retelling\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bfrom rags to riches\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM }
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
      { pattern: /\bcompetition\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bcontestants\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\belimination\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\bchallenges\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bdating\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bbachelor(ette)?\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\bhousewives\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\breal lives\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bfollows the\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bcameras follow\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\breality\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bunscripted\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bcompete for\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bvote(d)? off\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\brose ceremony\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH }
    ];
    
    for (const { pattern, weight } of realityIndicators) {
      if (pattern.test(overview)) {
        score += weight;
      }
    }
    
    // Check keywords too
    for (const kw of keywords) {
      if (ContentTypeAnalyzer.REALITY_KEYWORDS.some(rk => kw.includes(rk))) {
        score += ContentTypeAnalyzer.WEIGHT_MEDIUM;
      }
    }
    
    return score;
  }
  
  scoreTrueCrime(overview, keywords) {
    let score = 0;
    const trueCrimeIndicators = [
      { pattern: /\bmurder(s|er|ed)?\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bkill(ing|er|ed)?\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bserial killer\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\binvestigation\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bdetective(s)?\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bcrime scene\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bvictim(s)?\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bsuspect(s)?\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\btrial\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bconvicted\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bunsolved\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bcold case\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\btrue crime\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\bdisappearance\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bforensic\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM }
    ];
    
    for (const { pattern, weight } of trueCrimeIndicators) {
      if (pattern.test(overview)) {
        score += weight;
      }
    }
    
    for (const kw of keywords) {
      if (ContentTypeAnalyzer.TRUE_CRIME_KEYWORDS.some(tc => kw.includes(tc))) {
        score += ContentTypeAnalyzer.WEIGHT_MEDIUM;
      }
    }
    
    return score;
  }
  
  scoreRecordedGame(overview, title) {
    let score = 0;
    const gameIndicators = [
      { pattern: /\b(super ?bowl|world series|world cup|stanley cup|nba finals)\b/i, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\bchampionship (game|match|final)\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\bfinal(s)? (game|match)\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bplayoff(s)?\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\b(game|match) \d+\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bvs\.?\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bversus\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bfull (game|match)\b/, weight: ContentTypeAnalyzer.WEIGHT_HIGH },
      { pattern: /\bhighlights\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM }
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
      { pattern: /\blegendary\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bcareer\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bathlete(s)?\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bteam('s)? (story|journey|history)\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\bbehind the scenes\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM },
      { pattern: /\brises? to\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\btriumph\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\bdefeat\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\binterviews\b/, weight: ContentTypeAnalyzer.WEIGHT_LOW },
      { pattern: /\barchive footage\b/, weight: ContentTypeAnalyzer.WEIGHT_MEDIUM }
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
           keywords.some(k => ContentTypeAnalyzer.ANIME_KEYWORDS.includes(k));
  }
  
  isAdultContent(metadata, overview) {
    const hasAdultCert = ContentTypeAnalyzer.ADULT_CERTIFICATIONS.includes(metadata.certification);
    
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
    
    const hasAdultKeywords = (metadata.keywords || []).some(k => 
      ContentTypeAnalyzer.ADULT_KEYWORDS.some(ak => k.toLowerCase().includes(ak))
    );
    
    return hasAdultCert || hasAdultOverview || hasAdultKeywords;
  }
}

module.exports = new ContentTypeAnalyzer();
