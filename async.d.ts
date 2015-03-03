/*! *****************************************************************************
Copyright (C) Ron A. Buckton. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use 
this file except in compliance with the License. You may obtain a copy of the 
License at http://www.apache.org/licenses/LICENSE-2.0 

Unless required by applicable law or agreed to in writing, software 
distributed under the License is distributed on an "AS IS" BASIS, 
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 

See the License for the specific language governing permissions and 
limitations under the License. 
***************************************************************************** */
declare module 'task' {
    type Handle = {};
    function scheduleTask(task: () => void): Handle;
    function cancelTask(handle: Handle): void;
    
}
declare module 'promise' {
    export interface IPromise<T> {
        then<TResult>(onfulfilled: (value: T) => TResult | IPromise<TResult>, onrejected: (reason: any) => TResult | IPromise<TResult>): IPromise<TResult>;
    }
    /**
     * Represents the completion of an asynchronous operation
     */
    class Promise<T> {
        /**
         * Creates a new Promise.
         * @param init A callback used to initialize the promise. This callback is passed two arguments: a resolve callback used resolve the promise with a value or the result of another promise, and a reject callback used to reject the promise with a provided reason or error.
         */
        constructor(init: (resolve: (value?: IPromise<T> | T) => void, reject: (reason?: any) => void) => void);
        /**
         * Creates a new resolved promise for the provided value.
         * @param value A promise.
         * @returns A promise whose internal state matches the provided promise.
         */
        static resolve<T>(value: IPromise<T> | T): Promise<T>;
        /**
         * Creates a new resolved promise .
         * @returns A resolved promise.
         */
        static resolve(): Promise<void>;
        /**
         * Creates a new rejected promise for the provided reason.
         * @param reason The reason the promise was rejected.
         * @returns A new rejected Promise.
         */
        static reject(reason: any): Promise<void>;
        /**
         * Creates a new rejected promise for the provided reason.
         * @param reason The reason the promise was rejected.
         * @returns A new rejected Promise.
         */
        static reject<T>(reason: any): Promise<T>;
        /**
         * Creates a Promise that is resolved with an array of results when all of the provided Promises resolve, or rejected when any Promise is rejected.
         * @param values An array of Promises.
         * @returns A new Promise.
         */
        static all<T>(values: Array<IPromise<T> | T>): Promise<T[]>;
        /**
         * Creates a Promise that is resolved with an array of results when all of the provided Promises resolve, or rejected when any Promise is rejected.
         * @param values An array of values.
         * @returns A new Promise.
         */
        static all(values: IPromise<void>[]): Promise<void>;
        /**
         * Creates a Promise that is resolved or rejected when any of the provided Promises are resolved or rejected.
         * @param values An array of Promises.
         * @returns A new Promise.
         */
        static race<T>(values: Array<IPromise<T> | T>): Promise<T>;
        /**
         * Attaches callbacks for the resolution and/or rejection of the Promise.
         * @param onfulfilled The callback to execute when the Promise is resolved.
         * @param onrejected The callback to execute when the Promise is rejected.
         * @returns A Promise for the completion of which ever callback is executed.
         */
        then<TResult>(onfulfilled?: (value: T) => IPromise<TResult> | TResult, onrejected?: (reason: any) => IPromise<TResult> | TResult): Promise<TResult>;
        /**
         * Attaches a callback for only the rejection of the Promise.
         * @param onrejected The callback to execute when the Promise is rejected.
         * @returns A Promise for the completion of the callback.
         */
        catch(onrejected: (reason: any) => IPromise<T> | T): Promise<T>;
        /**
         * Attaches a callback for that is executed regardless of the resolution or rejection of the promise.
         * @param onsettled The callback to execute when the Promise is settled.
         * @returns A Promise for the completion of the callback.
         */
        finally(onsettled: () => IPromise<void> | void): Promise<T>;
        private _resolve(rejecting, result);
        private _await(onresolved, onrejected);
        private _settle(rejecting, result);
        private _forward(prev, resolve, reject, rejecting, result, onresolved, onrejected, id);
    }
    
}
declare module 'deferred' {
    import promise = require('./promise');
    import IPromise = promise.IPromise;
    import Promise = promise.Promise;
    class Deferred<T> {
        private _promise;
        private _resolve;
        private _reject;
        constructor();
        promise: Promise<T>;
        resolve(value?: IPromise<T> | T): void;
        reject(reason: any): void;
    }
    
}
declare module 'cancellation' {
    /**
     * A token used to recieve a cancellation signal.
     */
    export interface CancellationToken {
        /**
         * Gets a value indicating whether the token has received a cancellation signal.
         */
        canceled: boolean;
        /**
         * Gets the reason for cancellation, if one was supplied.
         */
        reason: any;
        /**
         * Throws an `Error` if the token has received a cancellation signal.
         */
        throwIfCanceled(): void;
        /**
         * Requests a callback when the token receives a cancellation signal, to perform additional cleanup.
         * @param callback The callback to execute
         * @returns A `CancellationRegistration` that that can be used to cancel the cleanup request.
         */
        register(callback: (reason: any) => void): CancellationRegistration;
    }
    /**
     * An object used to unregister a callback delegate registered to a `CancellationToken`
     */
    export interface CancellationRegistration {
        /**
         * Unregisters the callback
         */
        unregister(): void;
    }
    /**
     * A source for cancellation
     */
    class CancellationTokenSource {
        private static _canceled;
        private _callbacks;
        private _links;
        private _token;
        private _timer;
        private _canceled;
        private _reason;
        /**
         * A source for cancellation
         * @param delay The number of milliseconds to wait before cancelling the source
         * @param links Other `CancellationToken` instances that will cancel this source if the tokens are canceled.
         */
        constructor(delay: number, ...links: CancellationToken[]);
        /**
         * A source for cancellation
         * @param delay The number of milliseconds to wait before cancelling the source
         * @param links Other `CancellationToken` instances that will cancel this source if the tokens are canceled.
         */
        constructor(delay: number, links: CancellationToken[]);
        /**
         * A source for cancellation
         * @param delay The number of milliseconds to wait before cancelling the source
         */
        constructor(delay: number);
        /**
         * A source for cancellation
         * @param links Other `CancellationToken` instances that will cancel this source if the tokens are canceled.
         */
        constructor(...links: CancellationToken[]);
        /**
         * A source for cancellation
         * @param links Other `CancellationToken` instances that will cancel this source if the tokens are canceled.
         */
        constructor(links: CancellationToken[]);
        /**
         * Gets an already cancelled `CancellationToken`.
         */
        static canceled: CancellationToken;
        /**
         * Gets a value indicating whether the token has received a cancellation signal.
         */
        canceled: boolean;
        /**
         * Gets the reason for cancellation, if one was supplied.
         */
        reason: any;
        /**
         * Gets the `CancellationToken` for this source.
         */
        token: CancellationToken;
        /**
         * Signals the source is cancelled.
         * @param reason An optional reason for the cancellation.
         */
        cancel(reason?: any): void;
        /**
         * Signals the source is canceled after a delay.
         * @param delay The number of milliseconds to delay before signalling cancellation.
         * @param reason An optional reason for the cancellation.
         */
        cancelAfter(delay: number, reason?: any): void;
        /**
         * Closes the CancellationSource, preventing any future cancellation signal.
         */
        close(): void;
        private static _ontimeout(source, reason);
        private _register(callback);
        private _cancelCore(reason);
        private _clearTimeout();
        private _throwIfFrozen();
    }
    
}
declare module 'utils' {
    import promise = require('./promise');
    import cancellation = require('./cancellation');
    import Promise = promise.Promise;
    import CancellationToken = cancellation.CancellationToken;
    function sleep(delay?: number, token?: CancellationToken): Promise<void>;
    
}
declare module 'httpclient' {
    import cancellation = require('./cancellation');
    import promise = require('./promise');
    import Promise = promise.Promise;
    /**
     * A Uri
     */
    class Uri {
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
    module QueryString {
        interface QueryStringMap {
            [key: string]: string | number | boolean | (string | number | boolean)[];
        }
        function stringify(obj: any): string;
        function parse(text: string): QueryStringMap;
    }
    /**
     * An HTTP request for an HttpClient
     */
    class HttpRequest {
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
    class HttpResponse {
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
    class HttpClient {
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
        getAsync(url: string | Uri, token?: cancellation.CancellationToken): Promise<HttpResponse>;
        /**
         * Gets the response from issuing an HTTP POST to the requested url
         * @param url The url for the request
         * @param body The body of the request
         * @param token A token that can be used to cancel the request
         * @returns A future result for the response
         */
        postAsync(url: string | Uri, body: any, token?: cancellation.CancellationToken): Promise<HttpResponse>;
        /**
         * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
         * @param url The url for the request
         * @param value The value to serialize
         * @param jsonReplacer An array or callback used to replace values during serialization
         * @param token A token that can be used to cancel the request
         * @returns A future result for the response
         */
        postJsonAsync(url: string | Uri, value: any, jsonReplacer?: any[] | ((key: string, value: any) => string), token?: cancellation.CancellationToken): Promise<HttpResponse>;
        /**
         * Gets the response from issuing an HTTP PUT to the requested url
         * @param url The url for the request
         * @param body The body of the request
         * @param token A token that can be used to cancel the request
         * @returns A future result for the response
         */
        putAsync(url: string | Uri, body: any, token?: cancellation.CancellationToken): Promise<HttpResponse>;
        /**
         * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
         * @param url The url for the request
         * @param value The value to serialize
         * @param jsonReplacer An array or callback used to replace values during serialization
         * @param token A token that can be used to cancel the request
         * @returns A future result for the response
         */
        putJsonAsync(url: string | Uri, value: any, jsonReplacer?: any[] | ((key: string, value: any) => string), token?: cancellation.CancellationToken): Promise<HttpResponse>;
        /**
         * Gets the response from issuing an HTTP DELETE to the requested url
         * @param url The url for the request
         * @param token A token that can be used to cancel the request
         * @returns A future result for the response
         */
        deleteAsync(url: string | Uri, token?: cancellation.CancellationToken): Promise<HttpResponse>;
        /**
         * Sends the provided request and returns the response
         * @param request {HttpRequest} An HTTP request to send
         * @param token {futures.CancellationToken} A token that can be used to cancel the request
         * @returns {futures.Promise<HttpResponse>} A future result for the response
         */
        sendAsync(request: HttpRequest, token?: cancellation.CancellationToken): Promise<HttpResponse>;
        getJsonpAsync<T>(url: string | Uri, callbackArg?: string, noCache?: boolean, token?: cancellation.CancellationToken): Promise<T>;
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
    
}
declare module 'async' {
    import promise = require('./promise');
    import deferred = require('./deferred');
    import cancellation = require('./cancellation');
    import utils = require('./utils');
    export import IPromise = promise.IPromise;
    export import Promise = promise.Promise;
    export import Deferred = deferred.Deferred;
    export import CancellationToken = cancellation.CancellationToken;
    export import CancellationRegistration = cancellation.CancellationRegistration;
    export import CancellationTokenSource = cancellation.CancellationTokenSource;
    export import sleep = utils.sleep;
    
}
