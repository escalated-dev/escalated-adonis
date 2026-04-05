import Macroable from '@poppinss/macroable';
import type { Encryption } from '@adonisjs/encryption';
import { ServerResponse, IncomingMessage } from 'node:http';
import type { Qs } from './qs.js';
import { Redirect } from './redirect.js';
import type { Router } from './router/main.js';
import type { HttpContext } from './http_context/main.js';
import type { CastableHeader, CookieOptions, ResponseConfig, ResponseStream } from './types/response.js';
/**
 * The response is a wrapper over [ServerResponse](https://nodejs.org/api/http.html#http_class_http_serverresponse)
 * streamlining the process of writing response body and automatically setting up appropriate headers.
 */
export declare class Response extends Macroable {
    #private;
    request: IncomingMessage;
    response: ServerResponse;
    /**
     * Does response has body set that will written to the
     * response socket at the end of the request
     */
    get hasLazyBody(): boolean;
    /**
     * Find if the response has non-stream content
     */
    get hasContent(): boolean;
    /**
     * Returns true when response body is set using "response.stream"
     * method
     */
    get hasStream(): boolean;
    /**
     * Returns true when response body is set using "response.download"
     * or "response.attachment" methods
     */
    get hasFileToStream(): boolean;
    /**
     * Returns the response content. Check if the response
     * has content using the "hasContent" method
     */
    get content(): [any, boolean, (string | undefined)?] | undefined;
    /**
     * Returns reference to the stream set using "response.stream"
     * method
     */
    get outgoingStream(): import("stream").Readable | undefined;
    /**
     * Returns reference to the file path set using "response.stream"
     * method.
     */
    get fileToStream(): {
        path: string;
        generateEtag: boolean;
    } | undefined;
    /**
     * Lazy body is used to set the response body. However, do not
     * write it on the socket immediately unless `response.finish`
     * is called.
     */
    lazyBody: Partial<{
        content: [any, boolean, string?];
        stream: [ResponseStream, ((error: NodeJS.ErrnoException) => [string, number?])?];
        fileToStream: [string, boolean, ((error: NodeJS.ErrnoException) => [string, number?])?];
    }>;
    /**
     * The ctx will be set by the context itself. It creates a circular
     * reference
     */
    ctx?: HttpContext;
    constructor(request: IncomingMessage, response: ServerResponse, encryption: Encryption, config: ResponseConfig, router: Router, qs: Qs);
    /**
     * Returns a boolean telling if response is finished or not.
     * Any more attempts to update headers or body will result
     * in raised exceptions.
     */
    get finished(): boolean;
    /**
     * Returns a boolean telling if response headers has been sent or not.
     * Any more attempts to update headers will result in raised
     * exceptions.
     */
    get headersSent(): boolean;
    /**
     * Returns a boolean telling if response headers and body is written
     * or not. When value is `true`, you can feel free to write headers
     * and body.
     */
    get isPending(): boolean;
    /**
     * Writes the body with appropriate response headers. Etag header is set
     * when `generateEtag` is set to `true`.
     *
     * Empty body results in `204`.
     */
    protected writeBody(content: any, generateEtag: boolean, jsonpCallbackName?: string): void;
    /**
     * Stream the body to the response and handles cleaning up the stream
     */
    protected streamBody(body: ResponseStream, errorCallback?: (error: NodeJS.ErrnoException) => [string, number?]): Promise<void>;
    /**
     * Downloads a file by streaming it to the response
     */
    protected streamFileForDownload(filePath: string, generateEtag: boolean, errorCallback?: (error: NodeJS.ErrnoException) => [string, number?]): Promise<void>;
    /**
     * Listen for the event the response is written
     * to the TCP socket.
     *
     * Under the hood the callback is registered with
     * the "https://github.com/jshttp/on-finished" package
     */
    onFinish(callback: (err: Error | null, response: ServerResponse) => void): void;
    /**
     * Writes headers with the Node.js res object using the
     * response.setHeader method
     */
    relayHeaders(): void;
    /**
     * Calls res.writeHead on the Node.js res object.
     */
    writeHead(statusCode?: number): this;
    /**
     * Returns the existing value for a given HTTP response
     * header.
     */
    getHeader(key: string): import("http").OutgoingHttpHeader | undefined;
    /**
     * Get response headers
     */
    getHeaders(): {
        [x: string]: import("http").OutgoingHttpHeader | undefined;
        accept?: string | string[] | undefined;
        "accept-charset"?: string | string[] | undefined;
        "accept-encoding"?: string | string[] | undefined;
        "accept-language"?: string | string[] | undefined;
        "accept-ranges"?: string | undefined;
        "access-control-allow-credentials"?: string | undefined;
        "access-control-allow-headers"?: string | undefined;
        "access-control-allow-methods"?: string | undefined;
        "access-control-allow-origin"?: string | undefined;
        "access-control-expose-headers"?: string | undefined;
        "access-control-max-age"?: string | undefined;
        "access-control-request-headers"?: string | undefined;
        "access-control-request-method"?: string | undefined;
        age?: string | undefined;
        allow?: string | undefined;
        authorization?: string | undefined;
        "cache-control"?: string | undefined;
        "cdn-cache-control"?: string | undefined;
        connection?: string | string[] | undefined;
        "content-disposition"?: string | undefined;
        "content-encoding"?: string | undefined;
        "content-language"?: string | undefined;
        "content-length"?: string | number | undefined;
        "content-location"?: string | undefined;
        "content-range"?: string | undefined;
        "content-security-policy"?: string | undefined;
        "content-security-policy-report-only"?: string | undefined;
        "content-type"?: string | undefined;
        cookie?: string | string[] | undefined;
        dav?: string | string[] | undefined;
        dnt?: string | undefined;
        date?: string | undefined;
        etag?: string | undefined;
        expect?: string | undefined;
        expires?: string | undefined;
        forwarded?: string | undefined;
        from?: string | undefined;
        host?: string | undefined;
        "if-match"?: string | undefined;
        "if-modified-since"?: string | undefined;
        "if-none-match"?: string | undefined;
        "if-range"?: string | undefined;
        "if-unmodified-since"?: string | undefined;
        "last-modified"?: string | undefined;
        link?: string | string[] | undefined;
        location?: string | undefined;
        "max-forwards"?: string | undefined;
        origin?: string | undefined;
        pragma?: string | string[] | undefined;
        "proxy-authenticate"?: string | string[] | undefined;
        "proxy-authorization"?: string | undefined;
        "public-key-pins"?: string | undefined;
        "public-key-pins-report-only"?: string | undefined;
        range?: string | undefined;
        referer?: string | undefined;
        "referrer-policy"?: string | undefined;
        refresh?: string | undefined;
        "retry-after"?: string | undefined;
        "sec-websocket-accept"?: string | undefined;
        "sec-websocket-extensions"?: string | string[] | undefined;
        "sec-websocket-key"?: string | undefined;
        "sec-websocket-protocol"?: string | string[] | undefined;
        "sec-websocket-version"?: string | undefined;
        server?: string | undefined;
        "set-cookie"?: string | string[] | undefined;
        "strict-transport-security"?: string | undefined;
        te?: string | undefined;
        trailer?: string | undefined;
        "transfer-encoding"?: string | undefined;
        "user-agent"?: string | undefined;
        upgrade?: string | undefined;
        "upgrade-insecure-requests"?: string | undefined;
        vary?: string | undefined;
        via?: string | string[] | undefined;
        warning?: string | undefined;
        "www-authenticate"?: string | string[] | undefined;
        "x-content-type-options"?: string | undefined;
        "x-dns-prefetch-control"?: string | undefined;
        "x-frame-options"?: string | undefined;
        "x-xss-protection"?: string | undefined;
    };
    /**
     * Set header on the response. To `append` values to the existing header, we suggest
     * using [[append]] method.
     *
     * If `value` is non existy, then header won't be set.
     *
     * @example
     * ```js
     * response.header('content-type', 'application/json')
     * ```
     */
    header(key: string, value: CastableHeader): this;
    /**
     * Append value to an existing header. To replace the value, we suggest using
     * [[header]] method.
     *
     * If `value` is not existy, then header won't be set.
     *
     * @example
     * ```js
     * response.append('set-cookie', 'username=virk')
     * ```
     */
    append(key: string, value: CastableHeader): this;
    /**
     * Adds HTTP response header, when it doesn't exists already.
     */
    safeHeader(key: string, value: CastableHeader): this;
    /**
     * Removes the existing response header from being sent.
     */
    removeHeader(key: string): this;
    /**
     * Returns the status code for the response
     */
    getStatus(): number;
    /**
     * Set HTTP status code
     */
    status(code: number): this;
    /**
     * Set's status code only when it's not explictly
     * set
     */
    safeStatus(code: number): this;
    /**
     * Set response type by looking up for the mime-type using
     * partial types like file extensions.
     *
     * Make sure to read [mime-types](https://www.npmjs.com/package/mime-types) docs
     * too.
     *
     * @example
     * ```js
     * response.type('.json') // Content-type: application/json
     * ```
     */
    type(type: string, charset?: string): this;
    /**
     * Set the Vary HTTP header
     */
    vary(field: string | string[]): this;
    /**
     * Set etag by computing hash from the body. This class will set the etag automatically
     * when `etag = true` in the defined config object.
     *
     * Use this function, when you want to compute etag manually for some other resons.
     */
    setEtag(body: any, weak?: boolean): this;
    /**
     * Set X-Request-Id header by copying the header value from the request if it exists.
     *
     */
    setRequestId(): this;
    /**
     * Returns a boolean telling if the new response etag evaluates same
     * as the request header `if-none-match`. In case of `true`, the
     * server must return `304` response, telling the browser to
     * use the client cache.
     *
     * You won't have to deal with this method directly, since AdonisJs will
     * handle this for you when `http.etag = true` inside `config/app.js` file.
     *
     * However, this is how you can use it manually.
     *
     * @example
     * ```js
     * const responseBody = view.render('some-view')
     *
     * // sets the HTTP etag header for response
     * response.setEtag(responseBody)
     *
     * if (response.fresh()) {
     *   response.sendStatus(304)
     * } else {
     *   response.send(responseBody)
     * }
     * ```
     */
    fresh(): boolean;
    /**
     * Returns the response body. Returns null when response
     * body is a stream
     */
    getBody(): any;
    /**
     * Send the body as response and optionally generate etag. The default value
     * is read from `config/app.js` file, using `http.etag` property.
     *
     * This method buffers the body if `explicitEnd = true`, which is the default
     * behavior and do not change, unless you know what you are doing.
     */
    send(body: any, generateEtag?: boolean): void;
    /**
     * Alias of [[send]]
     */
    json(body: any, generateEtag?: boolean): void;
    /**
     * Writes response as JSONP. The callback name is resolved as follows, with priority
     * from top to bottom.
     *
     * 1. Explicitly defined as 2nd Param.
     * 2. Fetch from request query string.
     * 3. Use the config value `http.jsonpCallbackName` from `config/app.js`.
     * 4. Fallback to `callback`.
     *
     * This method buffers the body if `explicitEnd = true`, which is the default
     * behavior and do not change, unless you know what you are doing.
     */
    jsonp(body: any, callbackName?: string, generateEtag?: boolean): void;
    /**
     * Pipe stream to the response. This method will gracefully destroy
     * the stream, avoiding memory leaks.
     *
     * If `raiseErrors=false`, then this method will self handle all the exceptions by
     * writing a generic HTTP response. To have more control over the error, it is
     * recommended to set `raiseErrors=true` and wrap this function inside a
     * `try/catch` statement.
     *
     * Streaming a file from the disk and showing 404 when file is missing.
     *
     * @example
     * ```js
     * // Errors handled automatically with generic HTTP response
     * response.stream(fs.createReadStream('file.txt'))
     *
     * // Manually handle (note the await call)
     * try {
     *   await response.stream(fs.createReadStream('file.txt'))
     * } catch () {
     *   response.status(404).send('File not found')
     * }
     * ```
     */
    stream(body: ResponseStream, errorCallback?: (error: NodeJS.ErrnoException) => [string, number?]): void;
    /**
     * Download file by streaming it from the file path. This method will setup
     * appropriate `Content-type`, `Content-type` and `Last-modified` headers.
     *
     * Unexpected stream errors are handled gracefully to avoid memory leaks.
     *
     * If `raiseErrors=false`, then this method will self handle all the exceptions by
     * writing a generic HTTP response. To have more control over the error, it is
     * recommended to set `raiseErrors=true` and wrap this function inside a
     * `try/catch` statement.
     *
     * @example
     * ```js
     * // Errors handled automatically with generic HTTP response
     * response.download('somefile.jpg')
     *
     * // Manually handle (note the await call)
     * try {
     *   await response.download('somefile.jpg')
     * } catch (error) {
     *   response.status(error.code === 'ENOENT' ? 404 : 500)
     *   response.send('Cannot process file')
     * }
     * ```
     */
    download(filePath: string, generateEtag?: boolean, errorCallback?: (error: NodeJS.ErrnoException) => [string, number?]): void;
    /**
     * Download the file by forcing the user to save the file vs displaying it
     * within the browser.
     *
     * Internally calls [[download]]
     */
    attachment(filePath: string, name?: string, disposition?: string, generateEtag?: boolean, errorCallback?: (error: NodeJS.ErrnoException) => [string, number?]): void;
    /**
     * Set the location header.
     *
     * @example
     * ```js
     * response.location('/login')
     * ```
     */
    location(url: string): this;
    /**
     * Redirect the request.
     *
     * @example
     * ```js
     * response.redirect('/foo')
     * response.redirect().toRoute('foo.bar')
     * response.redirect().back()
     * ```
     */
    redirect(): Redirect;
    redirect(path: string, forwardQueryString?: boolean, statusCode?: number): void;
    /**
     * Abort the request with custom body and a status code. 400 is
     * used when status is not defined
     */
    abort(body: any, status?: number): never;
    /**
     * Abort the request with custom body and a status code when
     * passed condition returns `true`
     */
    abortIf(condition: unknown, body: any, status?: number): asserts condition is undefined | null | false;
    /**
     * Abort the request with custom body and a status code when
     * passed condition returns `false`
     */
    abortUnless<T>(condition: T, body: any, status?: number): asserts condition is Exclude<T, undefined | null | false>;
    /**
     * Set signed cookie as the response header. The inline options overrides
     * all options from the config.
     */
    cookie(key: string, value: any, options?: Partial<CookieOptions>): this;
    /**
     * Set encrypted cookie as the response header. The inline options overrides
     * all options from the config.
     */
    encryptedCookie(key: string, value: any, options?: Partial<CookieOptions>): this;
    /**
     * Set unsigned cookie as the response header. The inline options overrides
     * all options from the config.
     */
    plainCookie(key: string, value: any, options?: Partial<CookieOptions & {
        encode: boolean;
    }>): this;
    /**
     * Clear existing cookie.
     */
    clearCookie(key: string, options?: Partial<CookieOptions>): this;
    /**
     * Finishes the response by writing the lazy body, when `explicitEnd = true`
     * and response is already pending.
     *
     * Calling this method twice or when `explicitEnd = false` is noop.
     */
    finish(): void;
    /**
     * Shorthand method to finish request with "100" status code
     */
    continue(): void;
    /**
     * Shorthand method to finish request with "101" status code
     */
    switchingProtocols(): void;
    /**
     * Shorthand method to finish request with "200" status code
     */
    ok(body: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "201" status code
     */
    created(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "202" status code
     */
    accepted(body: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "203" status code
     */
    nonAuthoritativeInformation(body: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "204" status code
     */
    noContent(): void;
    /**
     * Shorthand method to finish request with "205" status code
     */
    resetContent(): void;
    /**
     * Shorthand method to finish request with "206" status code
     */
    partialContent(body: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "300" status code
     */
    multipleChoices(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "301" status code
     */
    movedPermanently(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "302" status code
     */
    movedTemporarily(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "303" status code
     */
    seeOther(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "304" status code
     */
    notModified(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "305" status code
     */
    useProxy(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "307" status code
     */
    temporaryRedirect(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "400" status code
     */
    badRequest(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "401" status code
     */
    unauthorized(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "402" status code
     */
    paymentRequired(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "403" status code
     */
    forbidden(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "404" status code
     */
    notFound(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "405" status code
     */
    methodNotAllowed(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "406" status code
     */
    notAcceptable(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "407" status code
     */
    proxyAuthenticationRequired(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "408" status code
     */
    requestTimeout(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "409" status code
     */
    conflict(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "401" status code
     */
    gone(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "411" status code
     */
    lengthRequired(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "412" status code
     */
    preconditionFailed(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "413" status code
     */
    requestEntityTooLarge(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "414" status code
     */
    requestUriTooLong(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "415" status code
     */
    unsupportedMediaType(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "416" status code
     */
    requestedRangeNotSatisfiable(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "417" status code
     */
    expectationFailed(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "422" status code
     */
    unprocessableEntity(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "429" status code
     */
    tooManyRequests(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "500" status code
     */
    internalServerError(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "501" status code
     */
    notImplemented(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "502" status code
     */
    badGateway(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "503" status code
     */
    serviceUnavailable(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "504" status code
     */
    gatewayTimeout(body?: any, generateEtag?: boolean): void;
    /**
     * Shorthand method to finish request with "505" status code
     */
    httpVersionNotSupported(body?: any, generateEtag?: boolean): void;
}
