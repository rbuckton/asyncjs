!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Promise=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
var promise_1 = require('./promise');
exports.Promise = promise_1.Promise;
var deferred_1 = require('./deferred');
exports.Deferred = deferred_1.Deferred;
var cancellation_1 = require('./cancellation');
exports.CancellationToken = cancellation_1.CancellationToken;
exports.CancellationTokenSource = cancellation_1.CancellationTokenSource;
var utils_1 = require('./utils');
exports.sleep = utils_1.sleep;
//# sourceMappingURL=file:///C|/dev/asyncjs/async.js.map
},{"./cancellation":undefined,"./deferred":undefined,"./promise":undefined,"./utils":undefined}],2:[function(require,module,exports){
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
var list_1 = require('./list');
var hasMsNonUserCodeExceptions = typeof Debug !== "undefined" &&
    typeof Debug.setNonUserCodeExceptions === "boolean";
/**
  * A source for cancellation
  */
var CancellationTokenSource = (function () {
    /**
      * @param links Other `CancellationToken` instances that will cancel this source if the tokens are canceled.
      */
    function CancellationTokenSource(links) {
        var _this = this;
        this._token = new CancellationToken(this);
        Object.defineProperty(this, "_token", { writable: false, configurable: false });
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
                    _this.cancel(reason);
                }));
            }
        }
    }
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
        if (reason == null) {
            reason = new Error("operation was canceled.");
        }
        if (reason instanceof Error && !("stack" in reason)) {
            if (hasMsNonUserCodeExceptions) {
                Debug.setNonUserCodeExceptions = true;
            }
            try {
                throw reason;
            }
            catch (error) {
                reason = error;
            }
        }
        var callbacks = this._callbacks;
        this._canceled = true;
        this._reason = reason;
        this._callbacks = null;
        Object.freeze(this);
        if (callbacks) {
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
    /**
     * Closes the CancellationSource, preventing any future cancellation signal.
     */
    CancellationTokenSource.prototype.close = function () {
        if (Object.isFrozen(this)) {
            return;
        }
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
    CancellationTokenSource.prototype._register = function (callback) {
        if (this._canceled) {
            callback(this._reason);
            return emptyRegistration;
        }
        if (Object.isFrozen(this)) {
            return emptyRegistration;
        }
        var callbacks = this._callbacks;
        if (!callbacks) {
            callbacks = new list_1.LinkedList();
            this._callbacks = callbacks;
        }
        var cookie = callbacks.addLast(callback);
        return Object.freeze({
            unregister: function () {
                callbacks.deleteNode(cookie);
            }
        });
    };
    CancellationTokenSource.prototype._throwIfFrozen = function () {
        if (Object.isFrozen(this)) {
            throw new Error("cannot modify a closed source");
        }
    };
    return CancellationTokenSource;
})();
exports.CancellationTokenSource = CancellationTokenSource;
/**
  * A token used to recieve a cancellation signal.
  */
var CancellationToken = (function () {
    /*@internal*/
    function CancellationToken(source) {
        this._source = source;
        Object.freeze(this);
    }
    Object.defineProperty(CancellationToken, "none", {
        /**
          * Gets an empty cancellation token that will never be canceled.
          */
        get: function () {
            if (!CancellationToken._none) {
                CancellationToken._none = new CancellationToken(undefined);
            }
            return CancellationToken._none;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CancellationToken.prototype, "canBeCanceled", {
        /**
          * Gets a value indicating whether the token can be canceled.
          */
        get: function () {
            return !!this._source && !Object.isFrozen(this._source);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CancellationToken.prototype, "canceled", {
        /**
          * Gets a value indicating whether the token has received a cancellation signal.
          */
        get: function () {
            if (!this._source) {
                return false;
            }
            return this._source._canceled;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CancellationToken.prototype, "reason", {
        /**
          * Gets the reason for cancellation, if one was supplied.
          */
        get: function () {
            if (!this._source) {
                return undefined;
            }
            return this._source._reason;
        },
        enumerable: true,
        configurable: true
    });
    /**
      * Throws an `Error` if the token has received a cancellation signal.
      */
    CancellationToken.prototype.throwIfCanceled = function (reason) {
        if (reason === void 0) { reason = this.reason; }
        if (!this._source) {
            return;
        }
        if (this.canceled) {
            throw reason;
        }
    };
    /**
      * Requests a callback when the token receives a cancellation signal to perform additional cleanup.
      * @param callback The callback to execute
      * @returns A `CancellationTokenRegistration` that that can be used to cancel the cleanup request.
      */
    CancellationToken.prototype.register = function (callback) {
        if (typeof callback !== "function") {
            throw new TypeError("Argument is not a Function object");
        }
        if (!this._source) {
            return emptyRegistration;
        }
        return this._source._register(callback);
    };
    return CancellationToken;
})();
exports.CancellationToken = CancellationToken;
var emptyRegistration = Object.freeze({ unregister: function () { } });
//# sourceMappingURL=file:///C|/dev/asyncjs/cancellation.js.map
},{"./list":undefined}],3:[function(require,module,exports){
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
var promise_1 = require('./promise');
var Deferred = (function () {
    function Deferred() {
        var _this = this;
        this._promise = new promise_1.Promise(function (resolve, reject) {
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
var promise_1 = require('./promise');
var cancellation_1 = require('./cancellation');
var hasMsNonUserCodeExceptions = typeof Debug !== "undefined" &&
    typeof Debug.setNonUserCodeExceptions === "boolean";
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
        this._cts = new cancellation_1.CancellationTokenSource();
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
        return new promise_1.Promise(function (resolve, reject) {
            // create a linked token
            var cts = new cancellation_1.CancellationTokenSource([_this._cts.token, token]);
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
                    var error = createHttpError(_this, response);
                    reject(error);
                }
            };
            // create the onerror callback
            var onerror = function (ev) {
                if (hasMsNonUserCodeExceptions)
                    Debug.setNonUserCodeExceptions = true;
                cleanup();
                // catch a cancellation and reject the promise
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
                // catch a cancellation and reject the promise
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
                setTimeout(function () { return cts.cancel(new Error("Operation timed out.")); }, _this.timeout);
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
        return new promise_1.Promise(function (resolve, reject) {
            // create a linked token
            var cts = new cancellation_1.CancellationTokenSource([_this._cts.token, token]);
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
                setTimeout(function () { return cts.cancel(new Error("Operation timed out.")); }, _this.timeout);
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
var LinkedListNode = (function () {
    function LinkedListNode(value) {
        this.value = value;
    }
    Object.defineProperty(LinkedListNode.prototype, "list", {
        /** Gets the LinkedList for this node */
        get: function () {
            return this._list;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(LinkedListNode.prototype, "previous", {
        /** Gets the previous node in the list */
        get: function () {
            if (this._previous && this !== this._list.first) {
                return this._previous;
            }
            return undefined;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(LinkedListNode.prototype, "next", {
        /** Gets the next node in the list */
        get: function () {
            if (this._next && this._next !== this._list.first) {
                return this._next;
            }
            return undefined;
        },
        enumerable: true,
        configurable: true
    });
    return LinkedListNode;
})();
exports.LinkedListNode = LinkedListNode;
var LinkedList = (function () {
    function LinkedList() {
    }
    Object.defineProperty(LinkedList.prototype, "first", {
        /** Gets the first node in the list */
        get: function () {
            return this._head;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(LinkedList.prototype, "last", {
        /** Gets the last node in the list */
        get: function () {
            if (this._head) {
                return this._head._previous;
            }
            return undefined;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(LinkedList.prototype, "size", {
        /** Gets the size of the list */
        get: function () {
            return this._size;
        },
        enumerable: true,
        configurable: true
    });
    LinkedList.prototype.addFirst = function (value) {
        var newNode = new LinkedListNode(value);
        if (this.first) {
            this._insert(this.first, newNode);
            this._head = newNode;
        }
        else {
            this._insertEmpty(newNode);
        }
        return newNode;
    };
    LinkedList.prototype.addNodeFirst = function (newNode) {
        this._checkNewNode(newNode);
        if (this.first) {
            this._insert(this.first, newNode);
            this._head = newNode;
        }
        else {
            this._insertEmpty(newNode);
        }
    };
    LinkedList.prototype.addLast = function (value) {
        var newNode = new LinkedListNode(value);
        if (this.first) {
            this._insert(this.first, newNode);
        }
        else {
            this._insertEmpty(newNode);
        }
        return newNode;
    };
    LinkedList.prototype.addNodeLast = function (newNode) {
        this._checkNewNode(newNode);
        if (this.first) {
            this._insert(this.first, newNode);
        }
        else {
            this._insertEmpty(newNode);
        }
    };
    LinkedList.prototype.addBefore = function (node, value) {
        this._checkNode(node);
        var newNode = new LinkedListNode(value);
        this._insert(node, newNode);
        if (this._head === node) {
            this._head = newNode;
        }
        return newNode;
    };
    LinkedList.prototype.addNodeBefore = function (node, newNode) {
        this._checkNode(node);
        this._checkNewNode(newNode);
        this._insert(node, newNode);
        if (this._head === node) {
            this._head = newNode;
        }
    };
    LinkedList.prototype.addAfter = function (node, value) {
        this._checkNode(node);
        var newNode = new LinkedListNode(value);
        this._insert(node._next, newNode);
        return newNode;
    };
    LinkedList.prototype.addNodeAfter = function (node, newNode) {
        this._checkNode(node);
        this._checkNewNode(newNode);
        this._insert(node._next, newNode);
    };
    LinkedList.prototype.has = function (value) {
        if (this._cache && this._cache.value === value) {
            return true;
        }
        return !!this.find(value);
    };
    LinkedList.prototype.find = function (value) {
        var node = this._head;
        if (node) {
            do {
                if (node.value === value) {
                    this._cache = node;
                    return node;
                }
                node = node._next;
            } while (node !== this._head);
        }
        return undefined;
    };
    LinkedList.prototype.findLast = function (value) {
        var node = this._head;
        if (node) {
            node = node._previous;
            var tail = node;
            do {
                if (node.value === value) {
                    this._cache = node;
                    return node;
                }
                node = node._previous;
            } while (node !== tail);
        }
        return undefined;
    };
    LinkedList.prototype.delete = function (value) {
        var node = this.find(value);
        if (node) {
            this._delete(node);
            return true;
        }
        return false;
    };
    LinkedList.prototype.deleteNode = function (node) {
        this._checkNode(node);
        this._delete(node);
    };
    LinkedList.prototype.deleteFirst = function () {
        if (this._head) {
            this._delete(this._head);
            return true;
        }
        return false;
    };
    LinkedList.prototype.deleteLast = function () {
        if (this._head) {
            this._delete(this._head._previous);
            return true;
        }
        return false;
    };
    LinkedList.prototype.removeFirst = function () {
        var node = this._head;
        if (node) {
            this._delete(node);
            return node.value;
        }
        return undefined;
    };
    LinkedList.prototype.removeLast = function () {
        if (this._head) {
            var node = this._head._previous;
            this._delete(node);
            return node.value;
        }
        return undefined;
    };
    LinkedList.prototype.clear = function () {
        var next = this._head;
        while (next) {
            var node = next;
            next = node._next;
            this._invalidate(node);
            if (next === this._head) {
                break;
            }
        }
        this._cache = undefined;
        this._size = 0;
    };
    LinkedList.prototype.forEach = function (callback) {
        var next = this._head;
        while (next) {
            var node = next;
            next = node._next;
            callback(node.value, node, this);
            if (next === this._head) {
                break;
            }
        }
    };
    LinkedList.prototype._checkNode = function (node) {
        if (!node)
            throw new TypeError("Argument not optional: node");
        if (node.list !== this)
            throw new Error("Wrong list.");
    };
    LinkedList.prototype._checkNewNode = function (newNode) {
        if (!newNode)
            throw new TypeError("Argument not optional: newNode");
        if (newNode.list)
            throw new Error("Node is already attached to a list.");
    };
    LinkedList.prototype._insert = function (node, newNode) {
        newNode._list = this;
        newNode._next = node;
        newNode._previous = node._previous;
        node._previous._next = newNode;
        node._previous = newNode;
        this._cache = newNode;
        this._size++;
    };
    LinkedList.prototype._insertEmpty = function (newNode) {
        newNode._list = this;
        newNode._next = newNode;
        newNode._previous = newNode;
        this._head = newNode;
        this._cache = newNode;
        this._size++;
    };
    LinkedList.prototype._delete = function (node) {
        if (node._next === node) {
            this._head = undefined;
        }
        else {
            node._next._previous = node._previous;
            node._previous._next = node._next;
            if (this._head === node) {
                this._head = node._next;
            }
        }
        this._invalidate(node);
        this._cache = undefined;
        this._size--;
    };
    LinkedList.prototype._invalidate = function (node) {
        node._list = undefined;
        node._next = undefined;
        node._previous = undefined;
    };
    return LinkedList;
})();
exports.LinkedList = LinkedList;
//# sourceMappingURL=file:///C|/dev/asyncjs/list.js.map
},{}],6:[function(require,module,exports){
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
var task_1 = require('./task');
var hasMsDebug = typeof Debug !== "undefined" &&
    typeof Debug.msTraceAsyncOperationStarting === "function" &&
    typeof Debug.msTraceAsyncOperationCompleted === "function" &&
    typeof Debug.msTraceAsyncCallbackStarting === "function" &&
    typeof Debug.msTraceAsyncCallbackCompleted === "function";
var hasMsNonUserCodeExceptions = typeof Debug !== "undefined" &&
    typeof Debug.setNonUserCodeExceptions === "boolean";
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
        if (typeof init !== "function") {
            throw new TypeError("argument is not a Function object");
        }
        if (hasMsNonUserCodeExceptions) {
            Debug.setNonUserCodeExceptions = true;
        }
        var resolver = function (rejecting, result) {
            if (resolver) {
                resolver = null;
                _this._resolve(rejecting, result);
            }
        };
        var resolve = function (value) { return resolver(false, value); };
        var reject = function (reason) { return resolver(true, reason); };
        try {
            init(resolve, reject);
        }
        catch (error) {
            reject(error);
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
            var resolver = function (index) { return function (value) {
                results[index] = value;
                if (--countdown === 0) {
                    resolve(results);
                }
            }; };
            for (var i = 0; i < results.length; i++) {
                _this.resolve(values[i]).then(resolver(i), reject);
            }
        });
    };
    Promise.race = function (values) {
        var _this = this;
        return new this(function (resolve, reject) {
            var promises = values.map(function (value) { return _this.resolve(value); });
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
        return this._await(function (value) { return new Promise(function (resolve) { return resolve(onsettled()); }).then(function () { return value; }); }, function (reason) { return new Promise(function (resolve) { return resolve(onsettled()); }).then(function () { return Promise.reject(reason); }); });
    };
    Promise.prototype._resolve = function (rejecting, result) {
        var _this = this;
        if (!rejecting) {
            if (hasMsNonUserCodeExceptions) {
                Debug.setNonUserCodeExceptions = true;
            }
            try {
                if (this === result) {
                    throw new TypeError("Cannot resolve a promise with itself");
                }
                if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result) {
                    var then = result.then;
                    if (typeof then === "function") {
                        var resolver = function (rejecting, result) {
                            if (resolver) {
                                resolver = null;
                                _this._resolve(rejecting, result);
                            }
                        };
                        var resolve = function (value) { return resolver(false, value); };
                        var reject = function (reason) { return resolver(true, reason); };
                        try {
                            then.call(result, resolve, reject);
                        }
                        catch (error) {
                            reject(error);
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
        var id;
        if (hasMsDebug) {
            Debug.msTraceAsyncOperationStarting("Promise.then");
        }
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
        if (prev) {
            prev.call(this, rejecting, result);
        }
        task_1.scheduleTask(function () {
            if (hasMsNonUserCodeExceptions) {
                Debug.setNonUserCodeExceptions = true;
            }
            if (hasMsDebug) {
                Debug.msTraceAsyncOperationCompleted(id, rejecting ? Debug.MS_ASYNC_OP_STATUS_ERROR : Debug.MS_ASYNC_OP_STATUS_SUCCESS);
            }
            var handler = rejecting ? onrejected : onresolved;
            if (typeof handler === "function") {
                if (hasMsDebug) {
                    Debug.msTraceAsyncCallbackStarting(id);
                }
                try {
                    result = handler(result);
                    rejecting = false;
                }
                catch (e) {
                    result = e;
                    rejecting = true;
                }
                finally {
                    if (hasMsDebug) {
                        Debug.msTraceAsyncCallbackCompleted();
                    }
                }
            }
            (rejecting ? reject : resolve)(result);
        });
    };
    return Promise;
})();
exports.Promise = Promise;
//# sourceMappingURL=file:///C|/dev/asyncjs/promise.js.map
},{"./task":undefined}],7:[function(require,module,exports){
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
var list_1 = require('./list');
var cancellation_1 = require('./cancellation');
function getOrCreateQueue() {
    if (!queue) {
        queue = new list_1.LinkedList();
    }
    return queue;
}
function scheduleImmediateTask(task, token) {
    if (token.canBeCanceled) {
        var registration = token.register(function () {
            if (node.list === recoveryQueue || node.list === queue) {
                node.list.deleteNode(node);
            }
            if (recoveryQueue && !recoveryQueue.first) {
                recoveryQueue = undefined;
            }
            if (queue && !queue.first) {
                queue = undefined;
            }
            if (!recoveryQueue && !queue) {
                cancelTick();
            }
        });
        var node = getOrCreateQueue().addLast(function () {
            registration.unregister();
            registration = undefined;
            if (!token.canceled) {
                task();
            }
        });
    }
    else {
        getOrCreateQueue().addLast(task);
    }
    scheduleTick();
}
function scheduleDelayedTask(task, delay, token) {
    if (token.canBeCanceled) {
        var registration = token.register(function () {
            handle = undefined;
            clearTimeout(handle);
        });
        var handle = setTimeout(function () {
            registration.unregister();
            registration = undefined;
            if (!token.canceled) {
                task();
            }
        }, delay);
    }
    else {
        setTimeout(task, delay);
    }
}
function scheduleTask(task, delay, token) {
    if (delay === void 0) { delay = 0; }
    if (token === void 0) { token = cancellation_1.CancellationToken.none; }
    if (delay > 0) {
        scheduleDelayedTask(task, delay, token);
    }
    else {
        scheduleImmediateTask(task, token);
    }
}
exports.scheduleTask = scheduleTask;
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
    while (node = queue.first) {
        queue.deleteNode(node);
        var task = node.value;
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
function getScheduler() {
    function getSetImmediateScheduler() {
        return {
            scheduleTick: function (callback) {
                return setImmediate(callback);
            },
            cancelTick: function (handle) {
                clearImmediate(handle);
            }
        };
    }
    function getMSSetImmediateScheduler() {
        return {
            scheduleTick: function (callback) {
                return msSetImmediate(callback);
            },
            cancelTick: function (handle) {
                msClearImmediate(handle);
            }
        };
    }
    function getNextTickScheduler() {
        var queue = new list_1.LinkedList();
        function ontick() {
            var node = queue.first;
            if (node) {
                queue.deleteFirst();
                var callback = node.value;
                callback();
            }
        }
        return {
            scheduleTick: function (callback) {
                var handle = queue.addLast(callback);
                process.nextTick(ontick);
                return handle;
            },
            cancelTick: function (handle) {
                if (handle && handle.list === queue) {
                    queue.deleteNode(handle);
                }
            }
        };
    }
    function getMessageChannelScheduler() {
        var queue = new list_1.LinkedList();
        var channel = new MessageChannel();
        channel.port2.onmessage = function () {
            var node = queue.first;
            if (node) {
                queue.deleteFirst();
                var callback = node.value;
                callback();
            }
        };
        return {
            scheduleTick: function (callback) {
                var handle = queue.addLast(callback);
                channel.port1.postMessage(undefined);
                return handle;
            },
            cancelTick: function (handle) {
                if (handle && handle.list === queue) {
                    queue.deleteNode(handle);
                }
            }
        };
    }
    function getSetTimeoutScheduler() {
        return {
            scheduleTick: function (callback) {
                return setTimeout(callback, 0);
            },
            cancelTick: function (handle) {
                clearTimeout(handle);
            }
        };
    }
    function getMissingScheduler() {
        return {
            scheduleTick: function (callback) {
                throw new Error("Scheduler not available.");
            },
            cancelTick: function (handle) {
                throw new Error("Scheduler not available.");
            }
        };
    }
    if (typeof setImmediate === "function") {
        return getSetImmediateScheduler();
    }
    else if (typeof msSetImmediate === "function") {
        return getMSSetImmediateScheduler();
    }
    else if (typeof MessageChannel === "function") {
        return getMessageChannelScheduler();
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
}
//# sourceMappingURL=file:///C|/dev/asyncjs/task.js.map
},{"./cancellation":undefined,"./list":undefined}],8:[function(require,module,exports){
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
var promise_1 = require('./promise');
var cancellation_1 = require('./cancellation');
var task_1 = require('./task');
function sleep(delay, token) {
    if (delay === void 0) { delay = 0; }
    if (token === void 0) { token = cancellation_1.CancellationToken.none; }
    if (typeof delay !== "number") {
        throw new TypeError("Number expected.");
    }
    if (token.canceled) {
        return promise_1.Promise.reject(token.reason);
    }
    if (!token.canBeCanceled && delay <= 0) {
        return promise_1.Promise.resolve();
    }
    return new promise_1.Promise(function (resolve, reject) {
        token.register(reject);
        task_1.scheduleTask(resolve, delay, token);
    });
}
exports.sleep = sleep;
//# sourceMappingURL=file:///C|/dev/asyncjs/utils.js.map
},{"./cancellation":undefined,"./promise":undefined,"./task":undefined}]},{},[5,7,6,3,2,8,4,1])(8)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwibGliXFxhc3luYy5qcyIsImxpYlxcY2FuY2VsbGF0aW9uLmpzIiwibGliXFxkZWZlcnJlZC5qcyIsImxpYlxcaHR0cGNsaWVudC5qcyIsImxpYlxcbGlzdC5qcyIsImxpYlxccHJvbWlzZS5qcyIsImxpYlxcdGFzay5qcyIsImxpYlxcdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdE9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2ekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMU9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyohICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoQykgUm9uIEEuIEJ1Y2t0b24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7IHlvdSBtYXkgbm90IHVzZVxyXG50aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS4gWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZVxyXG5MaWNlbnNlIGF0IGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxyXG5cclxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxyXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXHJcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxyXG5cclxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxudmFyIHByb21pc2VfMSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xyXG5leHBvcnRzLlByb21pc2UgPSBwcm9taXNlXzEuUHJvbWlzZTtcclxudmFyIGRlZmVycmVkXzEgPSByZXF1aXJlKCcuL2RlZmVycmVkJyk7XHJcbmV4cG9ydHMuRGVmZXJyZWQgPSBkZWZlcnJlZF8xLkRlZmVycmVkO1xyXG52YXIgY2FuY2VsbGF0aW9uXzEgPSByZXF1aXJlKCcuL2NhbmNlbGxhdGlvbicpO1xyXG5leHBvcnRzLkNhbmNlbGxhdGlvblRva2VuID0gY2FuY2VsbGF0aW9uXzEuQ2FuY2VsbGF0aW9uVG9rZW47XHJcbmV4cG9ydHMuQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgPSBjYW5jZWxsYXRpb25fMS5DYW5jZWxsYXRpb25Ub2tlblNvdXJjZTtcclxudmFyIHV0aWxzXzEgPSByZXF1aXJlKCcuL3V0aWxzJyk7XHJcbmV4cG9ydHMuc2xlZXAgPSB1dGlsc18xLnNsZWVwO1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1maWxlOi8vL0N8L2Rldi9hc3luY2pzL2FzeW5jLmpzLm1hcCIsIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKEMpIFJvbiBBLiBCdWNrdG9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpOyB5b3UgbWF5IG5vdCB1c2VcclxudGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGVcclxuTGljZW5zZSBhdCBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuXHJcblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuXHJcblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbnZhciBsaXN0XzEgPSByZXF1aXJlKCcuL2xpc3QnKTtcclxudmFyIGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zID0gdHlwZW9mIERlYnVnICE9PSBcInVuZGVmaW5lZFwiICYmXHJcbiAgICB0eXBlb2YgRGVidWcuc2V0Tm9uVXNlckNvZGVFeGNlcHRpb25zID09PSBcImJvb2xlYW5cIjtcclxuLyoqXHJcbiAgKiBBIHNvdXJjZSBmb3IgY2FuY2VsbGF0aW9uXHJcbiAgKi9cclxudmFyIENhbmNlbGxhdGlvblRva2VuU291cmNlID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIC8qKlxyXG4gICAgICAqIEBwYXJhbSBsaW5rcyBPdGhlciBgQ2FuY2VsbGF0aW9uVG9rZW5gIGluc3RhbmNlcyB0aGF0IHdpbGwgY2FuY2VsIHRoaXMgc291cmNlIGlmIHRoZSB0b2tlbnMgYXJlIGNhbmNlbGVkLlxyXG4gICAgICAqL1xyXG4gICAgZnVuY3Rpb24gQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UobGlua3MpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHRoaXMuX3Rva2VuID0gbmV3IENhbmNlbGxhdGlvblRva2VuKHRoaXMpO1xyXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIl90b2tlblwiLCB7IHdyaXRhYmxlOiBmYWxzZSwgY29uZmlndXJhYmxlOiBmYWxzZSB9KTtcclxuICAgICAgICBpZiAobGlua3MpIHtcclxuICAgICAgICAgICAgdGhpcy5fbGlua3MgPSBuZXcgQXJyYXkoKTtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaW5rcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIHZhciBsaW5rID0gbGlua3NbaV07XHJcbiAgICAgICAgICAgICAgICBpZiAoIWxpbmspIHtcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChsaW5rLmNhbmNlbGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FuY2VsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlYXNvbiA9IGxpbmsucmVhc29uO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuX2xpbmtzLnB1c2gobGluay5yZWdpc3RlcihmdW5jdGlvbiAocmVhc29uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuY2FuY2VsKHJlYXNvbik7XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UucHJvdG90eXBlLCBcInRva2VuXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSBgQ2FuY2VsbGF0aW9uVG9rZW5gIGZvciB0aGlzIHNvdXJjZS5cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3Rva2VuO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgLyoqXHJcbiAgICAgKiBTaWduYWxzIHRoZSBzb3VyY2UgaXMgY2FuY2VsbGVkLlxyXG4gICAgICogQHBhcmFtIHJlYXNvbiBBbiBvcHRpb25hbCByZWFzb24gZm9yIHRoZSBjYW5jZWxsYXRpb24uXHJcbiAgICAgKi9cclxuICAgIENhbmNlbGxhdGlvblRva2VuU291cmNlLnByb3RvdHlwZS5jYW5jZWwgPSBmdW5jdGlvbiAocmVhc29uKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2NhbmNlbGVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fdGhyb3dJZkZyb3plbigpO1xyXG4gICAgICAgIGlmIChyZWFzb24gPT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZWFzb24gPSBuZXcgRXJyb3IoXCJvcGVyYXRpb24gd2FzIGNhbmNlbGVkLlwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHJlYXNvbiBpbnN0YW5jZW9mIEVycm9yICYmICEoXCJzdGFja1wiIGluIHJlYXNvbikpIHtcclxuICAgICAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyByZWFzb247XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICByZWFzb24gPSBlcnJvcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzO1xyXG4gICAgICAgIHRoaXMuX2NhbmNlbGVkID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLl9yZWFzb24gPSByZWFzb247XHJcbiAgICAgICAgdGhpcy5fY2FsbGJhY2tzID0gbnVsbDtcclxuICAgICAgICBPYmplY3QuZnJlZXplKHRoaXMpO1xyXG4gICAgICAgIGlmIChjYWxsYmFja3MpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrcy5mb3JFYWNoKGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHJlYXNvbik7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBmaW5hbGx5IHtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrcy5jbGVhcigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQ2xvc2VzIHRoZSBDYW5jZWxsYXRpb25Tb3VyY2UsIHByZXZlbnRpbmcgYW55IGZ1dHVyZSBjYW5jZWxsYXRpb24gc2lnbmFsLlxyXG4gICAgICovXHJcbiAgICBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKE9iamVjdC5pc0Zyb3plbih0aGlzKSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLl9saW5rcykge1xyXG4gICAgICAgICAgICB2YXIgbGlua3MgPSB0aGlzLl9saW5rcztcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaW5rcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGxpbmtzW2ldLnVucmVnaXN0ZXIoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5fY2FsbGJhY2tzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrcy5jbGVhcigpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9saW5rcyA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5fY2FsbGJhY2tzID0gbnVsbDtcclxuICAgICAgICBPYmplY3QuZnJlZXplKHRoaXMpO1xyXG4gICAgfTtcclxuICAgIENhbmNlbGxhdGlvblRva2VuU291cmNlLnByb3RvdHlwZS5fcmVnaXN0ZXIgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICBpZiAodGhpcy5fY2FuY2VsZWQpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2sodGhpcy5fcmVhc29uKTtcclxuICAgICAgICAgICAgcmV0dXJuIGVtcHR5UmVnaXN0cmF0aW9uO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoT2JqZWN0LmlzRnJvemVuKHRoaXMpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlbXB0eVJlZ2lzdHJhdGlvbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIGNhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcztcclxuICAgICAgICBpZiAoIWNhbGxiYWNrcykge1xyXG4gICAgICAgICAgICBjYWxsYmFja3MgPSBuZXcgbGlzdF8xLkxpbmtlZExpc3QoKTtcclxuICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tzID0gY2FsbGJhY2tzO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgY29va2llID0gY2FsbGJhY2tzLmFkZExhc3QoY2FsbGJhY2spO1xyXG4gICAgICAgIHJldHVybiBPYmplY3QuZnJlZXplKHtcclxuICAgICAgICAgICAgdW5yZWdpc3RlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzLmRlbGV0ZU5vZGUoY29va2llKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIENhbmNlbGxhdGlvblRva2VuU291cmNlLnByb3RvdHlwZS5fdGhyb3dJZkZyb3plbiA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAoT2JqZWN0LmlzRnJvemVuKHRoaXMpKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhbm5vdCBtb2RpZnkgYSBjbG9zZWQgc291cmNlXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICByZXR1cm4gQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U7XHJcbn0pKCk7XHJcbmV4cG9ydHMuQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgPSBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZTtcclxuLyoqXHJcbiAgKiBBIHRva2VuIHVzZWQgdG8gcmVjaWV2ZSBhIGNhbmNlbGxhdGlvbiBzaWduYWwuXHJcbiAgKi9cclxudmFyIENhbmNlbGxhdGlvblRva2VuID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIC8qQGludGVybmFsKi9cclxuICAgIGZ1bmN0aW9uIENhbmNlbGxhdGlvblRva2VuKHNvdXJjZSkge1xyXG4gICAgICAgIHRoaXMuX3NvdXJjZSA9IHNvdXJjZTtcclxuICAgICAgICBPYmplY3QuZnJlZXplKHRoaXMpO1xyXG4gICAgfVxyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KENhbmNlbGxhdGlvblRva2VuLCBcIm5vbmVcIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAgKiBHZXRzIGFuIGVtcHR5IGNhbmNlbGxhdGlvbiB0b2tlbiB0aGF0IHdpbGwgbmV2ZXIgYmUgY2FuY2VsZWQuXHJcbiAgICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAoIUNhbmNlbGxhdGlvblRva2VuLl9ub25lKSB7XHJcbiAgICAgICAgICAgICAgICBDYW5jZWxsYXRpb25Ub2tlbi5fbm9uZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlbih1bmRlZmluZWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBDYW5jZWxsYXRpb25Ub2tlbi5fbm9uZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDYW5jZWxsYXRpb25Ub2tlbi5wcm90b3R5cGUsIFwiY2FuQmVDYW5jZWxlZFwiLCB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICAqIEdldHMgYSB2YWx1ZSBpbmRpY2F0aW5nIHdoZXRoZXIgdGhlIHRva2VuIGNhbiBiZSBjYW5jZWxlZC5cclxuICAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAhIXRoaXMuX3NvdXJjZSAmJiAhT2JqZWN0LmlzRnJvemVuKHRoaXMuX3NvdXJjZSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ2FuY2VsbGF0aW9uVG9rZW4ucHJvdG90eXBlLCBcImNhbmNlbGVkXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgICogR2V0cyBhIHZhbHVlIGluZGljYXRpbmcgd2hldGhlciB0aGUgdG9rZW4gaGFzIHJlY2VpdmVkIGEgY2FuY2VsbGF0aW9uIHNpZ25hbC5cclxuICAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5fc291cmNlKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3NvdXJjZS5fY2FuY2VsZWQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ2FuY2VsbGF0aW9uVG9rZW4ucHJvdG90eXBlLCBcInJlYXNvblwiLCB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICAqIEdldHMgdGhlIHJlYXNvbiBmb3IgY2FuY2VsbGF0aW9uLCBpZiBvbmUgd2FzIHN1cHBsaWVkLlxyXG4gICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLl9zb3VyY2UpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3NvdXJjZS5fcmVhc29uO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgLyoqXHJcbiAgICAgICogVGhyb3dzIGFuIGBFcnJvcmAgaWYgdGhlIHRva2VuIGhhcyByZWNlaXZlZCBhIGNhbmNlbGxhdGlvbiBzaWduYWwuXHJcbiAgICAgICovXHJcbiAgICBDYW5jZWxsYXRpb25Ub2tlbi5wcm90b3R5cGUudGhyb3dJZkNhbmNlbGVkID0gZnVuY3Rpb24gKHJlYXNvbikge1xyXG4gICAgICAgIGlmIChyZWFzb24gPT09IHZvaWQgMCkgeyByZWFzb24gPSB0aGlzLnJlYXNvbjsgfVxyXG4gICAgICAgIGlmICghdGhpcy5fc291cmNlKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuY2FuY2VsZWQpIHtcclxuICAgICAgICAgICAgdGhyb3cgcmVhc29uO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAgKiBSZXF1ZXN0cyBhIGNhbGxiYWNrIHdoZW4gdGhlIHRva2VuIHJlY2VpdmVzIGEgY2FuY2VsbGF0aW9uIHNpZ25hbCB0byBwZXJmb3JtIGFkZGl0aW9uYWwgY2xlYW51cC5cclxuICAgICAgKiBAcGFyYW0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIHRvIGV4ZWN1dGVcclxuICAgICAgKiBAcmV0dXJucyBBIGBDYW5jZWxsYXRpb25Ub2tlblJlZ2lzdHJhdGlvbmAgdGhhdCB0aGF0IGNhbiBiZSB1c2VkIHRvIGNhbmNlbCB0aGUgY2xlYW51cCByZXF1ZXN0LlxyXG4gICAgICAqL1xyXG4gICAgQ2FuY2VsbGF0aW9uVG9rZW4ucHJvdG90eXBlLnJlZ2lzdGVyID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJBcmd1bWVudCBpcyBub3QgYSBGdW5jdGlvbiBvYmplY3RcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdGhpcy5fc291cmNlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlbXB0eVJlZ2lzdHJhdGlvbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NvdXJjZS5fcmVnaXN0ZXIoY2FsbGJhY2spO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBDYW5jZWxsYXRpb25Ub2tlbjtcclxufSkoKTtcclxuZXhwb3J0cy5DYW5jZWxsYXRpb25Ub2tlbiA9IENhbmNlbGxhdGlvblRva2VuO1xyXG52YXIgZW1wdHlSZWdpc3RyYXRpb24gPSBPYmplY3QuZnJlZXplKHsgdW5yZWdpc3RlcjogZnVuY3Rpb24gKCkgeyB9IH0pO1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1maWxlOi8vL0N8L2Rldi9hc3luY2pzL2NhbmNlbGxhdGlvbi5qcy5tYXAiLCIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChDKSBSb24gQS4gQnVja3Rvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTsgeW91IG1heSBub3QgdXNlXHJcbnRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlXHJcbkxpY2Vuc2UgYXQgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcblxyXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcblxyXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG52YXIgcHJvbWlzZV8xID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XHJcbnZhciBEZWZlcnJlZCA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBEZWZlcnJlZCgpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHRoaXMuX3Byb21pc2UgPSBuZXcgcHJvbWlzZV8xLlByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICBfdGhpcy5fcmVzb2x2ZSA9IHJlc29sdmU7XHJcbiAgICAgICAgICAgIF90aGlzLl9yZWplY3QgPSByZWplY3Q7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoRGVmZXJyZWQucHJvdG90eXBlLCBcInByb21pc2VcIiwge1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcHJvbWlzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIERlZmVycmVkLnByb3RvdHlwZS5yZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdGhpcy5fcmVzb2x2ZSh2YWx1ZSk7XHJcbiAgICB9O1xyXG4gICAgRGVmZXJyZWQucHJvdG90eXBlLnJlamVjdCA9IGZ1bmN0aW9uIChyZWFzb24pIHtcclxuICAgICAgICB0aGlzLl9yZWplY3QocmVhc29uKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gRGVmZXJyZWQ7XHJcbn0pKCk7XHJcbmV4cG9ydHMuRGVmZXJyZWQgPSBEZWZlcnJlZDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy9kZWZlcnJlZC5qcy5tYXAiLCIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChDKSBSb24gQS4gQnVja3Rvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTsgeW91IG1heSBub3QgdXNlXHJcbnRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlXHJcbkxpY2Vuc2UgYXQgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcblxyXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcblxyXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG52YXIgcHJvbWlzZV8xID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XHJcbnZhciBjYW5jZWxsYXRpb25fMSA9IHJlcXVpcmUoJy4vY2FuY2VsbGF0aW9uJyk7XHJcbnZhciBoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucyA9IHR5cGVvZiBEZWJ1ZyAhPT0gXCJ1bmRlZmluZWRcIiAmJlxyXG4gICAgdHlwZW9mIERlYnVnLnNldE5vblVzZXJDb2RlRXhjZXB0aW9ucyA9PT0gXCJib29sZWFuXCI7XHJcbi8qKlxyXG4gKiBBIFVyaVxyXG4gKi9cclxudmFyIFVyaSA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBVcmkoKSB7XHJcbiAgICAgICAgdmFyIGFyZ3MgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBfaSA9IDA7IF9pIDwgYXJndW1lbnRzLmxlbmd0aDsgX2krKykge1xyXG4gICAgICAgICAgICBhcmdzW19pIC0gMF0gPSBhcmd1bWVudHNbX2ldO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUaGUgcHJvdG9jb2wgZm9yIHRoZSBVcmkgKGUuZy4gJ2h0dHA6JylcclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMucHJvdG9jb2wgPSBcIlwiO1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRoZSBob3N0bmFtZSBmb3IgdGhlIFVyaVxyXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5ob3N0bmFtZSA9IFwiXCI7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogVGhlIHBvcnQgbnVtYmVyIGZvciB0aGUgVXJpXHJcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnBvcnQgPSBudWxsO1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRoZSBwYXRoIG5hbWUgZm9yIHRoZSBVcmlcclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMucGF0aG5hbWUgPSBcIlwiO1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRoZSBzZWFyY2ggcG9ydGlvbiBvZiB0aGUgcGF0aCwgYWxzbyBrbm93biBhcyB0aGUgcXVlcnlzdHJpbmdcclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuc2VhcmNoID0gXCJcIjtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUaGUgZnJhZ21lbnQgcG9ydGlvbiBvZiB0aGUgcGF0aFxyXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5oYXNoID0gXCJcIjtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBBIHZhbHVlIGluZGljYXRpbmcgd2hldGhlciB0aGUgVXJsIGlzIGFuIGFic29sdXRlIHVybFxyXG4gICAgICAgICAqIEB0eXBlIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuYWJzb2x1dGUgPSBmYWxzZTtcclxuICAgICAgICBpZiAoYXJncy5sZW5ndGggPT09IDApXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkFyZ3VtZW50IG1pc3NpbmdcIik7XHJcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgICAgICAgIHZhciBtID0gVXJpUGFyc2VyLmV4ZWMoYXJnc1swXSk7XHJcbiAgICAgICAgICAgIGlmICghbSlcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBVUklFcnJvcigpO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIFVyaVBhcnRzKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSBVcmlQYXJ0c1tuYW1lXTtcclxuICAgICAgICAgICAgICAgIHZhciBwYXJ0ID0gbVtpbmRleF07XHJcbiAgICAgICAgICAgICAgICBpZiAocGFydCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA8IDUpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnQgPSBwYXJ0LnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoaW5kZXggPT09IDUpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnQgPSBwYXJzZUludChwYXJ0KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA9PT0gNSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFydCA9IG1bMV0gPyBVcmlQb3J0c1t0aGlzLnByb3RvY29sXSA6IG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzW25hbWVdID0gcGFydDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLmFic29sdXRlID0gISFtWzFdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGJhc2VVcmkgPSBhcmdzWzBdIGluc3RhbmNlb2YgVXJpID8gYXJnc1swXSA6IFVyaS5wYXJzZShhcmdzWzBdKTtcclxuICAgICAgICAgICAgdmFyIHVyaSA9IGFyZ3NbMF0gaW5zdGFuY2VvZiBVcmkgPyBhcmdzWzFdIDogVXJpLnBhcnNlKGFyZ3NbMV0pO1xyXG4gICAgICAgICAgICB0aGlzLmhhc2ggPSB1cmkuaGFzaDtcclxuICAgICAgICAgICAgaWYgKHVyaS5wcm90b2NvbCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wcm90b2NvbCA9IHVyaS5wcm90b2NvbDtcclxuICAgICAgICAgICAgICAgIHRoaXMuaG9zdG5hbWUgPSB1cmkuaG9zdG5hbWU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBvcnQgPSB1cmkucG9ydDtcclxuICAgICAgICAgICAgICAgIHRoaXMucGF0aG5hbWUgPSB1cmkucGF0aG5hbWU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNlYXJjaCA9IHVyaS5zZWFyY2g7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmhhc2ggPSB1cmkuaGFzaDtcclxuICAgICAgICAgICAgICAgIHRoaXMuYWJzb2x1dGUgPSB1cmkuYWJzb2x1dGU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnByb3RvY29sID0gYmFzZVVyaS5wcm90b2NvbDtcclxuICAgICAgICAgICAgICAgIGlmICh1cmkuaG9zdG5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmhvc3RuYW1lID0gdXJpLmhvc3RuYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucG9ydCA9IHVyaS5wb3J0O1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGF0aG5hbWUgPSB1cmkucGF0aG5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZWFyY2ggPSB1cmkuc2VhcmNoO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGFzaCA9IHVyaS5oYXNoO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWJzb2x1dGUgPSB1cmkuYWJzb2x1dGU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmhvc3RuYW1lID0gYmFzZVVyaS5ob3N0bmFtZTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBvcnQgPSBiYXNlVXJpLnBvcnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHVyaS5wYXRobmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXJpLnBhdGhuYW1lLmNoYXJBdCgwKSA9PT0gJy8nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhdGhuYW1lID0gdXJpLnBhdGhuYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKChiYXNlVXJpLmFic29sdXRlICYmICFiYXNlVXJpLnBhdGhuYW1lKSB8fCBiYXNlVXJpLnBhdGhuYW1lID09PSBcIi9cIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGF0aG5hbWUgPSAnLycgKyB1cmkucGF0aG5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChiYXNlVXJpLnBhdGhuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHBhcnRzID0gYmFzZVVyaS5wYXRobmFtZS5zcGxpdCgnLycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdID0gdXJpLnBhdGhuYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGF0aG5hbWUgPSBwYXJ0cy5qb2luKCcvJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGF0aG5hbWUgPSBiYXNlVXJpLnBhdGhuYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXJpLnNlYXJjaCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZWFyY2ggPSB1cmkuc2VhcmNoO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZWFyY2ggPSBiYXNlVXJpLnNlYXJjaDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBPYmplY3QuZnJlZXplKHRoaXMpO1xyXG4gICAgfVxyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFVyaS5wcm90b3R5cGUsIFwib3JpZ2luXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSBvcmlnaW4gb2YgdGhlIFVyaVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy50b1N0cmluZyhcIm9yaWdpblwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShVcmkucHJvdG90eXBlLCBcImhvc3RcIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEdldHMgdGhlIGhvc3QgZm9yIHRoZSB1cmksIGluY2x1ZGluZyB0aGUgaG9zdG5hbWUgYW5kIHBvcnRcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9TdHJpbmcoXCJob3N0XCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFVyaS5wcm90b3R5cGUsIFwic2NoZW1lXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSBzY2hlbWUgZm9yIHRoZSB1cmkgKGUuZy4gJ2h0dHA6Ly8nJylcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9TdHJpbmcoXCJzY2hlbWVcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICAvKipcclxuICAgICAqIFRlc3RzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHVyaSBoYXMgdGhlIHNhbWUgb3JpZ2luIGFzIHRoaXMgdXJpXHJcbiAgICAgKiBAcGFyYW0gdXJpIFRoZSB1cmkgdG8gY29tcGFyZSBhZ2FpbnN0XHJcbiAgICAgKiBAcmV0dXJucyBUcnVlIGlmIHRoZSB1cmkncyBoYXZlIHRoZSBzYW1lIG9yaWdpbjsgb3RoZXJ3aXNlLCBmYWxzZVxyXG4gICAgICovXHJcbiAgICBVcmkucHJvdG90eXBlLmlzU2FtZU9yaWdpbiA9IGZ1bmN0aW9uICh1cmkpIHtcclxuICAgICAgICB2YXIgb3RoZXI7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB1cmkgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgb3RoZXIgPSBVcmkucGFyc2UodXJpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAodXJpIGluc3RhbmNlb2YgVXJpKSB7XHJcbiAgICAgICAgICAgIG90aGVyID0gdXJpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkFyZ3VtZW50IG5vdCBvcHRpb25hbC5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmFic29sdXRlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm9yaWdpbiA9PT0gb3RoZXIub3JpZ2luO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gIW90aGVyLmFic29sdXRlO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBVcmlcclxuICAgICAqIEBwYXJhbSBmb3JtYXQge1N0cmluZ30gQSBmb3JtYXQgc3BlY2lmaWVyLlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIHN0cmluZyBjb250ZW50IG9mIHRoZSBVcmlcclxuICAgICAqL1xyXG4gICAgVXJpLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIChmb3JtYXQpIHtcclxuICAgICAgICBzd2l0Y2ggKGZvcm1hdCkge1xyXG4gICAgICAgICAgICBjYXNlIFwib3JpZ2luXCI6XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wcm90b2NvbCAmJiB0aGlzLmhvc3RuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh0aGlzLnByb3RvY29sKSArIFwiLy9cIiArIHRoaXMudG9TdHJpbmcoXCJob3N0XCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICAgICAgICAgIGNhc2UgXCJhdXRob3JpdHlcIjpcclxuICAgICAgICAgICAgY2FzZSBcImhvc3RcIjpcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmhvc3RuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucG9ydCAhPT0gVXJpUG9ydHNbdGhpcy5wcm90b2NvbF0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh0aGlzLmhvc3RuYW1lKSArIFwiOlwiICsgdGhpcy50b1N0cmluZyhcInBvcnRcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcodGhpcy5ob3N0bmFtZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICAgICAgY2FzZSBcInBhdGgrc2VhcmNoXCI6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gU3RyaW5nKHRoaXMucGF0aG5hbWUpICsgU3RyaW5nKHRoaXMuc2VhcmNoKTtcclxuICAgICAgICAgICAgY2FzZSBcInNjaGVtZVwiOiByZXR1cm4gdGhpcy50b1N0cmluZyhcInByb3RvY29sXCIpICsgXCIvL1wiO1xyXG4gICAgICAgICAgICBjYXNlIFwicHJvdG9jb2xcIjogcmV0dXJuIFN0cmluZyh0aGlzLnByb3RvY29sIHx8IFwiXCIpO1xyXG4gICAgICAgICAgICBjYXNlIFwiaG9zdG5hbWVcIjogcmV0dXJuIFN0cmluZyh0aGlzLmhvc3RuYW1lIHx8IFwiXCIpO1xyXG4gICAgICAgICAgICBjYXNlIFwicG9ydFwiOlxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucG9ydCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcodGhpcy5wb3J0KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnByb3RvY29sICYmIFVyaVBvcnRzW3RoaXMucHJvdG9jb2xdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZyhVcmlQb3J0c1t0aGlzLnByb3RvY29sXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICAgICAgY2FzZSBcImZpbGVcIjpcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBhdGhuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGkgPSB0aGlzLnBhdGhuYW1lLmxhc3RJbmRleE9mKFwiL1wiKSArIDE7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhuYW1lLnN1YnN0cihpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICAgICAgY2FzZSBcImRpclwiOlxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGF0aG5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgaSA9IHRoaXMucGF0aG5hbWUubGFzdEluZGV4T2YoXCIvXCIpICsgMTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaSA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aG5hbWUuc3Vic3RyKDAsIGkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgICAgICAgICBjYXNlIFwiZXh0XCI6XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wYXRobmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpID0gdGhpcy5wYXRobmFtZS5sYXN0SW5kZXhPZihcIi9cIikgKyAxO1xyXG4gICAgICAgICAgICAgICAgICAgIGkgPSB0aGlzLnBhdGhuYW1lLmxhc3RJbmRleE9mKFwiLlwiLCBpKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaSA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aG5hbWUuc3Vic3RyKGkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgICAgICAgICBjYXNlIFwiZmlsZS1leHRcIjpcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBhdGhuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGkgPSB0aGlzLnBhdGhuYW1lLmxhc3RJbmRleE9mKFwiL1wiKSArIDE7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGogPSB0aGlzLnBhdGhuYW1lLmxhc3RJbmRleE9mKFwiLlwiLCBpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGogPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRobmFtZS5zdWJzdHJpbmcoaSwgaik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aG5hbWUuc3Vic3RyKGkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgICAgICAgICBjYXNlIFwiZnJhZ21lbnRcIjpcclxuICAgICAgICAgICAgY2FzZSBcImhhc2hcIjpcclxuICAgICAgICAgICAgICAgIHZhciBoYXNoID0gU3RyaW5nKHRoaXMuaGFzaCB8fCBcIlwiKTtcclxuICAgICAgICAgICAgICAgIGlmIChoYXNoLmxlbmd0aCA+IDAgJiYgaGFzaC5jaGFyQXQoMCkgIT0gXCIjXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCIjXCIgKyBoYXNoO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGhhc2g7XHJcbiAgICAgICAgICAgIGNhc2UgXCJwYXRoXCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJwYXRobmFtZVwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh0aGlzLnBhdGhuYW1lIHx8IFwiXCIpO1xyXG4gICAgICAgICAgICBjYXNlIFwic2VhcmNoXCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJxdWVyeVwiOlxyXG4gICAgICAgICAgICAgICAgdmFyIHNlYXJjaCA9IFN0cmluZyh0aGlzLnNlYXJjaCB8fCBcIlwiKTtcclxuICAgICAgICAgICAgICAgIGlmIChzZWFyY2gubGVuZ3RoID4gMCAmJiBzZWFyY2guY2hhckF0KDApICE9IFwiP1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiP1wiICsgc2VhcmNoO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlYXJjaDtcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnRvU3RyaW5nKFwib3JpZ2luXCIpICsgdGhpcy50b1N0cmluZyhcInBhdGhuYW1lXCIpICsgdGhpcy50b1N0cmluZyhcInNlYXJjaFwiKSArIHRoaXMudG9TdHJpbmcoXCJoYXNoXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIFBhcnNlcyB0aGUgcHJvdmlkZWQgdXJpIHN0cmluZ1xyXG4gICAgICogQHBhcmFtIHVyaSB7U3RyaW5nfSBUaGUgdXJpIHN0cmluZyB0byBwYXJzZVxyXG4gICAgICogQHJldHVybnMge1VyaX0gVGhlIHBhcnNlZCB1cmlcclxuICAgICAqL1xyXG4gICAgVXJpLnBhcnNlID0gZnVuY3Rpb24gKHVyaSkge1xyXG4gICAgICAgIHJldHVybiBuZXcgVXJpKHVyaSk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBDb21iaW5lcyB0d28gdXJpc1xyXG4gICAgICogQHBhcmFtIGJhc2VVcmkgVGhlIGJhc2UgdXJpXHJcbiAgICAgKiBAcGFyYW0gdXJpIFRoZSByZWxhdGl2ZSB1cmlcclxuICAgICAqIEByZXR1cm5zIFRoZSBjb21iaW5lZCB1cmlcclxuICAgICAqL1xyXG4gICAgVXJpLmNvbWJpbmUgPSBmdW5jdGlvbiAoYmFzZVVyaSwgdXJpKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBVcmkoYmFzZVVyaSwgdXJpKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gVXJpO1xyXG59KSgpO1xyXG5leHBvcnRzLlVyaSA9IFVyaTtcclxudmFyIFF1ZXJ5U3RyaW5nO1xyXG4oZnVuY3Rpb24gKFF1ZXJ5U3RyaW5nKSB7XHJcbiAgICB2YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcclxuICAgIHZhciBRdWVyeVN0cmluZ1BhcnNlciA9IC8oPzpcXD98JnxeKShbXj0mXSopKD86PShbXiZdKikpPy9nO1xyXG4gICAgZnVuY3Rpb24gc3RyaW5naWZ5KG9iaikge1xyXG4gICAgICAgIGlmICghb2JqKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgcXMgPSBbXTtcclxuICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvYmopLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcclxuICAgICAgICAgICAgdmFyIHZhbHVlID0gb2JqW25hbWVdO1xyXG4gICAgICAgICAgICBzd2l0Y2ggKHR5cGVvZiB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcInN0cmluZ1wiOlxyXG4gICAgICAgICAgICAgICAgY2FzZSBcIm51bWJlclwiOlxyXG4gICAgICAgICAgICAgICAgY2FzZSBcImJvb2xlYW5cIjoge1xyXG4gICAgICAgICAgICAgICAgICAgIHFzLnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KG5hbWUpICsgXCI9XCIgKyBlbmNvZGVVUklDb21wb25lbnQoU3RyaW5nKHZhbHVlKSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFyID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gYXIubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKHR5cGVvZiBhcltpXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgXCJzdHJpbmdcIjpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIFwibnVtYmVyXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBcImJvb2xlYW5cIjpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcXMucHVzaChlbmNvZGVVUklDb21wb25lbnQobmFtZSkgKyBcIj1cIiArIGVuY29kZVVSSUNvbXBvbmVudChTdHJpbmcodmFsdWUpKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHFzLnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KG5hbWUpICsgXCI9XCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcXMucHVzaChlbmNvZGVVUklDb21wb25lbnQobmFtZSkgKyBcIj1cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgaWYgKHFzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCI/XCIgKyBxcy5qb2luKFwiJlwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICB9XHJcbiAgICBRdWVyeVN0cmluZy5zdHJpbmdpZnkgPSBzdHJpbmdpZnk7XHJcbiAgICBmdW5jdGlvbiBwYXJzZSh0ZXh0KSB7XHJcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xyXG4gICAgICAgIHZhciBwYXJ0O1xyXG4gICAgICAgIHdoaWxlIChwYXJ0ID0gUXVlcnlTdHJpbmdQYXJzZXIuZXhlYyh0ZXh0KSkge1xyXG4gICAgICAgICAgICB2YXIga2V5ID0gZGVjb2RlVVJJQ29tcG9uZW50KHBhcnRbMV0pO1xyXG4gICAgICAgICAgICBpZiAoa2V5Lmxlbmd0aCAmJiBrZXkgIT09IFwiX19wcm90b19fXCIpIHtcclxuICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IGRlY29kZVVSSUNvbXBvbmVudChwYXJ0WzJdKTtcclxuICAgICAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbChvYmosIGtleSkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcHJldmlvdXMgPSBvYmpba2V5XTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwcmV2aW91cykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFyID0gcHJldmlvdXM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyLnB1c2godmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqW2tleV0gPSBbcHJldmlvdXMsIHZhbHVlXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBvYmpba2V5XSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBvYmo7XHJcbiAgICB9XHJcbiAgICBRdWVyeVN0cmluZy5wYXJzZSA9IHBhcnNlO1xyXG59KShRdWVyeVN0cmluZyA9IGV4cG9ydHMuUXVlcnlTdHJpbmcgfHwgKGV4cG9ydHMuUXVlcnlTdHJpbmcgPSB7fSkpO1xyXG4vKipcclxuICogQW4gSFRUUCByZXF1ZXN0IGZvciBhbiBIdHRwQ2xpZW50XHJcbiAqL1xyXG52YXIgSHR0cFJlcXVlc3QgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIEhUVFAgcmVxdWVzdCBmb3IgYW4gSHR0cENsaWVudFxyXG4gICAgICogQHBhcmFtIG1ldGhvZCBUaGUgSFRUUCBtZXRob2QgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcGFyYW0gdXJsIFRoZSB1cmwgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIEh0dHBSZXF1ZXN0KG1ldGhvZCwgdXJsKSB7XHJcbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gdm9pZCAwKSB7IG1ldGhvZCA9IFwiR0VUXCI7IH1cclxuICAgICAgICB0aGlzLl9oZWFkZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcclxuICAgICAgICB0aGlzLm1ldGhvZCA9IG1ldGhvZDtcclxuICAgICAgICBpZiAodHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgICB0aGlzLnVybCA9IFVyaS5wYXJzZSh1cmwpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh1cmwgaW5zdGFuY2VvZiBVcmkpIHtcclxuICAgICAgICAgICAgdGhpcy51cmwgPSB1cmw7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIHRoZSBuYW1lZCByZXF1ZXN0IGhlYWRlclxyXG4gICAgICogQHBhcmFtIGtleSB7U3RyaW5nfSBUaGUgaGVhZGVyIG5hbWVcclxuICAgICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfSBUaGUgaGVhZGVyIHZhbHVlXHJcbiAgICAgKi9cclxuICAgIEh0dHBSZXF1ZXN0LnByb3RvdHlwZS5zZXRSZXF1ZXN0SGVhZGVyID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcclxuICAgICAgICBpZiAoa2V5ICE9PSBcIl9fcHJvdG9fX1wiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2hlYWRlcnNba2V5XSA9IHZhbHVlO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICByZXR1cm4gSHR0cFJlcXVlc3Q7XHJcbn0pKCk7XHJcbmV4cG9ydHMuSHR0cFJlcXVlc3QgPSBIdHRwUmVxdWVzdDtcclxuLyoqXHJcbiAqIEEgcmVzcG9uc2UgZnJvbSBhbiBIdHRwQ2xpZW50XHJcbiAqL1xyXG52YXIgSHR0cFJlc3BvbnNlID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIC8qKlxyXG4gICAgICogQSByZXNwb25zZSBmcm9tIGFuIEh0dHBDbGllbnRcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gSHR0cFJlc3BvbnNlKHJlcXVlc3QsIHhocikge1xyXG4gICAgICAgIHRoaXMuX3JlcXVlc3QgPSByZXF1ZXN0O1xyXG4gICAgICAgIHRoaXMuX3hociA9IHhocjtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShIdHRwUmVzcG9uc2UucHJvdG90eXBlLCBcInJlcXVlc3RcIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEdldHMgdGhlIHJlcXVlc3QgZm9yIHRoaXMgcmVzcG9uc2VcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlcXVlc3Q7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoSHR0cFJlc3BvbnNlLnByb3RvdHlwZSwgXCJzdGF0dXNcIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEdldHMgdGhlIHN0YXR1cyBjb2RlIG9mIHRoZSByZXNwb25zZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5feGhyLnN0YXR1cztcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShIdHRwUmVzcG9uc2UucHJvdG90eXBlLCBcInN0YXR1c1RleHRcIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEdldHMgdGhlIHN0YXR1cyB0ZXh0IG9mIHRoZSByZXNwb25zZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5feGhyLnN0YXR1c1RleHQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoSHR0cFJlc3BvbnNlLnByb3RvdHlwZSwgXCJyZXNwb25zZVRleHRcIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEdldHMgdGhlIHJlc3BvbnNlIHRleHQgb2YgdGhlIHJlc3BvbnNlXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl94aHIucmVzcG9uc2VUZXh0O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIGFsbCBvZiB0aGUgcmVzcG9uc2UgaGVhZGVzIGluIGEgc2luZ2xlIHN0cmluZ1xyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gQSBzdHJpbmcgY29udGFpbmluZyBhbGwgb2YgdGhlIHJlc3BvbnNlIGhlYWRlcnNcclxuICAgICAqL1xyXG4gICAgSHR0cFJlc3BvbnNlLnByb3RvdHlwZS5nZXRBbGxSZXNwb25zZUhlYWRlcnMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3hoci5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIHZhbHVlIGZvciB0aGUgbmFtZWQgcmVzcG9uc2UgaGVhZGVyXHJcbiAgICAgKiBAcGFyYW0gaGVhZGVyIHtTdHJpbmd9IFRoZSBuYW1lIG9mIHRoZSBoZWFkZXJcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSB2YWx1ZSBmb3IgdGhlIG5hbWVkIGhlYWRlclxyXG4gICAgICovXHJcbiAgICBIdHRwUmVzcG9uc2UucHJvdG90eXBlLmdldFJlc3BvbnNlSGVhZGVyID0gZnVuY3Rpb24gKGhlYWRlcikge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl94aHIuZ2V0UmVzcG9uc2VIZWFkZXIoaGVhZGVyKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gSHR0cFJlc3BvbnNlO1xyXG59KSgpO1xyXG5leHBvcnRzLkh0dHBSZXNwb25zZSA9IEh0dHBSZXNwb25zZTtcclxuLyoqXHJcbiAqIEEgY2xpZW50IGZvciBIVFRQIHJlcXVlc3RzXHJcbiAqL1xyXG52YXIgSHR0cENsaWVudCA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBjbGllbnQgZm9yIEhUVFAgcmVxdWVzdHNcclxuICAgICAqIEBwYXJhbSBiYXNlVXJsIFRoZSBiYXNlIHVybCBmb3IgdGhlIGNsaWVudFxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBIdHRwQ2xpZW50KGJhc2VVcmwpIHtcclxuICAgICAgICB0aGlzLl9oZWFkZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcclxuICAgICAgICB0aGlzLl9jdHMgPSBuZXcgY2FuY2VsbGF0aW9uXzEuQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcclxuICAgICAgICB0aGlzLl9jbG9zZWQgPSBmYWxzZTtcclxuICAgICAgICBpZiAoYmFzZVVybCkge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGJhc2VVcmwgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYmFzZVVybCA9IFVyaS5wYXJzZShiYXNlVXJsKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmIChiYXNlVXJsIGluc3RhbmNlb2YgVXJpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmJhc2VVcmwgPSBiYXNlVXJsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBDbG9zZXMgdGhlIGNsaWVudCBhbmQgY2FuY2VscyBhbGwgcGVuZGluZyByZXF1ZXN0c1xyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAodGhpcy5fY2xvc2VkKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPYmplY3QgZG9lc24ndCBzdXBwb3J0IHRoaXMgYWN0aW9uXCIpO1xyXG4gICAgICAgIHRoaXMuX2Nsb3NlZCA9IHRydWU7XHJcbiAgICAgICAgdGhpcy5fY3RzLmNhbmNlbCgpO1xyXG4gICAgICAgIHRoaXMuX2N0cy5jbG9zZSgpO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogU2V0cyBhIHZhbHVlIGZvciBhIGRlZmF1bHQgcmVxdWVzdCBoZWFkZXJcclxuICAgICAqIEBwYXJhbSBrZXkgVGhlIHJlcXVlc3QgaGVhZGVyIGtleVxyXG4gICAgICogQHBhcmFtIHZhbHVlIFRoZSByZXF1ZXN0IGhlYWRlciB2YWx1ZVxyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5zZXRSZXF1ZXN0SGVhZGVyID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcclxuICAgICAgICBpZiAodGhpcy5fY2xvc2VkKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPYmplY3QgZG9lc24ndCBzdXBwb3J0IHRoaXMgYWN0aW9uXCIpO1xyXG4gICAgICAgIGlmIChrZXkgIT09IFwiX19wcm90b19fXCIpIHtcclxuICAgICAgICAgICAgdGhpcy5faGVhZGVyc1trZXldID0gdmFsdWU7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgcmVzcG9uc2UgdGV4dCBmcm9tIHRoZSByZXF1ZXN0ZWQgdXJsXHJcbiAgICAgKiBAcGFyYW0gdXJsIFRoZSB1cmwgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyBBIGZ1dHVyZSByZXN1bHQgZm9yIHRoZSBzdHJpbmdcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuZ2V0U3RyaW5nQXN5bmMgPSBmdW5jdGlvbiAodXJsKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QXN5bmModXJsKS50aGVuKGZ1bmN0aW9uIChyKSB7IHJldHVybiByLnJlc3BvbnNlVGV4dDsgfSk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSByZXNwb25zZSBmcm9tIGlzc3VpbmcgYW4gSFRUUCBHRVQgdG8gdGhlIHJlcXVlc3RlZCB1cmxcclxuICAgICAqIEBwYXJhbSB1cmwgVGhlIHVybCBmb3IgdGhlIHJlcXVlc3RcclxuICAgICAqIEBwYXJhbSB0b2tlbiBBIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyBBIGZ1dHVyZSByZXN1bHQgZm9yIHRoZSByZXNwb25zZVxyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5nZXRBc3luYyA9IGZ1bmN0aW9uICh1cmwsIHRva2VuKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VuZEFzeW5jKG5ldyBIdHRwUmVxdWVzdChcIkdFVFwiLCB1cmwpLCB0b2tlbik7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSByZXNwb25zZSBmcm9tIGlzc3VpbmcgYW4gSFRUUCBQT1NUIHRvIHRoZSByZXF1ZXN0ZWQgdXJsXHJcbiAgICAgKiBAcGFyYW0gdXJsIFRoZSB1cmwgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcGFyYW0gYm9keSBUaGUgYm9keSBvZiB0aGUgcmVxdWVzdFxyXG4gICAgICogQHBhcmFtIHRva2VuIEEgdG9rZW4gdGhhdCBjYW4gYmUgdXNlZCB0byBjYW5jZWwgdGhlIHJlcXVlc3RcclxuICAgICAqIEByZXR1cm5zIEEgZnV0dXJlIHJlc3VsdCBmb3IgdGhlIHJlc3BvbnNlXHJcbiAgICAgKi9cclxuICAgIEh0dHBDbGllbnQucHJvdG90eXBlLnBvc3RBc3luYyA9IGZ1bmN0aW9uICh1cmwsIGJvZHksIHRva2VuKSB7XHJcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgSHR0cFJlcXVlc3QoXCJQT1NUXCIsIHVybCk7XHJcbiAgICAgICAgcmVxdWVzdC5ib2R5ID0gYm9keTtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZW5kQXN5bmMocmVxdWVzdCwgdG9rZW4pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgcmVzcG9uc2UgZnJvbSBpc3N1aW5nIGFuIEhUVFAgUE9TVCBvZiBhIEpTT04gc2VyaWFsaXplZCB2YWx1ZSB0byB0aGUgcmVxdWVzdGVkIHVybFxyXG4gICAgICogQHBhcmFtIHVybCBUaGUgdXJsIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICogQHBhcmFtIHZhbHVlIFRoZSB2YWx1ZSB0byBzZXJpYWxpemVcclxuICAgICAqIEBwYXJhbSBqc29uUmVwbGFjZXIgQW4gYXJyYXkgb3IgY2FsbGJhY2sgdXNlZCB0byByZXBsYWNlIHZhbHVlcyBkdXJpbmcgc2VyaWFsaXphdGlvblxyXG4gICAgICogQHBhcmFtIHRva2VuIEEgdG9rZW4gdGhhdCBjYW4gYmUgdXNlZCB0byBjYW5jZWwgdGhlIHJlcXVlc3RcclxuICAgICAqIEByZXR1cm5zIEEgZnV0dXJlIHJlc3VsdCBmb3IgdGhlIHJlc3BvbnNlXHJcbiAgICAgKi9cclxuICAgIEh0dHBDbGllbnQucHJvdG90eXBlLnBvc3RKc29uQXN5bmMgPSBmdW5jdGlvbiAodXJsLCB2YWx1ZSwganNvblJlcGxhY2VyLCB0b2tlbikge1xyXG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IEh0dHBSZXF1ZXN0KFwiUE9TVFwiLCB1cmwpO1xyXG4gICAgICAgIHJlcXVlc3QuYm9keSA9IEpTT04uc3RyaW5naWZ5KHZhbHVlLCBqc29uUmVwbGFjZXIpO1xyXG4gICAgICAgIHJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VuZEFzeW5jKHJlcXVlc3QsIHRva2VuKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIHJlc3BvbnNlIGZyb20gaXNzdWluZyBhbiBIVFRQIFBVVCB0byB0aGUgcmVxdWVzdGVkIHVybFxyXG4gICAgICogQHBhcmFtIHVybCBUaGUgdXJsIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICogQHBhcmFtIGJvZHkgVGhlIGJvZHkgb2YgdGhlIHJlcXVlc3RcclxuICAgICAqIEBwYXJhbSB0b2tlbiBBIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyBBIGZ1dHVyZSByZXN1bHQgZm9yIHRoZSByZXNwb25zZVxyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5wdXRBc3luYyA9IGZ1bmN0aW9uICh1cmwsIGJvZHksIHRva2VuKSB7XHJcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgSHR0cFJlcXVlc3QoXCJQVVRcIiwgdXJsKTtcclxuICAgICAgICByZXF1ZXN0LmJvZHkgPSBib2R5O1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNlbmRBc3luYyhyZXF1ZXN0LCB0b2tlbik7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSByZXNwb25zZSBmcm9tIGlzc3VpbmcgYW4gSFRUUCBQVVQgb2YgYSBKU09OIHNlcmlhbGl6ZWQgdmFsdWUgdG8gdGhlIHJlcXVlc3RlZCB1cmxcclxuICAgICAqIEBwYXJhbSB1cmwgVGhlIHVybCBmb3IgdGhlIHJlcXVlc3RcclxuICAgICAqIEBwYXJhbSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2VyaWFsaXplXHJcbiAgICAgKiBAcGFyYW0ganNvblJlcGxhY2VyIEFuIGFycmF5IG9yIGNhbGxiYWNrIHVzZWQgdG8gcmVwbGFjZSB2YWx1ZXMgZHVyaW5nIHNlcmlhbGl6YXRpb25cclxuICAgICAqIEBwYXJhbSB0b2tlbiBBIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyBBIGZ1dHVyZSByZXN1bHQgZm9yIHRoZSByZXNwb25zZVxyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5wdXRKc29uQXN5bmMgPSBmdW5jdGlvbiAodXJsLCB2YWx1ZSwganNvblJlcGxhY2VyLCB0b2tlbikge1xyXG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IEh0dHBSZXF1ZXN0KFwiUFVUXCIsIHVybCk7XHJcbiAgICAgICAgcmVxdWVzdC5ib2R5ID0gSlNPTi5zdHJpbmdpZnkodmFsdWUsIGpzb25SZXBsYWNlcik7XHJcbiAgICAgICAgcmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZW5kQXN5bmMocmVxdWVzdCwgdG9rZW4pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgcmVzcG9uc2UgZnJvbSBpc3N1aW5nIGFuIEhUVFAgREVMRVRFIHRvIHRoZSByZXF1ZXN0ZWQgdXJsXHJcbiAgICAgKiBAcGFyYW0gdXJsIFRoZSB1cmwgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcGFyYW0gdG9rZW4gQSB0b2tlbiB0aGF0IGNhbiBiZSB1c2VkIHRvIGNhbmNlbCB0aGUgcmVxdWVzdFxyXG4gICAgICogQHJldHVybnMgQSBmdXR1cmUgcmVzdWx0IGZvciB0aGUgcmVzcG9uc2VcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuZGVsZXRlQXN5bmMgPSBmdW5jdGlvbiAodXJsLCB0b2tlbikge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNlbmRBc3luYyhuZXcgSHR0cFJlcXVlc3QoXCJERUxFVEVcIiwgdXJsKSwgdG9rZW4pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogU2VuZHMgdGhlIHByb3ZpZGVkIHJlcXVlc3QgYW5kIHJldHVybnMgdGhlIHJlc3BvbnNlXHJcbiAgICAgKiBAcGFyYW0gcmVxdWVzdCB7SHR0cFJlcXVlc3R9IEFuIEhUVFAgcmVxdWVzdCB0byBzZW5kXHJcbiAgICAgKiBAcGFyYW0gdG9rZW4ge2Z1dHVyZXMuQ2FuY2VsbGF0aW9uVG9rZW59IEEgdG9rZW4gdGhhdCBjYW4gYmUgdXNlZCB0byBjYW5jZWwgdGhlIHJlcXVlc3RcclxuICAgICAqIEByZXR1cm5zIHtmdXR1cmVzLlByb21pc2U8SHR0cFJlc3BvbnNlPn0gQSBmdXR1cmUgcmVzdWx0IGZvciB0aGUgcmVzcG9uc2VcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuc2VuZEFzeW5jID0gZnVuY3Rpb24gKHJlcXVlc3QsIHRva2VuKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICBpZiAodGhpcy5fY2xvc2VkKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPYmplY3QgZG9lc24ndCBzdXBwb3J0IHRoaXMgYWN0aW9uXCIpO1xyXG4gICAgICAgIHJldHVybiBuZXcgcHJvbWlzZV8xLlByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICAvLyBjcmVhdGUgYSBsaW5rZWQgdG9rZW5cclxuICAgICAgICAgICAgdmFyIGN0cyA9IG5ldyBjYW5jZWxsYXRpb25fMS5DYW5jZWxsYXRpb25Ub2tlblNvdXJjZShbX3RoaXMuX2N0cy50b2tlbiwgdG9rZW5dKTtcclxuICAgICAgICAgICAgLy8gdGhyb3cgaWYgd2UncmUgYWxyZWFkeSBjYW5jZWxlZCwgdGhlIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZFxyXG4gICAgICAgICAgICBjdHMudG9rZW4udGhyb3dJZkNhbmNlbGVkKCk7XHJcbiAgICAgICAgICAgIC8vIG5vcm1hbGl6ZSB0aGUgdXJpXHJcbiAgICAgICAgICAgIHZhciB1cmwgPSBudWxsO1xyXG4gICAgICAgICAgICBpZiAoIXJlcXVlc3QudXJsKSB7XHJcbiAgICAgICAgICAgICAgICB1cmwgPSBfdGhpcy5iYXNlVXJsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKCFyZXF1ZXN0LnVybC5hYnNvbHV0ZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFfdGhpcy5iYXNlVXJsKVxyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgYXJndW1lbnQ6IHJlcXVlc3RcIik7XHJcbiAgICAgICAgICAgICAgICB1cmwgPSBuZXcgVXJpKF90aGlzLmJhc2VVcmwsIHJlcXVlc3QudXJsKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAodXJsKSB7XHJcbiAgICAgICAgICAgICAgICByZXF1ZXN0LnVybCA9IHVybDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICAgICAgICAgIHZhciByZXNwb25zZSA9IG5ldyBIdHRwUmVzcG9uc2UocmVxdWVzdCwgeGhyKTtcclxuICAgICAgICAgICAgdmFyIHJlcXVlc3RIZWFkZXJzID0gcmVxdWVzdC5faGVhZGVycztcclxuICAgICAgICAgICAgdmFyIGNsaWVudEhlYWRlcnMgPSBfdGhpcy5faGVhZGVycztcclxuICAgICAgICAgICAgLy8gY3JlYXRlIHRoZSBvbmxvYWQgY2FsbGJhY2tcclxuICAgICAgICAgICAgdmFyIG9ubG9hZCA9IGZ1bmN0aW9uIChldikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKVxyXG4gICAgICAgICAgICAgICAgICAgIERlYnVnLnNldE5vblVzZXJDb2RlRXhjZXB0aW9ucyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgICAgICAgICAvLyBjYXRjaCBhIGNhbmNlbGxhdGlvbiBhbmQgcmVqZWN0IHRoZSBwcm9taXNlXHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIGN0cy50b2tlbi50aHJvd0lmQ2FuY2VsZWQoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICh4aHIuc3RhdHVzID49IDIwMCAmJiB4aHIuc3RhdHVzIDwgMzAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyb3IgPSBjcmVhdGVIdHRwRXJyb3IoX3RoaXMsIHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAvLyBjcmVhdGUgdGhlIG9uZXJyb3IgY2FsbGJhY2tcclxuICAgICAgICAgICAgdmFyIG9uZXJyb3IgPSBmdW5jdGlvbiAoZXYpIHtcclxuICAgICAgICAgICAgICAgIGlmIChoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucylcclxuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgICAgICAgICAgLy8gY2F0Y2ggYSBjYW5jZWxsYXRpb24gYW5kIHJlamVjdCB0aGUgcHJvbWlzZVxyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICBjdHMudG9rZW4udGhyb3dJZkNhbmNlbGVkKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB2YXIgZXJyb3IgPSBjcmVhdGVIdHRwRXJyb3IoX3RoaXMsIHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIC8vIHJlZ2lzdGVyIGEgY2xlYW51cCBwaGFzZVxyXG4gICAgICAgICAgICB2YXIgcmVnaXN0cmF0aW9uID0gY3RzLnRva2VuLnJlZ2lzdGVyKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGlmIChoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucylcclxuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgICAgICAgICAgLy8gYWJvcnQgdGhlIHhoclxyXG4gICAgICAgICAgICAgICAgeGhyLmFib3J0KCk7XHJcbiAgICAgICAgICAgICAgICAvLyBjYXRjaCBhIGNhbmNlbGxhdGlvbiBhbmQgcmVqZWN0IHRoZSBwcm9taXNlXHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIGN0cy50b2tlbi50aHJvd0lmQ2FuY2VsZWQoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdmFyIGNsZWFudXAgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICB4aHIucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImxvYWRcIiwgb25sb2FkLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICB4aHIucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsIG9uZXJyb3IsIGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi51bnJlZ2lzdGVyKCk7XHJcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIC8vIGFkZCB0aGUgaGVhZGVycyBmcm9tIHRoZSBjbGllbnRcclxuICAgICAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoY2xpZW50SGVhZGVycykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XHJcbiAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIGNsaWVudEhlYWRlcnNba2V5XSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAvLyBhZGQgdGhlIGhlYWRlcnMgZnJvbSB0aGUgcmVxdWVzdFxyXG4gICAgICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhyZXF1ZXN0SGVhZGVycykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XHJcbiAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIHJlcXVlc3RIZWFkZXJzW2tleV0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgLy8gd2lyZSB1cCB0aGUgZXZlbnRzXHJcbiAgICAgICAgICAgIHhoci5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBvbmxvYWQsIGZhbHNlKTtcclxuICAgICAgICAgICAgeGhyLmFkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLCBvbmVycm9yLCBmYWxzZSk7XHJcbiAgICAgICAgICAgIC8vIGVuYWJsZSBjcmVkZW50aWFscyBpZiByZXF1ZXN0ZWRcclxuICAgICAgICAgICAgaWYgKF90aGlzLndpdGhDcmVkZW50aWFscykge1xyXG4gICAgICAgICAgICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gYXR0YWNoIGEgdGltZW91dFxyXG4gICAgICAgICAgICBpZiAoX3RoaXMudGltZW91dCA+IDApIHtcclxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkgeyByZXR1cm4gY3RzLmNhbmNlbChuZXcgRXJyb3IoXCJPcGVyYXRpb24gdGltZWQgb3V0LlwiKSk7IH0sIF90aGlzLnRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgICAgeGhyLnRpbWVvdXQgPSBfdGhpcy50aW1lb3V0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIHNlbmQgdGhlIHJlcXVlc3RcclxuICAgICAgICAgICAgeGhyLm9wZW4ocmVxdWVzdC5tZXRob2QsIHJlcXVlc3QudXJsLnRvU3RyaW5nKCksIHRydWUsIF90aGlzLnVzZXJuYW1lLCBfdGhpcy5wYXNzd29yZCk7XHJcbiAgICAgICAgICAgIHhoci5zZW5kKHJlcXVlc3QuYm9keSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuZ2V0SnNvbnBBc3luYyA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrQXJnLCBub0NhY2hlLCB0b2tlbikge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgaWYgKGNhbGxiYWNrQXJnID09PSB2b2lkIDApIHsgY2FsbGJhY2tBcmcgPSBcImNhbGxiYWNrXCI7IH1cclxuICAgICAgICBpZiAobm9DYWNoZSA9PT0gdm9pZCAwKSB7IG5vQ2FjaGUgPSBmYWxzZTsgfVxyXG4gICAgICAgIGlmICh0aGlzLl9jbG9zZWQpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk9iamVjdCBkb2Vzbid0IHN1cHBvcnQgdGhpcyBhY3Rpb25cIik7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gXCJ1bmRlZmluZWRcIilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSlNPTi1QIGlzIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBob3N0LlwiKTtcclxuICAgICAgICByZXR1cm4gbmV3IHByb21pc2VfMS5Qcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgLy8gY3JlYXRlIGEgbGlua2VkIHRva2VuXHJcbiAgICAgICAgICAgIHZhciBjdHMgPSBuZXcgY2FuY2VsbGF0aW9uXzEuQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoW190aGlzLl9jdHMudG9rZW4sIHRva2VuXSk7XHJcbiAgICAgICAgICAgIC8vIHRocm93IGlmIHdlJ3JlIGFscmVhZHkgY2FuY2VsZWQsIHRoZSBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWRcclxuICAgICAgICAgICAgY3RzLnRva2VuLnRocm93SWZDYW5jZWxlZCgpO1xyXG4gICAgICAgICAgICAvLyBub3JtYWxpemUgdGhlIHVyaVxyXG4gICAgICAgICAgICB2YXIgcmVxdWVzdFVybCA9IG51bGw7XHJcbiAgICAgICAgICAgIGlmICghdXJsKSB7XHJcbiAgICAgICAgICAgICAgICByZXF1ZXN0VXJsID0gX3RoaXMuYmFzZVVybDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdFVybCA9IG5ldyBVcmkodXJsKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHVybCBpbnN0YW5jZW9mIFVyaSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RVcmwgPSB1cmw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoIXJlcXVlc3RVcmwuYWJzb2x1dGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIV90aGlzLmJhc2VVcmwpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgYXJndW1lbnQ6IHVybFwiKTtcclxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0VXJsID0gbmV3IFVyaShfdGhpcy5iYXNlVXJsLCByZXF1ZXN0VXJsKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSBqc29ucFJlcXVlc3RJbmRleCsrO1xyXG4gICAgICAgICAgICB2YXIgbmFtZSA9IFwiX19Qcm9taXNlX19qc29ucF9fXCIgKyBpbmRleDtcclxuICAgICAgICAgICAgdmFyIHF1ZXJ5ID0gUXVlcnlTdHJpbmcucGFyc2UocmVxdWVzdFVybC5zZWFyY2gpO1xyXG4gICAgICAgICAgICBxdWVyeVtjYWxsYmFja0FyZ10gPSBuYW1lO1xyXG4gICAgICAgICAgICBpZiAobm9DYWNoZSkge1xyXG4gICAgICAgICAgICAgICAgcXVlcnlbXCJfdFwiXSA9IERhdGUubm93KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmVxdWVzdFVybC5zZWFyY2ggPSBRdWVyeVN0cmluZy5zdHJpbmdpZnkocXVlcnkpO1xyXG4gICAgICAgICAgICB2YXIgcGVuZGluZyA9IHRydWU7XHJcbiAgICAgICAgICAgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJoZWFkXCIpWzBdO1xyXG4gICAgICAgICAgICB2YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNjcmlwdFwiKTtcclxuICAgICAgICAgICAgc2NyaXB0LnR5cGUgPSBcInRleHQvamF2YXNjcmlwdFwiO1xyXG4gICAgICAgICAgICBzY3JpcHQuYXN5bmMgPSB0cnVlO1xyXG4gICAgICAgICAgICBzY3JpcHQuc3JjID0gcmVxdWVzdFVybC50b1N0cmluZygpO1xyXG4gICAgICAgICAgICAvLyBjaGVja3Mgd2hldGhlciB0aGUgcmVxdWVzdCBoYXMgYmVlbiBjYW5jZWxlZFxyXG4gICAgICAgICAgICB2YXIgY2hlY2tDYW5jZWxlZCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGlmIChoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucylcclxuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICBjdHMudG9rZW4udGhyb3dJZkNhbmNlbGVkKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgLy8gd2FpdHMgZm9yIHRoZSByZXN1bHRcclxuICAgICAgICAgICAgdmFyIG9ubG9hZCA9IGZ1bmN0aW9uIChyZXN1bHQpIHtcclxuICAgICAgICAgICAgICAgIGlnbm9yZSgpO1xyXG4gICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uLnVucmVnaXN0ZXIoKTtcclxuICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbiA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgICAgIGlmICghY2hlY2tDYW5jZWxlZCgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAvLyBpZ25vcmVzIGZ1cnRoZXIgY2FsbHMgdG8gZnVsZmlsbCB0aGUgcmVzdWx0XHJcbiAgICAgICAgICAgIHZhciBpZ25vcmUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBwZW5kaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgd2luZG93W25hbWVdO1xyXG4gICAgICAgICAgICAgICAgZGlzY29ubmVjdCgpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAvLyBkaXNjb25uZWN0cyB0aGUgc2NyaXB0IG5vZGVcclxuICAgICAgICAgICAgdmFyIGRpc2Nvbm5lY3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0LnBhcmVudE5vZGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBoZWFkLnJlbW92ZUNoaWxkKHNjcmlwdCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIC8vIHJlZ2lzdGVyIGEgY2xlYW51cCBwaGFzZVxyXG4gICAgICAgICAgICB2YXIgcmVnaXN0cmF0aW9uID0gY3RzLnRva2VuLnJlZ2lzdGVyKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGlmIChwZW5kaW5nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgd2luZG93W25hbWVdID0gaWdub3JlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZGlzY29ubmVjdCgpO1xyXG4gICAgICAgICAgICAgICAgY2hlY2tDYW5jZWxlZCgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgLy8gc2V0IGEgdGltZW91dCBiZWZvcmUgd2Ugbm8gbG9uZ2VyIGNhcmUgYWJvdXQgdGhlIHJlc3VsdC5cclxuICAgICAgICAgICAgaWYgKF90aGlzLnRpbWVvdXQpIHtcclxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkgeyByZXR1cm4gY3RzLmNhbmNlbChuZXcgRXJyb3IoXCJPcGVyYXRpb24gdGltZWQgb3V0LlwiKSk7IH0sIF90aGlzLnRpbWVvdXQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHdpbmRvd1tuYW1lXSA9IG9ubG9hZDtcclxuICAgICAgICAgICAgaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBIdHRwQ2xpZW50O1xyXG59KSgpO1xyXG5leHBvcnRzLkh0dHBDbGllbnQgPSBIdHRwQ2xpZW50O1xyXG5mdW5jdGlvbiBjcmVhdGVIdHRwRXJyb3IoaHR0cENsaWVudCwgcmVzcG9uc2UsIG1lc3NhZ2UpIHtcclxuICAgIGlmIChtZXNzYWdlID09PSB2b2lkIDApIHsgbWVzc2FnZSA9IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgcHJvY2Vzc2luZyB5b3VyIHJlcXVlc3RcIjsgfVxyXG4gICAgdmFyIGVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xyXG4gICAgZXJyb3IubmFtZSA9IFwiSHR0cEVycm9yXCI7XHJcbiAgICBlcnJvci5odHRwQ2xpZW50ID0gaHR0cENsaWVudDtcclxuICAgIGVycm9yLnJlc3BvbnNlID0gcmVzcG9uc2U7XHJcbiAgICBlcnJvci5tZXNzYWdlID0gbWVzc2FnZTtcclxuICAgIHJldHVybiBlcnJvcjtcclxufVxyXG52YXIgVXJpUGFyc2VyID0gL14oKD86KGh0dHBzPzopXFwvXFwvKSg/OlteOkBdKig/OlxcOlteQF0qKT9AKT8oKFthLXpcXGQtXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXFwuXSspKD86XFw6KFxcZCspKT8pPyk/KD8hW2EtelxcZC1dK1xcOikoKD86XnxcXC8pW15cXD9cXCNdKik/KFxcP1teI10qKT8oIy4qKT8kL2k7XHJcbnZhciBVcmlQYXJ0cyA9IHsgXCJwcm90b2NvbFwiOiAyLCBcImhvc3RuYW1lXCI6IDQsIFwicG9ydFwiOiA1LCBcInBhdGhuYW1lXCI6IDYsIFwic2VhcmNoXCI6IDcsIFwiaGFzaFwiOiA4IH07XHJcbnZhciBVcmlQb3J0cyA9IHsgXCJodHRwOlwiOiA4MCwgXCJodHRwczpcIjogNDQzIH07XHJcbnZhciBqc29ucFJlcXVlc3RJbmRleCA9IDA7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGU6Ly8vQ3wvZGV2L2FzeW5janMvaHR0cGNsaWVudC5qcy5tYXAiLCIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChDKSBSb24gQS4gQnVja3Rvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTsgeW91IG1heSBub3QgdXNlXHJcbnRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlXHJcbkxpY2Vuc2UgYXQgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcblxyXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcblxyXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG52YXIgTGlua2VkTGlzdE5vZGUgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gTGlua2VkTGlzdE5vZGUodmFsdWUpIHtcclxuICAgICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoTGlua2VkTGlzdE5vZGUucHJvdG90eXBlLCBcImxpc3RcIiwge1xyXG4gICAgICAgIC8qKiBHZXRzIHRoZSBMaW5rZWRMaXN0IGZvciB0aGlzIG5vZGUgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2xpc3Q7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoTGlua2VkTGlzdE5vZGUucHJvdG90eXBlLCBcInByZXZpb3VzXCIsIHtcclxuICAgICAgICAvKiogR2V0cyB0aGUgcHJldmlvdXMgbm9kZSBpbiB0aGUgbGlzdCAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fcHJldmlvdXMgJiYgdGhpcyAhPT0gdGhpcy5fbGlzdC5maXJzdCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3ByZXZpb3VzO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoTGlua2VkTGlzdE5vZGUucHJvdG90eXBlLCBcIm5leHRcIiwge1xyXG4gICAgICAgIC8qKiBHZXRzIHRoZSBuZXh0IG5vZGUgaW4gdGhlIGxpc3QgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX25leHQgJiYgdGhpcy5fbmV4dCAhPT0gdGhpcy5fbGlzdC5maXJzdCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX25leHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIHJldHVybiBMaW5rZWRMaXN0Tm9kZTtcclxufSkoKTtcclxuZXhwb3J0cy5MaW5rZWRMaXN0Tm9kZSA9IExpbmtlZExpc3ROb2RlO1xyXG52YXIgTGlua2VkTGlzdCA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBMaW5rZWRMaXN0KCkge1xyXG4gICAgfVxyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KExpbmtlZExpc3QucHJvdG90eXBlLCBcImZpcnN0XCIsIHtcclxuICAgICAgICAvKiogR2V0cyB0aGUgZmlyc3Qgbm9kZSBpbiB0aGUgbGlzdCAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5faGVhZDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShMaW5rZWRMaXN0LnByb3RvdHlwZSwgXCJsYXN0XCIsIHtcclxuICAgICAgICAvKiogR2V0cyB0aGUgbGFzdCBub2RlIGluIHRoZSBsaXN0ICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9oZWFkKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5faGVhZC5fcHJldmlvdXM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShMaW5rZWRMaXN0LnByb3RvdHlwZSwgXCJzaXplXCIsIHtcclxuICAgICAgICAvKiogR2V0cyB0aGUgc2l6ZSBvZiB0aGUgbGlzdCAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc2l6ZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmFkZEZpcnN0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdmFyIG5ld05vZGUgPSBuZXcgTGlua2VkTGlzdE5vZGUodmFsdWUpO1xyXG4gICAgICAgIGlmICh0aGlzLmZpcnN0KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2luc2VydCh0aGlzLmZpcnN0LCBuZXdOb2RlKTtcclxuICAgICAgICAgICAgdGhpcy5faGVhZCA9IG5ld05vZGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9pbnNlcnRFbXB0eShuZXdOb2RlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG5ld05vZGU7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuYWRkTm9kZUZpcnN0ID0gZnVuY3Rpb24gKG5ld05vZGUpIHtcclxuICAgICAgICB0aGlzLl9jaGVja05ld05vZGUobmV3Tm9kZSk7XHJcbiAgICAgICAgaWYgKHRoaXMuZmlyc3QpIHtcclxuICAgICAgICAgICAgdGhpcy5faW5zZXJ0KHRoaXMuZmlyc3QsIG5ld05vZGUpO1xyXG4gICAgICAgICAgICB0aGlzLl9oZWFkID0gbmV3Tm9kZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2luc2VydEVtcHR5KG5ld05vZGUpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5hZGRMYXN0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdmFyIG5ld05vZGUgPSBuZXcgTGlua2VkTGlzdE5vZGUodmFsdWUpO1xyXG4gICAgICAgIGlmICh0aGlzLmZpcnN0KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2luc2VydCh0aGlzLmZpcnN0LCBuZXdOb2RlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2luc2VydEVtcHR5KG5ld05vZGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbmV3Tm9kZTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5hZGROb2RlTGFzdCA9IGZ1bmN0aW9uIChuZXdOb2RlKSB7XHJcbiAgICAgICAgdGhpcy5fY2hlY2tOZXdOb2RlKG5ld05vZGUpO1xyXG4gICAgICAgIGlmICh0aGlzLmZpcnN0KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2luc2VydCh0aGlzLmZpcnN0LCBuZXdOb2RlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2luc2VydEVtcHR5KG5ld05vZGUpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5hZGRCZWZvcmUgPSBmdW5jdGlvbiAobm9kZSwgdmFsdWUpIHtcclxuICAgICAgICB0aGlzLl9jaGVja05vZGUobm9kZSk7XHJcbiAgICAgICAgdmFyIG5ld05vZGUgPSBuZXcgTGlua2VkTGlzdE5vZGUodmFsdWUpO1xyXG4gICAgICAgIHRoaXMuX2luc2VydChub2RlLCBuZXdOb2RlKTtcclxuICAgICAgICBpZiAodGhpcy5faGVhZCA9PT0gbm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLl9oZWFkID0gbmV3Tm9kZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG5ld05vZGU7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuYWRkTm9kZUJlZm9yZSA9IGZ1bmN0aW9uIChub2RlLCBuZXdOb2RlKSB7XHJcbiAgICAgICAgdGhpcy5fY2hlY2tOb2RlKG5vZGUpO1xyXG4gICAgICAgIHRoaXMuX2NoZWNrTmV3Tm9kZShuZXdOb2RlKTtcclxuICAgICAgICB0aGlzLl9pbnNlcnQobm9kZSwgbmV3Tm9kZSk7XHJcbiAgICAgICAgaWYgKHRoaXMuX2hlYWQgPT09IG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5faGVhZCA9IG5ld05vZGU7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmFkZEFmdGVyID0gZnVuY3Rpb24gKG5vZGUsIHZhbHVlKSB7XHJcbiAgICAgICAgdGhpcy5fY2hlY2tOb2RlKG5vZGUpO1xyXG4gICAgICAgIHZhciBuZXdOb2RlID0gbmV3IExpbmtlZExpc3ROb2RlKHZhbHVlKTtcclxuICAgICAgICB0aGlzLl9pbnNlcnQobm9kZS5fbmV4dCwgbmV3Tm9kZSk7XHJcbiAgICAgICAgcmV0dXJuIG5ld05vZGU7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuYWRkTm9kZUFmdGVyID0gZnVuY3Rpb24gKG5vZGUsIG5ld05vZGUpIHtcclxuICAgICAgICB0aGlzLl9jaGVja05vZGUobm9kZSk7XHJcbiAgICAgICAgdGhpcy5fY2hlY2tOZXdOb2RlKG5ld05vZGUpO1xyXG4gICAgICAgIHRoaXMuX2luc2VydChub2RlLl9uZXh0LCBuZXdOb2RlKTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICBpZiAodGhpcy5fY2FjaGUgJiYgdGhpcy5fY2FjaGUudmFsdWUgPT09IHZhbHVlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gISF0aGlzLmZpbmQodmFsdWUpO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuX2hlYWQ7XHJcbiAgICAgICAgaWYgKG5vZGUpIHtcclxuICAgICAgICAgICAgZG8ge1xyXG4gICAgICAgICAgICAgICAgaWYgKG5vZGUudmFsdWUgPT09IHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FjaGUgPSBub2RlO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBub2RlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbm9kZSA9IG5vZGUuX25leHQ7XHJcbiAgICAgICAgICAgIH0gd2hpbGUgKG5vZGUgIT09IHRoaXMuX2hlYWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmZpbmRMYXN0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLl9oZWFkO1xyXG4gICAgICAgIGlmIChub2RlKSB7XHJcbiAgICAgICAgICAgIG5vZGUgPSBub2RlLl9wcmV2aW91cztcclxuICAgICAgICAgICAgdmFyIHRhaWwgPSBub2RlO1xyXG4gICAgICAgICAgICBkbyB7XHJcbiAgICAgICAgICAgICAgICBpZiAobm9kZS52YWx1ZSA9PT0gdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYWNoZSA9IG5vZGU7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5vZGU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5fcHJldmlvdXM7XHJcbiAgICAgICAgICAgIH0gd2hpbGUgKG5vZGUgIT09IHRhaWwpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmRlbGV0ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHZhciBub2RlID0gdGhpcy5maW5kKHZhbHVlKTtcclxuICAgICAgICBpZiAobm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLl9kZWxldGUobm9kZSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuZGVsZXRlTm9kZSA9IGZ1bmN0aW9uIChub2RlKSB7XHJcbiAgICAgICAgdGhpcy5fY2hlY2tOb2RlKG5vZGUpO1xyXG4gICAgICAgIHRoaXMuX2RlbGV0ZShub2RlKTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5kZWxldGVGaXJzdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAodGhpcy5faGVhZCkge1xyXG4gICAgICAgICAgICB0aGlzLl9kZWxldGUodGhpcy5faGVhZCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuZGVsZXRlTGFzdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAodGhpcy5faGVhZCkge1xyXG4gICAgICAgICAgICB0aGlzLl9kZWxldGUodGhpcy5faGVhZC5fcHJldmlvdXMpO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLnJlbW92ZUZpcnN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBub2RlID0gdGhpcy5faGVhZDtcclxuICAgICAgICBpZiAobm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLl9kZWxldGUobm9kZSk7XHJcbiAgICAgICAgICAgIHJldHVybiBub2RlLnZhbHVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLnJlbW92ZUxhc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2hlYWQpIHtcclxuICAgICAgICAgICAgdmFyIG5vZGUgPSB0aGlzLl9oZWFkLl9wcmV2aW91cztcclxuICAgICAgICAgICAgdGhpcy5fZGVsZXRlKG5vZGUpO1xyXG4gICAgICAgICAgICByZXR1cm4gbm9kZS52YWx1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgbmV4dCA9IHRoaXMuX2hlYWQ7XHJcbiAgICAgICAgd2hpbGUgKG5leHQpIHtcclxuICAgICAgICAgICAgdmFyIG5vZGUgPSBuZXh0O1xyXG4gICAgICAgICAgICBuZXh0ID0gbm9kZS5fbmV4dDtcclxuICAgICAgICAgICAgdGhpcy5faW52YWxpZGF0ZShub2RlKTtcclxuICAgICAgICAgICAgaWYgKG5leHQgPT09IHRoaXMuX2hlYWQpIHtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX2NhY2hlID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIHRoaXMuX3NpemUgPSAwO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICB2YXIgbmV4dCA9IHRoaXMuX2hlYWQ7XHJcbiAgICAgICAgd2hpbGUgKG5leHQpIHtcclxuICAgICAgICAgICAgdmFyIG5vZGUgPSBuZXh0O1xyXG4gICAgICAgICAgICBuZXh0ID0gbm9kZS5fbmV4dDtcclxuICAgICAgICAgICAgY2FsbGJhY2sobm9kZS52YWx1ZSwgbm9kZSwgdGhpcyk7XHJcbiAgICAgICAgICAgIGlmIChuZXh0ID09PSB0aGlzLl9oZWFkKSB7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5fY2hlY2tOb2RlID0gZnVuY3Rpb24gKG5vZGUpIHtcclxuICAgICAgICBpZiAoIW5vZGUpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJBcmd1bWVudCBub3Qgb3B0aW9uYWw6IG5vZGVcIik7XHJcbiAgICAgICAgaWYgKG5vZGUubGlzdCAhPT0gdGhpcylcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiV3JvbmcgbGlzdC5cIik7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuX2NoZWNrTmV3Tm9kZSA9IGZ1bmN0aW9uIChuZXdOb2RlKSB7XHJcbiAgICAgICAgaWYgKCFuZXdOb2RlKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQXJndW1lbnQgbm90IG9wdGlvbmFsOiBuZXdOb2RlXCIpO1xyXG4gICAgICAgIGlmIChuZXdOb2RlLmxpc3QpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vZGUgaXMgYWxyZWFkeSBhdHRhY2hlZCB0byBhIGxpc3QuXCIpO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLl9pbnNlcnQgPSBmdW5jdGlvbiAobm9kZSwgbmV3Tm9kZSkge1xyXG4gICAgICAgIG5ld05vZGUuX2xpc3QgPSB0aGlzO1xyXG4gICAgICAgIG5ld05vZGUuX25leHQgPSBub2RlO1xyXG4gICAgICAgIG5ld05vZGUuX3ByZXZpb3VzID0gbm9kZS5fcHJldmlvdXM7XHJcbiAgICAgICAgbm9kZS5fcHJldmlvdXMuX25leHQgPSBuZXdOb2RlO1xyXG4gICAgICAgIG5vZGUuX3ByZXZpb3VzID0gbmV3Tm9kZTtcclxuICAgICAgICB0aGlzLl9jYWNoZSA9IG5ld05vZGU7XHJcbiAgICAgICAgdGhpcy5fc2l6ZSsrO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLl9pbnNlcnRFbXB0eSA9IGZ1bmN0aW9uIChuZXdOb2RlKSB7XHJcbiAgICAgICAgbmV3Tm9kZS5fbGlzdCA9IHRoaXM7XHJcbiAgICAgICAgbmV3Tm9kZS5fbmV4dCA9IG5ld05vZGU7XHJcbiAgICAgICAgbmV3Tm9kZS5fcHJldmlvdXMgPSBuZXdOb2RlO1xyXG4gICAgICAgIHRoaXMuX2hlYWQgPSBuZXdOb2RlO1xyXG4gICAgICAgIHRoaXMuX2NhY2hlID0gbmV3Tm9kZTtcclxuICAgICAgICB0aGlzLl9zaXplKys7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuX2RlbGV0ZSA9IGZ1bmN0aW9uIChub2RlKSB7XHJcbiAgICAgICAgaWYgKG5vZGUuX25leHQgPT09IG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5faGVhZCA9IHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIG5vZGUuX25leHQuX3ByZXZpb3VzID0gbm9kZS5fcHJldmlvdXM7XHJcbiAgICAgICAgICAgIG5vZGUuX3ByZXZpb3VzLl9uZXh0ID0gbm9kZS5fbmV4dDtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2hlYWQgPT09IG5vZGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2hlYWQgPSBub2RlLl9uZXh0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX2ludmFsaWRhdGUobm9kZSk7XHJcbiAgICAgICAgdGhpcy5fY2FjaGUgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgdGhpcy5fc2l6ZS0tO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLl9pbnZhbGlkYXRlID0gZnVuY3Rpb24gKG5vZGUpIHtcclxuICAgICAgICBub2RlLl9saXN0ID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIG5vZGUuX25leHQgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgbm9kZS5fcHJldmlvdXMgPSB1bmRlZmluZWQ7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIExpbmtlZExpc3Q7XHJcbn0pKCk7XHJcbmV4cG9ydHMuTGlua2VkTGlzdCA9IExpbmtlZExpc3Q7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGU6Ly8vQ3wvZGV2L2FzeW5janMvbGlzdC5qcy5tYXAiLCIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChDKSBSb24gQS4gQnVja3Rvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTsgeW91IG1heSBub3QgdXNlXHJcbnRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlXHJcbkxpY2Vuc2UgYXQgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcblxyXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcblxyXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG52YXIgdGFza18xID0gcmVxdWlyZSgnLi90YXNrJyk7XHJcbnZhciBoYXNNc0RlYnVnID0gdHlwZW9mIERlYnVnICE9PSBcInVuZGVmaW5lZFwiICYmXHJcbiAgICB0eXBlb2YgRGVidWcubXNUcmFjZUFzeW5jT3BlcmF0aW9uU3RhcnRpbmcgPT09IFwiZnVuY3Rpb25cIiAmJlxyXG4gICAgdHlwZW9mIERlYnVnLm1zVHJhY2VBc3luY09wZXJhdGlvbkNvbXBsZXRlZCA9PT0gXCJmdW5jdGlvblwiICYmXHJcbiAgICB0eXBlb2YgRGVidWcubXNUcmFjZUFzeW5jQ2FsbGJhY2tTdGFydGluZyA9PT0gXCJmdW5jdGlvblwiICYmXHJcbiAgICB0eXBlb2YgRGVidWcubXNUcmFjZUFzeW5jQ2FsbGJhY2tDb21wbGV0ZWQgPT09IFwiZnVuY3Rpb25cIjtcclxudmFyIGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zID0gdHlwZW9mIERlYnVnICE9PSBcInVuZGVmaW5lZFwiICYmXHJcbiAgICB0eXBlb2YgRGVidWcuc2V0Tm9uVXNlckNvZGVFeGNlcHRpb25zID09PSBcImJvb2xlYW5cIjtcclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgdGhlIGNvbXBsZXRpb24gb2YgYW4gYXN5bmNocm9ub3VzIG9wZXJhdGlvblxyXG4gKi9cclxudmFyIFByb21pc2UgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgbmV3IFByb21pc2UuXHJcbiAgICAgKiBAcGFyYW0gaW5pdCBBIGNhbGxiYWNrIHVzZWQgdG8gaW5pdGlhbGl6ZSB0aGUgcHJvbWlzZS4gVGhpcyBjYWxsYmFjayBpcyBwYXNzZWQgdHdvIGFyZ3VtZW50czogYSByZXNvbHZlIGNhbGxiYWNrIHVzZWQgcmVzb2x2ZSB0aGUgcHJvbWlzZSB3aXRoIGEgdmFsdWUgb3IgdGhlIHJlc3VsdCBvZiBhbm90aGVyIHByb21pc2UsIGFuZCBhIHJlamVjdCBjYWxsYmFjayB1c2VkIHRvIHJlamVjdCB0aGUgcHJvbWlzZSB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIG9yIGVycm9yLlxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBQcm9taXNlKGluaXQpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIGlmICh0eXBlb2YgaW5pdCAhPT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcmd1bWVudCBpcyBub3QgYSBGdW5jdGlvbiBvYmplY3RcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucykge1xyXG4gICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgcmVzb2x2ZXIgPSBmdW5jdGlvbiAocmVqZWN0aW5nLCByZXN1bHQpIHtcclxuICAgICAgICAgICAgaWYgKHJlc29sdmVyKSB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlciA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICBfdGhpcy5fcmVzb2x2ZShyZWplY3RpbmcsIHJlc3VsdCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgICAgIHZhciByZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiByZXNvbHZlcihmYWxzZSwgdmFsdWUpOyB9O1xyXG4gICAgICAgIHZhciByZWplY3QgPSBmdW5jdGlvbiAocmVhc29uKSB7IHJldHVybiByZXNvbHZlcih0cnVlLCByZWFzb24pOyB9O1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGluaXQocmVzb2x2ZSwgcmVqZWN0KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgUHJvbWlzZS5yZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuICh2YWx1ZSBpbnN0YW5jZW9mIHRoaXMpID8gdmFsdWUgOiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXR1cm4gcmVzb2x2ZSh2YWx1ZSk7IH0pO1xyXG4gICAgfTtcclxuICAgIFByb21pc2UucmVqZWN0ID0gZnVuY3Rpb24gKHJlYXNvbikge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAoXywgcmVqZWN0KSB7IHJldHVybiByZWplY3QocmVhc29uKTsgfSk7XHJcbiAgICB9O1xyXG4gICAgUHJvbWlzZS5hbGwgPSBmdW5jdGlvbiAodmFsdWVzKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICByZXR1cm4gbmV3IHRoaXMoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICB2YXIgY291bnRkb3duID0gdmFsdWVzLmxlbmd0aCB8fCAwO1xyXG4gICAgICAgICAgICBpZiAoY291bnRkb3duIDw9IDApIHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoW10pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0gQXJyYXkoY291bnRkb3duKTtcclxuICAgICAgICAgICAgdmFyIHJlc29sdmVyID0gZnVuY3Rpb24gKGluZGV4KSB7IHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdHNbaW5kZXhdID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICBpZiAoLS1jb3VudGRvd24gPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdHMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9OyB9O1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIF90aGlzLnJlc29sdmUodmFsdWVzW2ldKS50aGVuKHJlc29sdmVyKGkpLCByZWplY3QpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgUHJvbWlzZS5yYWNlID0gZnVuY3Rpb24gKHZhbHVlcykge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgdmFyIHByb21pc2VzID0gdmFsdWVzLm1hcChmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIF90aGlzLnJlc29sdmUodmFsdWUpOyB9KTtcclxuICAgICAgICAgICAgcHJvbWlzZXMuZm9yRWFjaChmdW5jdGlvbiAocHJvbWlzZSkgeyByZXR1cm4gcHJvbWlzZS50aGVuKHJlc29sdmUsIHJlamVjdCk7IH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoZXMgY2FsbGJhY2tzIGZvciB0aGUgcmVzb2x1dGlvbiBhbmQvb3IgcmVqZWN0aW9uIG9mIHRoZSBQcm9taXNlLlxyXG4gICAgICogQHBhcmFtIG9uZnVsZmlsbGVkIFRoZSBjYWxsYmFjayB0byBleGVjdXRlIHdoZW4gdGhlIFByb21pc2UgaXMgcmVzb2x2ZWQuXHJcbiAgICAgKiBAcGFyYW0gb25yZWplY3RlZCBUaGUgY2FsbGJhY2sgdG8gZXhlY3V0ZSB3aGVuIHRoZSBQcm9taXNlIGlzIHJlamVjdGVkLlxyXG4gICAgICogQHJldHVybnMgQSBQcm9taXNlIGZvciB0aGUgY29tcGxldGlvbiBvZiB3aGljaCBldmVyIGNhbGxiYWNrIGlzIGV4ZWN1dGVkLlxyXG4gICAgICovXHJcbiAgICBQcm9taXNlLnByb3RvdHlwZS50aGVuID0gZnVuY3Rpb24gKG9uZnVsZmlsbGVkLCBvbnJlamVjdGVkKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F3YWl0KG9uZnVsZmlsbGVkLCBvbnJlamVjdGVkKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaGVzIGEgY2FsbGJhY2sgZm9yIG9ubHkgdGhlIHJlamVjdGlvbiBvZiB0aGUgUHJvbWlzZS5cclxuICAgICAqIEBwYXJhbSBvbnJlamVjdGVkIFRoZSBjYWxsYmFjayB0byBleGVjdXRlIHdoZW4gdGhlIFByb21pc2UgaXMgcmVqZWN0ZWQuXHJcbiAgICAgKiBAcmV0dXJucyBBIFByb21pc2UgZm9yIHRoZSBjb21wbGV0aW9uIG9mIHRoZSBjYWxsYmFjay5cclxuICAgICAqL1xyXG4gICAgUHJvbWlzZS5wcm90b3R5cGUuY2F0Y2ggPSBmdW5jdGlvbiAob25yZWplY3RlZCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hd2FpdCh1bmRlZmluZWQsIG9ucmVqZWN0ZWQpO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoZXMgYSBjYWxsYmFjayBmb3IgdGhhdCBpcyBleGVjdXRlZCByZWdhcmRsZXNzIG9mIHRoZSByZXNvbHV0aW9uIG9yIHJlamVjdGlvbiBvZiB0aGUgcHJvbWlzZS5cclxuICAgICAqIEBwYXJhbSBvbnNldHRsZWQgVGhlIGNhbGxiYWNrIHRvIGV4ZWN1dGUgd2hlbiB0aGUgUHJvbWlzZSBpcyBzZXR0bGVkLlxyXG4gICAgICogQHJldHVybnMgQSBQcm9taXNlIGZvciB0aGUgY29tcGxldGlvbiBvZiB0aGUgY2FsbGJhY2suXHJcbiAgICAgKi9cclxuICAgIFByb21pc2UucHJvdG90eXBlLmZpbmFsbHkgPSBmdW5jdGlvbiAob25zZXR0bGVkKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F3YWl0KGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmV0dXJuIHJlc29sdmUob25zZXR0bGVkKCkpOyB9KS50aGVuKGZ1bmN0aW9uICgpIHsgcmV0dXJuIHZhbHVlOyB9KTsgfSwgZnVuY3Rpb24gKHJlYXNvbikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmV0dXJuIHJlc29sdmUob25zZXR0bGVkKCkpOyB9KS50aGVuKGZ1bmN0aW9uICgpIHsgcmV0dXJuIFByb21pc2UucmVqZWN0KHJlYXNvbik7IH0pOyB9KTtcclxuICAgIH07XHJcbiAgICBQcm9taXNlLnByb3RvdHlwZS5fcmVzb2x2ZSA9IGZ1bmN0aW9uIChyZWplY3RpbmcsIHJlc3VsdCkge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgaWYgKCFyZWplY3RpbmcpIHtcclxuICAgICAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcyA9PT0gcmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZXNvbHZlIGEgcHJvbWlzZSB3aXRoIGl0c2VsZlwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgIT09IG51bGwgJiYgKHR5cGVvZiByZXN1bHQgPT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIHJlc3VsdCA9PT0gXCJmdW5jdGlvblwiKSAmJiBcInRoZW5cIiBpbiByZXN1bHQpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGhlbiA9IHJlc3VsdC50aGVuO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhlbiA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZXNvbHZlciA9IGZ1bmN0aW9uIChyZWplY3RpbmcsIHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc29sdmVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZXIgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9yZXNvbHZlKHJlamVjdGluZywgcmVzdWx0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc29sdmUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHJlc29sdmVyKGZhbHNlLCB2YWx1ZSk7IH07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWplY3QgPSBmdW5jdGlvbiAocmVhc29uKSB7IHJldHVybiByZXNvbHZlcih0cnVlLCByZWFzb24pOyB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhlbi5jYWxsKHJlc3VsdCwgcmVzb2x2ZSwgcmVqZWN0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGVycm9yO1xyXG4gICAgICAgICAgICAgICAgcmVqZWN0aW5nID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9zZXR0bGUocmVqZWN0aW5nLCByZXN1bHQpO1xyXG4gICAgfTtcclxuICAgIFByb21pc2UucHJvdG90eXBlLl9hd2FpdCA9IGZ1bmN0aW9uIChvbnJlc29sdmVkLCBvbnJlamVjdGVkKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB2YXIgaWQ7XHJcbiAgICAgICAgaWYgKGhhc01zRGVidWcpIHtcclxuICAgICAgICAgICAgRGVidWcubXNUcmFjZUFzeW5jT3BlcmF0aW9uU3RhcnRpbmcoXCJQcm9taXNlLnRoZW5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgIHZhciBwcmV2ID0gX3RoaXMuX3NldHRsZTtcclxuICAgICAgICAgICAgX3RoaXMuX3NldHRsZSA9IGZ1bmN0aW9uIChyZWplY3RpbmcsIHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgX3RoaXMuX2ZvcndhcmQocHJldiwgcmVzb2x2ZSwgcmVqZWN0LCByZWplY3RpbmcsIHJlc3VsdCwgb25yZXNvbHZlZCwgb25yZWplY3RlZCwgaWQpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFByb21pc2UucHJvdG90eXBlLl9zZXR0bGUgPSBmdW5jdGlvbiAocmVqZWN0aW5nLCByZXN1bHQpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHRoaXMuX3NldHRsZSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5fYXdhaXQgPSBmdW5jdGlvbiAob25mdWxmaWxsZWQsIG9ucmVqZWN0ZWQpIHtcclxuICAgICAgICAgICAgdmFyIGlkID0gaGFzTXNEZWJ1ZyAmJiBEZWJ1Zy5tc1RyYWNlQXN5bmNPcGVyYXRpb25TdGFydGluZyhcIlByb21pc2UudGhlblwiKTtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBfdGhpcy5jb25zdHJ1Y3RvcihmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICBfdGhpcy5fZm9yd2FyZChudWxsLCByZXNvbHZlLCByZWplY3QsIHJlamVjdGluZywgcmVzdWx0LCBvbmZ1bGZpbGxlZCwgb25yZWplY3RlZCwgaWQpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9O1xyXG4gICAgfTtcclxuICAgIFByb21pc2UucHJvdG90eXBlLl9mb3J3YXJkID0gZnVuY3Rpb24gKHByZXYsIHJlc29sdmUsIHJlamVjdCwgcmVqZWN0aW5nLCByZXN1bHQsIG9ucmVzb2x2ZWQsIG9ucmVqZWN0ZWQsIGlkKSB7XHJcbiAgICAgICAgaWYgKHByZXYpIHtcclxuICAgICAgICAgICAgcHJldi5jYWxsKHRoaXMsIHJlamVjdGluZywgcmVzdWx0KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGFza18xLnNjaGVkdWxlVGFzayhmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgRGVidWcuc2V0Tm9uVXNlckNvZGVFeGNlcHRpb25zID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoaGFzTXNEZWJ1Zykge1xyXG4gICAgICAgICAgICAgICAgRGVidWcubXNUcmFjZUFzeW5jT3BlcmF0aW9uQ29tcGxldGVkKGlkLCByZWplY3RpbmcgPyBEZWJ1Zy5NU19BU1lOQ19PUF9TVEFUVVNfRVJST1IgOiBEZWJ1Zy5NU19BU1lOQ19PUF9TVEFUVVNfU1VDQ0VTUyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFyIGhhbmRsZXIgPSByZWplY3RpbmcgPyBvbnJlamVjdGVkIDogb25yZXNvbHZlZDtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICAgICAgICAgIGlmIChoYXNNc0RlYnVnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgRGVidWcubXNUcmFjZUFzeW5jQ2FsbGJhY2tTdGFydGluZyhpZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGhhbmRsZXIocmVzdWx0KTtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3RpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZTtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3RpbmcgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZmluYWxseSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhhc01zRGVidWcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcubXNUcmFjZUFzeW5jQ2FsbGJhY2tDb21wbGV0ZWQoKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgKHJlamVjdGluZyA/IHJlamVjdCA6IHJlc29sdmUpKHJlc3VsdCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIFByb21pc2U7XHJcbn0pKCk7XHJcbmV4cG9ydHMuUHJvbWlzZSA9IFByb21pc2U7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGU6Ly8vQ3wvZGV2L2FzeW5janMvcHJvbWlzZS5qcy5tYXAiLCIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChDKSBSb24gQS4gQnVja3Rvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTsgeW91IG1heSBub3QgdXNlXHJcbnRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlXHJcbkxpY2Vuc2UgYXQgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcblxyXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcblxyXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG52YXIgbGlzdF8xID0gcmVxdWlyZSgnLi9saXN0Jyk7XHJcbnZhciBjYW5jZWxsYXRpb25fMSA9IHJlcXVpcmUoJy4vY2FuY2VsbGF0aW9uJyk7XHJcbmZ1bmN0aW9uIGdldE9yQ3JlYXRlUXVldWUoKSB7XHJcbiAgICBpZiAoIXF1ZXVlKSB7XHJcbiAgICAgICAgcXVldWUgPSBuZXcgbGlzdF8xLkxpbmtlZExpc3QoKTtcclxuICAgIH1cclxuICAgIHJldHVybiBxdWV1ZTtcclxufVxyXG5mdW5jdGlvbiBzY2hlZHVsZUltbWVkaWF0ZVRhc2sodGFzaywgdG9rZW4pIHtcclxuICAgIGlmICh0b2tlbi5jYW5CZUNhbmNlbGVkKSB7XHJcbiAgICAgICAgdmFyIHJlZ2lzdHJhdGlvbiA9IHRva2VuLnJlZ2lzdGVyKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG5vZGUubGlzdCA9PT0gcmVjb3ZlcnlRdWV1ZSB8fCBub2RlLmxpc3QgPT09IHF1ZXVlKSB7XHJcbiAgICAgICAgICAgICAgICBub2RlLmxpc3QuZGVsZXRlTm9kZShub2RlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAocmVjb3ZlcnlRdWV1ZSAmJiAhcmVjb3ZlcnlRdWV1ZS5maXJzdCkge1xyXG4gICAgICAgICAgICAgICAgcmVjb3ZlcnlRdWV1ZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAocXVldWUgJiYgIXF1ZXVlLmZpcnN0KSB7XHJcbiAgICAgICAgICAgICAgICBxdWV1ZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIXJlY292ZXJ5UXVldWUgJiYgIXF1ZXVlKSB7XHJcbiAgICAgICAgICAgICAgICBjYW5jZWxUaWNrKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICB2YXIgbm9kZSA9IGdldE9yQ3JlYXRlUXVldWUoKS5hZGRMYXN0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmVnaXN0cmF0aW9uLnVucmVnaXN0ZXIoKTtcclxuICAgICAgICAgICAgcmVnaXN0cmF0aW9uID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBpZiAoIXRva2VuLmNhbmNlbGVkKSB7XHJcbiAgICAgICAgICAgICAgICB0YXNrKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIGdldE9yQ3JlYXRlUXVldWUoKS5hZGRMYXN0KHRhc2spO1xyXG4gICAgfVxyXG4gICAgc2NoZWR1bGVUaWNrKCk7XHJcbn1cclxuZnVuY3Rpb24gc2NoZWR1bGVEZWxheWVkVGFzayh0YXNrLCBkZWxheSwgdG9rZW4pIHtcclxuICAgIGlmICh0b2tlbi5jYW5CZUNhbmNlbGVkKSB7XHJcbiAgICAgICAgdmFyIHJlZ2lzdHJhdGlvbiA9IHRva2VuLnJlZ2lzdGVyKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaGFuZGxlID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBjbGVhclRpbWVvdXQoaGFuZGxlKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICB2YXIgaGFuZGxlID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi51bnJlZ2lzdGVyKCk7XHJcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbiA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgaWYgKCF0b2tlbi5jYW5jZWxlZCkge1xyXG4gICAgICAgICAgICAgICAgdGFzaygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSwgZGVsYXkpO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgc2V0VGltZW91dCh0YXNrLCBkZWxheSk7XHJcbiAgICB9XHJcbn1cclxuZnVuY3Rpb24gc2NoZWR1bGVUYXNrKHRhc2ssIGRlbGF5LCB0b2tlbikge1xyXG4gICAgaWYgKGRlbGF5ID09PSB2b2lkIDApIHsgZGVsYXkgPSAwOyB9XHJcbiAgICBpZiAodG9rZW4gPT09IHZvaWQgMCkgeyB0b2tlbiA9IGNhbmNlbGxhdGlvbl8xLkNhbmNlbGxhdGlvblRva2VuLm5vbmU7IH1cclxuICAgIGlmIChkZWxheSA+IDApIHtcclxuICAgICAgICBzY2hlZHVsZURlbGF5ZWRUYXNrKHRhc2ssIGRlbGF5LCB0b2tlbik7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICBzY2hlZHVsZUltbWVkaWF0ZVRhc2sodGFzaywgdG9rZW4pO1xyXG4gICAgfVxyXG59XHJcbmV4cG9ydHMuc2NoZWR1bGVUYXNrID0gc2NoZWR1bGVUYXNrO1xyXG52YXIgc2NoZWR1bGVyO1xyXG52YXIgaGFuZGxlO1xyXG52YXIgcmVjb3ZlcnlRdWV1ZTtcclxudmFyIHF1ZXVlO1xyXG5mdW5jdGlvbiBzY2hlZHVsZVRpY2soKSB7XHJcbiAgICBpZiAoaGFuZGxlICE9PSB2b2lkIDApIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZiAoIXNjaGVkdWxlcikge1xyXG4gICAgICAgIHNjaGVkdWxlciA9IGdldFNjaGVkdWxlcigpO1xyXG4gICAgfVxyXG4gICAgaGFuZGxlID0gc2NoZWR1bGVyLnNjaGVkdWxlVGljayhvblRpY2spO1xyXG59XHJcbmZ1bmN0aW9uIGNhbmNlbFRpY2soKSB7XHJcbiAgICBpZiAoaGFuZGxlID09PSB2b2lkIDAgfHwgIXNjaGVkdWxlcikge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHNjaGVkdWxlci5jYW5jZWxUaWNrKGhhbmRsZSk7XHJcbiAgICBoYW5kbGUgPSB1bmRlZmluZWQ7XHJcbn1cclxuZnVuY3Rpb24gb25UaWNrKCkge1xyXG4gICAgaGFuZGxlID0gdW5kZWZpbmVkO1xyXG4gICAgcHJvY2Vzc1F1ZXVlKHJlY292ZXJ5UXVldWUpO1xyXG4gICAgcmVjb3ZlcnlRdWV1ZSA9IHF1ZXVlO1xyXG4gICAgcXVldWUgPSB1bmRlZmluZWQ7XHJcbiAgICBwcm9jZXNzUXVldWUocmVjb3ZlcnlRdWV1ZSk7XHJcbiAgICByZWNvdmVyeVF1ZXVlID0gdW5kZWZpbmVkO1xyXG59XHJcbmZ1bmN0aW9uIHByb2Nlc3NRdWV1ZShxdWV1ZSkge1xyXG4gICAgaWYgKCFxdWV1ZSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHZhciBub2RlO1xyXG4gICAgdmFyIHRhc2tDb21wbGV0ZWQgPSBmYWxzZTtcclxuICAgIHdoaWxlIChub2RlID0gcXVldWUuZmlyc3QpIHtcclxuICAgICAgICBxdWV1ZS5kZWxldGVOb2RlKG5vZGUpO1xyXG4gICAgICAgIHZhciB0YXNrID0gbm9kZS52YWx1ZTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICB0YXNrKCk7XHJcbiAgICAgICAgICAgIHRhc2tDb21wbGV0ZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHtcclxuICAgICAgICAgICAgaWYgKCF0YXNrQ29tcGxldGVkKSB7XHJcbiAgICAgICAgICAgICAgICBzY2hlZHVsZVRpY2soKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5mdW5jdGlvbiBnZXRTY2hlZHVsZXIoKSB7XHJcbiAgICBmdW5jdGlvbiBnZXRTZXRJbW1lZGlhdGVTY2hlZHVsZXIoKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgc2NoZWR1bGVUaWNrOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBzZXRJbW1lZGlhdGUoY2FsbGJhY2spO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjYW5jZWxUaWNrOiBmdW5jdGlvbiAoaGFuZGxlKSB7XHJcbiAgICAgICAgICAgICAgICBjbGVhckltbWVkaWF0ZShoYW5kbGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGdldE1TU2V0SW1tZWRpYXRlU2NoZWR1bGVyKCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHNjaGVkdWxlVGljazogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbXNTZXRJbW1lZGlhdGUoY2FsbGJhY2spO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjYW5jZWxUaWNrOiBmdW5jdGlvbiAoaGFuZGxlKSB7XHJcbiAgICAgICAgICAgICAgICBtc0NsZWFySW1tZWRpYXRlKGhhbmRsZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gZ2V0TmV4dFRpY2tTY2hlZHVsZXIoKSB7XHJcbiAgICAgICAgdmFyIHF1ZXVlID0gbmV3IGxpc3RfMS5MaW5rZWRMaXN0KCk7XHJcbiAgICAgICAgZnVuY3Rpb24gb250aWNrKCkge1xyXG4gICAgICAgICAgICB2YXIgbm9kZSA9IHF1ZXVlLmZpcnN0O1xyXG4gICAgICAgICAgICBpZiAobm9kZSkge1xyXG4gICAgICAgICAgICAgICAgcXVldWUuZGVsZXRlRmlyc3QoKTtcclxuICAgICAgICAgICAgICAgIHZhciBjYWxsYmFjayA9IG5vZGUudmFsdWU7XHJcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHNjaGVkdWxlVGljazogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgaGFuZGxlID0gcXVldWUuYWRkTGFzdChjYWxsYmFjayk7XHJcbiAgICAgICAgICAgICAgICBwcm9jZXNzLm5leHRUaWNrKG9udGljayk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaGFuZGxlO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjYW5jZWxUaWNrOiBmdW5jdGlvbiAoaGFuZGxlKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaGFuZGxlICYmIGhhbmRsZS5saXN0ID09PSBxdWV1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHF1ZXVlLmRlbGV0ZU5vZGUoaGFuZGxlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBnZXRNZXNzYWdlQ2hhbm5lbFNjaGVkdWxlcigpIHtcclxuICAgICAgICB2YXIgcXVldWUgPSBuZXcgbGlzdF8xLkxpbmtlZExpc3QoKTtcclxuICAgICAgICB2YXIgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xyXG4gICAgICAgIGNoYW5uZWwucG9ydDIub25tZXNzYWdlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgbm9kZSA9IHF1ZXVlLmZpcnN0O1xyXG4gICAgICAgICAgICBpZiAobm9kZSkge1xyXG4gICAgICAgICAgICAgICAgcXVldWUuZGVsZXRlRmlyc3QoKTtcclxuICAgICAgICAgICAgICAgIHZhciBjYWxsYmFjayA9IG5vZGUudmFsdWU7XHJcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzY2hlZHVsZVRpY2s6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgdmFyIGhhbmRsZSA9IHF1ZXVlLmFkZExhc3QoY2FsbGJhY2spO1xyXG4gICAgICAgICAgICAgICAgY2hhbm5lbC5wb3J0MS5wb3N0TWVzc2FnZSh1bmRlZmluZWQpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGhhbmRsZTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgY2FuY2VsVGljazogZnVuY3Rpb24gKGhhbmRsZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGhhbmRsZSAmJiBoYW5kbGUubGlzdCA9PT0gcXVldWUpIHtcclxuICAgICAgICAgICAgICAgICAgICBxdWV1ZS5kZWxldGVOb2RlKGhhbmRsZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gZ2V0U2V0VGltZW91dFNjaGVkdWxlcigpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzY2hlZHVsZVRpY2s6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoY2FsbGJhY2ssIDApO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjYW5jZWxUaWNrOiBmdW5jdGlvbiAoaGFuZGxlKSB7XHJcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoaGFuZGxlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBnZXRNaXNzaW5nU2NoZWR1bGVyKCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHNjaGVkdWxlVGljazogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJTY2hlZHVsZXIgbm90IGF2YWlsYWJsZS5cIik7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNhbmNlbFRpY2s6IGZ1bmN0aW9uIChoYW5kbGUpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlNjaGVkdWxlciBub3QgYXZhaWxhYmxlLlwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICBpZiAodHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldFNldEltbWVkaWF0ZVNjaGVkdWxlcigpO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAodHlwZW9mIG1zU2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICByZXR1cm4gZ2V0TVNTZXRJbW1lZGlhdGVTY2hlZHVsZXIoKTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldE1lc3NhZ2VDaGFubmVsU2NoZWR1bGVyKCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmICh0eXBlb2YgcHJvY2VzcyA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgcHJvY2Vzcy5uZXh0VGljayA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldE5leHRUaWNrU2NoZWR1bGVyKCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldFNldFRpbWVvdXRTY2hlZHVsZXIoKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBnZXRNaXNzaW5nU2NoZWR1bGVyKCk7XHJcbiAgICB9XHJcbn1cclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy90YXNrLmpzLm1hcCIsIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKEMpIFJvbiBBLiBCdWNrdG9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpOyB5b3UgbWF5IG5vdCB1c2VcclxudGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGVcclxuTGljZW5zZSBhdCBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuXHJcblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuXHJcblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbnZhciBwcm9taXNlXzEgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcclxudmFyIGNhbmNlbGxhdGlvbl8xID0gcmVxdWlyZSgnLi9jYW5jZWxsYXRpb24nKTtcclxudmFyIHRhc2tfMSA9IHJlcXVpcmUoJy4vdGFzaycpO1xyXG5mdW5jdGlvbiBzbGVlcChkZWxheSwgdG9rZW4pIHtcclxuICAgIGlmIChkZWxheSA9PT0gdm9pZCAwKSB7IGRlbGF5ID0gMDsgfVxyXG4gICAgaWYgKHRva2VuID09PSB2b2lkIDApIHsgdG9rZW4gPSBjYW5jZWxsYXRpb25fMS5DYW5jZWxsYXRpb25Ub2tlbi5ub25lOyB9XHJcbiAgICBpZiAodHlwZW9mIGRlbGF5ICE9PSBcIm51bWJlclwiKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk51bWJlciBleHBlY3RlZC5cIik7XHJcbiAgICB9XHJcbiAgICBpZiAodG9rZW4uY2FuY2VsZWQpIHtcclxuICAgICAgICByZXR1cm4gcHJvbWlzZV8xLlByb21pc2UucmVqZWN0KHRva2VuLnJlYXNvbik7XHJcbiAgICB9XHJcbiAgICBpZiAoIXRva2VuLmNhbkJlQ2FuY2VsZWQgJiYgZGVsYXkgPD0gMCkge1xyXG4gICAgICAgIHJldHVybiBwcm9taXNlXzEuUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV3IHByb21pc2VfMS5Qcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICB0b2tlbi5yZWdpc3RlcihyZWplY3QpO1xyXG4gICAgICAgIHRhc2tfMS5zY2hlZHVsZVRhc2socmVzb2x2ZSwgZGVsYXksIHRva2VuKTtcclxuICAgIH0pO1xyXG59XHJcbmV4cG9ydHMuc2xlZXAgPSBzbGVlcDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy91dGlscy5qcy5tYXAiXX0=
