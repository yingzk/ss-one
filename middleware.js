export class ErrorHandler {
    static handle(error, request) {
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });

        // 添加 CORS 头
        const headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        };

        if (error instanceof ValidationError) {
            return new Response(JSON.stringify({
                error: error.message,
                code: 'VALIDATION_ERROR'
            }), {
                status: 400,
                headers
            });
        }

        if (error instanceof AuthError) {
            return new Response(JSON.stringify({
                error: error.message,
                code: 'AUTH_ERROR'
            }), {
                status: 401,
                headers
            });
        }

        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            code: 'INTERNAL_ERROR',
            message: error.message  // 添加具体错误信息
        }), {
            status: 500,
            headers
        });
    }
}

export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class AuthError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.name = 'AuthError';
    }
} 