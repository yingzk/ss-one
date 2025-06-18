// CFSUB.js
import { CONFIG } from './config.js';
import { NodesService, CollectionsService, ShareService, AuthService, UserService } from './services.js';
import { generateManagementPage } from './management.js';
import { isSubscriptionPath } from './utils.js';
import { ErrorHandler } from './middleware.js';
import { generateUserPage } from './user.js';

export default {
    async fetch(request, env, ctx) {
        try {
            const services = initializeServices(env);
            return await handleRequest(request, env, services);
        } catch (err) {
            return ErrorHandler.handle(err, request);
        }
    }
};

function initializeServices(env) {
    const nodesService = new NodesService(env, CONFIG);
    const collectionsService = new CollectionsService(env, CONFIG);
    const shareService = new ShareService(env, CONFIG, nodesService, collectionsService);
    const userService = new UserService(env, CONFIG);
    const authService = new AuthService(env, CONFIG);

    return {
        nodes: nodesService,
        collections: collectionsService,
        share: shareService,
        user: userService,
        auth: authService
    };
}

async function handleRequest(request, env, services) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS 预检请求处理
    if (method === 'OPTIONS') {
        return handleCORS();
    }

    // 处理 favicon.ico 请求
    if (path === '/favicon.ico') {
        return new Response(null, { status: 204 });  // 返回空响应
    }

    // 用户页面路由处理
    if (path.startsWith(CONFIG.API.USER.PAGE)) {
        try {
            let auth = request.headers.get('Authorization');
            const url = new URL(request.url);
            const token = url.searchParams.get('token');
            if (token) {
                auth = `Bearer ${token}`;
            }

            if (auth?.startsWith('Bearer ')) {
                const sessionToken = auth.split(' ')[1];
                const session = await services.user.verifySession(sessionToken, request);
                if (session) {
                    return generateUserPage(env, 'secret', {
                        username: session.username,
                        collectionId: session.collectionId,
                        expiry: session.expiry,
                        request: request
                    });
                }
            }
            return generateUserPage(env);
        } catch (error) {
            return ErrorHandler.handle(error, request);
        }
    }

    // 公开路径不需要认证
    if (isPublicPath(path)) {
        if (path.startsWith('/api/')) {
            return handleAPIRequest(request, path, services);
        }
        return null;  // 继续处理其他路由
    }

    // 管理员认证检查
    const auth = request.headers.get('Authorization');
    if (!auth || !services.auth.checkAuth(auth)) {
        return new Response('Unauthorized', {
            status: 401,
            headers: {
                'WWW-Authenticate': 'Basic realm="Admin Access"',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    // API 路由处理
    if (path.startsWith('/api/')) {
        return handleAPIRequest(request, path, services);
    }

    // 返回管理界面
    return generateManagementPage(env, CONFIG);
}

function isPublicPath(path) {
    return path.startsWith(CONFIG.API.SHARE) || 
           isSubscriptionPath(path) || 
           path.startsWith('/user') ||  // 用户页面径
           path.startsWith(CONFIG.API.USER.BASE) ||  // 所有用户API都是公开的
           path === '/favicon.ico';
}

function handleCORS() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    });
}

async function handleAPIRequest(request, path, services) {
    
    // 分享API - 公开访问
    if (path.startsWith(CONFIG.API.SHARE)) {
        return services.share.handleRequest(request);
    }
    
    // 用户API - 公开访问
    if (path.startsWith(CONFIG.API.USER.BASE)) {
        if (path === CONFIG.API.USER.LOGIN) {
            return services.user.handleLogin(request);
        }
        
        // 处理登出请求
        if (path === CONFIG.API.USER.LOGOUT) {
            const urlObj = new URL(request.url);
            const token = urlObj.searchParams.get('token');
            if (token) {
                await services.user.deleteSession(token);
            }
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return services.user.handleRequest(request);
    }
    
    // 节点API - 需要管理员权限
    if (path.startsWith(CONFIG.API.NODES)) {
        return services.nodes.handleRequest(request);
    }
    
    // 集合API - 需要管理员权限
    if (path.startsWith(CONFIG.API.COLLECTIONS)) {
        return services.collections.handleRequest(request);
    }

    return new Response('Not Found', { status: 404 });
}