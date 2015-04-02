import { Promise } from './promise';
import { CancellationToken } from './cancellation';
/**
 * A Uri
 */
export declare class Uri {
    /**
     * The protocol for the Uri (e.g. 'http:')
     * @type {String}
     */
    protocol: string;
    /**
     * The hostname for the Uri
     * @type {String}
     */
    hostname: string;
    /**
     * The port number for the Uri
     * @type {Number}
     */
    port: number;
    /**
     * The path name for the Uri
     * @type {String}
     */
    pathname: string;
    /**
     * The search portion of the path, also known as the querystring
     * @type {String}
     */
    search: string;
    /**
     * The fragment portion of the path
     * @type {String}
     */
    hash: string;
    /**
     * A value indicating whether the Url is an absolute url
     * @type {Boolean}
     */
    absolute: boolean;
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
    /**
     * Gets the origin of the Uri
     */
    origin: string;
    /**
     * Gets the host for the uri, including the hostname and port
     */
    host: string;
    /**
     * Gets the scheme for the uri (e.g. 'http://'')
     */
    scheme: string;
    /**
     * Tests whether the provided uri has the same origin as this uri
     * @param uri The uri to compare against
     * @returns True if the uri's have the same origin; otherwise, false
     */
    isSameOrigin(uri: string | Uri): boolean;
    /**
     * Gets the string representation of the Uri
     * @param format {String} A format specifier.
     * @returns {String} The string content of the Uri
     */
    toString(format?: string): string;
    /**
     * Parses the provided uri string
     * @param uri {String} The uri string to parse
     * @returns {Uri} The parsed uri
     */
    static parse(uri: string): Uri;
    /**
     * Combines two uris
     * @param baseUri The base uri
     * @param uri The relative uri
     * @returns The combined uri
     */
    static combine(baseUri: string | Uri, uri: string | Uri): Uri;
}
export declare module QueryString {
    interface QueryStringMap {
        [key: string]: string | number | boolean | (string | number | boolean)[];
    }
    function stringify(obj: any): string;
    function parse(text: string): QueryStringMap;
}
/**
 * An HTTP request for an HttpClient
 */
export declare class HttpRequest {
    private _headers;
    /**
     * The body of the request
     * @type {any}
     */
    body: any;
    /**
     * The HTTP method for the request
     * @type {String}
     */
    method: string;
    /**
     * The url for the request
     * @type {Uri}
     */
    url: Uri;
    /**
     * Creates an HTTP request for an HttpClient
     * @param method The HTTP method for the request
     * @param url The url for the request
     */
    constructor(method?: string, url?: string | Uri);
    /**
     * Sets the named request header
     * @param key {String} The header name
     * @param value {String} The header value
     */
    setRequestHeader(key: string, value: string): void;
}
/**
 * A response from an HttpClient
 */
export declare class HttpResponse {
    private _request;
    private _xhr;
    /**
     * A response from an HttpClient
     */
    constructor(request: HttpRequest, xhr: XMLHttpRequest);
    /**
     * Gets the request for this response
     */
    request: HttpRequest;
    /**
     * Gets the status code of the response
     */
    status: number;
    /**
     * Gets the status text of the response
     */
    statusText: string;
    /**
     * Gets the response text of the response
     */
    responseText: string;
    /**
     * Gets all of the response heades in a single string
     * @returns {String} A string containing all of the response headers
     */
    getAllResponseHeaders(): string;
    /**
     * Gets the value for the named response header
     * @param header {String} The name of the header
     * @returns {String} The value for the named header
     */
    getResponseHeader(header: string): string;
}
/**
 * A client for HTTP requests
 */
export declare class HttpClient {
    private _headers;
    private _cts;
    private _closed;
    /**
     * The base url for the client
     * @type {Uri}
     */
    baseUrl: Uri;
    /**
     * A value indicating whether cookies should be sent to a cross-origin request
     * @type {Boolean}
     */
    withCredentials: boolean;
    /**
     * The number of milliseconds to wait before the request should time out
     * @type {Number}
     */
    timeout: number;
    /**
     * The username for the request
     * @type {String}
     */
    username: string;
    /**
     * The password for the request
     * @type {String}
     */
    password: string;
    /**
     * Creates a client for HTTP requests
     * @param baseUrl The base url for the client
     */
    constructor(baseUrl?: string | Uri);
    /**
     * Closes the client and cancels all pending requests
     */
    close(): void;
    /**
     * Sets a value for a default request header
     * @param key The request header key
     * @param value The request header value
     */
    setRequestHeader(key: string, value: string): void;
    /**
     * Gets the response text from the requested url
     * @param url The url for the request
     * @returns A future result for the string
     */
    getStringAsync(url: string | Uri): Promise<string>;
    /**
     * Gets the response from issuing an HTTP GET to the requested url
     * @param url The url for the request
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    getAsync(url: string | Uri, token?: CancellationToken): Promise<HttpResponse>;
    /**
     * Gets the response from issuing an HTTP POST to the requested url
     * @param url The url for the request
     * @param body The body of the request
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    postAsync(url: string | Uri, body: any, token?: CancellationToken): Promise<HttpResponse>;
    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url The url for the request
     * @param value The value to serialize
     * @param jsonReplacer An array or callback used to replace values during serialization
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    postJsonAsync(url: string | Uri, value: any, jsonReplacer?: any[] | ((key: string, value: any) => string), token?: CancellationToken): Promise<HttpResponse>;
    /**
     * Gets the response from issuing an HTTP PUT to the requested url
     * @param url The url for the request
     * @param body The body of the request
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    putAsync(url: string | Uri, body: any, token?: CancellationToken): Promise<HttpResponse>;
    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url The url for the request
     * @param value The value to serialize
     * @param jsonReplacer An array or callback used to replace values during serialization
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    putJsonAsync(url: string | Uri, value: any, jsonReplacer?: any[] | ((key: string, value: any) => string), token?: CancellationToken): Promise<HttpResponse>;
    /**
     * Gets the response from issuing an HTTP DELETE to the requested url
     * @param url The url for the request
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    deleteAsync(url: string | Uri, token?: CancellationToken): Promise<HttpResponse>;
    /**
     * Sends the provided request and returns the response
     * @param request {HttpRequest} An HTTP request to send
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    sendAsync(request: HttpRequest, token?: CancellationToken): Promise<HttpResponse>;
    getJsonpAsync<T>(url: string | Uri, callbackArg?: string, noCache?: boolean, token?: CancellationToken): Promise<T>;
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
