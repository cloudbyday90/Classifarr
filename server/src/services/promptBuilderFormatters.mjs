export function getDiscordTitle(prompt) {
    const emoji = {
        low_confidence: '🎬',
        ai_rejection: '⚠️',
        close_race: '🏆',
        new_discovery: '🆕',
        confirmation: '✅',
        standard: '🎬'
    };

    return `${emoji[prompt.type] || '🎬'} ${prompt.title}`;
}

export function getDiscordDescription(prompt) {
    switch (prompt.type) {
        case 'low_confidence':
            return `Classification Needed\n\n📊 Confidence: ${prompt.confidence}% → ${prompt.topSuggestion?.libraryName || 'Unknown'}`;
        case 'ai_rejection':
            return `AI Validation Rejected\n\n${prompt.aiReasoning}`;
        case 'close_race':
            return 'Close Call - Multiple Strong Matches';
        case 'new_discovery':
            return `New ${prompt.discoveryType} Detected: ${prompt.discoveryEntity}`;
        case 'confirmation':
            return `Please confirm: ${prompt.suggestion?.libraryName}`;
        default:
            return `Confidence: ${prompt.confidence}%`;
    }
}

export function getDiscordColor(prompt) {
    const colors = {
        low_confidence: 0xFFA500,
        ai_rejection: 0xFF0000,
        close_race: 0xFFFF00,
        new_discovery: 0x00FFFF,
        confirmation: 0x00FF00,
        standard: 0x0099FF
    };

    return colors[prompt.type] || colors.standard;
}

export function getDiscordFields(prompt) {
    const fields = [];

    if (prompt.type === 'low_confidence') {
        if (prompt.matchingSignals.length > 0) {
            fields.push({
                name: '✅ Matching Signals',
                value: prompt.matchingSignals.map(s => `• ${s}`).join('\n'),
                inline: false
            });
        }
        if (prompt.conflictingSignals.length > 0) {
            fields.push({
                name: '⚠️ Conflicting Signals',
                value: prompt.conflictingSignals.map(s => `• ${s}`).join('\n'),
                inline: false
            });
        }
        if (prompt.missingSignals.length > 0) {
            fields.push({
                name: '❓ Missing Information',
                value: prompt.missingSignals.map(s => `• ${s}`).join('\n'),
                inline: false
            });
        }
    }

    if (prompt.suggestions && prompt.suggestions.length > 0) {
        fields.push({
            name: '📚 Suggestions',
            value: prompt.suggestions.map((s, i) =>
                `[${i + 1}] ${s.libraryName} (${s.score}%)`
            ).join('\n'),
            inline: false
        });
    }

    return fields;
}

export function getDiscordComponents(prompt) {
    const components = [];

    if (prompt.suggestions && prompt.suggestions.length > 0) {
        const options = prompt.suggestions.map(s => ({
            label: s.libraryName,
            value: s.libraryId.toString(),
            description: `${s.score}% confidence`
        }));

        components.push({
            type: 1,
            components: [{
                type: 3,
                custom_id: 'library_select',
                placeholder: 'Select library...',
                options
            }]
        });
    }

    return components;
}

export function formatForDiscord(prompt) {
    const embed = {
        title: getDiscordTitle(prompt),
        description: getDiscordDescription(prompt),
        color: getDiscordColor(prompt),
        fields: getDiscordFields(prompt),
        timestamp: new Date().toISOString()
    };

    const components = getDiscordComponents(prompt);

    return {
        embeds: [embed],
        components
    };
}

export function getWebContent(prompt) {
    return {
        header: prompt.title,
        description: getDiscordDescription(prompt),
        signals: {
            matching: prompt.matchingSignals || [],
            conflicting: prompt.conflictingSignals || [],
            missing: prompt.missingSignals || []
        },
        suggestions: prompt.suggestions || [],
        reasonOptions: prompt.reasonOptions || [],
        patternOptions: prompt.patternOptions || []
    };
}

export function getWebActions(prompt) {
    const actions = [];

    if (prompt.suggestions && prompt.suggestions.length > 0) {
        actions.push({
            type: 'select_library',
            options: prompt.suggestions.map(s => ({
                value: s.libraryId,
                label: s.libraryName,
                score: s.score
            }))
        });
    }

    actions.push({
        type: 'submit',
        label: 'Confirm Selection'
    });

    return actions;
}

export function formatForWeb(prompt) {
    return {
        type: prompt.type,
        title: prompt.title,
        content: getWebContent(prompt),
        actions: getWebActions(prompt),
        metadata: {
            confidence: prompt.confidence,
            timestamp: new Date().toISOString()
        }
    };
}
