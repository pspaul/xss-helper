# xss-helper
Just an unfinished tool with a boring name that makes XSS boilerplate stuff less annoying.

## Usage
Use `yarn start` or build and run with docker.

### Payloads
Requesting `/PAYLOAD` will return one of the following payloads:

| Name | Functionality |
|---|---|
| default | `alert(origin)` |
| hash | `eval(decodeURIComponent(location.hash.slice(1)))` |
| cookie | send cookie to `?cb`/`?callback` |
| fetch | send `?ex`/`?extract` to `?cb`/`?callback` |
| name | set `window.name` to `?name` and redirect to `?url` |

If the `PAYLOAD` is not known, it will be reflected in the response.
The `PAYLOAD` can also be specified via `?p` or `?payload`.

It is also possible to serve payload files. They have to be placed in the `./payloads` directory and can then be accessed via `/p/PATH`. Example: put `xss.html` into `./paylodas/test/`, it will be served on `/p/test/xss.html`.

### Response Type
The response type will be determined by the server as follows:

1. `?type` or `?t` is set
    - `html`: html,
    - `script`: script
    - `plain`: plain
2. OR path ends with `.EXT`
    - `html`, `htm`: html
    - `js`: script
    - other: plain
3. OR the `sec-fetch-dest` header is set to:
    - `document`, `embed`, `frame`, `iframe`, `object`: html
    - `script`, `audioworklet`, `paintworklet`, `serviceworker`, `sharedworker`, `worker`: script
    - other: plain
4. OR the `accept` header is set to:
    - `text/html`: html
    - `application/javascript`: script
    - `text/plain`
5. OR use plain

### Response Headers
Response headers can be defined using the `h` or `headers` query parameters.
Example: `?h[referrer-policy]=unsafe-url` will set the `Referrer-Policy` header to `unsafe-url`.

Some headers will be set by default, but can be overriden:
- `access-control-allow-origin: *`
- `cross-origin-resource-policy: cross-origin`
- `cross-origin-embedder-policy: unsafe-none`

### Config
Configuration via environment variables:

| Name | Default | Description |
|---|---|---|
| HOST | `127.0.0.1` | The address to bind to |
| PORT | `3000` | The port to listen on |
| PREFIX | `/` | The path prefix to remove before processing (useful for setups with a reverse proxy) |
