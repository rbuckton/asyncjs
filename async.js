!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Promise=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var promise = require('./promise');
var deferred = require('./deferred');
var cancellation = require('./cancellation');
var utils = require('./utils');
exports.Promise = promise.Promise;
exports.Deferred = deferred.Deferred;
exports.CancellationTokenSource = cancellation.CancellationTokenSource;
exports.sleep = utils.sleep;
//# sourceMappingURL=file:///C|/dev/asyncjs/async.js.map
},{"./cancellation":undefined,"./deferred":undefined,"./promise":undefined,"./utils":undefined}],2:[function(require,module,exports){
var hasMsNonUserCodeExceptions = typeof Debug !== "undefined" && typeof Debug.setNonUserCodeExceptions === "boolean";
/**
 * A source for cancellation
 */
var CancellationTokenSource = (function () {
    function CancellationTokenSource() {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        var delay = -1;
        var links;
        if (typeof args[0] === "number") {
            delay = args.shift() | 0;
            if (delay < 0)
                throw new RangeError();
        }
        if (Array.isArray(args[0])) {
            links = args.shift();
        }
        else if (args.length) {
            links = args;
        }
        var source = this;
        this._token = Object.freeze({
            get canceled() {
                return source._canceled;
            },
            get reason() {
                return source._reason;
            },
            throwIfCanceled: function () {
                if (source._canceled) {
                    throw source._reason;
                }
            },
            register: function (callback) {
                return source._register(callback);
            }
        });
        if (links) {
            this._links = new Array();
            for (var i = 0, l = links.length; i < l; i++) {
                var link = links[i];
                if (!link) {
                    continue;
                }
                if (link.canceled) {
                    this._canceled = true;
                    this._reason = link.reason;
                    return;
                }
                this._links.push(link.register(function (reason) {
                    _this._cancelCore(reason);
                }));
            }
        }
        if (delay >= 0) {
            this.cancelAfter(delay);
        }
    }
    Object.defineProperty(CancellationTokenSource, "canceled", {
        /**
         * Gets an already cancelled `CancellationToken`.
         */
        get: function () {
            if (!CancellationTokenSource._canceled) {
                var cts = new CancellationTokenSource();
                cts.cancel();
                CancellationTokenSource._canceled = cts.token;
            }
            return CancellationTokenSource._canceled;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CancellationTokenSource.prototype, "canceled", {
        /**
         * Gets a value indicating whether the token has received a cancellation signal.
         */
        get: function () {
            return this._canceled;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CancellationTokenSource.prototype, "reason", {
        /**
         * Gets the reason for cancellation, if one was supplied.
         */
        get: function () {
            return this._reason;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CancellationTokenSource.prototype, "token", {
        /**
         * Gets the `CancellationToken` for this source.
         */
        get: function () {
            return this._token;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Signals the source is cancelled.
     * @param reason An optional reason for the cancellation.
     */
    CancellationTokenSource.prototype.cancel = function (reason) {
        if (this._canceled) {
            return;
        }
        this._throwIfFrozen();
        this._cancelCore(reason);
    };
    /**
     * Signals the source is canceled after a delay.
     * @param delay The number of milliseconds to delay before signalling cancellation.
     * @param reason An optional reason for the cancellation.
     */
    CancellationTokenSource.prototype.cancelAfter = function (delay, reason) {
        if (this._canceled) {
            return;
        }
        this._throwIfFrozen();
        this._clearTimeout();
        this._timer = setTimeout(CancellationTokenSource._ontimeout, delay, this, reason);
    };
    /**
     * Closes the CancellationSource, preventing any future cancellation signal.
     */
    CancellationTokenSource.prototype.close = function () {
        if (Object.isFrozen(this)) {
            return;
        }
        this._clearTimeout();
        if (this._links) {
            var links = this._links;
            for (var i = 0, l = links.length; i < l; i++) {
                links[i].unregister();
            }
        }
        if (this._callbacks) {
            this._callbacks.clear();
        }
        this._links = null;
        this._callbacks = null;
        Object.freeze(this);
    };
    CancellationTokenSource._ontimeout = function (source, reason) {
        source._timer = null;
        if (!Object.isFrozen(source)) {
            source._cancelCore(reason);
        }
    };
    CancellationTokenSource.prototype._register = function (callback) {
        if (typeof callback !== "function")
            throw new TypeError("argument is not a Function object");
        if (this._canceled) {
            callback(this._reason);
            return emptyRegistration;
        }
        if (Object.isFrozen(this)) {
            return emptyRegistration;
        }
        var cookie = {};
        var callbacks = this._callbacks || (this._callbacks = new Map());
        callbacks.set(cookie, callback);
        return {
            unregister: function () {
                callbacks.delete(cookie);
            }
        };
    };
    CancellationTokenSource.prototype._cancelCore = function (reason) {
        if (hasMsNonUserCodeExceptions)
            Debug.setNonUserCodeExceptions = true;
        if (this._canceled) {
            return;
        }
        this._clearTimeout();
        if (reason == null) {
            reason = new Error("operation was canceled.");
        }
        if (reason instanceof Error && !("stack" in reason)) {
            try {
                throw reason;
            }
            catch (error) {
                reason = error;
            }
        }
        this._canceled = true;
        this._reason = reason;
        if (this._callbacks) {
            var callbacks = this._callbacks;
            this._callbacks = null;
            try {
                callbacks.forEach(function (callback) {
                    callback(reason);
                });
            }
            finally {
                callbacks.clear();
            }
        }
    };
    CancellationTokenSource.prototype._clearTimeout = function () {
        if (this._timer != null) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    };
    CancellationTokenSource.prototype._throwIfFrozen = function () {
        if (Object.isFrozen(this)) {
            throw new Error("cannot modify a closed source");
        }
    };
    return CancellationTokenSource;
})();
exports.CancellationTokenSource = CancellationTokenSource;
var emptyRegistration = Object.freeze({ unregister: function () {
} });
//# sourceMappingURL=file:///C|/dev/asyncjs/cancellation.js.map
},{}],3:[function(require,module,exports){
var promise = require('./promise');
var Promise = promise.Promise;
var Deferred = (function () {
    function Deferred() {
        var _this = this;
        this._promise = new Promise(function (resolve, reject) {
            _this._resolve = resolve;
            _this._reject = reject;
        });
    }
    Object.defineProperty(Deferred.prototype, "promise", {
        get: function () {
            return this._promise;
        },
        enumerable: true,
        configurable: true
    });
    Deferred.prototype.resolve = function (value) {
        this._resolve(value);
    };
    Deferred.prototype.reject = function (reason) {
        this._reject(reason);
    };
    return Deferred;
})();
exports.Deferred = Deferred;
//# sourceMappingURL=file:///C|/dev/asyncjs/deferred.js.map
},{"./promise":undefined}],4:[function(require,module,exports){
var cancellation = require('./cancellation');
var promise = require('./promise');
var Promise = promise.Promise;
var CancellationTokenSource = cancellation.CancellationTokenSource;
var hasMsNonUserCodeExceptions = typeof Debug !== "undefined" && typeof Debug.setNonUserCodeExceptions === "boolean";
/**
 * A Uri
 */
var Uri = (function () {
    function Uri() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        /**
         * The protocol for the Uri (e.g. 'http:')
         * @type {String}
         */
        this.protocol = "";
        /**
         * The hostname for the Uri
         * @type {String}
         */
        this.hostname = "";
        /**
         * The port number for the Uri
         * @type {Number}
         */
        this.port = null;
        /**
         * The path name for the Uri
         * @type {String}
         */
        this.pathname = "";
        /**
         * The search portion of the path, also known as the querystring
         * @type {String}
         */
        this.search = "";
        /**
         * The fragment portion of the path
         * @type {String}
         */
        this.hash = "";
        /**
         * A value indicating whether the Url is an absolute url
         * @type {Boolean}
         */
        this.absolute = false;
        if (args.length === 0)
            throw new Error("Argument missing");
        if (args.length === 1) {
            var m = UriParser.exec(args[0]);
            if (!m)
                throw new URIError();
            for (var name in UriParts) {
                var index = UriParts[name];
                var part = m[index];
                if (part) {
                    if (index < 5)
                        part = part.toLowerCase();
                    else if (index === 5)
                        part = parseInt(part);
                }
                else {
                    if (index === 5)
                        part = m[1] ? UriPorts[this.protocol] : null;
                }
                this[name] = part;
            }
            this.absolute = !!m[1];
        }
        else {
            var baseUri = args[0] instanceof Uri ? args[0] : Uri.parse(args[0]);
            var uri = args[0] instanceof Uri ? args[1] : Uri.parse(args[1]);
            this.hash = uri.hash;
            if (uri.protocol) {
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
                if (uri.hostname) {
                    this.hostname = uri.hostname;
                    this.port = uri.port;
                    this.pathname = uri.pathname;
                    this.search = uri.search;
                    this.hash = uri.hash;
                    this.absolute = uri.absolute;
                }
                else {
                    this.hostname = baseUri.hostname;
                    this.port = baseUri.port;
                    if (uri.pathname) {
                        if (uri.pathname.charAt(0) === '/') {
                            this.pathname = uri.pathname;
                        }
                        else {
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
                        if (uri.search) {
                            this.search = uri.search;
                        }
                        else {
                            this.search = baseUri.search;
                        }
                    }
                }
            }
        }
        Object.freeze(this);
    }
    Object.defineProperty(Uri.prototype, "origin", {
        /**
         * Gets the origin of the Uri
         */
        get: function () {
            return this.toString("origin");
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Uri.prototype, "host", {
        /**
         * Gets the host for the uri, including the hostname and port
         */
        get: function () {
            return this.toString("host");
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Uri.prototype, "scheme", {
        /**
         * Gets the scheme for the uri (e.g. 'http://'')
         */
        get: function () {
            return this.toString("scheme");
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Tests whether the provided uri has the same origin as this uri
     * @param uri The uri to compare against
     * @returns True if the uri's have the same origin; otherwise, false
     */
    Uri.prototype.isSameOrigin = function (uri) {
        var other;
        if (typeof uri === "string") {
            other = Uri.parse(uri);
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
    };
    /**
     * Gets the string representation of the Uri
     * @param format {String} A format specifier.
     * @returns {String} The string content of the Uri
     */
    Uri.prototype.toString = function (format) {
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
    };
    /**
     * Parses the provided uri string
     * @param uri {String} The uri string to parse
     * @returns {Uri} The parsed uri
     */
    Uri.parse = function (uri) {
        return new Uri(uri);
    };
    /**
     * Combines two uris
     * @param baseUri The base uri
     * @param uri The relative uri
     * @returns The combined uri
     */
    Uri.combine = function (baseUri, uri) {
        return new Uri(baseUri, uri);
    };
    return Uri;
})();
exports.Uri = Uri;
var QueryString;
(function (QueryString) {
    var hasOwn = Object.prototype.hasOwnProperty;
    var QueryStringParser = /(?:\?|&|^)([^=&]*)(?:=([^&]*))?/g;
    function stringify(obj) {
        if (!obj) {
            return "";
        }
        var qs = [];
        Object.getOwnPropertyNames(obj).forEach(function (name) {
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
                        var ar = value;
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
    QueryString.stringify = stringify;
    function parse(text) {
        var obj = {};
        var part;
        while (part = QueryStringParser.exec(text)) {
            var key = decodeURIComponent(part[1]);
            if (key.length && key !== "__proto__") {
                var value = decodeURIComponent(part[2]);
                if (hasOwn.call(obj, key)) {
                    var previous = obj[key];
                    if (Array.isArray(previous)) {
                        var ar = previous;
                        ar.push(value);
                    }
                    else {
                        obj[key] = [previous, value];
                    }
                }
                else {
                    obj[key] = value;
                }
            }
        }
        return obj;
    }
    QueryString.parse = parse;
})(QueryString = exports.QueryString || (exports.QueryString = {}));
/**
 * An HTTP request for an HttpClient
 */
var HttpRequest = (function () {
    /**
     * Creates an HTTP request for an HttpClient
     * @param method The HTTP method for the request
     * @param url The url for the request
     */
    function HttpRequest(method, url) {
        if (method === void 0) { method = "GET"; }
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
    HttpRequest.prototype.setRequestHeader = function (key, value) {
        if (key !== "__proto__") {
            this._headers[key] = value;
        }
    };
    return HttpRequest;
})();
exports.HttpRequest = HttpRequest;
/**
 * A response from an HttpClient
 */
var HttpResponse = (function () {
    /**
     * A response from an HttpClient
     */
    function HttpResponse(request, xhr) {
        this._request = request;
        this._xhr = xhr;
    }
    Object.defineProperty(HttpResponse.prototype, "request", {
        /**
         * Gets the request for this response
         */
        get: function () {
            return this._request;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(HttpResponse.prototype, "status", {
        /**
         * Gets the status code of the response
         */
        get: function () {
            return this._xhr.status;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(HttpResponse.prototype, "statusText", {
        /**
         * Gets the status text of the response
         */
        get: function () {
            return this._xhr.statusText;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(HttpResponse.prototype, "responseText", {
        /**
         * Gets the response text of the response
         */
        get: function () {
            return this._xhr.responseText;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Gets all of the response heades in a single string
     * @returns {String} A string containing all of the response headers
     */
    HttpResponse.prototype.getAllResponseHeaders = function () {
        return this._xhr.getAllResponseHeaders();
    };
    /**
     * Gets the value for the named response header
     * @param header {String} The name of the header
     * @returns {String} The value for the named header
     */
    HttpResponse.prototype.getResponseHeader = function (header) {
        return this._xhr.getResponseHeader(header);
    };
    return HttpResponse;
})();
exports.HttpResponse = HttpResponse;
/**
 * A client for HTTP requests
 */
var HttpClient = (function () {
    /**
     * Creates a client for HTTP requests
     * @param baseUrl The base url for the client
     */
    function HttpClient(baseUrl) {
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
    HttpClient.prototype.close = function () {
        if (this._closed)
            throw new Error("Object doesn't support this action");
        this._closed = true;
        this._cts.cancel();
        this._cts.close();
    };
    /**
     * Sets a value for a default request header
     * @param key The request header key
     * @param value The request header value
     */
    HttpClient.prototype.setRequestHeader = function (key, value) {
        if (this._closed)
            throw new Error("Object doesn't support this action");
        if (key !== "__proto__") {
            this._headers[key] = value;
        }
    };
    /**
     * Gets the response text from the requested url
     * @param url The url for the request
     * @returns A future result for the string
     */
    HttpClient.prototype.getStringAsync = function (url) {
        return this.getAsync(url).then(function (r) { return r.responseText; });
    };
    /**
     * Gets the response from issuing an HTTP GET to the requested url
     * @param url The url for the request
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    HttpClient.prototype.getAsync = function (url, token) {
        return this.sendAsync(new HttpRequest("GET", url), token);
    };
    /**
     * Gets the response from issuing an HTTP POST to the requested url
     * @param url The url for the request
     * @param body The body of the request
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    HttpClient.prototype.postAsync = function (url, body, token) {
        var request = new HttpRequest("POST", url);
        request.body = body;
        return this.sendAsync(request, token);
    };
    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url The url for the request
     * @param value The value to serialize
     * @param jsonReplacer An array or callback used to replace values during serialization
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    HttpClient.prototype.postJsonAsync = function (url, value, jsonReplacer, token) {
        var request = new HttpRequest("POST", url);
        request.body = JSON.stringify(value, jsonReplacer);
        request.setRequestHeader("Content-Type", "application/json");
        return this.sendAsync(request, token);
    };
    /**
     * Gets the response from issuing an HTTP PUT to the requested url
     * @param url The url for the request
     * @param body The body of the request
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    HttpClient.prototype.putAsync = function (url, body, token) {
        var request = new HttpRequest("PUT", url);
        request.body = body;
        return this.sendAsync(request, token);
    };
    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url The url for the request
     * @param value The value to serialize
     * @param jsonReplacer An array or callback used to replace values during serialization
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    HttpClient.prototype.putJsonAsync = function (url, value, jsonReplacer, token) {
        var request = new HttpRequest("PUT", url);
        request.body = JSON.stringify(value, jsonReplacer);
        request.setRequestHeader("Content-Type", "application/json");
        return this.sendAsync(request, token);
    };
    /**
     * Gets the response from issuing an HTTP DELETE to the requested url
     * @param url The url for the request
     * @param token A token that can be used to cancel the request
     * @returns A future result for the response
     */
    HttpClient.prototype.deleteAsync = function (url, token) {
        return this.sendAsync(new HttpRequest("DELETE", url), token);
    };
    /**
     * Sends the provided request and returns the response
     * @param request {HttpRequest} An HTTP request to send
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    HttpClient.prototype.sendAsync = function (request, token) {
        var _this = this;
        if (this._closed)
            throw new Error("Object doesn't support this action");
        return new Promise(function (resolve, reject) {
            // create a linked token
            var cts = new CancellationTokenSource(_this._cts.token, token);
            // throw if we're already canceled, the promise will be rejected
            cts.token.throwIfCanceled();
            // normalize the uri
            var url = null;
            if (!request.url) {
                url = _this.baseUrl;
            }
            else if (!request.url.absolute) {
                if (!_this.baseUrl)
                    throw new Error("Invalid argument: request");
                url = new Uri(_this.baseUrl, request.url);
            }
            if (url) {
                request.url = url;
            }
            var xhr = new XMLHttpRequest();
            var response = new HttpResponse(request, xhr);
            var requestHeaders = request._headers;
            var clientHeaders = _this._headers;
            // create the onload callback
            var onload = function (ev) {
                if (hasMsNonUserCodeExceptions)
                    Debug.setNonUserCodeExceptions = true;
                cleanup();
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
                    var error = createHttpError(_this, response);
                    reject(error);
                }
            };
            // create the onerror callback
            var onerror = function (ev) {
                if (hasMsNonUserCodeExceptions)
                    Debug.setNonUserCodeExceptions = true;
                cleanup();
                try {
                    cts.token.throwIfCanceled();
                }
                catch (e) {
                    reject(e);
                    return;
                }
                var error = createHttpError(_this, response);
                reject(error);
            };
            // register a cleanup phase
            var registration = cts.token.register(function () {
                if (hasMsNonUserCodeExceptions)
                    Debug.setNonUserCodeExceptions = true;
                cleanup();
                // abort the xhr
                xhr.abort();
                try {
                    cts.token.throwIfCanceled();
                }
                catch (e) {
                    reject(e);
                }
            });
            var cleanup = function () {
                xhr.removeEventListener("load", onload, false);
                xhr.removeEventListener("error", onerror, false);
                registration.unregister();
                registration = undefined;
            };
            // add the headers from the client
            Object.getOwnPropertyNames(clientHeaders).forEach(function (key) {
                xhr.setRequestHeader(key, clientHeaders[key]);
            });
            // add the headers from the request
            Object.getOwnPropertyNames(requestHeaders).forEach(function (key) {
                xhr.setRequestHeader(key, requestHeaders[key]);
            });
            // wire up the events
            xhr.addEventListener("load", onload, false);
            xhr.addEventListener("error", onerror, false);
            // enable credentials if requested
            if (_this.withCredentials) {
                xhr.withCredentials = true;
            }
            // attach a timeout
            if (_this.timeout > 0) {
                cts.cancelAfter(_this.timeout);
                xhr.timeout = _this.timeout;
            }
            // send the request
            xhr.open(request.method, request.url.toString(), true, _this.username, _this.password);
            xhr.send(request.body);
        });
    };
    HttpClient.prototype.getJsonpAsync = function (url, callbackArg, noCache, token) {
        var _this = this;
        if (callbackArg === void 0) { callbackArg = "callback"; }
        if (noCache === void 0) { noCache = false; }
        if (this._closed)
            throw new Error("Object doesn't support this action");
        if (typeof document === "undefined")
            throw new Error("JSON-P is not supported in this host.");
        return new Promise(function (resolve, reject) {
            // create a linked token
            var cts = new CancellationTokenSource(_this._cts.token, token);
            // throw if we're already canceled, the promise will be rejected
            cts.token.throwIfCanceled();
            // normalize the uri
            var requestUrl = null;
            if (!url) {
                requestUrl = _this.baseUrl;
            }
            else {
                if (typeof url === "string") {
                    requestUrl = new Uri(url);
                }
                else if (url instanceof Uri) {
                    requestUrl = url;
                }
                if (!requestUrl.absolute) {
                    if (!_this.baseUrl)
                        throw new Error("Invalid argument: url");
                    requestUrl = new Uri(_this.baseUrl, requestUrl);
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
            var script = document.createElement("script");
            script.type = "text/javascript";
            script.async = true;
            script.src = requestUrl.toString();
            // checks whether the request has been canceled
            var checkCanceled = function () {
                if (hasMsNonUserCodeExceptions)
                    Debug.setNonUserCodeExceptions = true;
                try {
                    cts.token.throwIfCanceled();
                }
                catch (e) {
                    reject(e);
                    return true;
                }
                return false;
            };
            // waits for the result
            var onload = function (result) {
                ignore();
                registration.unregister();
                registration = undefined;
                if (!checkCanceled()) {
                    resolve(result);
                }
            };
            // ignores further calls to fulfill the result
            var ignore = function () {
                pending = false;
                delete window[name];
                disconnect();
            };
            // disconnects the script node
            var disconnect = function () {
                if (script.parentNode) {
                    head.removeChild(script);
                }
            };
            // register a cleanup phase
            var registration = cts.token.register(function () {
                if (pending) {
                    window[name] = ignore;
                }
                disconnect();
                checkCanceled();
            });
            // set a timeout before we no longer care about the result.
            if (_this.timeout) {
                cts.cancelAfter(_this.timeout);
            }
            window[name] = onload;
            head.appendChild(script);
        });
    };
    return HttpClient;
})();
exports.HttpClient = HttpClient;
function createHttpError(httpClient, response, message) {
    if (message === void 0) { message = "An error occurred while processing your request"; }
    var error = new Error(message);
    error.name = "HttpError";
    error.httpClient = httpClient;
    error.response = response;
    error.message = message;
    return error;
}
var UriParser = /^((?:(https?:)\/\/)(?:[^:@]*(?:\:[^@]*)?@)?(([a-z\d-\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF\.]+)(?:\:(\d+))?)?)?(?![a-z\d-]+\:)((?:^|\/)[^\?\#]*)?(\?[^#]*)?(#.*)?$/i;
var UriParts = { "protocol": 2, "hostname": 4, "port": 5, "pathname": 6, "search": 7, "hash": 8 };
var UriPorts = { "http:": 80, "https:": 443 };
var jsonpRequestIndex = 0;
//# sourceMappingURL=file:///C|/dev/asyncjs/httpclient.js.map
},{"./cancellation":undefined,"./promise":undefined}],5:[function(require,module,exports){
var task = require('./task');
var scheduleTask = task.scheduleTask;
var hasMsDebug = typeof Debug !== "undefined" && typeof Debug.msTraceAsyncOperationStarting === "function" && typeof Debug.msTraceAsyncOperationCompleted === "function" && typeof Debug.msTraceAsyncCallbackStarting === "function" && typeof Debug.msTraceAsyncCallbackCompleted === "function";
var hasMsNonUserCodeExceptions = typeof Debug !== "undefined" && typeof Debug.setNonUserCodeExceptions === "boolean";
/**
 * Represents the completion of an asynchronous operation
 */
var Promise = (function () {
    /**
     * Creates a new Promise.
     * @param init A callback used to initialize the promise. This callback is passed two arguments: a resolve callback used resolve the promise with a value or the result of another promise, and a reject callback used to reject the promise with a provided reason or error.
     */
    function Promise(init) {
        var _this = this;
        if (hasMsNonUserCodeExceptions)
            Debug.setNonUserCodeExceptions = true;
        if (typeof init !== "function")
            throw new TypeError("argument is not a Function object");
        var resolve = function (rejecting, result) {
            resolve = null;
            _this._resolve(rejecting, result);
        };
        try {
            init(function (value) {
                resolve && resolve(false, value);
            }, function (error) {
                resolve && resolve(true, error);
            });
        }
        catch (error) {
            resolve(true, error);
        }
    }
    Promise.resolve = function (value) {
        return (value instanceof this) ? value : new Promise(function (resolve) { return resolve(value); });
    };
    Promise.reject = function (reason) {
        return new Promise(function (_, reject) { return reject(reason); });
    };
    Promise.all = function (values) {
        var _this = this;
        return new this(function (resolve, reject) {
            var countdown = values.length || 0;
            if (countdown <= 0) {
                resolve([]);
                return;
            }
            var results = Array(countdown);
            for (var i = 0; i < results.length; i++) {
                _this.resolve(values[i]).then((function (index) { return function (value) {
                    results[index] = value;
                    if (--countdown == 0) {
                        resolve(results);
                    }
                }; })(i), reject);
            }
        });
    };
    Promise.race = function (values) {
        var _this = this;
        return new this(function (resolve, reject) {
            var promises = values.map(_this.resolve, _this);
            promises.forEach(function (promise) { return promise.then(resolve, reject); });
        });
    };
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    Promise.prototype.then = function (onfulfilled, onrejected) {
        return this._await(onfulfilled, onrejected);
    };
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    Promise.prototype.catch = function (onrejected) {
        return this._await(undefined, onrejected);
    };
    /**
     * Attaches a callback for that is executed regardless of the resolution or rejection of the promise.
     * @param onsettled The callback to execute when the Promise is settled.
     * @returns A Promise for the completion of the callback.
     */
    Promise.prototype.finally = function (onsettled) {
        return this._await(function (value) { return new Promise(function (resolve) { return resolve(onsettled()); }).then(function () { return Promise.resolve(value); }); }, function (reason) { return new Promise(function (resolve) { return resolve(onsettled()); }).then(function () { return Promise.reject(reason); }); });
    };
    Promise.prototype._resolve = function (rejecting, result) {
        var _this = this;
        if (hasMsNonUserCodeExceptions)
            Debug.setNonUserCodeExceptions = true;
        if (!rejecting) {
            try {
                if (this === result)
                    throw new TypeError("Cannot resolve a promise with itself");
                if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result) {
                    var then = result.then;
                    if (typeof then === "function") {
                        var resolve = function (rejecting, result) {
                            resolve = null;
                            _this._resolve(rejecting, result);
                        };
                        try {
                            then.call(result, function (result) {
                                resolve && resolve(false, result);
                            }, function (result) {
                                resolve && resolve(true, result);
                            });
                        }
                        catch (error) {
                            resolve(true, error);
                        }
                        return;
                    }
                }
            }
            catch (error) {
                result = error;
                rejecting = true;
            }
        }
        this._settle(rejecting, result);
    };
    Promise.prototype._await = function (onresolved, onrejected) {
        var _this = this;
        var id = hasMsDebug && Debug.msTraceAsyncOperationStarting("Promise.then");
        return new this.constructor(function (resolve, reject) {
            var prev = _this._settle;
            _this._settle = function (rejecting, result) {
                _this._forward(prev, resolve, reject, rejecting, result, onresolved, onrejected, id);
            };
        });
    };
    Promise.prototype._settle = function (rejecting, result) {
        var _this = this;
        this._settle = null;
        this._await = function (onfulfilled, onrejected) {
            var id = hasMsDebug && Debug.msTraceAsyncOperationStarting("Promise.then");
            return new _this.constructor(function (resolve, reject) {
                _this._forward(null, resolve, reject, rejecting, result, onfulfilled, onrejected, id);
            });
        };
    };
    Promise.prototype._forward = function (prev, resolve, reject, rejecting, result, onresolved, onrejected, id) {
        prev && prev.call(this, rejecting, result);
        scheduleTask(function () {
            if (hasMsNonUserCodeExceptions)
                Debug.setNonUserCodeExceptions = true;
            try {
                var handler = rejecting ? onrejected : onresolved;
                hasMsDebug && Debug.msTraceAsyncOperationCompleted(id, rejecting ? Debug.MS_ASYNC_OP_STATUS_ERROR : Debug.MS_ASYNC_OP_STATUS_SUCCESS);
                if (typeof handler === "function") {
                    hasMsDebug && Debug.msTraceAsyncCallbackStarting(id);
                    result = handler(result);
                    rejecting = false;
                }
            }
            catch (e) {
                result = e;
                rejecting = true;
            }
            finally {
                hasMsDebug && Debug.msTraceAsyncCallbackCompleted();
            }
            (rejecting ? reject : resolve)(result);
        });
    };
    return Promise;
})();
exports.Promise = Promise;
//# sourceMappingURL=file:///C|/dev/asyncjs/promise.js.map
},{"./task":undefined}],6:[function(require,module,exports){
function scheduleTask(task) {
    if (!queue) {
        queue = {};
    }
    var node = { task: task };
    enqueueTask(queue, node);
    scheduleTick();
    return node;
}
exports.scheduleTask = scheduleTask;
function cancelTask(handle) {
    if (!handle) {
        return;
    }
    var node = handle;
    if (node.queue === recoveryQueue || node.queue === queue) {
        removeTask(node.queue, node);
    }
    if (recoveryQueue && !recoveryQueue.head) {
        recoveryQueue = undefined;
    }
    if (queue && !queue.head) {
        queue = undefined;
    }
    if (!recoveryQueue && !queue) {
        cancelTick();
    }
}
exports.cancelTask = cancelTask;
var scheduler;
var handle;
var recoveryQueue;
var queue;
function scheduleTick() {
    if (handle !== void 0) {
        return;
    }
    if (!scheduler) {
        scheduler = getScheduler();
    }
    handle = scheduler.scheduleTick(onTick);
}
function cancelTick() {
    if (handle === void 0 || !scheduler) {
        return;
    }
    scheduler.cancelTick(handle);
    handle = undefined;
}
function onTick() {
    handle = undefined;
    processQueue(recoveryQueue);
    recoveryQueue = queue;
    queue = undefined;
    processQueue(recoveryQueue);
    recoveryQueue = undefined;
}
function processQueue(queue) {
    if (!queue) {
        return;
    }
    var node;
    var taskCompleted = false;
    while (node = dequeueTask(queue)) {
        var task = node.task;
        try {
            task();
            taskCompleted = true;
        }
        finally {
            if (!taskCompleted) {
                scheduleTick();
            }
        }
    }
}
function enqueueTask(queue, node) {
    node.previous = queue.tail;
    node.queue = queue;
    if (queue.tail) {
        queue.tail.next = node;
    }
    else {
        queue.head = node;
    }
    queue.tail = node;
}
function dequeueTask(queue) {
    if (!queue) {
        return;
    }
    var node = queue.tail;
    if (node) {
        removeTask(queue, node);
    }
    return node;
}
function removeTask(queue, node) {
    if (!queue) {
        return;
    }
    if (node.next) {
        node.next.previous = node.previous;
    }
    if (node.previous) {
        node.previous.next = node.next;
    }
    if (node === queue.tail) {
        queue.tail = node.previous;
    }
    if (node === queue.head) {
        queue.head = node.next;
    }
    node.next = undefined;
    node.previous = undefined;
    node.queue = undefined;
}
function getScheduler() {
    if (typeof setImmediate === "function") {
        return getSetImmediateScheduler();
    }
    else if (typeof msSetImmediate === "function") {
        return getMSSetImmediateScheduler();
    }
    else if (typeof process === "object" && typeof process.nextTick === "function") {
        return getNextTickScheduler();
    }
    else if (typeof setTimeout === "function") {
        return getSetTimeoutScheduler();
    }
    else {
        return getMissingScheduler();
    }
    function getSetImmediateScheduler() {
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick(callback) {
            return setImmediate(callback);
        }
        function cancelTick(handle) {
            clearImmediate(handle);
        }
    }
    function getMSSetImmediateScheduler() {
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick(callback) {
            return msSetImmediate(callback);
        }
        function cancelTick(handle) {
            msClearImmediate(handle);
        }
    }
    function getNextTickScheduler() {
        var nextHandle = 1;
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick(callback) {
            var handle = { canceled: false };
            process.nextTick(function () {
                if (handle.canceled)
                    return;
                callback();
            });
            return handle;
        }
        function cancelTick(handle) {
            if (handle)
                handle.canceled = true;
        }
    }
    function getSetTimeoutScheduler() {
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick(callback) {
            return setTimeout(callback, 0);
        }
        function cancelTick(handle) {
            clearTimeout(handle);
        }
    }
    function getMissingScheduler() {
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick() {
            throw new Error("Scheduler not available.");
        }
        function cancelTick() {
            throw new Error("Scheduler not available.");
        }
    }
}
//# sourceMappingURL=file:///C|/dev/asyncjs/task.js.map
},{}],7:[function(require,module,exports){
var promise = require('./promise');
var task = require('./task');
var Promise = promise.Promise;
var scheduleTask = task.scheduleTask;
var cancelTask = task.cancelTask;
function sleep(delay, token) {
    if (delay === void 0) { delay = 0; }
    if (typeof delay !== "number") {
        throw new TypeError("Number expected.");
    }
    if (token && token.canceled) {
        return Promise.reject(token.reason);
    }
    var schedule;
    var cancel;
    if (delay <= 0) {
        schedule = scheduleTask;
        cancel = cancelTask;
    }
    else {
        schedule = function (task) { return setTimeout(task, delay); };
        cancel = clearTimeout;
    }
    return new Promise(function (resolve, reject) {
        var registration;
        var handle = schedule(function () {
            if (registration) {
                registration.unregister();
                registration = undefined;
            }
            resolve();
        });
        if (token) {
            registration = token.register(function (reason) {
                cancel(handle);
                handle = undefined;
                reject(reason);
            });
        }
    });
}
exports.sleep = sleep;
//# sourceMappingURL=file:///C|/dev/asyncjs/utils.js.map
},{"./promise":undefined,"./task":undefined}]},{},[6,5,3,2,7,4,1])(7)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwibGliXFxhc3luYy5qcyIsImxpYlxcY2FuY2VsbGF0aW9uLmpzIiwibGliXFxkZWZlcnJlZC5qcyIsImxpYlxcaHR0cGNsaWVudC5qcyIsImxpYlxccHJvbWlzZS5qcyIsImxpYlxcdGFzay5qcyIsImxpYlxcdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3h5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgcHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xyXG52YXIgZGVmZXJyZWQgPSByZXF1aXJlKCcuL2RlZmVycmVkJyk7XHJcbnZhciBjYW5jZWxsYXRpb24gPSByZXF1aXJlKCcuL2NhbmNlbGxhdGlvbicpO1xyXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XHJcbmV4cG9ydHMuUHJvbWlzZSA9IHByb21pc2UuUHJvbWlzZTtcclxuZXhwb3J0cy5EZWZlcnJlZCA9IGRlZmVycmVkLkRlZmVycmVkO1xyXG5leHBvcnRzLkNhbmNlbGxhdGlvblRva2VuU291cmNlID0gY2FuY2VsbGF0aW9uLkNhbmNlbGxhdGlvblRva2VuU291cmNlO1xyXG5leHBvcnRzLnNsZWVwID0gdXRpbHMuc2xlZXA7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGU6Ly8vQ3wvZGV2L2FzeW5janMvYXN5bmMuanMubWFwIiwidmFyIGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zID0gdHlwZW9mIERlYnVnICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPT09IFwiYm9vbGVhblwiO1xyXG4vKipcclxuICogQSBzb3VyY2UgZm9yIGNhbmNlbGxhdGlvblxyXG4gKi9cclxudmFyIENhbmNlbGxhdGlvblRva2VuU291cmNlID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIENhbmNlbGxhdGlvblRva2VuU291cmNlKCkge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgdmFyIGFyZ3MgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBfaSA9IDA7IF9pIDwgYXJndW1lbnRzLmxlbmd0aDsgX2krKykge1xyXG4gICAgICAgICAgICBhcmdzW19pIC0gMF0gPSBhcmd1bWVudHNbX2ldO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgZGVsYXkgPSAtMTtcclxuICAgICAgICB2YXIgbGlua3M7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcIm51bWJlclwiKSB7XHJcbiAgICAgICAgICAgIGRlbGF5ID0gYXJncy5zaGlmdCgpIHwgMDtcclxuICAgICAgICAgICAgaWYgKGRlbGF5IDwgMClcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGFyZ3NbMF0pKSB7XHJcbiAgICAgICAgICAgIGxpbmtzID0gYXJncy5zaGlmdCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChhcmdzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBsaW5rcyA9IGFyZ3M7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBzb3VyY2UgPSB0aGlzO1xyXG4gICAgICAgIHRoaXMuX3Rva2VuID0gT2JqZWN0LmZyZWV6ZSh7XHJcbiAgICAgICAgICAgIGdldCBjYW5jZWxlZCgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBzb3VyY2UuX2NhbmNlbGVkO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBnZXQgcmVhc29uKCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNvdXJjZS5fcmVhc29uO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB0aHJvd0lmQ2FuY2VsZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGlmIChzb3VyY2UuX2NhbmNlbGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgc291cmNlLl9yZWFzb247XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHJlZ2lzdGVyOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBzb3VyY2UuX3JlZ2lzdGVyKGNhbGxiYWNrKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGlmIChsaW5rcykge1xyXG4gICAgICAgICAgICB0aGlzLl9saW5rcyA9IG5ldyBBcnJheSgpO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpbmtzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgdmFyIGxpbmsgPSBsaW5rc1tpXTtcclxuICAgICAgICAgICAgICAgIGlmICghbGluaykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKGxpbmsuY2FuY2VsZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYW5jZWxlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVhc29uID0gbGluay5yZWFzb247XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5fbGlua3MucHVzaChsaW5rLnJlZ2lzdGVyKGZ1bmN0aW9uIChyZWFzb24pIHtcclxuICAgICAgICAgICAgICAgICAgICBfdGhpcy5fY2FuY2VsQ29yZShyZWFzb24pO1xyXG4gICAgICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkZWxheSA+PSAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2FuY2VsQWZ0ZXIoZGVsYXkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSwgXCJjYW5jZWxlZFwiLCB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogR2V0cyBhbiBhbHJlYWR5IGNhbmNlbGxlZCBgQ2FuY2VsbGF0aW9uVG9rZW5gLlxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAoIUNhbmNlbGxhdGlvblRva2VuU291cmNlLl9jYW5jZWxlZCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xyXG4gICAgICAgICAgICAgICAgY3RzLmNhbmNlbCgpO1xyXG4gICAgICAgICAgICAgICAgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UuX2NhbmNlbGVkID0gY3RzLnRva2VuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5fY2FuY2VsZWQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UucHJvdG90eXBlLCBcImNhbmNlbGVkXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIGEgdmFsdWUgaW5kaWNhdGluZyB3aGV0aGVyIHRoZSB0b2tlbiBoYXMgcmVjZWl2ZWQgYSBjYW5jZWxsYXRpb24gc2lnbmFsLlxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fY2FuY2VsZWQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UucHJvdG90eXBlLCBcInJlYXNvblwiLCB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogR2V0cyB0aGUgcmVhc29uIGZvciBjYW5jZWxsYXRpb24sIGlmIG9uZSB3YXMgc3VwcGxpZWQuXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWFzb247XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UucHJvdG90eXBlLCBcInRva2VuXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSBgQ2FuY2VsbGF0aW9uVG9rZW5gIGZvciB0aGlzIHNvdXJjZS5cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3Rva2VuO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgLyoqXHJcbiAgICAgKiBTaWduYWxzIHRoZSBzb3VyY2UgaXMgY2FuY2VsbGVkLlxyXG4gICAgICogQHBhcmFtIHJlYXNvbiBBbiBvcHRpb25hbCByZWFzb24gZm9yIHRoZSBjYW5jZWxsYXRpb24uXHJcbiAgICAgKi9cclxuICAgIENhbmNlbGxhdGlvblRva2VuU291cmNlLnByb3RvdHlwZS5jYW5jZWwgPSBmdW5jdGlvbiAocmVhc29uKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2NhbmNlbGVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fdGhyb3dJZkZyb3plbigpO1xyXG4gICAgICAgIHRoaXMuX2NhbmNlbENvcmUocmVhc29uKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIFNpZ25hbHMgdGhlIHNvdXJjZSBpcyBjYW5jZWxlZCBhZnRlciBhIGRlbGF5LlxyXG4gICAgICogQHBhcmFtIGRlbGF5IFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIGRlbGF5IGJlZm9yZSBzaWduYWxsaW5nIGNhbmNlbGxhdGlvbi5cclxuICAgICAqIEBwYXJhbSByZWFzb24gQW4gb3B0aW9uYWwgcmVhc29uIGZvciB0aGUgY2FuY2VsbGF0aW9uLlxyXG4gICAgICovXHJcbiAgICBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5wcm90b3R5cGUuY2FuY2VsQWZ0ZXIgPSBmdW5jdGlvbiAoZGVsYXksIHJlYXNvbikge1xyXG4gICAgICAgIGlmICh0aGlzLl9jYW5jZWxlZCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX3Rocm93SWZGcm96ZW4oKTtcclxuICAgICAgICB0aGlzLl9jbGVhclRpbWVvdXQoKTtcclxuICAgICAgICB0aGlzLl90aW1lciA9IHNldFRpbWVvdXQoQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UuX29udGltZW91dCwgZGVsYXksIHRoaXMsIHJlYXNvbik7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBDbG9zZXMgdGhlIENhbmNlbGxhdGlvblNvdXJjZSwgcHJldmVudGluZyBhbnkgZnV0dXJlIGNhbmNlbGxhdGlvbiBzaWduYWwuXHJcbiAgICAgKi9cclxuICAgIENhbmNlbGxhdGlvblRva2VuU291cmNlLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAoT2JqZWN0LmlzRnJvemVuKHRoaXMpKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fY2xlYXJUaW1lb3V0KCk7XHJcbiAgICAgICAgaWYgKHRoaXMuX2xpbmtzKSB7XHJcbiAgICAgICAgICAgIHZhciBsaW5rcyA9IHRoaXMuX2xpbmtzO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpbmtzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgbGlua3NbaV0udW5yZWdpc3RlcigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLl9jYWxsYmFja3MpIHtcclxuICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tzLmNsZWFyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX2xpbmtzID0gbnVsbDtcclxuICAgICAgICB0aGlzLl9jYWxsYmFja3MgPSBudWxsO1xyXG4gICAgICAgIE9iamVjdC5mcmVlemUodGhpcyk7XHJcbiAgICB9O1xyXG4gICAgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UuX29udGltZW91dCA9IGZ1bmN0aW9uIChzb3VyY2UsIHJlYXNvbikge1xyXG4gICAgICAgIHNvdXJjZS5fdGltZXIgPSBudWxsO1xyXG4gICAgICAgIGlmICghT2JqZWN0LmlzRnJvemVuKHNvdXJjZSkpIHtcclxuICAgICAgICAgICAgc291cmNlLl9jYW5jZWxDb3JlKHJlYXNvbik7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIENhbmNlbGxhdGlvblRva2VuU291cmNlLnByb3RvdHlwZS5fcmVnaXN0ZXIgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcmd1bWVudCBpcyBub3QgYSBGdW5jdGlvbiBvYmplY3RcIik7XHJcbiAgICAgICAgaWYgKHRoaXMuX2NhbmNlbGVkKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKHRoaXMuX3JlYXNvbik7XHJcbiAgICAgICAgICAgIHJldHVybiBlbXB0eVJlZ2lzdHJhdGlvbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKE9iamVjdC5pc0Zyb3plbih0aGlzKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZW1wdHlSZWdpc3RyYXRpb247XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBjb29raWUgPSB7fTtcclxuICAgICAgICB2YXIgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8ICh0aGlzLl9jYWxsYmFja3MgPSBuZXcgTWFwKCkpO1xyXG4gICAgICAgIGNhbGxiYWNrcy5zZXQoY29va2llLCBjYWxsYmFjayk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgdW5yZWdpc3RlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzLmRlbGV0ZShjb29raWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH07XHJcbiAgICBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5wcm90b3R5cGUuX2NhbmNlbENvcmUgPSBmdW5jdGlvbiAocmVhc29uKSB7XHJcbiAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKVxyXG4gICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgIGlmICh0aGlzLl9jYW5jZWxlZCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX2NsZWFyVGltZW91dCgpO1xyXG4gICAgICAgIGlmIChyZWFzb24gPT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZWFzb24gPSBuZXcgRXJyb3IoXCJvcGVyYXRpb24gd2FzIGNhbmNlbGVkLlwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHJlYXNvbiBpbnN0YW5jZW9mIEVycm9yICYmICEoXCJzdGFja1wiIGluIHJlYXNvbikpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHRocm93IHJlYXNvbjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHJlYXNvbiA9IGVycm9yO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX2NhbmNlbGVkID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLl9yZWFzb24gPSByZWFzb247XHJcbiAgICAgICAgaWYgKHRoaXMuX2NhbGxiYWNrcykge1xyXG4gICAgICAgICAgICB2YXIgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzO1xyXG4gICAgICAgICAgICB0aGlzLl9jYWxsYmFja3MgPSBudWxsO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzLmZvckVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2socmVhc29uKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGZpbmFsbHkge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzLmNsZWFyKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UucHJvdG90eXBlLl9jbGVhclRpbWVvdXQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX3RpbWVyICE9IG51bGwpIHtcclxuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3RpbWVyKTtcclxuICAgICAgICAgICAgdGhpcy5fdGltZXIgPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5wcm90b3R5cGUuX3Rocm93SWZGcm96ZW4gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKE9iamVjdC5pc0Zyb3plbih0aGlzKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjYW5ub3QgbW9kaWZ5IGEgY2xvc2VkIHNvdXJjZVwiKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIENhbmNlbGxhdGlvblRva2VuU291cmNlO1xyXG59KSgpO1xyXG5leHBvcnRzLkNhbmNlbGxhdGlvblRva2VuU291cmNlID0gQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U7XHJcbnZhciBlbXB0eVJlZ2lzdHJhdGlvbiA9IE9iamVjdC5mcmVlemUoeyB1bnJlZ2lzdGVyOiBmdW5jdGlvbiAoKSB7XHJcbn0gfSk7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGU6Ly8vQ3wvZGV2L2FzeW5janMvY2FuY2VsbGF0aW9uLmpzLm1hcCIsInZhciBwcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XHJcbnZhciBQcm9taXNlID0gcHJvbWlzZS5Qcm9taXNlO1xyXG52YXIgRGVmZXJyZWQgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gRGVmZXJyZWQoKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB0aGlzLl9wcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICBfdGhpcy5fcmVzb2x2ZSA9IHJlc29sdmU7XHJcbiAgICAgICAgICAgIF90aGlzLl9yZWplY3QgPSByZWplY3Q7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoRGVmZXJyZWQucHJvdG90eXBlLCBcInByb21pc2VcIiwge1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcHJvbWlzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIERlZmVycmVkLnByb3RvdHlwZS5yZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdGhpcy5fcmVzb2x2ZSh2YWx1ZSk7XHJcbiAgICB9O1xyXG4gICAgRGVmZXJyZWQucHJvdG90eXBlLnJlamVjdCA9IGZ1bmN0aW9uIChyZWFzb24pIHtcclxuICAgICAgICB0aGlzLl9yZWplY3QocmVhc29uKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gRGVmZXJyZWQ7XHJcbn0pKCk7XHJcbmV4cG9ydHMuRGVmZXJyZWQgPSBEZWZlcnJlZDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy9kZWZlcnJlZC5qcy5tYXAiLCJ2YXIgY2FuY2VsbGF0aW9uID0gcmVxdWlyZSgnLi9jYW5jZWxsYXRpb24nKTtcclxudmFyIHByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcclxudmFyIFByb21pc2UgPSBwcm9taXNlLlByb21pc2U7XHJcbnZhciBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSA9IGNhbmNlbGxhdGlvbi5DYW5jZWxsYXRpb25Ub2tlblNvdXJjZTtcclxudmFyIGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zID0gdHlwZW9mIERlYnVnICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPT09IFwiYm9vbGVhblwiO1xyXG4vKipcclxuICogQSBVcmlcclxuICovXHJcbnZhciBVcmkgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gVXJpKCkge1xyXG4gICAgICAgIHZhciBhcmdzID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICAgICAgYXJnc1tfaSAtIDBdID0gYXJndW1lbnRzW19pXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogVGhlIHByb3RvY29sIGZvciB0aGUgVXJpIChlLmcuICdodHRwOicpXHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnByb3RvY29sID0gXCJcIjtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUaGUgaG9zdG5hbWUgZm9yIHRoZSBVcmlcclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuaG9zdG5hbWUgPSBcIlwiO1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRoZSBwb3J0IG51bWJlciBmb3IgdGhlIFVyaVxyXG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5wb3J0ID0gbnVsbDtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUaGUgcGF0aCBuYW1lIGZvciB0aGUgVXJpXHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnBhdGhuYW1lID0gXCJcIjtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUaGUgc2VhcmNoIHBvcnRpb24gb2YgdGhlIHBhdGgsIGFsc28ga25vd24gYXMgdGhlIHF1ZXJ5c3RyaW5nXHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnNlYXJjaCA9IFwiXCI7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogVGhlIGZyYWdtZW50IHBvcnRpb24gb2YgdGhlIHBhdGhcclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuaGFzaCA9IFwiXCI7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQSB2YWx1ZSBpbmRpY2F0aW5nIHdoZXRoZXIgdGhlIFVybCBpcyBhbiBhYnNvbHV0ZSB1cmxcclxuICAgICAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLmFic29sdXRlID0gZmFsc2U7XHJcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID09PSAwKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBcmd1bWVudCBtaXNzaW5nXCIpO1xyXG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICAgICAgICB2YXIgbSA9IFVyaVBhcnNlci5leGVjKGFyZ3NbMF0pO1xyXG4gICAgICAgICAgICBpZiAoIW0pXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVVJJRXJyb3IoKTtcclxuICAgICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiBVcmlQYXJ0cykge1xyXG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gVXJpUGFydHNbbmFtZV07XHJcbiAgICAgICAgICAgICAgICB2YXIgcGFydCA9IG1baW5kZXhdO1xyXG4gICAgICAgICAgICAgICAgaWYgKHBhcnQpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPCA1KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0ID0gcGFydC50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGluZGV4ID09PSA1KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0ID0gcGFyc2VJbnQocGFydCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPT09IDUpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnQgPSBtWzFdID8gVXJpUG9ydHNbdGhpcy5wcm90b2NvbF0gOiBudWxsO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpc1tuYW1lXSA9IHBhcnQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5hYnNvbHV0ZSA9ICEhbVsxXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHZhciBiYXNlVXJpID0gYXJnc1swXSBpbnN0YW5jZW9mIFVyaSA/IGFyZ3NbMF0gOiBVcmkucGFyc2UoYXJnc1swXSk7XHJcbiAgICAgICAgICAgIHZhciB1cmkgPSBhcmdzWzBdIGluc3RhbmNlb2YgVXJpID8gYXJnc1sxXSA6IFVyaS5wYXJzZShhcmdzWzFdKTtcclxuICAgICAgICAgICAgdGhpcy5oYXNoID0gdXJpLmhhc2g7XHJcbiAgICAgICAgICAgIGlmICh1cmkucHJvdG9jb2wpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucHJvdG9jb2wgPSB1cmkucHJvdG9jb2w7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmhvc3RuYW1lID0gdXJpLmhvc3RuYW1lO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wb3J0ID0gdXJpLnBvcnQ7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBhdGhuYW1lID0gdXJpLnBhdGhuYW1lO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZWFyY2ggPSB1cmkuc2VhcmNoO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5oYXNoID0gdXJpLmhhc2g7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFic29sdXRlID0gdXJpLmFic29sdXRlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wcm90b2NvbCA9IGJhc2VVcmkucHJvdG9jb2w7XHJcbiAgICAgICAgICAgICAgICBpZiAodXJpLmhvc3RuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5ob3N0bmFtZSA9IHVyaS5ob3N0bmFtZTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBvcnQgPSB1cmkucG9ydDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBhdGhuYW1lID0gdXJpLnBhdGhuYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2VhcmNoID0gdXJpLnNlYXJjaDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmhhc2ggPSB1cmkuaGFzaDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFic29sdXRlID0gdXJpLmFic29sdXRlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5ob3N0bmFtZSA9IGJhc2VVcmkuaG9zdG5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3J0ID0gYmFzZVVyaS5wb3J0O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh1cmkucGF0aG5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVyaS5wYXRobmFtZS5jaGFyQXQoMCkgPT09ICcvJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXRobmFtZSA9IHVyaS5wYXRobmFtZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgoYmFzZVVyaS5hYnNvbHV0ZSAmJiAhYmFzZVVyaS5wYXRobmFtZSkgfHwgYmFzZVVyaS5wYXRobmFtZSA9PT0gXCIvXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhdGhuYW1lID0gJy8nICsgdXJpLnBhdGhuYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoYmFzZVVyaS5wYXRobmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwYXJ0cyA9IGJhc2VVcmkucGF0aG5hbWUuc3BsaXQoJy8nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXSA9IHVyaS5wYXRobmFtZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhdGhuYW1lID0gcGFydHMuam9pbignLycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhdGhuYW1lID0gYmFzZVVyaS5wYXRobmFtZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVyaS5zZWFyY2gpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2VhcmNoID0gdXJpLnNlYXJjaDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2VhcmNoID0gYmFzZVVyaS5zZWFyY2g7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgT2JqZWN0LmZyZWV6ZSh0aGlzKTtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShVcmkucHJvdG90eXBlLCBcIm9yaWdpblwiLCB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogR2V0cyB0aGUgb3JpZ2luIG9mIHRoZSBVcmlcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9TdHJpbmcoXCJvcmlnaW5cIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoVXJpLnByb3RvdHlwZSwgXCJob3N0XCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSBob3N0IGZvciB0aGUgdXJpLCBpbmNsdWRpbmcgdGhlIGhvc3RuYW1lIGFuZCBwb3J0XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRvU3RyaW5nKFwiaG9zdFwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShVcmkucHJvdG90eXBlLCBcInNjaGVtZVwiLCB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogR2V0cyB0aGUgc2NoZW1lIGZvciB0aGUgdXJpIChlLmcuICdodHRwOi8vJycpXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRvU3RyaW5nKFwic2NoZW1lXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgLyoqXHJcbiAgICAgKiBUZXN0cyB3aGV0aGVyIHRoZSBwcm92aWRlZCB1cmkgaGFzIHRoZSBzYW1lIG9yaWdpbiBhcyB0aGlzIHVyaVxyXG4gICAgICogQHBhcmFtIHVyaSBUaGUgdXJpIHRvIGNvbXBhcmUgYWdhaW5zdFxyXG4gICAgICogQHJldHVybnMgVHJ1ZSBpZiB0aGUgdXJpJ3MgaGF2ZSB0aGUgc2FtZSBvcmlnaW47IG90aGVyd2lzZSwgZmFsc2VcclxuICAgICAqL1xyXG4gICAgVXJpLnByb3RvdHlwZS5pc1NhbWVPcmlnaW4gPSBmdW5jdGlvbiAodXJpKSB7XHJcbiAgICAgICAgdmFyIG90aGVyO1xyXG4gICAgICAgIGlmICh0eXBlb2YgdXJpID09PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICAgIG90aGVyID0gVXJpLnBhcnNlKHVyaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHVyaSBpbnN0YW5jZW9mIFVyaSkge1xyXG4gICAgICAgICAgICBvdGhlciA9IHVyaTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJBcmd1bWVudCBub3Qgb3B0aW9uYWwuXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5hYnNvbHV0ZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5vcmlnaW4gPT09IG90aGVyLm9yaWdpbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuICFvdGhlci5hYnNvbHV0ZTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgVXJpXHJcbiAgICAgKiBAcGFyYW0gZm9ybWF0IHtTdHJpbmd9IEEgZm9ybWF0IHNwZWNpZmllci5cclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBzdHJpbmcgY29udGVudCBvZiB0aGUgVXJpXHJcbiAgICAgKi9cclxuICAgIFVyaS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoZm9ybWF0KSB7XHJcbiAgICAgICAgc3dpdGNoIChmb3JtYXQpIHtcclxuICAgICAgICAgICAgY2FzZSBcIm9yaWdpblwiOlxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucHJvdG9jb2wgJiYgdGhpcy5ob3N0bmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcodGhpcy5wcm90b2NvbCkgKyBcIi8vXCIgKyB0aGlzLnRvU3RyaW5nKFwiaG9zdFwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgICAgICAgICBjYXNlIFwiYXV0aG9yaXR5XCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJob3N0XCI6XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5ob3N0bmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBvcnQgIT09IFVyaVBvcnRzW3RoaXMucHJvdG9jb2xdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcodGhpcy5ob3N0bmFtZSkgKyBcIjpcIiArIHRoaXMudG9TdHJpbmcoXCJwb3J0XCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gU3RyaW5nKHRoaXMuaG9zdG5hbWUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICAgICAgICAgIGNhc2UgXCJwYXRoK3NlYXJjaFwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh0aGlzLnBhdGhuYW1lKSArIFN0cmluZyh0aGlzLnNlYXJjaCk7XHJcbiAgICAgICAgICAgIGNhc2UgXCJzY2hlbWVcIjogcmV0dXJuIHRoaXMudG9TdHJpbmcoXCJwcm90b2NvbFwiKSArIFwiLy9cIjtcclxuICAgICAgICAgICAgY2FzZSBcInByb3RvY29sXCI6IHJldHVybiBTdHJpbmcodGhpcy5wcm90b2NvbCB8fCBcIlwiKTtcclxuICAgICAgICAgICAgY2FzZSBcImhvc3RuYW1lXCI6IHJldHVybiBTdHJpbmcodGhpcy5ob3N0bmFtZSB8fCBcIlwiKTtcclxuICAgICAgICAgICAgY2FzZSBcInBvcnRcIjpcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBvcnQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gU3RyaW5nKHRoaXMucG9ydCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wcm90b2NvbCAmJiBVcmlQb3J0c1t0aGlzLnByb3RvY29sXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcoVXJpUG9ydHNbdGhpcy5wcm90b2NvbF0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICAgICAgICAgIGNhc2UgXCJmaWxlXCI6XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wYXRobmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpID0gdGhpcy5wYXRobmFtZS5sYXN0SW5kZXhPZihcIi9cIikgKyAxO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRobmFtZS5zdWJzdHIoaSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICAgICAgICAgIGNhc2UgXCJkaXJcIjpcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBhdGhuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGkgPSB0aGlzLnBhdGhuYW1lLmxhc3RJbmRleE9mKFwiL1wiKSArIDE7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhuYW1lLnN1YnN0cigwLCBpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICAgICAgY2FzZSBcImV4dFwiOlxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGF0aG5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgaSA9IHRoaXMucGF0aG5hbWUubGFzdEluZGV4T2YoXCIvXCIpICsgMTtcclxuICAgICAgICAgICAgICAgICAgICBpID0gdGhpcy5wYXRobmFtZS5sYXN0SW5kZXhPZihcIi5cIiwgaSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhuYW1lLnN1YnN0cihpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICAgICAgY2FzZSBcImZpbGUtZXh0XCI6XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wYXRobmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpID0gdGhpcy5wYXRobmFtZS5sYXN0SW5kZXhPZihcIi9cIikgKyAxO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBqID0gdGhpcy5wYXRobmFtZS5sYXN0SW5kZXhPZihcIi5cIiwgaSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChqID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aG5hbWUuc3Vic3RyaW5nKGksIGopO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhuYW1lLnN1YnN0cihpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICAgICAgY2FzZSBcImZyYWdtZW50XCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJoYXNoXCI6XHJcbiAgICAgICAgICAgICAgICB2YXIgaGFzaCA9IFN0cmluZyh0aGlzLmhhc2ggfHwgXCJcIik7XHJcbiAgICAgICAgICAgICAgICBpZiAoaGFzaC5sZW5ndGggPiAwICYmIGhhc2guY2hhckF0KDApICE9IFwiI1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiI1wiICsgaGFzaDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBoYXNoO1xyXG4gICAgICAgICAgICBjYXNlIFwicGF0aFwiOlxyXG4gICAgICAgICAgICBjYXNlIFwicGF0aG5hbWVcIjpcclxuICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcodGhpcy5wYXRobmFtZSB8fCBcIlwiKTtcclxuICAgICAgICAgICAgY2FzZSBcInNlYXJjaFwiOlxyXG4gICAgICAgICAgICBjYXNlIFwicXVlcnlcIjpcclxuICAgICAgICAgICAgICAgIHZhciBzZWFyY2ggPSBTdHJpbmcodGhpcy5zZWFyY2ggfHwgXCJcIik7XHJcbiAgICAgICAgICAgICAgICBpZiAoc2VhcmNoLmxlbmd0aCA+IDAgJiYgc2VhcmNoLmNoYXJBdCgwKSAhPSBcIj9cIikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIj9cIiArIHNlYXJjaDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBzZWFyY2g7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50b1N0cmluZyhcIm9yaWdpblwiKSArIHRoaXMudG9TdHJpbmcoXCJwYXRobmFtZVwiKSArIHRoaXMudG9TdHJpbmcoXCJzZWFyY2hcIikgKyB0aGlzLnRvU3RyaW5nKFwiaGFzaFwiKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBQYXJzZXMgdGhlIHByb3ZpZGVkIHVyaSBzdHJpbmdcclxuICAgICAqIEBwYXJhbSB1cmkge1N0cmluZ30gVGhlIHVyaSBzdHJpbmcgdG8gcGFyc2VcclxuICAgICAqIEByZXR1cm5zIHtVcml9IFRoZSBwYXJzZWQgdXJpXHJcbiAgICAgKi9cclxuICAgIFVyaS5wYXJzZSA9IGZ1bmN0aW9uICh1cmkpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFVyaSh1cmkpO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQ29tYmluZXMgdHdvIHVyaXNcclxuICAgICAqIEBwYXJhbSBiYXNlVXJpIFRoZSBiYXNlIHVyaVxyXG4gICAgICogQHBhcmFtIHVyaSBUaGUgcmVsYXRpdmUgdXJpXHJcbiAgICAgKiBAcmV0dXJucyBUaGUgY29tYmluZWQgdXJpXHJcbiAgICAgKi9cclxuICAgIFVyaS5jb21iaW5lID0gZnVuY3Rpb24gKGJhc2VVcmksIHVyaSkge1xyXG4gICAgICAgIHJldHVybiBuZXcgVXJpKGJhc2VVcmksIHVyaSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIFVyaTtcclxufSkoKTtcclxuZXhwb3J0cy5VcmkgPSBVcmk7XHJcbnZhciBRdWVyeVN0cmluZztcclxuKGZ1bmN0aW9uIChRdWVyeVN0cmluZykge1xyXG4gICAgdmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XHJcbiAgICB2YXIgUXVlcnlTdHJpbmdQYXJzZXIgPSAvKD86XFw/fCZ8XikoW149Jl0qKSg/Oj0oW14mXSopKT8vZztcclxuICAgIGZ1bmN0aW9uIHN0cmluZ2lmeShvYmopIHtcclxuICAgICAgICBpZiAoIW9iaikge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHFzID0gW107XHJcbiAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XHJcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IG9ialtuYW1lXTtcclxuICAgICAgICAgICAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgXCJzdHJpbmdcIjpcclxuICAgICAgICAgICAgICAgIGNhc2UgXCJudW1iZXJcIjpcclxuICAgICAgICAgICAgICAgIGNhc2UgXCJib29sZWFuXCI6IHtcclxuICAgICAgICAgICAgICAgICAgICBxcy5wdXNoKGVuY29kZVVSSUNvbXBvbmVudChuYW1lKSArIFwiPVwiICsgZW5jb2RlVVJJQ29tcG9uZW50KFN0cmluZyh2YWx1ZSkpKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhciA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IGFyLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoICh0eXBlb2YgYXJbaV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIFwic3RyaW5nXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBcIm51bWJlclwiOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgXCJib29sZWFuXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHFzLnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KG5hbWUpICsgXCI9XCIgKyBlbmNvZGVVUklDb21wb25lbnQoU3RyaW5nKHZhbHVlKSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBxcy5wdXNoKGVuY29kZVVSSUNvbXBvbmVudChuYW1lKSArIFwiPVwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHFzLnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KG5hbWUpICsgXCI9XCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGlmIChxcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiP1wiICsgcXMuam9pbihcIiZcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgfVxyXG4gICAgUXVlcnlTdHJpbmcuc3RyaW5naWZ5ID0gc3RyaW5naWZ5O1xyXG4gICAgZnVuY3Rpb24gcGFyc2UodGV4dCkge1xyXG4gICAgICAgIHZhciBvYmogPSB7fTtcclxuICAgICAgICB2YXIgcGFydDtcclxuICAgICAgICB3aGlsZSAocGFydCA9IFF1ZXJ5U3RyaW5nUGFyc2VyLmV4ZWModGV4dCkpIHtcclxuICAgICAgICAgICAgdmFyIGtleSA9IGRlY29kZVVSSUNvbXBvbmVudChwYXJ0WzFdKTtcclxuICAgICAgICAgICAgaWYgKGtleS5sZW5ndGggJiYga2V5ICE9PSBcIl9fcHJvdG9fX1wiKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBkZWNvZGVVUklDb21wb25lbnQocGFydFsyXSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwob2JqLCBrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByZXZpb3VzID0gb2JqW2tleV07XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocHJldmlvdXMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhciA9IHByZXZpb3VzO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhci5wdXNoKHZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9ialtrZXldID0gW3ByZXZpb3VzLCB2YWx1ZV07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb2JqW2tleV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gb2JqO1xyXG4gICAgfVxyXG4gICAgUXVlcnlTdHJpbmcucGFyc2UgPSBwYXJzZTtcclxufSkoUXVlcnlTdHJpbmcgPSBleHBvcnRzLlF1ZXJ5U3RyaW5nIHx8IChleHBvcnRzLlF1ZXJ5U3RyaW5nID0ge30pKTtcclxuLyoqXHJcbiAqIEFuIEhUVFAgcmVxdWVzdCBmb3IgYW4gSHR0cENsaWVudFxyXG4gKi9cclxudmFyIEh0dHBSZXF1ZXN0ID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhbiBIVFRQIHJlcXVlc3QgZm9yIGFuIEh0dHBDbGllbnRcclxuICAgICAqIEBwYXJhbSBtZXRob2QgVGhlIEhUVFAgbWV0aG9kIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICogQHBhcmFtIHVybCBUaGUgdXJsIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBIdHRwUmVxdWVzdChtZXRob2QsIHVybCkge1xyXG4gICAgICAgIGlmIChtZXRob2QgPT09IHZvaWQgMCkgeyBtZXRob2QgPSBcIkdFVFwiOyB9XHJcbiAgICAgICAgdGhpcy5faGVhZGVycyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XHJcbiAgICAgICAgdGhpcy5tZXRob2QgPSBtZXRob2Q7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB1cmwgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgdGhpcy51cmwgPSBVcmkucGFyc2UodXJsKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAodXJsIGluc3RhbmNlb2YgVXJpKSB7XHJcbiAgICAgICAgICAgIHRoaXMudXJsID0gdXJsO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyB0aGUgbmFtZWQgcmVxdWVzdCBoZWFkZXJcclxuICAgICAqIEBwYXJhbSBrZXkge1N0cmluZ30gVGhlIGhlYWRlciBuYW1lXHJcbiAgICAgKiBAcGFyYW0gdmFsdWUge1N0cmluZ30gVGhlIGhlYWRlciB2YWx1ZVxyXG4gICAgICovXHJcbiAgICBIdHRwUmVxdWVzdC5wcm90b3R5cGUuc2V0UmVxdWVzdEhlYWRlciA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XHJcbiAgICAgICAgaWYgKGtleSAhPT0gXCJfX3Byb3RvX19cIikge1xyXG4gICAgICAgICAgICB0aGlzLl9oZWFkZXJzW2tleV0gPSB2YWx1ZTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEh0dHBSZXF1ZXN0O1xyXG59KSgpO1xyXG5leHBvcnRzLkh0dHBSZXF1ZXN0ID0gSHR0cFJlcXVlc3Q7XHJcbi8qKlxyXG4gKiBBIHJlc3BvbnNlIGZyb20gYW4gSHR0cENsaWVudFxyXG4gKi9cclxudmFyIEh0dHBSZXNwb25zZSA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICAvKipcclxuICAgICAqIEEgcmVzcG9uc2UgZnJvbSBhbiBIdHRwQ2xpZW50XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIEh0dHBSZXNwb25zZShyZXF1ZXN0LCB4aHIpIHtcclxuICAgICAgICB0aGlzLl9yZXF1ZXN0ID0gcmVxdWVzdDtcclxuICAgICAgICB0aGlzLl94aHIgPSB4aHI7XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoSHR0cFJlc3BvbnNlLnByb3RvdHlwZSwgXCJyZXF1ZXN0XCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSByZXF1ZXN0IGZvciB0aGlzIHJlc3BvbnNlXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZXF1ZXN0O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEh0dHBSZXNwb25zZS5wcm90b3R5cGUsIFwic3RhdHVzXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSBzdGF0dXMgY29kZSBvZiB0aGUgcmVzcG9uc2VcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3hoci5zdGF0dXM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoSHR0cFJlc3BvbnNlLnByb3RvdHlwZSwgXCJzdGF0dXNUZXh0XCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSBzdGF0dXMgdGV4dCBvZiB0aGUgcmVzcG9uc2VcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3hoci5zdGF0dXNUZXh0O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEh0dHBSZXNwb25zZS5wcm90b3R5cGUsIFwicmVzcG9uc2VUZXh0XCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSByZXNwb25zZSB0ZXh0IG9mIHRoZSByZXNwb25zZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5feGhyLnJlc3BvbnNlVGV4dDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyBhbGwgb2YgdGhlIHJlc3BvbnNlIGhlYWRlcyBpbiBhIHNpbmdsZSBzdHJpbmdcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IEEgc3RyaW5nIGNvbnRhaW5pbmcgYWxsIG9mIHRoZSByZXNwb25zZSBoZWFkZXJzXHJcbiAgICAgKi9cclxuICAgIEh0dHBSZXNwb25zZS5wcm90b3R5cGUuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl94aHIuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSB2YWx1ZSBmb3IgdGhlIG5hbWVkIHJlc3BvbnNlIGhlYWRlclxyXG4gICAgICogQHBhcmFtIGhlYWRlciB7U3RyaW5nfSBUaGUgbmFtZSBvZiB0aGUgaGVhZGVyXHJcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgdmFsdWUgZm9yIHRoZSBuYW1lZCBoZWFkZXJcclxuICAgICAqL1xyXG4gICAgSHR0cFJlc3BvbnNlLnByb3RvdHlwZS5nZXRSZXNwb25zZUhlYWRlciA9IGZ1bmN0aW9uIChoZWFkZXIpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5feGhyLmdldFJlc3BvbnNlSGVhZGVyKGhlYWRlcik7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEh0dHBSZXNwb25zZTtcclxufSkoKTtcclxuZXhwb3J0cy5IdHRwUmVzcG9uc2UgPSBIdHRwUmVzcG9uc2U7XHJcbi8qKlxyXG4gKiBBIGNsaWVudCBmb3IgSFRUUCByZXF1ZXN0c1xyXG4gKi9cclxudmFyIEh0dHBDbGllbnQgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgY2xpZW50IGZvciBIVFRQIHJlcXVlc3RzXHJcbiAgICAgKiBAcGFyYW0gYmFzZVVybCBUaGUgYmFzZSB1cmwgZm9yIHRoZSBjbGllbnRcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gSHR0cENsaWVudChiYXNlVXJsKSB7XHJcbiAgICAgICAgdGhpcy5faGVhZGVycyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XHJcbiAgICAgICAgdGhpcy5fY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XHJcbiAgICAgICAgdGhpcy5fY2xvc2VkID0gZmFsc2U7XHJcbiAgICAgICAgaWYgKGJhc2VVcmwpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBiYXNlVXJsID09PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmJhc2VVcmwgPSBVcmkucGFyc2UoYmFzZVVybCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAoYmFzZVVybCBpbnN0YW5jZW9mIFVyaSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5iYXNlVXJsID0gYmFzZVVybDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogQ2xvc2VzIHRoZSBjbGllbnQgYW5kIGNhbmNlbHMgYWxsIHBlbmRpbmcgcmVxdWVzdHNcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2Nsb3NlZClcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT2JqZWN0IGRvZXNuJ3Qgc3VwcG9ydCB0aGlzIGFjdGlvblwiKTtcclxuICAgICAgICB0aGlzLl9jbG9zZWQgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuX2N0cy5jYW5jZWwoKTtcclxuICAgICAgICB0aGlzLl9jdHMuY2xvc2UoKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIFNldHMgYSB2YWx1ZSBmb3IgYSBkZWZhdWx0IHJlcXVlc3QgaGVhZGVyXHJcbiAgICAgKiBAcGFyYW0ga2V5IFRoZSByZXF1ZXN0IGhlYWRlciBrZXlcclxuICAgICAqIEBwYXJhbSB2YWx1ZSBUaGUgcmVxdWVzdCBoZWFkZXIgdmFsdWVcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuc2V0UmVxdWVzdEhlYWRlciA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2Nsb3NlZClcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT2JqZWN0IGRvZXNuJ3Qgc3VwcG9ydCB0aGlzIGFjdGlvblwiKTtcclxuICAgICAgICBpZiAoa2V5ICE9PSBcIl9fcHJvdG9fX1wiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2hlYWRlcnNba2V5XSA9IHZhbHVlO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIHJlc3BvbnNlIHRleHQgZnJvbSB0aGUgcmVxdWVzdGVkIHVybFxyXG4gICAgICogQHBhcmFtIHVybCBUaGUgdXJsIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICogQHJldHVybnMgQSBmdXR1cmUgcmVzdWx0IGZvciB0aGUgc3RyaW5nXHJcbiAgICAgKi9cclxuICAgIEh0dHBDbGllbnQucHJvdG90eXBlLmdldFN0cmluZ0FzeW5jID0gZnVuY3Rpb24gKHVybCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmdldEFzeW5jKHVybCkudGhlbihmdW5jdGlvbiAocikgeyByZXR1cm4gci5yZXNwb25zZVRleHQ7IH0pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgcmVzcG9uc2UgZnJvbSBpc3N1aW5nIGFuIEhUVFAgR0VUIHRvIHRoZSByZXF1ZXN0ZWQgdXJsXHJcbiAgICAgKiBAcGFyYW0gdXJsIFRoZSB1cmwgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcGFyYW0gdG9rZW4gQSB0b2tlbiB0aGF0IGNhbiBiZSB1c2VkIHRvIGNhbmNlbCB0aGUgcmVxdWVzdFxyXG4gICAgICogQHJldHVybnMgQSBmdXR1cmUgcmVzdWx0IGZvciB0aGUgcmVzcG9uc2VcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuZ2V0QXN5bmMgPSBmdW5jdGlvbiAodXJsLCB0b2tlbikge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNlbmRBc3luYyhuZXcgSHR0cFJlcXVlc3QoXCJHRVRcIiwgdXJsKSwgdG9rZW4pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgcmVzcG9uc2UgZnJvbSBpc3N1aW5nIGFuIEhUVFAgUE9TVCB0byB0aGUgcmVxdWVzdGVkIHVybFxyXG4gICAgICogQHBhcmFtIHVybCBUaGUgdXJsIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICogQHBhcmFtIGJvZHkgVGhlIGJvZHkgb2YgdGhlIHJlcXVlc3RcclxuICAgICAqIEBwYXJhbSB0b2tlbiBBIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyBBIGZ1dHVyZSByZXN1bHQgZm9yIHRoZSByZXNwb25zZVxyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5wb3N0QXN5bmMgPSBmdW5jdGlvbiAodXJsLCBib2R5LCB0b2tlbikge1xyXG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IEh0dHBSZXF1ZXN0KFwiUE9TVFwiLCB1cmwpO1xyXG4gICAgICAgIHJlcXVlc3QuYm9keSA9IGJvZHk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VuZEFzeW5jKHJlcXVlc3QsIHRva2VuKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIHJlc3BvbnNlIGZyb20gaXNzdWluZyBhbiBIVFRQIFBPU1Qgb2YgYSBKU09OIHNlcmlhbGl6ZWQgdmFsdWUgdG8gdGhlIHJlcXVlc3RlZCB1cmxcclxuICAgICAqIEBwYXJhbSB1cmwgVGhlIHVybCBmb3IgdGhlIHJlcXVlc3RcclxuICAgICAqIEBwYXJhbSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2VyaWFsaXplXHJcbiAgICAgKiBAcGFyYW0ganNvblJlcGxhY2VyIEFuIGFycmF5IG9yIGNhbGxiYWNrIHVzZWQgdG8gcmVwbGFjZSB2YWx1ZXMgZHVyaW5nIHNlcmlhbGl6YXRpb25cclxuICAgICAqIEBwYXJhbSB0b2tlbiBBIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyBBIGZ1dHVyZSByZXN1bHQgZm9yIHRoZSByZXNwb25zZVxyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5wb3N0SnNvbkFzeW5jID0gZnVuY3Rpb24gKHVybCwgdmFsdWUsIGpzb25SZXBsYWNlciwgdG9rZW4pIHtcclxuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBIdHRwUmVxdWVzdChcIlBPU1RcIiwgdXJsKTtcclxuICAgICAgICByZXF1ZXN0LmJvZHkgPSBKU09OLnN0cmluZ2lmeSh2YWx1ZSwganNvblJlcGxhY2VyKTtcclxuICAgICAgICByZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNlbmRBc3luYyhyZXF1ZXN0LCB0b2tlbik7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSByZXNwb25zZSBmcm9tIGlzc3VpbmcgYW4gSFRUUCBQVVQgdG8gdGhlIHJlcXVlc3RlZCB1cmxcclxuICAgICAqIEBwYXJhbSB1cmwgVGhlIHVybCBmb3IgdGhlIHJlcXVlc3RcclxuICAgICAqIEBwYXJhbSBib2R5IFRoZSBib2R5IG9mIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcGFyYW0gdG9rZW4gQSB0b2tlbiB0aGF0IGNhbiBiZSB1c2VkIHRvIGNhbmNlbCB0aGUgcmVxdWVzdFxyXG4gICAgICogQHJldHVybnMgQSBmdXR1cmUgcmVzdWx0IGZvciB0aGUgcmVzcG9uc2VcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUucHV0QXN5bmMgPSBmdW5jdGlvbiAodXJsLCBib2R5LCB0b2tlbikge1xyXG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IEh0dHBSZXF1ZXN0KFwiUFVUXCIsIHVybCk7XHJcbiAgICAgICAgcmVxdWVzdC5ib2R5ID0gYm9keTtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZW5kQXN5bmMocmVxdWVzdCwgdG9rZW4pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgcmVzcG9uc2UgZnJvbSBpc3N1aW5nIGFuIEhUVFAgUFVUIG9mIGEgSlNPTiBzZXJpYWxpemVkIHZhbHVlIHRvIHRoZSByZXF1ZXN0ZWQgdXJsXHJcbiAgICAgKiBAcGFyYW0gdXJsIFRoZSB1cmwgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcGFyYW0gdmFsdWUgVGhlIHZhbHVlIHRvIHNlcmlhbGl6ZVxyXG4gICAgICogQHBhcmFtIGpzb25SZXBsYWNlciBBbiBhcnJheSBvciBjYWxsYmFjayB1c2VkIHRvIHJlcGxhY2UgdmFsdWVzIGR1cmluZyBzZXJpYWxpemF0aW9uXHJcbiAgICAgKiBAcGFyYW0gdG9rZW4gQSB0b2tlbiB0aGF0IGNhbiBiZSB1c2VkIHRvIGNhbmNlbCB0aGUgcmVxdWVzdFxyXG4gICAgICogQHJldHVybnMgQSBmdXR1cmUgcmVzdWx0IGZvciB0aGUgcmVzcG9uc2VcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUucHV0SnNvbkFzeW5jID0gZnVuY3Rpb24gKHVybCwgdmFsdWUsIGpzb25SZXBsYWNlciwgdG9rZW4pIHtcclxuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBIdHRwUmVxdWVzdChcIlBVVFwiLCB1cmwpO1xyXG4gICAgICAgIHJlcXVlc3QuYm9keSA9IEpTT04uc3RyaW5naWZ5KHZhbHVlLCBqc29uUmVwbGFjZXIpO1xyXG4gICAgICAgIHJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VuZEFzeW5jKHJlcXVlc3QsIHRva2VuKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIHJlc3BvbnNlIGZyb20gaXNzdWluZyBhbiBIVFRQIERFTEVURSB0byB0aGUgcmVxdWVzdGVkIHVybFxyXG4gICAgICogQHBhcmFtIHVybCBUaGUgdXJsIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICogQHBhcmFtIHRva2VuIEEgdG9rZW4gdGhhdCBjYW4gYmUgdXNlZCB0byBjYW5jZWwgdGhlIHJlcXVlc3RcclxuICAgICAqIEByZXR1cm5zIEEgZnV0dXJlIHJlc3VsdCBmb3IgdGhlIHJlc3BvbnNlXHJcbiAgICAgKi9cclxuICAgIEh0dHBDbGllbnQucHJvdG90eXBlLmRlbGV0ZUFzeW5jID0gZnVuY3Rpb24gKHVybCwgdG9rZW4pIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZW5kQXN5bmMobmV3IEh0dHBSZXF1ZXN0KFwiREVMRVRFXCIsIHVybCksIHRva2VuKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIFNlbmRzIHRoZSBwcm92aWRlZCByZXF1ZXN0IGFuZCByZXR1cm5zIHRoZSByZXNwb25zZVxyXG4gICAgICogQHBhcmFtIHJlcXVlc3Qge0h0dHBSZXF1ZXN0fSBBbiBIVFRQIHJlcXVlc3QgdG8gc2VuZFxyXG4gICAgICogQHBhcmFtIHRva2VuIHtmdXR1cmVzLkNhbmNlbGxhdGlvblRva2VufSBBIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyB7ZnV0dXJlcy5Qcm9taXNlPEh0dHBSZXNwb25zZT59IEEgZnV0dXJlIHJlc3VsdCBmb3IgdGhlIHJlc3BvbnNlXHJcbiAgICAgKi9cclxuICAgIEh0dHBDbGllbnQucHJvdG90eXBlLnNlbmRBc3luYyA9IGZ1bmN0aW9uIChyZXF1ZXN0LCB0b2tlbikge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgaWYgKHRoaXMuX2Nsb3NlZClcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT2JqZWN0IGRvZXNuJ3Qgc3VwcG9ydCB0aGlzIGFjdGlvblwiKTtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICAvLyBjcmVhdGUgYSBsaW5rZWQgdG9rZW5cclxuICAgICAgICAgICAgdmFyIGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZShfdGhpcy5fY3RzLnRva2VuLCB0b2tlbik7XHJcbiAgICAgICAgICAgIC8vIHRocm93IGlmIHdlJ3JlIGFscmVhZHkgY2FuY2VsZWQsIHRoZSBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWRcclxuICAgICAgICAgICAgY3RzLnRva2VuLnRocm93SWZDYW5jZWxlZCgpO1xyXG4gICAgICAgICAgICAvLyBub3JtYWxpemUgdGhlIHVyaVxyXG4gICAgICAgICAgICB2YXIgdXJsID0gbnVsbDtcclxuICAgICAgICAgICAgaWYgKCFyZXF1ZXN0LnVybCkge1xyXG4gICAgICAgICAgICAgICAgdXJsID0gX3RoaXMuYmFzZVVybDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmICghcmVxdWVzdC51cmwuYWJzb2x1dGUpIHtcclxuICAgICAgICAgICAgICAgIGlmICghX3RoaXMuYmFzZVVybClcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGFyZ3VtZW50OiByZXF1ZXN0XCIpO1xyXG4gICAgICAgICAgICAgICAgdXJsID0gbmV3IFVyaShfdGhpcy5iYXNlVXJsLCByZXF1ZXN0LnVybCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHVybCkge1xyXG4gICAgICAgICAgICAgICAgcmVxdWVzdC51cmwgPSB1cmw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG4gICAgICAgICAgICB2YXIgcmVzcG9uc2UgPSBuZXcgSHR0cFJlc3BvbnNlKHJlcXVlc3QsIHhocik7XHJcbiAgICAgICAgICAgIHZhciByZXF1ZXN0SGVhZGVycyA9IHJlcXVlc3QuX2hlYWRlcnM7XHJcbiAgICAgICAgICAgIHZhciBjbGllbnRIZWFkZXJzID0gX3RoaXMuX2hlYWRlcnM7XHJcbiAgICAgICAgICAgIC8vIGNyZWF0ZSB0aGUgb25sb2FkIGNhbGxiYWNrXHJcbiAgICAgICAgICAgIHZhciBvbmxvYWQgPSBmdW5jdGlvbiAoZXYpIHtcclxuICAgICAgICAgICAgICAgIGlmIChoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucylcclxuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICBjdHMudG9rZW4udGhyb3dJZkNhbmNlbGVkKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoeGhyLnN0YXR1cyA+PSAyMDAgJiYgeGhyLnN0YXR1cyA8IDMwMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVycm9yID0gY3JlYXRlSHR0cEVycm9yKF90aGlzLCByZXNwb25zZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgLy8gY3JlYXRlIHRoZSBvbmVycm9yIGNhbGxiYWNrXHJcbiAgICAgICAgICAgIHZhciBvbmVycm9yID0gZnVuY3Rpb24gKGV2KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaGFzTXNOb25Vc2VyQ29kZUV4Y2VwdGlvbnMpXHJcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuc2V0Tm9uVXNlckNvZGVFeGNlcHRpb25zID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3RzLnRva2VuLnRocm93SWZDYW5jZWxlZCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdmFyIGVycm9yID0gY3JlYXRlSHR0cEVycm9yKF90aGlzLCByZXNwb25zZSk7XHJcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAvLyByZWdpc3RlciBhIGNsZWFudXAgcGhhc2VcclxuICAgICAgICAgICAgdmFyIHJlZ2lzdHJhdGlvbiA9IGN0cy50b2tlbi5yZWdpc3RlcihmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaGFzTXNOb25Vc2VyQ29kZUV4Y2VwdGlvbnMpXHJcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuc2V0Tm9uVXNlckNvZGVFeGNlcHRpb25zID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgICAgICAgICAgIC8vIGFib3J0IHRoZSB4aHJcclxuICAgICAgICAgICAgICAgIHhoci5hYm9ydCgpO1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICBjdHMudG9rZW4udGhyb3dJZkNhbmNlbGVkKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHZhciBjbGVhbnVwID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgeGhyLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsIG9ubG9hZCwgZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgeGhyLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLCBvbmVycm9yLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24udW5yZWdpc3RlcigpO1xyXG4gICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAvLyBhZGQgdGhlIGhlYWRlcnMgZnJvbSB0aGUgY2xpZW50XHJcbiAgICAgICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGNsaWVudEhlYWRlcnMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xyXG4gICAgICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoa2V5LCBjbGllbnRIZWFkZXJzW2tleV0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgLy8gYWRkIHRoZSBoZWFkZXJzIGZyb20gdGhlIHJlcXVlc3RcclxuICAgICAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMocmVxdWVzdEhlYWRlcnMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xyXG4gICAgICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoa2V5LCByZXF1ZXN0SGVhZGVyc1trZXldKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIC8vIHdpcmUgdXAgdGhlIGV2ZW50c1xyXG4gICAgICAgICAgICB4aHIuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIiwgb25sb2FkLCBmYWxzZSk7XHJcbiAgICAgICAgICAgIHhoci5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgb25lcnJvciwgZmFsc2UpO1xyXG4gICAgICAgICAgICAvLyBlbmFibGUgY3JlZGVudGlhbHMgaWYgcmVxdWVzdGVkXHJcbiAgICAgICAgICAgIGlmIChfdGhpcy53aXRoQ3JlZGVudGlhbHMpIHtcclxuICAgICAgICAgICAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIGF0dGFjaCBhIHRpbWVvdXRcclxuICAgICAgICAgICAgaWYgKF90aGlzLnRpbWVvdXQgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBjdHMuY2FuY2VsQWZ0ZXIoX3RoaXMudGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICB4aHIudGltZW91dCA9IF90aGlzLnRpbWVvdXQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gc2VuZCB0aGUgcmVxdWVzdFxyXG4gICAgICAgICAgICB4aHIub3BlbihyZXF1ZXN0Lm1ldGhvZCwgcmVxdWVzdC51cmwudG9TdHJpbmcoKSwgdHJ1ZSwgX3RoaXMudXNlcm5hbWUsIF90aGlzLnBhc3N3b3JkKTtcclxuICAgICAgICAgICAgeGhyLnNlbmQocmVxdWVzdC5ib2R5KTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5nZXRKc29ucEFzeW5jID0gZnVuY3Rpb24gKHVybCwgY2FsbGJhY2tBcmcsIG5vQ2FjaGUsIHRva2VuKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICBpZiAoY2FsbGJhY2tBcmcgPT09IHZvaWQgMCkgeyBjYWxsYmFja0FyZyA9IFwiY2FsbGJhY2tcIjsgfVxyXG4gICAgICAgIGlmIChub0NhY2hlID09PSB2b2lkIDApIHsgbm9DYWNoZSA9IGZhbHNlOyB9XHJcbiAgICAgICAgaWYgKHRoaXMuX2Nsb3NlZClcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT2JqZWN0IGRvZXNuJ3Qgc3VwcG9ydCB0aGlzIGFjdGlvblwiKTtcclxuICAgICAgICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSBcInVuZGVmaW5lZFwiKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJKU09OLVAgaXMgbm90IHN1cHBvcnRlZCBpbiB0aGlzIGhvc3QuXCIpO1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgIC8vIGNyZWF0ZSBhIGxpbmtlZCB0b2tlblxyXG4gICAgICAgICAgICB2YXIgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKF90aGlzLl9jdHMudG9rZW4sIHRva2VuKTtcclxuICAgICAgICAgICAgLy8gdGhyb3cgaWYgd2UncmUgYWxyZWFkeSBjYW5jZWxlZCwgdGhlIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZFxyXG4gICAgICAgICAgICBjdHMudG9rZW4udGhyb3dJZkNhbmNlbGVkKCk7XHJcbiAgICAgICAgICAgIC8vIG5vcm1hbGl6ZSB0aGUgdXJpXHJcbiAgICAgICAgICAgIHZhciByZXF1ZXN0VXJsID0gbnVsbDtcclxuICAgICAgICAgICAgaWYgKCF1cmwpIHtcclxuICAgICAgICAgICAgICAgIHJlcXVlc3RVcmwgPSBfdGhpcy5iYXNlVXJsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB1cmwgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0VXJsID0gbmV3IFVyaSh1cmwpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodXJsIGluc3RhbmNlb2YgVXJpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdFVybCA9IHVybDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICghcmVxdWVzdFVybC5hYnNvbHV0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICghX3RoaXMuYmFzZVVybClcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBhcmd1bWVudDogdXJsXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RVcmwgPSBuZXcgVXJpKF90aGlzLmJhc2VVcmwsIHJlcXVlc3RVcmwpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IGpzb25wUmVxdWVzdEluZGV4Kys7XHJcbiAgICAgICAgICAgIHZhciBuYW1lID0gXCJfX1Byb21pc2VfX2pzb25wX19cIiArIGluZGV4O1xyXG4gICAgICAgICAgICB2YXIgcXVlcnkgPSBRdWVyeVN0cmluZy5wYXJzZShyZXF1ZXN0VXJsLnNlYXJjaCk7XHJcbiAgICAgICAgICAgIHF1ZXJ5W2NhbGxiYWNrQXJnXSA9IG5hbWU7XHJcbiAgICAgICAgICAgIGlmIChub0NhY2hlKSB7XHJcbiAgICAgICAgICAgICAgICBxdWVyeVtcIl90XCJdID0gRGF0ZS5ub3coKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXF1ZXN0VXJsLnNlYXJjaCA9IFF1ZXJ5U3RyaW5nLnN0cmluZ2lmeShxdWVyeSk7XHJcbiAgICAgICAgICAgIHZhciBwZW5kaW5nID0gdHJ1ZTtcclxuICAgICAgICAgICAgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImhlYWRcIilbMF07XHJcbiAgICAgICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpO1xyXG4gICAgICAgICAgICBzY3JpcHQudHlwZSA9IFwidGV4dC9qYXZhc2NyaXB0XCI7XHJcbiAgICAgICAgICAgIHNjcmlwdC5hc3luYyA9IHRydWU7XHJcbiAgICAgICAgICAgIHNjcmlwdC5zcmMgPSByZXF1ZXN0VXJsLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgICAgIC8vIGNoZWNrcyB3aGV0aGVyIHRoZSByZXF1ZXN0IGhhcyBiZWVuIGNhbmNlbGVkXHJcbiAgICAgICAgICAgIHZhciBjaGVja0NhbmNlbGVkID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKVxyXG4gICAgICAgICAgICAgICAgICAgIERlYnVnLnNldE5vblVzZXJDb2RlRXhjZXB0aW9ucyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIGN0cy50b2tlbi50aHJvd0lmQ2FuY2VsZWQoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAvLyB3YWl0cyBmb3IgdGhlIHJlc3VsdFxyXG4gICAgICAgICAgICB2YXIgb25sb2FkID0gZnVuY3Rpb24gKHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgaWdub3JlKCk7XHJcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24udW5yZWdpc3RlcigpO1xyXG4gICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFjaGVja0NhbmNlbGVkKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIC8vIGlnbm9yZXMgZnVydGhlciBjYWxscyB0byBmdWxmaWxsIHRoZSByZXN1bHRcclxuICAgICAgICAgICAgdmFyIGlnbm9yZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIHBlbmRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIGRlbGV0ZSB3aW5kb3dbbmFtZV07XHJcbiAgICAgICAgICAgICAgICBkaXNjb25uZWN0KCk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIC8vIGRpc2Nvbm5lY3RzIHRoZSBzY3JpcHQgbm9kZVxyXG4gICAgICAgICAgICB2YXIgZGlzY29ubmVjdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGlmIChzY3JpcHQucGFyZW50Tm9kZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGhlYWQucmVtb3ZlQ2hpbGQoc2NyaXB0KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgLy8gcmVnaXN0ZXIgYSBjbGVhbnVwIHBoYXNlXHJcbiAgICAgICAgICAgIHZhciByZWdpc3RyYXRpb24gPSBjdHMudG9rZW4ucmVnaXN0ZXIoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHBlbmRpbmcpIHtcclxuICAgICAgICAgICAgICAgICAgICB3aW5kb3dbbmFtZV0gPSBpZ25vcmU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBkaXNjb25uZWN0KCk7XHJcbiAgICAgICAgICAgICAgICBjaGVja0NhbmNlbGVkKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAvLyBzZXQgYSB0aW1lb3V0IGJlZm9yZSB3ZSBubyBsb25nZXIgY2FyZSBhYm91dCB0aGUgcmVzdWx0LlxyXG4gICAgICAgICAgICBpZiAoX3RoaXMudGltZW91dCkge1xyXG4gICAgICAgICAgICAgICAgY3RzLmNhbmNlbEFmdGVyKF90aGlzLnRpbWVvdXQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHdpbmRvd1tuYW1lXSA9IG9ubG9hZDtcclxuICAgICAgICAgICAgaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBIdHRwQ2xpZW50O1xyXG59KSgpO1xyXG5leHBvcnRzLkh0dHBDbGllbnQgPSBIdHRwQ2xpZW50O1xyXG5mdW5jdGlvbiBjcmVhdGVIdHRwRXJyb3IoaHR0cENsaWVudCwgcmVzcG9uc2UsIG1lc3NhZ2UpIHtcclxuICAgIGlmIChtZXNzYWdlID09PSB2b2lkIDApIHsgbWVzc2FnZSA9IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgcHJvY2Vzc2luZyB5b3VyIHJlcXVlc3RcIjsgfVxyXG4gICAgdmFyIGVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xyXG4gICAgZXJyb3IubmFtZSA9IFwiSHR0cEVycm9yXCI7XHJcbiAgICBlcnJvci5odHRwQ2xpZW50ID0gaHR0cENsaWVudDtcclxuICAgIGVycm9yLnJlc3BvbnNlID0gcmVzcG9uc2U7XHJcbiAgICBlcnJvci5tZXNzYWdlID0gbWVzc2FnZTtcclxuICAgIHJldHVybiBlcnJvcjtcclxufVxyXG52YXIgVXJpUGFyc2VyID0gL14oKD86KGh0dHBzPzopXFwvXFwvKSg/OlteOkBdKig/OlxcOlteQF0qKT9AKT8oKFthLXpcXGQtXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXFwuXSspKD86XFw6KFxcZCspKT8pPyk/KD8hW2EtelxcZC1dK1xcOikoKD86XnxcXC8pW15cXD9cXCNdKik/KFxcP1teI10qKT8oIy4qKT8kL2k7XHJcbnZhciBVcmlQYXJ0cyA9IHsgXCJwcm90b2NvbFwiOiAyLCBcImhvc3RuYW1lXCI6IDQsIFwicG9ydFwiOiA1LCBcInBhdGhuYW1lXCI6IDYsIFwic2VhcmNoXCI6IDcsIFwiaGFzaFwiOiA4IH07XHJcbnZhciBVcmlQb3J0cyA9IHsgXCJodHRwOlwiOiA4MCwgXCJodHRwczpcIjogNDQzIH07XHJcbnZhciBqc29ucFJlcXVlc3RJbmRleCA9IDA7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGU6Ly8vQ3wvZGV2L2FzeW5janMvaHR0cGNsaWVudC5qcy5tYXAiLCJ2YXIgdGFzayA9IHJlcXVpcmUoJy4vdGFzaycpO1xyXG52YXIgc2NoZWR1bGVUYXNrID0gdGFzay5zY2hlZHVsZVRhc2s7XHJcbnZhciBoYXNNc0RlYnVnID0gdHlwZW9mIERlYnVnICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBEZWJ1Zy5tc1RyYWNlQXN5bmNPcGVyYXRpb25TdGFydGluZyA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBEZWJ1Zy5tc1RyYWNlQXN5bmNPcGVyYXRpb25Db21wbGV0ZWQgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgRGVidWcubXNUcmFjZUFzeW5jQ2FsbGJhY2tTdGFydGluZyA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBEZWJ1Zy5tc1RyYWNlQXN5bmNDYWxsYmFja0NvbXBsZXRlZCA9PT0gXCJmdW5jdGlvblwiO1xyXG52YXIgaGFzTXNOb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0eXBlb2YgRGVidWcgIT09IFwidW5kZWZpbmVkXCIgJiYgdHlwZW9mIERlYnVnLnNldE5vblVzZXJDb2RlRXhjZXB0aW9ucyA9PT0gXCJib29sZWFuXCI7XHJcbi8qKlxyXG4gKiBSZXByZXNlbnRzIHRoZSBjb21wbGV0aW9uIG9mIGFuIGFzeW5jaHJvbm91cyBvcGVyYXRpb25cclxuICovXHJcbnZhciBQcm9taXNlID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIG5ldyBQcm9taXNlLlxyXG4gICAgICogQHBhcmFtIGluaXQgQSBjYWxsYmFjayB1c2VkIHRvIGluaXRpYWxpemUgdGhlIHByb21pc2UuIFRoaXMgY2FsbGJhY2sgaXMgcGFzc2VkIHR3byBhcmd1bWVudHM6IGEgcmVzb2x2ZSBjYWxsYmFjayB1c2VkIHJlc29sdmUgdGhlIHByb21pc2Ugd2l0aCBhIHZhbHVlIG9yIHRoZSByZXN1bHQgb2YgYW5vdGhlciBwcm9taXNlLCBhbmQgYSByZWplY3QgY2FsbGJhY2sgdXNlZCB0byByZWplY3QgdGhlIHByb21pc2Ugd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBvciBlcnJvci5cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gUHJvbWlzZShpbml0KSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICBpZiAoaGFzTXNOb25Vc2VyQ29kZUV4Y2VwdGlvbnMpXHJcbiAgICAgICAgICAgIERlYnVnLnNldE5vblVzZXJDb2RlRXhjZXB0aW9ucyA9IHRydWU7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBpbml0ICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcmd1bWVudCBpcyBub3QgYSBGdW5jdGlvbiBvYmplY3RcIik7XHJcbiAgICAgICAgdmFyIHJlc29sdmUgPSBmdW5jdGlvbiAocmVqZWN0aW5nLCByZXN1bHQpIHtcclxuICAgICAgICAgICAgcmVzb2x2ZSA9IG51bGw7XHJcbiAgICAgICAgICAgIF90aGlzLl9yZXNvbHZlKHJlamVjdGluZywgcmVzdWx0KTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGluaXQoZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlICYmIHJlc29sdmUoZmFsc2UsIHZhbHVlKTtcclxuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlICYmIHJlc29sdmUodHJ1ZSwgZXJyb3IpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIHJlc29sdmUodHJ1ZSwgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFByb21pc2UucmVzb2x2ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHJldHVybiAodmFsdWUgaW5zdGFuY2VvZiB0aGlzKSA/IHZhbHVlIDogbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmV0dXJuIHJlc29sdmUodmFsdWUpOyB9KTtcclxuICAgIH07XHJcbiAgICBQcm9taXNlLnJlamVjdCA9IGZ1bmN0aW9uIChyZWFzb24pIHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKF8sIHJlamVjdCkgeyByZXR1cm4gcmVqZWN0KHJlYXNvbik7IH0pO1xyXG4gICAgfTtcclxuICAgIFByb21pc2UuYWxsID0gZnVuY3Rpb24gKHZhbHVlcykge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgdmFyIGNvdW50ZG93biA9IHZhbHVlcy5sZW5ndGggfHwgMDtcclxuICAgICAgICAgICAgaWYgKGNvdW50ZG93biA8PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKFtdKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IEFycmF5KGNvdW50ZG93bik7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzdWx0cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgX3RoaXMucmVzb2x2ZSh2YWx1ZXNbaV0pLnRoZW4oKGZ1bmN0aW9uIChpbmRleCkgeyByZXR1cm4gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1tpbmRleF0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoLS1jb3VudGRvd24gPT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdHMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH07IH0pKGkpLCByZWplY3QpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgUHJvbWlzZS5yYWNlID0gZnVuY3Rpb24gKHZhbHVlcykge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgdmFyIHByb21pc2VzID0gdmFsdWVzLm1hcChfdGhpcy5yZXNvbHZlLCBfdGhpcyk7XHJcbiAgICAgICAgICAgIHByb21pc2VzLmZvckVhY2goZnVuY3Rpb24gKHByb21pc2UpIHsgcmV0dXJuIHByb21pc2UudGhlbihyZXNvbHZlLCByZWplY3QpOyB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaGVzIGNhbGxiYWNrcyBmb3IgdGhlIHJlc29sdXRpb24gYW5kL29yIHJlamVjdGlvbiBvZiB0aGUgUHJvbWlzZS5cclxuICAgICAqIEBwYXJhbSBvbmZ1bGZpbGxlZCBUaGUgY2FsbGJhY2sgdG8gZXhlY3V0ZSB3aGVuIHRoZSBQcm9taXNlIGlzIHJlc29sdmVkLlxyXG4gICAgICogQHBhcmFtIG9ucmVqZWN0ZWQgVGhlIGNhbGxiYWNrIHRvIGV4ZWN1dGUgd2hlbiB0aGUgUHJvbWlzZSBpcyByZWplY3RlZC5cclxuICAgICAqIEByZXR1cm5zIEEgUHJvbWlzZSBmb3IgdGhlIGNvbXBsZXRpb24gb2Ygd2hpY2ggZXZlciBjYWxsYmFjayBpcyBleGVjdXRlZC5cclxuICAgICAqL1xyXG4gICAgUHJvbWlzZS5wcm90b3R5cGUudGhlbiA9IGZ1bmN0aW9uIChvbmZ1bGZpbGxlZCwgb25yZWplY3RlZCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hd2FpdChvbmZ1bGZpbGxlZCwgb25yZWplY3RlZCk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2hlcyBhIGNhbGxiYWNrIGZvciBvbmx5IHRoZSByZWplY3Rpb24gb2YgdGhlIFByb21pc2UuXHJcbiAgICAgKiBAcGFyYW0gb25yZWplY3RlZCBUaGUgY2FsbGJhY2sgdG8gZXhlY3V0ZSB3aGVuIHRoZSBQcm9taXNlIGlzIHJlamVjdGVkLlxyXG4gICAgICogQHJldHVybnMgQSBQcm9taXNlIGZvciB0aGUgY29tcGxldGlvbiBvZiB0aGUgY2FsbGJhY2suXHJcbiAgICAgKi9cclxuICAgIFByb21pc2UucHJvdG90eXBlLmNhdGNoID0gZnVuY3Rpb24gKG9ucmVqZWN0ZWQpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fYXdhaXQodW5kZWZpbmVkLCBvbnJlamVjdGVkKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaGVzIGEgY2FsbGJhY2sgZm9yIHRoYXQgaXMgZXhlY3V0ZWQgcmVnYXJkbGVzcyBvZiB0aGUgcmVzb2x1dGlvbiBvciByZWplY3Rpb24gb2YgdGhlIHByb21pc2UuXHJcbiAgICAgKiBAcGFyYW0gb25zZXR0bGVkIFRoZSBjYWxsYmFjayB0byBleGVjdXRlIHdoZW4gdGhlIFByb21pc2UgaXMgc2V0dGxlZC5cclxuICAgICAqIEByZXR1cm5zIEEgUHJvbWlzZSBmb3IgdGhlIGNvbXBsZXRpb24gb2YgdGhlIGNhbGxiYWNrLlxyXG4gICAgICovXHJcbiAgICBQcm9taXNlLnByb3RvdHlwZS5maW5hbGx5ID0gZnVuY3Rpb24gKG9uc2V0dGxlZCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hd2FpdChmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJldHVybiByZXNvbHZlKG9uc2V0dGxlZCgpKTsgfSkudGhlbihmdW5jdGlvbiAoKSB7IHJldHVybiBQcm9taXNlLnJlc29sdmUodmFsdWUpOyB9KTsgfSwgZnVuY3Rpb24gKHJlYXNvbikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmV0dXJuIHJlc29sdmUob25zZXR0bGVkKCkpOyB9KS50aGVuKGZ1bmN0aW9uICgpIHsgcmV0dXJuIFByb21pc2UucmVqZWN0KHJlYXNvbik7IH0pOyB9KTtcclxuICAgIH07XHJcbiAgICBQcm9taXNlLnByb3RvdHlwZS5fcmVzb2x2ZSA9IGZ1bmN0aW9uIChyZWplY3RpbmcsIHJlc3VsdCkge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKVxyXG4gICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgIGlmICghcmVqZWN0aW5nKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcyA9PT0gcmVzdWx0KVxyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVzb2x2ZSBhIHByb21pc2Ugd2l0aCBpdHNlbGZcIik7XHJcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICE9PSBudWxsICYmICh0eXBlb2YgcmVzdWx0ID09PSBcIm9iamVjdFwiIHx8IHR5cGVvZiByZXN1bHQgPT09IFwiZnVuY3Rpb25cIikgJiYgXCJ0aGVuXCIgaW4gcmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRoZW4gPSByZXN1bHQudGhlbjtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoZW4gPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVzb2x2ZSA9IGZ1bmN0aW9uIChyZWplY3RpbmcsIHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fcmVzb2x2ZShyZWplY3RpbmcsIHJlc3VsdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGVuLmNhbGwocmVzdWx0LCBmdW5jdGlvbiAocmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSAmJiByZXNvbHZlKGZhbHNlLCByZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUgJiYgcmVzb2x2ZSh0cnVlLCByZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gZXJyb3I7XHJcbiAgICAgICAgICAgICAgICByZWplY3RpbmcgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX3NldHRsZShyZWplY3RpbmcsIHJlc3VsdCk7XHJcbiAgICB9O1xyXG4gICAgUHJvbWlzZS5wcm90b3R5cGUuX2F3YWl0ID0gZnVuY3Rpb24gKG9ucmVzb2x2ZWQsIG9ucmVqZWN0ZWQpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHZhciBpZCA9IGhhc01zRGVidWcgJiYgRGVidWcubXNUcmFjZUFzeW5jT3BlcmF0aW9uU3RhcnRpbmcoXCJQcm9taXNlLnRoZW5cIik7XHJcbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgdmFyIHByZXYgPSBfdGhpcy5fc2V0dGxlO1xyXG4gICAgICAgICAgICBfdGhpcy5fc2V0dGxlID0gZnVuY3Rpb24gKHJlamVjdGluZywgcmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICBfdGhpcy5fZm9yd2FyZChwcmV2LCByZXNvbHZlLCByZWplY3QsIHJlamVjdGluZywgcmVzdWx0LCBvbnJlc29sdmVkLCBvbnJlamVjdGVkLCBpZCk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgUHJvbWlzZS5wcm90b3R5cGUuX3NldHRsZSA9IGZ1bmN0aW9uIChyZWplY3RpbmcsIHJlc3VsdCkge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgdGhpcy5fc2V0dGxlID0gbnVsbDtcclxuICAgICAgICB0aGlzLl9hd2FpdCA9IGZ1bmN0aW9uIChvbmZ1bGZpbGxlZCwgb25yZWplY3RlZCkge1xyXG4gICAgICAgICAgICB2YXIgaWQgPSBoYXNNc0RlYnVnICYmIERlYnVnLm1zVHJhY2VBc3luY09wZXJhdGlvblN0YXJ0aW5nKFwiUHJvbWlzZS50aGVuXCIpO1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IF90aGlzLmNvbnN0cnVjdG9yKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgICAgIF90aGlzLl9mb3J3YXJkKG51bGwsIHJlc29sdmUsIHJlamVjdCwgcmVqZWN0aW5nLCByZXN1bHQsIG9uZnVsZmlsbGVkLCBvbnJlamVjdGVkLCBpZCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH07XHJcbiAgICB9O1xyXG4gICAgUHJvbWlzZS5wcm90b3R5cGUuX2ZvcndhcmQgPSBmdW5jdGlvbiAocHJldiwgcmVzb2x2ZSwgcmVqZWN0LCByZWplY3RpbmcsIHJlc3VsdCwgb25yZXNvbHZlZCwgb25yZWplY3RlZCwgaWQpIHtcclxuICAgICAgICBwcmV2ICYmIHByZXYuY2FsbCh0aGlzLCByZWplY3RpbmcsIHJlc3VsdCk7XHJcbiAgICAgICAgc2NoZWR1bGVUYXNrKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKVxyXG4gICAgICAgICAgICAgICAgRGVidWcuc2V0Tm9uVXNlckNvZGVFeGNlcHRpb25zID0gdHJ1ZTtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHZhciBoYW5kbGVyID0gcmVqZWN0aW5nID8gb25yZWplY3RlZCA6IG9ucmVzb2x2ZWQ7XHJcbiAgICAgICAgICAgICAgICBoYXNNc0RlYnVnICYmIERlYnVnLm1zVHJhY2VBc3luY09wZXJhdGlvbkNvbXBsZXRlZChpZCwgcmVqZWN0aW5nID8gRGVidWcuTVNfQVNZTkNfT1BfU1RBVFVTX0VSUk9SIDogRGVidWcuTVNfQVNZTkNfT1BfU1RBVFVTX1NVQ0NFU1MpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICBoYXNNc0RlYnVnICYmIERlYnVnLm1zVHJhY2VBc3luY0NhbGxiYWNrU3RhcnRpbmcoaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGhhbmRsZXIocmVzdWx0KTtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3RpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gZTtcclxuICAgICAgICAgICAgICAgIHJlamVjdGluZyA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZmluYWxseSB7XHJcbiAgICAgICAgICAgICAgICBoYXNNc0RlYnVnICYmIERlYnVnLm1zVHJhY2VBc3luY0NhbGxiYWNrQ29tcGxldGVkKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgKHJlamVjdGluZyA/IHJlamVjdCA6IHJlc29sdmUpKHJlc3VsdCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIFByb21pc2U7XHJcbn0pKCk7XHJcbmV4cG9ydHMuUHJvbWlzZSA9IFByb21pc2U7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGU6Ly8vQ3wvZGV2L2FzeW5janMvcHJvbWlzZS5qcy5tYXAiLCJmdW5jdGlvbiBzY2hlZHVsZVRhc2sodGFzaykge1xyXG4gICAgaWYgKCFxdWV1ZSkge1xyXG4gICAgICAgIHF1ZXVlID0ge307XHJcbiAgICB9XHJcbiAgICB2YXIgbm9kZSA9IHsgdGFzazogdGFzayB9O1xyXG4gICAgZW5xdWV1ZVRhc2socXVldWUsIG5vZGUpO1xyXG4gICAgc2NoZWR1bGVUaWNrKCk7XHJcbiAgICByZXR1cm4gbm9kZTtcclxufVxyXG5leHBvcnRzLnNjaGVkdWxlVGFzayA9IHNjaGVkdWxlVGFzaztcclxuZnVuY3Rpb24gY2FuY2VsVGFzayhoYW5kbGUpIHtcclxuICAgIGlmICghaGFuZGxlKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdmFyIG5vZGUgPSBoYW5kbGU7XHJcbiAgICBpZiAobm9kZS5xdWV1ZSA9PT0gcmVjb3ZlcnlRdWV1ZSB8fCBub2RlLnF1ZXVlID09PSBxdWV1ZSkge1xyXG4gICAgICAgIHJlbW92ZVRhc2sobm9kZS5xdWV1ZSwgbm9kZSk7XHJcbiAgICB9XHJcbiAgICBpZiAocmVjb3ZlcnlRdWV1ZSAmJiAhcmVjb3ZlcnlRdWV1ZS5oZWFkKSB7XHJcbiAgICAgICAgcmVjb3ZlcnlRdWV1ZSA9IHVuZGVmaW5lZDtcclxuICAgIH1cclxuICAgIGlmIChxdWV1ZSAmJiAhcXVldWUuaGVhZCkge1xyXG4gICAgICAgIHF1ZXVlID0gdW5kZWZpbmVkO1xyXG4gICAgfVxyXG4gICAgaWYgKCFyZWNvdmVyeVF1ZXVlICYmICFxdWV1ZSkge1xyXG4gICAgICAgIGNhbmNlbFRpY2soKTtcclxuICAgIH1cclxufVxyXG5leHBvcnRzLmNhbmNlbFRhc2sgPSBjYW5jZWxUYXNrO1xyXG52YXIgc2NoZWR1bGVyO1xyXG52YXIgaGFuZGxlO1xyXG52YXIgcmVjb3ZlcnlRdWV1ZTtcclxudmFyIHF1ZXVlO1xyXG5mdW5jdGlvbiBzY2hlZHVsZVRpY2soKSB7XHJcbiAgICBpZiAoaGFuZGxlICE9PSB2b2lkIDApIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZiAoIXNjaGVkdWxlcikge1xyXG4gICAgICAgIHNjaGVkdWxlciA9IGdldFNjaGVkdWxlcigpO1xyXG4gICAgfVxyXG4gICAgaGFuZGxlID0gc2NoZWR1bGVyLnNjaGVkdWxlVGljayhvblRpY2spO1xyXG59XHJcbmZ1bmN0aW9uIGNhbmNlbFRpY2soKSB7XHJcbiAgICBpZiAoaGFuZGxlID09PSB2b2lkIDAgfHwgIXNjaGVkdWxlcikge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHNjaGVkdWxlci5jYW5jZWxUaWNrKGhhbmRsZSk7XHJcbiAgICBoYW5kbGUgPSB1bmRlZmluZWQ7XHJcbn1cclxuZnVuY3Rpb24gb25UaWNrKCkge1xyXG4gICAgaGFuZGxlID0gdW5kZWZpbmVkO1xyXG4gICAgcHJvY2Vzc1F1ZXVlKHJlY292ZXJ5UXVldWUpO1xyXG4gICAgcmVjb3ZlcnlRdWV1ZSA9IHF1ZXVlO1xyXG4gICAgcXVldWUgPSB1bmRlZmluZWQ7XHJcbiAgICBwcm9jZXNzUXVldWUocmVjb3ZlcnlRdWV1ZSk7XHJcbiAgICByZWNvdmVyeVF1ZXVlID0gdW5kZWZpbmVkO1xyXG59XHJcbmZ1bmN0aW9uIHByb2Nlc3NRdWV1ZShxdWV1ZSkge1xyXG4gICAgaWYgKCFxdWV1ZSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHZhciBub2RlO1xyXG4gICAgdmFyIHRhc2tDb21wbGV0ZWQgPSBmYWxzZTtcclxuICAgIHdoaWxlIChub2RlID0gZGVxdWV1ZVRhc2socXVldWUpKSB7XHJcbiAgICAgICAgdmFyIHRhc2sgPSBub2RlLnRhc2s7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgdGFzaygpO1xyXG4gICAgICAgICAgICB0YXNrQ29tcGxldGVkID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZmluYWxseSB7XHJcbiAgICAgICAgICAgIGlmICghdGFza0NvbXBsZXRlZCkge1xyXG4gICAgICAgICAgICAgICAgc2NoZWR1bGVUaWNrKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuZnVuY3Rpb24gZW5xdWV1ZVRhc2socXVldWUsIG5vZGUpIHtcclxuICAgIG5vZGUucHJldmlvdXMgPSBxdWV1ZS50YWlsO1xyXG4gICAgbm9kZS5xdWV1ZSA9IHF1ZXVlO1xyXG4gICAgaWYgKHF1ZXVlLnRhaWwpIHtcclxuICAgICAgICBxdWV1ZS50YWlsLm5leHQgPSBub2RlO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgcXVldWUuaGVhZCA9IG5vZGU7XHJcbiAgICB9XHJcbiAgICBxdWV1ZS50YWlsID0gbm9kZTtcclxufVxyXG5mdW5jdGlvbiBkZXF1ZXVlVGFzayhxdWV1ZSkge1xyXG4gICAgaWYgKCFxdWV1ZSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHZhciBub2RlID0gcXVldWUudGFpbDtcclxuICAgIGlmIChub2RlKSB7XHJcbiAgICAgICAgcmVtb3ZlVGFzayhxdWV1ZSwgbm9kZSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbm9kZTtcclxufVxyXG5mdW5jdGlvbiByZW1vdmVUYXNrKHF1ZXVlLCBub2RlKSB7XHJcbiAgICBpZiAoIXF1ZXVlKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgaWYgKG5vZGUubmV4dCkge1xyXG4gICAgICAgIG5vZGUubmV4dC5wcmV2aW91cyA9IG5vZGUucHJldmlvdXM7XHJcbiAgICB9XHJcbiAgICBpZiAobm9kZS5wcmV2aW91cykge1xyXG4gICAgICAgIG5vZGUucHJldmlvdXMubmV4dCA9IG5vZGUubmV4dDtcclxuICAgIH1cclxuICAgIGlmIChub2RlID09PSBxdWV1ZS50YWlsKSB7XHJcbiAgICAgICAgcXVldWUudGFpbCA9IG5vZGUucHJldmlvdXM7XHJcbiAgICB9XHJcbiAgICBpZiAobm9kZSA9PT0gcXVldWUuaGVhZCkge1xyXG4gICAgICAgIHF1ZXVlLmhlYWQgPSBub2RlLm5leHQ7XHJcbiAgICB9XHJcbiAgICBub2RlLm5leHQgPSB1bmRlZmluZWQ7XHJcbiAgICBub2RlLnByZXZpb3VzID0gdW5kZWZpbmVkO1xyXG4gICAgbm9kZS5xdWV1ZSA9IHVuZGVmaW5lZDtcclxufVxyXG5mdW5jdGlvbiBnZXRTY2hlZHVsZXIoKSB7XHJcbiAgICBpZiAodHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldFNldEltbWVkaWF0ZVNjaGVkdWxlcigpO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAodHlwZW9mIG1zU2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICByZXR1cm4gZ2V0TVNTZXRJbW1lZGlhdGVTY2hlZHVsZXIoKTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKHR5cGVvZiBwcm9jZXNzID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBwcm9jZXNzLm5leHRUaWNrID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICByZXR1cm4gZ2V0TmV4dFRpY2tTY2hlZHVsZXIoKTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICByZXR1cm4gZ2V0U2V0VGltZW91dFNjaGVkdWxlcigpO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIGdldE1pc3NpbmdTY2hlZHVsZXIoKTtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGdldFNldEltbWVkaWF0ZVNjaGVkdWxlcigpIHtcclxuICAgICAgICByZXR1cm4geyBzY2hlZHVsZVRpY2s6IHNjaGVkdWxlVGljaywgY2FuY2VsVGljazogY2FuY2VsVGljayB9O1xyXG4gICAgICAgIGZ1bmN0aW9uIHNjaGVkdWxlVGljayhjYWxsYmFjaykge1xyXG4gICAgICAgICAgICByZXR1cm4gc2V0SW1tZWRpYXRlKGNhbGxiYWNrKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZnVuY3Rpb24gY2FuY2VsVGljayhoYW5kbGUpIHtcclxuICAgICAgICAgICAgY2xlYXJJbW1lZGlhdGUoaGFuZGxlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBnZXRNU1NldEltbWVkaWF0ZVNjaGVkdWxlcigpIHtcclxuICAgICAgICByZXR1cm4geyBzY2hlZHVsZVRpY2s6IHNjaGVkdWxlVGljaywgY2FuY2VsVGljazogY2FuY2VsVGljayB9O1xyXG4gICAgICAgIGZ1bmN0aW9uIHNjaGVkdWxlVGljayhjYWxsYmFjaykge1xyXG4gICAgICAgICAgICByZXR1cm4gbXNTZXRJbW1lZGlhdGUoY2FsbGJhY2spO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmdW5jdGlvbiBjYW5jZWxUaWNrKGhhbmRsZSkge1xyXG4gICAgICAgICAgICBtc0NsZWFySW1tZWRpYXRlKGhhbmRsZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gZ2V0TmV4dFRpY2tTY2hlZHVsZXIoKSB7XHJcbiAgICAgICAgdmFyIG5leHRIYW5kbGUgPSAxO1xyXG4gICAgICAgIHJldHVybiB7IHNjaGVkdWxlVGljazogc2NoZWR1bGVUaWNrLCBjYW5jZWxUaWNrOiBjYW5jZWxUaWNrIH07XHJcbiAgICAgICAgZnVuY3Rpb24gc2NoZWR1bGVUaWNrKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgIHZhciBoYW5kbGUgPSB7IGNhbmNlbGVkOiBmYWxzZSB9O1xyXG4gICAgICAgICAgICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGlmIChoYW5kbGUuY2FuY2VsZWQpXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiBoYW5kbGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZ1bmN0aW9uIGNhbmNlbFRpY2soaGFuZGxlKSB7XHJcbiAgICAgICAgICAgIGlmIChoYW5kbGUpXHJcbiAgICAgICAgICAgICAgICBoYW5kbGUuY2FuY2VsZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGdldFNldFRpbWVvdXRTY2hlZHVsZXIoKSB7XHJcbiAgICAgICAgcmV0dXJuIHsgc2NoZWR1bGVUaWNrOiBzY2hlZHVsZVRpY2ssIGNhbmNlbFRpY2s6IGNhbmNlbFRpY2sgfTtcclxuICAgICAgICBmdW5jdGlvbiBzY2hlZHVsZVRpY2soY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoY2FsbGJhY2ssIDApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmdW5jdGlvbiBjYW5jZWxUaWNrKGhhbmRsZSkge1xyXG4gICAgICAgICAgICBjbGVhclRpbWVvdXQoaGFuZGxlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBnZXRNaXNzaW5nU2NoZWR1bGVyKCkge1xyXG4gICAgICAgIHJldHVybiB7IHNjaGVkdWxlVGljazogc2NoZWR1bGVUaWNrLCBjYW5jZWxUaWNrOiBjYW5jZWxUaWNrIH07XHJcbiAgICAgICAgZnVuY3Rpb24gc2NoZWR1bGVUaWNrKCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJTY2hlZHVsZXIgbm90IGF2YWlsYWJsZS5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZ1bmN0aW9uIGNhbmNlbFRpY2soKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlNjaGVkdWxlciBub3QgYXZhaWxhYmxlLlwiKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy90YXNrLmpzLm1hcCIsInZhciBwcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XHJcbnZhciB0YXNrID0gcmVxdWlyZSgnLi90YXNrJyk7XHJcbnZhciBQcm9taXNlID0gcHJvbWlzZS5Qcm9taXNlO1xyXG52YXIgc2NoZWR1bGVUYXNrID0gdGFzay5zY2hlZHVsZVRhc2s7XHJcbnZhciBjYW5jZWxUYXNrID0gdGFzay5jYW5jZWxUYXNrO1xyXG5mdW5jdGlvbiBzbGVlcChkZWxheSwgdG9rZW4pIHtcclxuICAgIGlmIChkZWxheSA9PT0gdm9pZCAwKSB7IGRlbGF5ID0gMDsgfVxyXG4gICAgaWYgKHR5cGVvZiBkZWxheSAhPT0gXCJudW1iZXJcIikge1xyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJOdW1iZXIgZXhwZWN0ZWQuXCIpO1xyXG4gICAgfVxyXG4gICAgaWYgKHRva2VuICYmIHRva2VuLmNhbmNlbGVkKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KHRva2VuLnJlYXNvbik7XHJcbiAgICB9XHJcbiAgICB2YXIgc2NoZWR1bGU7XHJcbiAgICB2YXIgY2FuY2VsO1xyXG4gICAgaWYgKGRlbGF5IDw9IDApIHtcclxuICAgICAgICBzY2hlZHVsZSA9IHNjaGVkdWxlVGFzaztcclxuICAgICAgICBjYW5jZWwgPSBjYW5jZWxUYXNrO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgc2NoZWR1bGUgPSBmdW5jdGlvbiAodGFzaykgeyByZXR1cm4gc2V0VGltZW91dCh0YXNrLCBkZWxheSk7IH07XHJcbiAgICAgICAgY2FuY2VsID0gY2xlYXJUaW1lb3V0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICB2YXIgcmVnaXN0cmF0aW9uO1xyXG4gICAgICAgIHZhciBoYW5kbGUgPSBzY2hlZHVsZShmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChyZWdpc3RyYXRpb24pIHtcclxuICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi51bnJlZ2lzdGVyKCk7XHJcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGlmICh0b2tlbikge1xyXG4gICAgICAgICAgICByZWdpc3RyYXRpb24gPSB0b2tlbi5yZWdpc3RlcihmdW5jdGlvbiAocmVhc29uKSB7XHJcbiAgICAgICAgICAgICAgICBjYW5jZWwoaGFuZGxlKTtcclxuICAgICAgICAgICAgICAgIGhhbmRsZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgICAgIHJlamVjdChyZWFzb24pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxufVxyXG5leHBvcnRzLnNsZWVwID0gc2xlZXA7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGU6Ly8vQ3wvZGV2L2FzeW5janMvdXRpbHMuanMubWFwIl19
