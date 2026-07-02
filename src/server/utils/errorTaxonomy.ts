
export const ERROR_CATEGORIES = {
    SYSTEM: 'SYSTEM',
    VALIDATION: 'VALIDATION',
    EXTERNAL: 'EXTERNAL',
    AUTHORIZATION: 'AUTHORIZATION'
};

export const ERROR_CODES = {
    SYSTEM: {
        CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
        INTERNAL_ERROR: 'INTERNAL_ERROR'
    },
    VALIDATION: {
        INVALID_INPUT: 'INVALID_INPUT',
        NOT_FOUND: 'NOT_FOUND'
    },
    EXTERNAL: {
        API_ERROR: 'API_ERROR'
    },
    AUTHORIZATION: {
        UNAUTHORIZED: 'UNAUTHORIZED'
    }
};

export class StandardError extends Error {
    code: string;
    statusCode: number;
    details: unknown;
    category: string;

    constructor(code: string, message: string, statusCode: number = 500, details: unknown = null, category: string = 'SYSTEM') {
        super(message);
        this.name = 'StandardError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.category = category;
    }
}
