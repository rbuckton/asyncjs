import cancellation = require('./cancellation');
import promise = require('./promise');

import Promise = promise.Promise;
import CancellationToken = cancellation.CancellationToken;
import CancellationRegistration = cancellation.CancellationRegistration;
import CancellationTokenSource = cancellation.CancellationTokenSource

var hasMsNonUserCodeExceptions =
    typeof Debug !== "undefined" &&
    typeof Debug.setNonUserCodeExceptions === "boolean";

/**
 * A Uri
 */
export class Uri {
    /**
     * The protocol for the Uri (e.g. 'http:')
     * @type {String}
     */
    public protocol: string = "";

    /**
     * The hostname for the Uri
     * @type {String}
     */
    public hostname: string = "";

    /**
     * The port number for the Uri
     * @type {Number}
     */
    public port: number = null;

    /**
     * The path name for the Uri
     * @type {String}
     */
    public pathname: string = "";

    /**
     * The search portion of the path, also known as the querystring
     * @type {String}
     */
    public search: string = "";

    /**
     * The fragment portion of the path
     * @type {String}
     */
    public hash: string = "";

    /**
     * A value indicating whether the Url is an absolute url
     * @type {Boolean}
     */
    public absolute: boolean = false;

    /**
     * Creates a new Uri by parsing a string
     * @param uri {String} The uri string to parse
     */
    constructor(uri: string);

    /**
     * Creates a new Uri by combining a base Uri and a relative Uri
     * @param baseUri The base uri
     * @param uri The relative uri
     */
    constructor(baseUri: string | Uri, uri: string | Uri);

    constructor(...args: any[]) {
        if (args.length === 0) throw new Error("Argument missing");
        if (args.length === 1) {
            var m = UriParser.exec(args[0]);
            if (!m) throw new URIError();
            
            for (var name in UriParts) {
                var index = UriParts[name];
                var part: any = m[index];
                if (part) {
                    if (index < 5) part = part.toLowerCase();
                    else if (index === 5) part = parseInt(part);
                }
                else {
                    if (index === 5) part = m[1] ? UriPorts[this.protocol] : null;
                }
                
                (<any>this)[name] = part;
            }
            
            this.absolute = !!m[1];         
        }
        else {
            var baseUri: Uri = args[0] instanceof Uri ? args[0] : Uri.parse(args[0]);
            var uri: Uri = args[0] instanceof Uri ? args[1] : Uri.parse(args[1]);
            if (uri.absolute) {         
                this.protocol = uri.protocol;
                this.hostname = uri.hostname;
                this.port = uri.port;
                this.pathname = uri.pathname;
                this.search = uri.search;
                this.hash = uri.hash;
                this.absolute = uri.absolute;
            }
            else {
                this.protocol = baseUri.protocol;
                this.hostname = baseUri.hostname;
                this.port = baseUri.port;
                this.pathname = baseUri.pathname;
                this.search = baseUri.search;
                this.hash = baseUri.hash;
                this.absolute = baseUri.absolute;
                if (uri.pathname) {
                    if (uri.pathname[0] !== '/') {
                        if ((baseUri.absolute && !baseUri.pathname) || baseUri.pathname === "/") {
                            this.pathname = '/' + uri.pathname;
                        }
                        else if (baseUri.pathname) {
                            var parts = baseUri.pathname.split('/');
                            parts[parts.length - 1] = uri.pathname;
                            this.pathname = parts.join('/');
                        }
                    }
                }
                else {
                    this.pathname = baseUri.pathname;
                    if (!uri.search) {
                        this.search = baseUri.search;
                        if (!uri.hash) {
                            this.hash = baseUri.hash;
                        }
                    }
                }
            }
        }

        Object.freeze(this);
    }
    
    /**
     * Gets the origin of the Uri
     */
    public get origin(): string {
        return this.toString("origin");
    }

    /**
     * Gets the host for the uri, including the hostname and port
     */
    public get host(): string {
        return this.toString("host");
    }

    /**
     * Gets the scheme for the uri (e.g. 'http://'')
     */
    public get scheme(): string {
        return this.toString("scheme");
    }

    /**
     * Tests whether the provided uri has the same origin as this uri
     * @param uri The uri to compare against
     * @returns True if the uri's have the same origin; otherwise, false
     */
    public isSameOrigin(uri: string | Uri): boolean {
        var other: Uri;
        if (typeof uri === "string") {
          other = Uri.parse(<string>uri);
        }
        else if (uri instanceof Uri) {
          other = uri;
        }
        else {
          throw new TypeError("Argument not optional.");
        }

        if (this.absolute) {
            return this.origin === other.origin;
        }

        return !other.absolute;
    }

    /**
     * Gets the string representation of the Uri
     * @param format {String} A format specifier.
     * @returns {String} The string content of the Uri
     */
    public toString(format?: string): string {
        switch (format) {
            case "origin":
                if (this.protocol && this.hostname) {
                    return String(this.protocol) + "//" + this.toString("host");
                }
                return "";

            case "authority":
            case "host":
                if (this.hostname) {
                    if (this.port !== UriPorts[this.protocol]) {
                        return String(this.hostname) + ":" + this.toString("port");
                    }
                    return String(this.hostname);
                }
                return "";

            case "path+search":
                return String(this.pathname) + String(this.search);

            case "scheme": return this.toString("protocol") + "//";
            case "protocol": return String(this.protocol || "");
            case "hostname": return String(this.hostname || "");
            case "port":
                if (this.port) {
                    return String(this.port);
                }
                if (this.protocol && UriPorts[this.protocol]) {
                    return String(UriPorts[this.protocol]);
                }
                return "";

            case "file":
                if (this.pathname) {
                    var i = this.pathname.lastIndexOf("/") + 1;
                    if (i > 0) {
                        return this.pathname.substr(i);
                    }
                }
                return "";

            case "dir":
                if (this.pathname) {
                    var i = this.pathname.lastIndexOf("/") + 1;
                    if (i > 0) {
                        return this.pathname.substr(0, i);
                    }
                }
                return "";

            case "ext":
                if (this.pathname) {
                    var i = this.pathname.lastIndexOf("/") + 1;
                    i = this.pathname.lastIndexOf(".", i);
                    if (i > 0) {
                        return this.pathname.substr(i);
                    }
                }
                return "";

            case "file-ext":
                if (this.pathname) {
                    var i = this.pathname.lastIndexOf("/") + 1;
                    if (i) {
                        var j = this.pathname.lastIndexOf(".", i);
                        if (j > 0) {
                            return this.pathname.substring(i, j);
                        }
                        return this.pathname.substr(i);
                    }
                }
                return "";

            case "fragment":
            case "hash": 
                var hash = String(this.hash || "");
                if (hash.length > 0 && hash.charAt(0) != "#") {
                    return "#" + hash;
                }
                return hash;

            case "path":
            case "pathname": 
                return String(this.pathname || "");

            case "search":
            case "query": 
                var search = String(this.search || "");
                if (search.length > 0 && search.charAt(0) != "?") {
                    return "?" + search;
                }
                return search;

            default: 
                return this.toString("origin") + this.toString("pathname") + this.toString("search") + this.toString("hash");
        }
    }

    /**
     * Parses the provided uri string
     * @param uri {String} The uri string to parse
     * @returns {Uri} The parsed uri
     */
    public static parse(uri: string): Uri {
        return new Uri(uri);
    }

    /**
     * Combines two uris
     * @param baseUri The base uri
     * @param uri The relative uri
     * @returns The combined uri
     */
    public static combine(baseUri: string | Uri, uri: string | Uri): Uri {
        return new Uri(baseUri, uri);
    }
}

export module QueryString {
    var hasOwn = Object.prototype.hasOwnProperty;
    var QueryStringParser = /(?:\?|&|^)([^=&]*)(?:=([^&]*))?/g;

    export interface QueryStringMap { 
      [key: string]: string | number | boolean | (string | number | boolean)[];
    }

    export function stringify(obj: QueryStringMap): string {
        var qs: string[] = [];
        Object.getOwnPropertyNames(obj).forEach(name => {
            var value = obj[name];
            switch (typeof value) {
                case "string":
                case "number":
                case "boolean": {
                    qs.push(encodeURIComponent(name) + "=" + encodeURIComponent(String(value)));
                    return;
                }

                default: {
                    if (Array.isArray(value)) {
                        var ar = <any[]>value;
                        for (var i = 0, n = ar.length; i < n; i++) {
                            switch (typeof ar[i]) {
                                case "string":
                                case "number":
                                case "boolean":
                                    qs.push(encodeURIComponent(name) + "=" + encodeURIComponent(String(value)));
                                    break;

                                default:
                                    qs.push(encodeURIComponent(name) + "=");
                                    break;
                            }
                        }
                    }
                    else {
                        qs.push(encodeURIComponent(name) + "=");
                    }
                }
            }
        });

        if (qs.length) {
            return "?" + qs.join("&");
        }

        return "";
    }

    export function parse(text: string): QueryStringMap {
        var obj: QueryStringMap = {};
        var part: RegExpExecArray;
        while (part = QueryStringParser.exec(text)) {
            var key = decodeURIComponent(part[1]);
            if (key.length && key !== "__proto__") {
                var value = decodeURIComponent(part[2]);
                if (hasOwn.call(obj, key)) {
                    var previous = obj[key];
                    if (Array.isArray(previous)) {
                        var ar = <any[]>previous;
                        ar.push(value);
                    }
                    else {
                        obj[key] = [<string | number | boolean>previous, value];
                    }
                }
                else {
                    obj[key] = value;
                }
            }
        }

        return obj;
    }
}


/**
 * An HTTP request for an HttpClient
 */
export class HttpRequest {
    private _headers: ObjectMap<string>;

    /**
     * The body of the request   
     * @type {any}
     */
    public body: any;

    /**
     * The HTTP method for the request
     * @type {String}
     */
    public method: string;

    /**
     * The url for the request
     * @type {Uri}
     */
    public url: Uri;

    /**
     * Creates an HTTP request for an HttpClient
     * @param method The HTTP method for the request
     * @param url The url for the request
     */
    constructor(method: string = "GET", url?: string | Uri) {
        this._headers = Object.create(null);
        this.method = method;
        if (typeof url === "string") {
            this.url = Uri.parse(url);
        }
        else if (url instanceof Uri) {
            this.url = url;
        }
    }

    /**
     * Sets the named request header
     * @param key {String} The header name
     * @param value {String} The header value
     */
    public setRequestHeader(key: string, value: string): void {
        if (key !== "__proto__") {
            this._headers[key] = value;
        }
    }
}

/**
 * A response from an HttpClient
 */
export class HttpResponse {
    private _request: HttpRequest;
    private _xhr: XMLHttpRequest;

    /**
     * A response from an HttpClient
     */
    constructor(request: HttpRequest, xhr: XMLHttpRequest) {
        this._request = request;
        this._xhr = xhr;
    }

    /**
     * Gets the request for this response
     */
    public get request(): HttpRequest {
        return this._request;
    }

    /**
     * Gets the status code of the response
     */
    public get status(): number {
        return this._xhr.status;
    }

    /**
     * Gets the status text of the response
     */
    public get statusText(): string {
        return this._xhr.statusText;
    }

    /**
     * Gets the response text of the response
     */
    public get responseText(): string {
        return this._xhr.responseText;
    }

    /**
     * Gets all of the response heades in a single string
     * @returns {String} A string containing all of the response headers
     */
    public getAllResponseHeaders(): string {
        return this._xhr.getAllResponseHeaders();
    }
    
    /**
     * Gets the value for the named response header
     * @param header {String} The name of the header
     * @returns {String} The value for the named header
     */
    public getResponseHeader(header: string): string {
        return this._xhr.getResponseHeader(header);
    }
}

/**
 * A client for HTTP requests
 */
export class HttpClient {

    private _headers: ObjectMap<string>;
    private _cts: CancellationTokenSource;
    private _closed: boolean;

    /**
     * The base url for the client
     * @type {Uri}
     */
    public baseUrl: Uri;

    /**
     * A value indicating whether cookies should be sent to a cross-origin request
     * @type {Boolean}
     */
    public withCredentials: boolean;

    /**
     * The number of milliseconds to wait before the request should time out
     * @type {Number}
     */
    public timeout: number;

    /**
     * The username for the request
     * @type {String}
     */
    public username: string;

    /**
     * The password for the request
     * @type {String}
     */
    public password: string;

    /**
     * Creates a client for HTTP requests
     * @param baseUrl The base url for the client
     */
    constructor(baseUrl?: string | Uri) {
        this._headers = Object.create(null);
        this._cts = new CancellationTokenSource();
        this._closed = false;
                
        if (baseUrl) {
            if (typeof baseUrl === "string") {
              this.baseUrl = Uri.parse(baseUrl);
            }
            else if (baseUrl instanceof Uri) {
              this.baseUrl = baseUrl;
            }
        }
    }

    /**
     * Closes the client and cancels all pending requests
     */
    public close(): void {
        if (this._closed) throw new Error("Object doesn't support this action");
        this._closed = true;
        this._cts.cancel();
        this._cts.close();       
    }

    /**
     * Sets a value for a default request header
     * @param key The request header key
     * @param value The request header value
     */
    public setRequestHeader(key: string, value: string): void {
        if (this._closed) throw new Error("Object doesn't support this action");
        if (key !== "__proto__") {
            this._headers[key] = value;
        }
    }

    /**
     * Gets the response text from the requested url
     * @param url The url for the request
     * @returns A future result for the string
     */
    public getStringAsync(url: string | Uri): Promise<string> {
        return this.getAsync(url).then(r => r.responseText);
    }

    /**
     * Gets the response from issuing an HTTP GET to the requested url
     * @param url The url for the request
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    public getAsync(url: string | Uri, token?: cancellation.CancellationToken): Promise<HttpResponse> {
        return this.sendAsync(new HttpRequest("GET", url), token);
    }

    /**
     * Gets the response from issuing an HTTP POST to the requested url
     * @param url The url for the request
     * @param body The body of the request
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    public postAsync(url: string | Uri, body: any, token?: cancellation.CancellationToken): Promise<HttpResponse> {
        var request = new HttpRequest("POST", url);
        request.body = body;
        return this.sendAsync(request, token);
    }

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url The url for the request
     * @param value The value to serialize
     * @param jsonReplacer An array or callback used to replace values during serialization
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    public postJsonAsync(url: string | Uri, value: any, jsonReplacer?: any[] | ((key: string, value: any) => string), token?: cancellation.CancellationToken): Promise<HttpResponse> {
        var request = new HttpRequest("POST", url);
        request.body = JSON.stringify(value, <any>jsonReplacer);
        request.setRequestHeader("Content-Type", "application/json");
        return this.sendAsync(request, token);
    }

    /**
     * Gets the response from issuing an HTTP PUT to the requested url
     * @param url The url for the request
     * @param body The body of the request
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    public putAsync(url: string | Uri, body: any, token?: cancellation.CancellationToken): Promise<HttpResponse> {
        var request = new HttpRequest("PUT", url);
        request.body = body;
        return this.sendAsync(request, token);
    }

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url The url for the request
     * @param value The value to serialize
     * @param jsonReplacer An array or callback used to replace values during serialization
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    public putJsonAsync(url: string | Uri, value: any, jsonReplacer?: any[] | ((key: string, value: any) => string), token?: cancellation.CancellationToken): Promise<HttpResponse> {
        var request = new HttpRequest("PUT", url);
        request.body = JSON.stringify(value, <any>jsonReplacer);
        request.setRequestHeader("Content-Type", "application/json");
        return this.sendAsync(request, token);
    }

    /**
     * Gets the response from issuing an HTTP DELETE to the requested url
     * @param url The url for the request
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    public deleteAsync(url: string | Uri, token?: cancellation.CancellationToken): Promise<HttpResponse> {
        return this.sendAsync(new HttpRequest("DELETE", url), token);
    }

    /**
     * Sends the provided request and returns the response
     * @param request {HttpRequest} An HTTP request to send
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public sendAsync(request: HttpRequest, token?: cancellation.CancellationToken): Promise<HttpResponse> {
        if (this._closed) throw new Error("Object doesn't support this action");

        return new Promise<HttpResponse>((resolve, reject) => {

            // create a linked token
            var cts = new CancellationTokenSource(this._cts.token, token);

            // throw if we're already canceled, the promise will be rejected
            cts.token.throwIfCanceled();

            // normalize the uri
            var url: Uri = null;
            if (!request.url) {
                url = this.baseUrl;
            }
            else if (!request.url.absolute) {
                if (!this.baseUrl) throw new Error("Invalid argument: request");
                url = new Uri(this.baseUrl, request.url);
            }
                
            if (url) {
                request.url = url;
            }

            var xhr = new XMLHttpRequest();
            var response = new HttpResponse(request, xhr);
            var requestHeaders = (<any>request)._headers;
            var clientHeaders = this._headers;

            // create the onload callback
            var onload = (ev: Event) => {
                if (hasMsNonUserCodeExceptions) Debug.setNonUserCodeExceptions = true;
                cleanup();

                // catch a cancellation and reject the promise
                try {
                    cts.token.throwIfCanceled();
                }
                catch (e) {
                    reject(e);
                    return;
                }
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(response);
                }
                else {
                    var error = createHttpError(this, response);
                    reject(error);
                }
            };

            // create the onerror callback
            var onerror = (ev: ErrorEvent) => {
                if (hasMsNonUserCodeExceptions) Debug.setNonUserCodeExceptions = true;
                cleanup();

                // catch a cancellation and reject the promise
                try {
                    cts.token.throwIfCanceled();
                }
                catch (e) {
                    reject(e);
                    return;
                }

                var error = createHttpError(this, response);
                reject(error);
            };

            // register a cleanup phase
            var registration = cts.token.register(() => {
                if (hasMsNonUserCodeExceptions) Debug.setNonUserCodeExceptions = true;
                cleanup();

                // abort the xhr
                xhr.abort();

                // catch a cancellation and reject the promise
                try {
                    cts.token.throwIfCanceled();
                }
                catch (e) {
                    reject(e);
                }
            });

            var cleanup = () => {
                xhr.removeEventListener("load", onload, false);
                xhr.removeEventListener("error", onerror, false);
                registration.unregister();
                registration = undefined;
            };

            // add the headers from the client
            Object.getOwnPropertyNames(clientHeaders).forEach(key => {
                xhr.setRequestHeader(key, clientHeaders[key]);
            });

            // add the headers from the request
            Object.getOwnPropertyNames(requestHeaders).forEach(key => {
                xhr.setRequestHeader(key, requestHeaders[key]);
            });

            // wire up the events
            xhr.addEventListener("load", onload, false);
            xhr.addEventListener("error", onerror, false);

            // enable credentials if requested
            if (this.withCredentials) {
                xhr.withCredentials = true;
            }

            // attach a timeout
            if (this.timeout > 0) {
                cts.cancelAfter(this.timeout);
                xhr.timeout = this.timeout;
            }

            // send the request
            xhr.open(request.method, request.url.toString(), true, this.username, this.password);
            xhr.send(request.body);
        });
    }

    public getJsonpAsync<T>(url: string | Uri, callbackArg: string = "callback", noCache: boolean = false, token?: cancellation.CancellationToken): Promise<T> {
        if (this._closed) throw new Error("Object doesn't support this action");
        if (typeof document === "undefined") throw new Error("JSON-P is not supported in this host.");

        return new Promise<T>((resolve, reject) => {
            // create a linked token
            var cts = new CancellationTokenSource(this._cts.token, token);

            // throw if we're already canceled, the promise will be rejected
            cts.token.throwIfCanceled();

            // normalize the uri
            var requestUrl: Uri = null;
            if (!url) {
                requestUrl = this.baseUrl;
            }
            else {
                if (typeof url === "string") {
                  requestUrl = new Uri(url);
                }
                else if (url instanceof Uri) {
                  requestUrl = url;
                }

                if (!requestUrl.absolute) {
                    if (!this.baseUrl) throw new Error("Invalid argument: url");
                    requestUrl = new Uri(this.baseUrl, requestUrl);
                }
            }

            var index = jsonpRequestIndex++;
            var name = "__Promise__jsonp__" + index;
            var query = QueryString.parse(requestUrl.search);
            query[callbackArg] = name;
            if (noCache) {
                query["_t"] = Date.now();
            }
            
            requestUrl.search = QueryString.stringify(query);

            var pending = true;
            var head = document.getElementsByTagName("head")[0];
            var script = <HTMLScriptElement>document.createElement("script");
            script.type = "text/javascript";
            script.async = true;
            script.src = requestUrl.toString();
            
            // checks whether the request has been canceled
            var checkCanceled = () => {
                if (hasMsNonUserCodeExceptions) Debug.setNonUserCodeExceptions = true;
                try {
                    cts.token.throwIfCanceled();
                }
                catch (e) {
                    reject(e);
                    return true;
                }

                return false;
            }

            // waits for the result
            var onload = (result: any) => {
                ignore();
                registration.unregister();
                registration = undefined;
                if (!checkCanceled()) {
                    resolve(result);
                }
            }

            // ignores further calls to fulfill the result
            var ignore = () => {
                pending = false;
                delete (<any>window)[name];
                disconnect();
            }

            // disconnects the script node
            var disconnect = () => {
                if (script.parentNode) {
                    head.removeChild(script);
                }
            }

            // register a cleanup phase
            var registration = cts.token.register(() => {                
                if (pending) {
                    (<any>window)[name] = ignore;
                }

                disconnect();
                checkCanceled();
            });
            
            // set a timeout before we no longer care about the result.
            if (this.timeout) {
                cts.cancelAfter(this.timeout);
            }

            (<any>window)[name] = onload;
            head.appendChild(script);
        });
    }
}

/**
 * An error raised during an http request
 */
export interface HttpError extends Error {

  /**
   * The `HttpClient` that initiated the request
   */
  httpClient: HttpClient;

  /**
   * The `HttpResponse` for the error
   */
  response: HttpResponse;
}

function createHttpError(httpClient: HttpClient, response: HttpResponse, message: string = "An error occurred while processing your request"): HttpError {
  var error = <HttpError>new Error(message);
  error.name = "HttpError";
  error.httpClient = httpClient;
  error.response = response;
  error.message = message;
  return error;
}

interface ObjectMap<T> {
  [key: string]: T;
}

var UriParser = /^((?:(https?:)\/\/)(?:[^:@]*(?:\:[^@]*)?@)?(([a-z\d-\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF\.]+)(?:\:(\d+))?)?)?(?![a-z\d-]+\:)((?:^|\/)[^\?\#]*)?(\?[^#]*)?(#.*)?$/i;
var UriParts: ObjectMap<number> = { "protocol": 2, "hostname": 4, "port": 5, "pathname": 6, "search": 7, "hash": 8 };
var UriPorts: ObjectMap<number> = { "http:": 80, "https:": 443 };
var jsonpRequestIndex = 0;