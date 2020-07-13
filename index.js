const FS = require('fs');
const URL = require('url');
const Path = require('path');
const cache = {};

function file(path) {
    path = path.replace(/\.\./g, '.');
    path = Path.normalize(path);

    return Path.join(__dirname, path);
}

const server = require('http').createServer(function (request, response) {
    const url = URL.parse(request.url);

    if (url.pathname === '/') {
        FS.createReadStream(file('index.html')).pipe(response);
        return;
    }

    if (url.pathname.startsWith('/a/')) {
        const slug = url.pathname.slice(3);
        if (slug in cache) {
            response.writeHead(200);
            response.end(cache[slug]);
            return;
        }
    }

    response.writeHead(404, 'Bleep!');
    response.end(cache[404]);
});

FS.readFile(file('404.html'), (_, buffer) => cache[404] = buffer.toString('utf-8'));

server.listen(process.env.PORT || 3000);