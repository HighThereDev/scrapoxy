'use strict';

const http = require('http'),
    net = require('net');


const config = {
    port: process.env.port || 3128,
    client_ips: process.env.client_ips || []
};

// Create server
const server = http.createServer();

// Accept client via CONNECT method
server.on('connect', (req, socket, head) => {

    if (!authorized(req)) {
        console.error('Unauthorized Client: ', getClientIp(req));
        return socket.end();
    }

    console.log(`Url: ${req.url}`);

    // Decrypt target
    parseTarget(req.url, (err, target) => {
        if (err) {
            console.error('Error (parsing): ', err);
            return socket.end();
        }

        // Connect to target
        console.log('connect to %s, port %d', target.hostname, target.port);
        const proxy_socket = net.Socket();
        proxy_socket.connect(target.port, target.hostname);

        socket.on('error', (err) => {
            console.error('Error (socket): ', err);
            proxy_socket.end();
        });

        proxy_socket.on('error', (err) => {
            console.error('Error (proxy_socket): ', err);
            socket.end();
        });

        // Send hello
        socket.write('HTTP/1.1 200 Connection established\r\n\r\n');
        proxy_socket.write(head);

        // Pipe data
        socket.pipe(proxy_socket).pipe(socket);
    });
});

// Response to PING on GET /ping
server.on('request', (req, res) => {
    if (req.method === 'GET' && req.url === '/secure') {
        if (config.client_ips.length > 0) {
            res.statusCode = 401;
            res.end();
        }
        else {
            const ip = getClientIp(req);
            if (ip) {
                console.log(`restricting connections to client: ${ip}`);
                config.client_ips.push(ip);
            }
            res.statusCode = 200;
            res.end();
        }
    }
    else if (req.method === 'GET' && req.url === '/ping') {
        if (authorized(req)) {
            setTimeout(() => {
                res.statusCode = 200;
                res.end();
            }, 1000);
        }
        else {
            res.statusCode = 401;
            res.end();
        }
    }
    else {
        res.statusCode = 404;
        res.end();
    }
});

server.listen(config.port, (err) => {
    if (err) {
        return console.error('cannot start proxy');
    }

    console.log('proxy listening at port %d', config.port);
});


////////////

function parseTarget(url, callback) {
    if (!url) return callback('No URL found');

    const part = url.split(':');
    if (part.length !== 2) {
        return callback(`Cannot parse target: ${url}`);
    }

    const hostname = part[0],
        port = parseInt(part[1]);

    if (!hostname || !port) {
        return callback(`Cannot parse target (2): ${url}`);
    }

    callback(null, {hostname, port});
}

function authorized(request) {
    return config.client_ips.length === 0 || config.client_ips.indexOf(getClientIp(request)) !== -1;
}

function getClientIp(request) {
    if (!request) return null;

    const headers = [
        'X-Client-IP',
        'X-Forwarded-For',
        'CF-Connecting-IP',
        'Fastly-Client-Ip',
        'True-Client-Ip',
        'X-Real-IP',
        'X-Cluster-Client-IP',
        'X-Forwarded',
        'Forwarded-For',
        'Forwarded',
    ];

    const paths = [
        'connection.remoteAddress',
        'socket.remoteAddress',
        'connection.socket.remoteAddress',
        'info.remoteAddress',
    ];

    if (request.headers) {
        const request_headers = Object.keys(request.headers);
        const clean_headers = request_headers.map((header) => String(header).toLowerCase());
        const matched_header = headers.findIndex((header) => clean_headers.indexOf(header.toLowerCase()) >= 0);
        if (matched_header >= 0) {
            return request.headers[request_headers[matched_header]];
        }
    }

    const ip = paths.reduce((acc,path)=>{
        return acc || path.split('.').reduce((val,key)=>{
            return val && val[key] ? val[key] : null;
        }, request);
    }, null);

    return ip;
}
