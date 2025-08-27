export async function onRequest(context) {
    // 检查是否为WebSocket请求
    if (context.request.headers.get('Upgrade') !== 'websocket') {
        return new Response('请使用WebSocket连接', { status: 426 });
    }

    // 建立WebSocket连接
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // 管理连接和用户
    const connections = new Map(); // 存储所有连接: userId -> { ws, user }
    let onlineCount = 0;

    // 处理服务器端WebSocket事件
    server.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'login':
                    // 存储新连接
                    connections.set(data.user.id, {
                        ws: server,
                        user: data.user
                    });
                    onlineCount = connections.size;
                    // 广播在线人数
                    broadcast({ type: 'online', count: onlineCount });
                    break;

                case 'message':
                    // 广播消息给所有连接
                    broadcast({ type: 'message', msg: data.msg });
                    break;

                case 'logout':
                    // 移除连接
                    connections.delete(data.userId);
                    onlineCount = connections.size;
                    // 广播在线人数
                    broadcast({ type: 'online', count: onlineCount });
                    break;
            }
        } catch (err) {
            console.error('处理消息错误:', err);
        }
    });

    // 连接关闭时清理
    server.addEventListener('close', () => {
        // 找到并移除断开的连接
        for (const [userId, conn] of connections) {
            if (conn.ws === server) {
                connections.delete(userId);
                onlineCount = connections.size;
                broadcast({ type: 'online', count: onlineCount });
                break;
            }
        }
    });

    // 广播消息给所有连接
    function broadcast(message) {
        const msg = JSON.stringify(message);
        for (const conn of connections.values()) {
            try {
                conn.ws.send(msg);
            } catch (err) {
                console.error('广播消息失败:', err);
            }
        }
    }

    // 接受WebSocket连接
    server.accept();

    // 返回客户端WebSocket
    return new Response(null, {
        status: 101,
        webSocket: client
    });
}
    