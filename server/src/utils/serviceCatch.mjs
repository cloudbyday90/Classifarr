export async function withServiceCatch(logger, label, context, fn) {
    if (typeof context === 'function') {
        fn = context;
        context = {};
    }
    try {
        return await fn();
    } catch (error) {
        logger.error(label, { error: error.message, ...context });
        throw error;
    }
}
