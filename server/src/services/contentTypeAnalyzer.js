const { createLogger } = require('../utils/logger');

const logger = createLogger('content-analyzer');

class ContentTypeAnalyzer {
  /**
   * Analyze media metadata to detect content type
   * @param {object} metadata - Media metadata (overview, title, genres, keywords, certification)
   * @returns {object} - Analysis result with detected type, confidence, reasoning
   */
  analyze(metadata) {
    const { overview = '', title = '', genres = [], keywords = [], certification = '', original_language = '' } = metadata;

    const analysisResults = [];

    // Run all detection methods
    analysisResults.push(this.scoreRecordedPerformance(overview, title, keywords));
    analysisResults.push(this.scoreConcertFilm(overview, title, genres));
    analysisResults.push(this.scoreAdultAnimation(overview, certification, genres));
    analysisResults.push(this.scoreRealityTV(overview, genres, keywords));

    // Find highest confidence result
    const bestResult = analysisResults.reduce((best, current) => {
      return current.confidence > best.confidence ? current : best;
    });

    logger.debug('Content analysis completed', { 
      title, 
      detected: bestResult.detected_type, 
      confidence: bestResult.confidence 
    });

    return bestResult;
  }

  /**
   * Detect stand-up comedy specials vs documentaries about comedians
   */
  scoreRecordedPerformance(overview, title, keywords) {
    const text = `${overview} ${title}`.toLowerCase();
    const kwLower = keywords.map(k => k.toLowerCase());

    let confidence = 0;
    const reasoning = [];
    const suggested_labels = [];

    // Strong indicators of stand-up
    const standupIndicators = [
      'recorded live',
      'live at',
      'comedy special',
      'stand-up',
      'standup',
      'live performance',
      'taped at',
      'filmed at'
    ];

    const standupMatches = standupIndicators.filter(ind => text.includes(ind));
    
    if (standupMatches.length > 0) {
      confidence += 30 * standupMatches.length;
      reasoning.push(`Found stand-up indicators: ${standupMatches.join(', ')}`);
      suggested_labels.push('standup');
    }

    // Keyword indicators
    if (kwLower.includes('stand-up comedy') || kwLower.includes('comedy special')) {
      confidence += 40;
      reasoning.push('TMDB keywords indicate stand-up comedy');
      suggested_labels.push('standup');
    }

    // Documentary indicators suggest NOT stand-up
    const docIndicators = ['documentary about', 'biography', 'life story', 'explores', 'chronicles'];
    const docMatches = docIndicators.filter(ind => text.includes(ind));
    
    if (docMatches.length > 0 && standupMatches.length === 0) {
      confidence = 0;
      reasoning.push('Documentary-style language detected, not a stand-up special');
    }

    if (confidence >= 70) {
      return {
        detected_type: 'standup',
        confidence: Math.min(confidence, 95),
        reasoning,
        suggested_labels: ['standup', 'comedy'],
        overrides_genre: true,
        original_genres: []
      };
    }

    return { detected_type: null, confidence: 0, reasoning: [], suggested_labels: [], overrides_genre: false };
  }

  /**
   * Detect concert films vs music documentaries vs biopics
   */
  scoreConcertFilm(overview, title, genres) {
    const text = `${overview} ${title}`.toLowerCase();
    const genresLower = genres.map(g => g.toLowerCase());

    let confidence = 0;
    const reasoning = [];
    const suggested_labels = [];

    // Concert indicators
    const concertIndicators = [
      'live concert',
      'concert film',
      'tour',
      'live performance',
      'on stage',
      'world tour',
      'performs live'
    ];

    const concertMatches = concertIndicators.filter(ind => text.includes(ind));

    if (concertMatches.length > 0) {
      confidence += 35 * concertMatches.length;
      reasoning.push(`Concert film indicators: ${concertMatches.join(', ')}`);
      suggested_labels.push('concert');
    }

    // Genre check
    if (genresLower.includes('music') && concertMatches.length > 0) {
      confidence += 20;
      reasoning.push('Music genre combined with concert indicators');
    }

    // Documentary indicators reduce concert confidence
    if (genresLower.includes('documentary') && !text.includes('concert')) {
      confidence = Math.max(0, confidence - 30);
      reasoning.push('Documentary genre without concert context');
    }

    if (confidence >= 70) {
      return {
        detected_type: 'concert',
        confidence: Math.min(confidence, 95),
        reasoning,
        suggested_labels: ['concert', 'music'],
        overrides_genre: true,
        original_genres: genres
      };
    }

    return { detected_type: null, confidence: 0, reasoning: [], suggested_labels: [], overrides_genre: false };
  }

  /**
   * Detect adult animation vs family animation
   */
  scoreAdultAnimation(overview, certification, genres) {
    const genresLower = genres.map(g => g.toLowerCase());

    let confidence = 0;
    const reasoning = [];
    const suggested_labels = [];

    if (!genresLower.includes('animation')) {
      return { detected_type: null, confidence: 0, reasoning: [], suggested_labels: [], overrides_genre: false };
    }

    // Adult certifications
    const adultCertifications = ['R', 'NC-17', 'TV-MA', 'TV-14'];
    
    if (adultCertifications.includes(certification)) {
      confidence += 60;
      reasoning.push(`Adult certification: ${certification}`);
      suggested_labels.push('adult_animation');
    }

    // Adult themes in overview
    const overview_lower = overview.toLowerCase();
    const adultThemes = ['explicit', 'mature', 'adult', 'nsfw', 'vulgar', 'crude'];
    const themeMatches = adultThemes.filter(theme => overview_lower.includes(theme));

    if (themeMatches.length > 0) {
      confidence += 20 * themeMatches.length;
      reasoning.push(`Adult themes detected: ${themeMatches.join(', ')}`);
      suggested_labels.push('adult_animation');
    }

    // Comedy genre with adult cert
    if (genresLower.includes('comedy') && adultCertifications.includes(certification)) {
      confidence += 15;
      reasoning.push('Adult animated comedy');
    }

    if (confidence >= 70) {
      return {
        detected_type: 'adult_animation',
        confidence: Math.min(confidence, 95),
        reasoning,
        suggested_labels: ['adult_animation', 'animation'],
        overrides_genre: false, // Don't override, just enhance
        original_genres: genres
      };
    }

    // If G, PG, or TV-Y, definitely family
    const familyCertifications = ['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-G'];
    if (familyCertifications.includes(certification)) {
      return {
        detected_type: 'family_animation',
        confidence: 90,
        reasoning: [`Family-friendly certification: ${certification}`],
        suggested_labels: ['animation', 'family'],
        overrides_genre: false,
        original_genres: genres
      };
    }

    return { detected_type: null, confidence: 0, reasoning: [], suggested_labels: [], overrides_genre: false };
  }

  /**
   * Detect reality TV vs documentary series
   */
  scoreRealityTV(overview, genres, keywords) {
    const text = overview.toLowerCase();
    const genresLower = genres.map(g => g.toLowerCase());
    const kwLower = keywords.map(k => k.toLowerCase());

    let confidence = 0;
    const reasoning = [];
    const suggested_labels = [];

    // Reality TV indicators
    const realityIndicators = [
      'contestants',
      'compete',
      'competition',
      'elimination',
      'voted off',
      'real people',
      'unscripted',
      'reality show'
    ];

    const realityMatches = realityIndicators.filter(ind => text.includes(ind));

    if (realityMatches.length > 0) {
      confidence += 30 * realityMatches.length;
      reasoning.push(`Reality TV indicators: ${realityMatches.join(', ')}`);
      suggested_labels.push('reality');
    }

    // TMDB might label as Documentary but it's really Reality
    if (genresLower.includes('documentary') && realityMatches.length > 1) {
      confidence += 25;
      reasoning.push('Labeled as documentary but shows reality TV characteristics');
    }

    // Keywords
    if (kwLower.includes('reality television') || kwLower.includes('reality tv')) {
      confidence += 40;
      reasoning.push('TMDB keywords indicate reality TV');
      suggested_labels.push('reality');
    }

    if (confidence >= 75) {
      return {
        detected_type: 'reality_tv',
        confidence: Math.min(confidence, 95),
        reasoning,
        suggested_labels: ['reality', 'reality_competition'],
        overrides_genre: genresLower.includes('documentary'), // Override if misclassified as documentary
        original_genres: genres
      };
    }

    return { detected_type: null, confidence: 0, reasoning: [], suggested_labels: [], overrides_genre: false };
  }
}

module.exports = new ContentTypeAnalyzer();
