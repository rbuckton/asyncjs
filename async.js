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
var promise = require('./promise');
var deferred = require('./deferred');
var cancellation = require('./cancellation');
var utils = require('./utils');
exports.Promise = promise.Promise;
exports.Deferred = deferred.Deferred;
exports.CancellationToken = cancellation.CancellationToken;
exports.CancellationTokenSource = cancellation.CancellationTokenSource;
exports.sleep = utils.sleep;
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
var list = require('./list');
var LinkedList = list.LinkedList;
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
            callbacks = new LinkedList();
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
var promise = require('./promise');
var cancellation = require('./cancellation');
var Promise = promise.Promise;
var CancellationTokenSource = cancellation.CancellationTokenSource;
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
            var cts = new CancellationTokenSource([_this._cts.token, token]);
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
        return new Promise(function (resolve, reject) {
            // create a linked token
            var cts = new CancellationTokenSource([_this._cts.token, token]);
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
var task = require('./task');
var scheduleTask = task.scheduleTask;
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
        scheduleTask(function () {
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
var list = require('./list');
var cancellation = require('./cancellation');
var LinkedList = list.LinkedList;
var CancellationToken = cancellation.CancellationToken;
function getOrCreateQueue() {
    if (!queue) {
        queue = new LinkedList();
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
    if (token === void 0) { token = CancellationToken.none; }
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
        var queue = new LinkedList();
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
        var queue = new LinkedList();
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
var promise = require('./promise');
var cancellation = require('./cancellation');
var task = require('./task');
var Promise = promise.Promise;
var CancellationToken = cancellation.CancellationToken;
var scheduleTask = task.scheduleTask;
function sleep(delay, token) {
    if (delay === void 0) { delay = 0; }
    if (token === void 0) { token = CancellationToken.none; }
    if (typeof delay !== "number") {
        throw new TypeError("Number expected.");
    }
    if (token.canceled) {
        return Promise.reject(token.reason);
    }
    if (!token.canBeCanceled && delay <= 0) {
        return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
        token.register(reject);
        scheduleTask(resolve, delay, token);
    });
}
exports.sleep = sleep;
//# sourceMappingURL=file:///C|/dev/asyncjs/utils.js.map
},{"./cancellation":undefined,"./promise":undefined,"./task":undefined}]},{},[5,7,6,3,2,8,4,1])(8)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwibGliXFxhc3luYy5qcyIsImxpYlxcY2FuY2VsbGF0aW9uLmpzIiwibGliXFxkZWZlcnJlZC5qcyIsImxpYlxcaHR0cGNsaWVudC5qcyIsImxpYlxcbGlzdC5qcyIsImxpYlxccHJvbWlzZS5qcyIsImxpYlxcdGFzay5qcyIsImxpYlxcdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3p6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaE5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChDKSBSb24gQS4gQnVja3Rvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTsgeW91IG1heSBub3QgdXNlXHJcbnRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlXHJcbkxpY2Vuc2UgYXQgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcblxyXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcblxyXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG52YXIgcHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xyXG52YXIgZGVmZXJyZWQgPSByZXF1aXJlKCcuL2RlZmVycmVkJyk7XHJcbnZhciBjYW5jZWxsYXRpb24gPSByZXF1aXJlKCcuL2NhbmNlbGxhdGlvbicpO1xyXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XHJcbmV4cG9ydHMuUHJvbWlzZSA9IHByb21pc2UuUHJvbWlzZTtcclxuZXhwb3J0cy5EZWZlcnJlZCA9IGRlZmVycmVkLkRlZmVycmVkO1xyXG5leHBvcnRzLkNhbmNlbGxhdGlvblRva2VuID0gY2FuY2VsbGF0aW9uLkNhbmNlbGxhdGlvblRva2VuO1xyXG5leHBvcnRzLkNhbmNlbGxhdGlvblRva2VuU291cmNlID0gY2FuY2VsbGF0aW9uLkNhbmNlbGxhdGlvblRva2VuU291cmNlO1xyXG5leHBvcnRzLnNsZWVwID0gdXRpbHMuc2xlZXA7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGU6Ly8vQ3wvZGV2L2FzeW5janMvYXN5bmMuanMubWFwIiwiLyohICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoQykgUm9uIEEuIEJ1Y2t0b24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7IHlvdSBtYXkgbm90IHVzZVxyXG50aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS4gWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZVxyXG5MaWNlbnNlIGF0IGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxyXG5cclxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxyXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXHJcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxyXG5cclxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxudmFyIGxpc3QgPSByZXF1aXJlKCcuL2xpc3QnKTtcclxudmFyIExpbmtlZExpc3QgPSBsaXN0LkxpbmtlZExpc3Q7XHJcbnZhciBoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucyA9IHR5cGVvZiBEZWJ1ZyAhPT0gXCJ1bmRlZmluZWRcIiAmJlxyXG50eXBlb2YgRGVidWcuc2V0Tm9uVXNlckNvZGVFeGNlcHRpb25zID09PSBcImJvb2xlYW5cIjtcclxuLyoqXHJcbiAgKiBBIHNvdXJjZSBmb3IgY2FuY2VsbGF0aW9uXHJcbiAgKi9cclxudmFyIENhbmNlbGxhdGlvblRva2VuU291cmNlID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIC8qKlxyXG4gICAgICAqIEBwYXJhbSBsaW5rcyBPdGhlciBgQ2FuY2VsbGF0aW9uVG9rZW5gIGluc3RhbmNlcyB0aGF0IHdpbGwgY2FuY2VsIHRoaXMgc291cmNlIGlmIHRoZSB0b2tlbnMgYXJlIGNhbmNlbGVkLlxyXG4gICAgICAqL1xyXG4gICAgZnVuY3Rpb24gQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UobGlua3MpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHRoaXMuX3Rva2VuID0gbmV3IENhbmNlbGxhdGlvblRva2VuKHRoaXMpO1xyXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIl90b2tlblwiLCB7IHdyaXRhYmxlOiBmYWxzZSwgY29uZmlndXJhYmxlOiBmYWxzZSB9KTtcclxuICAgICAgICBpZiAobGlua3MpIHtcclxuICAgICAgICAgICAgdGhpcy5fbGlua3MgPSBuZXcgQXJyYXkoKTtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaW5rcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIHZhciBsaW5rID0gbGlua3NbaV07XHJcbiAgICAgICAgICAgICAgICBpZiAoIWxpbmspIHtcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChsaW5rLmNhbmNlbGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FuY2VsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlYXNvbiA9IGxpbmsucmVhc29uO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuX2xpbmtzLnB1c2gobGluay5yZWdpc3RlcihmdW5jdGlvbiAocmVhc29uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuY2FuY2VsKHJlYXNvbik7XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UucHJvdG90eXBlLCBcInRva2VuXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSBgQ2FuY2VsbGF0aW9uVG9rZW5gIGZvciB0aGlzIHNvdXJjZS5cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3Rva2VuO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgLyoqXHJcbiAgICAgKiBTaWduYWxzIHRoZSBzb3VyY2UgaXMgY2FuY2VsbGVkLlxyXG4gICAgICogQHBhcmFtIHJlYXNvbiBBbiBvcHRpb25hbCByZWFzb24gZm9yIHRoZSBjYW5jZWxsYXRpb24uXHJcbiAgICAgKi9cclxuICAgIENhbmNlbGxhdGlvblRva2VuU291cmNlLnByb3RvdHlwZS5jYW5jZWwgPSBmdW5jdGlvbiAocmVhc29uKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2NhbmNlbGVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fdGhyb3dJZkZyb3plbigpO1xyXG4gICAgICAgIGlmIChyZWFzb24gPT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZWFzb24gPSBuZXcgRXJyb3IoXCJvcGVyYXRpb24gd2FzIGNhbmNlbGVkLlwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHJlYXNvbiBpbnN0YW5jZW9mIEVycm9yICYmICEoXCJzdGFja1wiIGluIHJlYXNvbikpIHtcclxuICAgICAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyByZWFzb247XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICByZWFzb24gPSBlcnJvcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzO1xyXG4gICAgICAgIHRoaXMuX2NhbmNlbGVkID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLl9yZWFzb24gPSByZWFzb247XHJcbiAgICAgICAgdGhpcy5fY2FsbGJhY2tzID0gbnVsbDtcclxuICAgICAgICBPYmplY3QuZnJlZXplKHRoaXMpO1xyXG4gICAgICAgIGlmIChjYWxsYmFja3MpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrcy5mb3JFYWNoKGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHJlYXNvbik7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBmaW5hbGx5IHtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrcy5jbGVhcigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQ2xvc2VzIHRoZSBDYW5jZWxsYXRpb25Tb3VyY2UsIHByZXZlbnRpbmcgYW55IGZ1dHVyZSBjYW5jZWxsYXRpb24gc2lnbmFsLlxyXG4gICAgICovXHJcbiAgICBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKE9iamVjdC5pc0Zyb3plbih0aGlzKSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLl9saW5rcykge1xyXG4gICAgICAgICAgICB2YXIgbGlua3MgPSB0aGlzLl9saW5rcztcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaW5rcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGxpbmtzW2ldLnVucmVnaXN0ZXIoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5fY2FsbGJhY2tzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrcy5jbGVhcigpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9saW5rcyA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5fY2FsbGJhY2tzID0gbnVsbDtcclxuICAgICAgICBPYmplY3QuZnJlZXplKHRoaXMpO1xyXG4gICAgfTtcclxuICAgIENhbmNlbGxhdGlvblRva2VuU291cmNlLnByb3RvdHlwZS5fcmVnaXN0ZXIgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICBpZiAodGhpcy5fY2FuY2VsZWQpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2sodGhpcy5fcmVhc29uKTtcclxuICAgICAgICAgICAgcmV0dXJuIGVtcHR5UmVnaXN0cmF0aW9uO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoT2JqZWN0LmlzRnJvemVuKHRoaXMpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlbXB0eVJlZ2lzdHJhdGlvbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIGNhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcztcclxuICAgICAgICBpZiAoIWNhbGxiYWNrcykge1xyXG4gICAgICAgICAgICBjYWxsYmFja3MgPSBuZXcgTGlua2VkTGlzdCgpO1xyXG4gICAgICAgICAgICB0aGlzLl9jYWxsYmFja3MgPSBjYWxsYmFja3M7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBjb29raWUgPSBjYWxsYmFja3MuYWRkTGFzdChjYWxsYmFjayk7XHJcbiAgICAgICAgcmV0dXJuIE9iamVjdC5mcmVlemUoe1xyXG4gICAgICAgICAgICB1bnJlZ2lzdGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBjYWxsYmFja3MuZGVsZXRlTm9kZShjb29raWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UucHJvdG90eXBlLl90aHJvd0lmRnJvemVuID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmIChPYmplY3QuaXNGcm96ZW4odGhpcykpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY2Fubm90IG1vZGlmeSBhIGNsb3NlZCBzb3VyY2VcIik7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHJldHVybiBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZTtcclxufSkoKTtcclxuZXhwb3J0cy5DYW5jZWxsYXRpb25Ub2tlblNvdXJjZSA9IENhbmNlbGxhdGlvblRva2VuU291cmNlO1xyXG4vKipcclxuICAqIEEgdG9rZW4gdXNlZCB0byByZWNpZXZlIGEgY2FuY2VsbGF0aW9uIHNpZ25hbC5cclxuICAqL1xyXG52YXIgQ2FuY2VsbGF0aW9uVG9rZW4gPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgLypAaW50ZXJuYWwqL1xyXG4gICAgZnVuY3Rpb24gQ2FuY2VsbGF0aW9uVG9rZW4oc291cmNlKSB7XHJcbiAgICAgICAgdGhpcy5fc291cmNlID0gc291cmNlO1xyXG4gICAgICAgIE9iamVjdC5mcmVlemUodGhpcyk7XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ2FuY2VsbGF0aW9uVG9rZW4sIFwibm9uZVwiLCB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICAqIEdldHMgYW4gZW1wdHkgY2FuY2VsbGF0aW9uIHRva2VuIHRoYXQgd2lsbCBuZXZlciBiZSBjYW5jZWxlZC5cclxuICAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICghQ2FuY2VsbGF0aW9uVG9rZW4uX25vbmUpIHtcclxuICAgICAgICAgICAgICAgIENhbmNlbGxhdGlvblRva2VuLl9ub25lID0gbmV3IENhbmNlbGxhdGlvblRva2VuKHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIENhbmNlbGxhdGlvblRva2VuLl9ub25lO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KENhbmNlbGxhdGlvblRva2VuLnByb3RvdHlwZSwgXCJjYW5CZUNhbmNlbGVkXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgICogR2V0cyBhIHZhbHVlIGluZGljYXRpbmcgd2hldGhlciB0aGUgdG9rZW4gY2FuIGJlIGNhbmNlbGVkLlxyXG4gICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuICEhdGhpcy5fc291cmNlICYmICFPYmplY3QuaXNGcm96ZW4odGhpcy5fc291cmNlKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDYW5jZWxsYXRpb25Ub2tlbi5wcm90b3R5cGUsIFwiY2FuY2VsZWRcIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAgKiBHZXRzIGEgdmFsdWUgaW5kaWNhdGluZyB3aGV0aGVyIHRoZSB0b2tlbiBoYXMgcmVjZWl2ZWQgYSBjYW5jZWxsYXRpb24gc2lnbmFsLlxyXG4gICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLl9zb3VyY2UpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc291cmNlLl9jYW5jZWxlZDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDYW5jZWxsYXRpb25Ub2tlbi5wcm90b3R5cGUsIFwicmVhc29uXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgICogR2V0cyB0aGUgcmVhc29uIGZvciBjYW5jZWxsYXRpb24sIGlmIG9uZSB3YXMgc3VwcGxpZWQuXHJcbiAgICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3NvdXJjZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc291cmNlLl9yZWFzb247XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICAvKipcclxuICAgICAgKiBUaHJvd3MgYW4gYEVycm9yYCBpZiB0aGUgdG9rZW4gaGFzIHJlY2VpdmVkIGEgY2FuY2VsbGF0aW9uIHNpZ25hbC5cclxuICAgICAgKi9cclxuICAgIENhbmNlbGxhdGlvblRva2VuLnByb3RvdHlwZS50aHJvd0lmQ2FuY2VsZWQgPSBmdW5jdGlvbiAocmVhc29uKSB7XHJcbiAgICAgICAgaWYgKHJlYXNvbiA9PT0gdm9pZCAwKSB7IHJlYXNvbiA9IHRoaXMucmVhc29uOyB9XHJcbiAgICAgICAgaWYgKCF0aGlzLl9zb3VyY2UpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5jYW5jZWxlZCkge1xyXG4gICAgICAgICAgICB0aHJvdyByZWFzb247XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICAqIFJlcXVlc3RzIGEgY2FsbGJhY2sgd2hlbiB0aGUgdG9rZW4gcmVjZWl2ZXMgYSBjYW5jZWxsYXRpb24gc2lnbmFsIHRvIHBlcmZvcm0gYWRkaXRpb25hbCBjbGVhbnVwLlxyXG4gICAgICAqIEBwYXJhbSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgdG8gZXhlY3V0ZVxyXG4gICAgICAqIEByZXR1cm5zIEEgYENhbmNlbGxhdGlvblRva2VuUmVnaXN0cmF0aW9uYCB0aGF0IHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSBjbGVhbnVwIHJlcXVlc3QuXHJcbiAgICAgICovXHJcbiAgICBDYW5jZWxsYXRpb25Ub2tlbi5wcm90b3R5cGUucmVnaXN0ZXIgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkFyZ3VtZW50IGlzIG5vdCBhIEZ1bmN0aW9uIG9iamVjdFwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF0aGlzLl9zb3VyY2UpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVtcHR5UmVnaXN0cmF0aW9uO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcy5fc291cmNlLl9yZWdpc3RlcihjYWxsYmFjayk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIENhbmNlbGxhdGlvblRva2VuO1xyXG59KSgpO1xyXG5leHBvcnRzLkNhbmNlbGxhdGlvblRva2VuID0gQ2FuY2VsbGF0aW9uVG9rZW47XHJcbnZhciBlbXB0eVJlZ2lzdHJhdGlvbiA9IE9iamVjdC5mcmVlemUoeyB1bnJlZ2lzdGVyOiBmdW5jdGlvbiAoKSB7IH0gfSk7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGU6Ly8vQ3wvZGV2L2FzeW5janMvY2FuY2VsbGF0aW9uLmpzLm1hcCIsIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKEMpIFJvbiBBLiBCdWNrdG9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpOyB5b3UgbWF5IG5vdCB1c2VcclxudGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGVcclxuTGljZW5zZSBhdCBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuXHJcblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuXHJcblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbnZhciBwcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XHJcbnZhciBQcm9taXNlID0gcHJvbWlzZS5Qcm9taXNlO1xyXG52YXIgRGVmZXJyZWQgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gRGVmZXJyZWQoKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB0aGlzLl9wcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICBfdGhpcy5fcmVzb2x2ZSA9IHJlc29sdmU7XHJcbiAgICAgICAgICAgIF90aGlzLl9yZWplY3QgPSByZWplY3Q7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoRGVmZXJyZWQucHJvdG90eXBlLCBcInByb21pc2VcIiwge1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcHJvbWlzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIERlZmVycmVkLnByb3RvdHlwZS5yZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdGhpcy5fcmVzb2x2ZSh2YWx1ZSk7XHJcbiAgICB9O1xyXG4gICAgRGVmZXJyZWQucHJvdG90eXBlLnJlamVjdCA9IGZ1bmN0aW9uIChyZWFzb24pIHtcclxuICAgICAgICB0aGlzLl9yZWplY3QocmVhc29uKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gRGVmZXJyZWQ7XHJcbn0pKCk7XHJcbmV4cG9ydHMuRGVmZXJyZWQgPSBEZWZlcnJlZDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy9kZWZlcnJlZC5qcy5tYXAiLCIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChDKSBSb24gQS4gQnVja3Rvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTsgeW91IG1heSBub3QgdXNlXHJcbnRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlXHJcbkxpY2Vuc2UgYXQgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcblxyXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcblxyXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG52YXIgcHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xyXG52YXIgY2FuY2VsbGF0aW9uID0gcmVxdWlyZSgnLi9jYW5jZWxsYXRpb24nKTtcclxudmFyIFByb21pc2UgPSBwcm9taXNlLlByb21pc2U7XHJcbnZhciBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSA9IGNhbmNlbGxhdGlvbi5DYW5jZWxsYXRpb25Ub2tlblNvdXJjZTtcclxudmFyIGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zID0gdHlwZW9mIERlYnVnICE9PSBcInVuZGVmaW5lZFwiICYmXHJcbnR5cGVvZiBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPT09IFwiYm9vbGVhblwiO1xyXG4vKipcclxuICogQSBVcmlcclxuICovXHJcbnZhciBVcmkgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gVXJpKCkge1xyXG4gICAgICAgIHZhciBhcmdzID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICAgICAgYXJnc1tfaSAtIDBdID0gYXJndW1lbnRzW19pXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogVGhlIHByb3RvY29sIGZvciB0aGUgVXJpIChlLmcuICdodHRwOicpXHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnByb3RvY29sID0gXCJcIjtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUaGUgaG9zdG5hbWUgZm9yIHRoZSBVcmlcclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuaG9zdG5hbWUgPSBcIlwiO1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRoZSBwb3J0IG51bWJlciBmb3IgdGhlIFVyaVxyXG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5wb3J0ID0gbnVsbDtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUaGUgcGF0aCBuYW1lIGZvciB0aGUgVXJpXHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnBhdGhuYW1lID0gXCJcIjtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUaGUgc2VhcmNoIHBvcnRpb24gb2YgdGhlIHBhdGgsIGFsc28ga25vd24gYXMgdGhlIHF1ZXJ5c3RyaW5nXHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnNlYXJjaCA9IFwiXCI7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogVGhlIGZyYWdtZW50IHBvcnRpb24gb2YgdGhlIHBhdGhcclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuaGFzaCA9IFwiXCI7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQSB2YWx1ZSBpbmRpY2F0aW5nIHdoZXRoZXIgdGhlIFVybCBpcyBhbiBhYnNvbHV0ZSB1cmxcclxuICAgICAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLmFic29sdXRlID0gZmFsc2U7XHJcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID09PSAwKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBcmd1bWVudCBtaXNzaW5nXCIpO1xyXG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICAgICAgICB2YXIgbSA9IFVyaVBhcnNlci5leGVjKGFyZ3NbMF0pO1xyXG4gICAgICAgICAgICBpZiAoIW0pXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVVJJRXJyb3IoKTtcclxuICAgICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiBVcmlQYXJ0cykge1xyXG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gVXJpUGFydHNbbmFtZV07XHJcbiAgICAgICAgICAgICAgICB2YXIgcGFydCA9IG1baW5kZXhdO1xyXG4gICAgICAgICAgICAgICAgaWYgKHBhcnQpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPCA1KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0ID0gcGFydC50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGluZGV4ID09PSA1KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0ID0gcGFyc2VJbnQocGFydCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPT09IDUpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnQgPSBtWzFdID8gVXJpUG9ydHNbdGhpcy5wcm90b2NvbF0gOiBudWxsO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpc1tuYW1lXSA9IHBhcnQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5hYnNvbHV0ZSA9ICEhbVsxXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHZhciBiYXNlVXJpID0gYXJnc1swXSBpbnN0YW5jZW9mIFVyaSA/IGFyZ3NbMF0gOiBVcmkucGFyc2UoYXJnc1swXSk7XHJcbiAgICAgICAgICAgIHZhciB1cmkgPSBhcmdzWzBdIGluc3RhbmNlb2YgVXJpID8gYXJnc1sxXSA6IFVyaS5wYXJzZShhcmdzWzFdKTtcclxuICAgICAgICAgICAgdGhpcy5oYXNoID0gdXJpLmhhc2g7XHJcbiAgICAgICAgICAgIGlmICh1cmkucHJvdG9jb2wpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucHJvdG9jb2wgPSB1cmkucHJvdG9jb2w7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmhvc3RuYW1lID0gdXJpLmhvc3RuYW1lO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wb3J0ID0gdXJpLnBvcnQ7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBhdGhuYW1lID0gdXJpLnBhdGhuYW1lO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZWFyY2ggPSB1cmkuc2VhcmNoO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5oYXNoID0gdXJpLmhhc2g7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFic29sdXRlID0gdXJpLmFic29sdXRlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wcm90b2NvbCA9IGJhc2VVcmkucHJvdG9jb2w7XHJcbiAgICAgICAgICAgICAgICBpZiAodXJpLmhvc3RuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5ob3N0bmFtZSA9IHVyaS5ob3N0bmFtZTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBvcnQgPSB1cmkucG9ydDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBhdGhuYW1lID0gdXJpLnBhdGhuYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2VhcmNoID0gdXJpLnNlYXJjaDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmhhc2ggPSB1cmkuaGFzaDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFic29sdXRlID0gdXJpLmFic29sdXRlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5ob3N0bmFtZSA9IGJhc2VVcmkuaG9zdG5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3J0ID0gYmFzZVVyaS5wb3J0O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh1cmkucGF0aG5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVyaS5wYXRobmFtZS5jaGFyQXQoMCkgPT09ICcvJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXRobmFtZSA9IHVyaS5wYXRobmFtZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgoYmFzZVVyaS5hYnNvbHV0ZSAmJiAhYmFzZVVyaS5wYXRobmFtZSkgfHwgYmFzZVVyaS5wYXRobmFtZSA9PT0gXCIvXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhdGhuYW1lID0gJy8nICsgdXJpLnBhdGhuYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoYmFzZVVyaS5wYXRobmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwYXJ0cyA9IGJhc2VVcmkucGF0aG5hbWUuc3BsaXQoJy8nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXSA9IHVyaS5wYXRobmFtZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhdGhuYW1lID0gcGFydHMuam9pbignLycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhdGhuYW1lID0gYmFzZVVyaS5wYXRobmFtZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVyaS5zZWFyY2gpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2VhcmNoID0gdXJpLnNlYXJjaDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2VhcmNoID0gYmFzZVVyaS5zZWFyY2g7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgT2JqZWN0LmZyZWV6ZSh0aGlzKTtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShVcmkucHJvdG90eXBlLCBcIm9yaWdpblwiLCB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogR2V0cyB0aGUgb3JpZ2luIG9mIHRoZSBVcmlcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9TdHJpbmcoXCJvcmlnaW5cIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoVXJpLnByb3RvdHlwZSwgXCJob3N0XCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSBob3N0IGZvciB0aGUgdXJpLCBpbmNsdWRpbmcgdGhlIGhvc3RuYW1lIGFuZCBwb3J0XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRvU3RyaW5nKFwiaG9zdFwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShVcmkucHJvdG90eXBlLCBcInNjaGVtZVwiLCB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogR2V0cyB0aGUgc2NoZW1lIGZvciB0aGUgdXJpIChlLmcuICdodHRwOi8vJycpXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRvU3RyaW5nKFwic2NoZW1lXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgLyoqXHJcbiAgICAgKiBUZXN0cyB3aGV0aGVyIHRoZSBwcm92aWRlZCB1cmkgaGFzIHRoZSBzYW1lIG9yaWdpbiBhcyB0aGlzIHVyaVxyXG4gICAgICogQHBhcmFtIHVyaSBUaGUgdXJpIHRvIGNvbXBhcmUgYWdhaW5zdFxyXG4gICAgICogQHJldHVybnMgVHJ1ZSBpZiB0aGUgdXJpJ3MgaGF2ZSB0aGUgc2FtZSBvcmlnaW47IG90aGVyd2lzZSwgZmFsc2VcclxuICAgICAqL1xyXG4gICAgVXJpLnByb3RvdHlwZS5pc1NhbWVPcmlnaW4gPSBmdW5jdGlvbiAodXJpKSB7XHJcbiAgICAgICAgdmFyIG90aGVyO1xyXG4gICAgICAgIGlmICh0eXBlb2YgdXJpID09PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICAgIG90aGVyID0gVXJpLnBhcnNlKHVyaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHVyaSBpbnN0YW5jZW9mIFVyaSkge1xyXG4gICAgICAgICAgICBvdGhlciA9IHVyaTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJBcmd1bWVudCBub3Qgb3B0aW9uYWwuXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5hYnNvbHV0ZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5vcmlnaW4gPT09IG90aGVyLm9yaWdpbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuICFvdGhlci5hYnNvbHV0ZTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgVXJpXHJcbiAgICAgKiBAcGFyYW0gZm9ybWF0IHtTdHJpbmd9IEEgZm9ybWF0IHNwZWNpZmllci5cclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBzdHJpbmcgY29udGVudCBvZiB0aGUgVXJpXHJcbiAgICAgKi9cclxuICAgIFVyaS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoZm9ybWF0KSB7XHJcbiAgICAgICAgc3dpdGNoIChmb3JtYXQpIHtcclxuICAgICAgICAgICAgY2FzZSBcIm9yaWdpblwiOlxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucHJvdG9jb2wgJiYgdGhpcy5ob3N0bmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcodGhpcy5wcm90b2NvbCkgKyBcIi8vXCIgKyB0aGlzLnRvU3RyaW5nKFwiaG9zdFwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgICAgICAgICBjYXNlIFwiYXV0aG9yaXR5XCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJob3N0XCI6XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5ob3N0bmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBvcnQgIT09IFVyaVBvcnRzW3RoaXMucHJvdG9jb2xdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcodGhpcy5ob3N0bmFtZSkgKyBcIjpcIiArIHRoaXMudG9TdHJpbmcoXCJwb3J0XCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gU3RyaW5nKHRoaXMuaG9zdG5hbWUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICAgICAgICAgIGNhc2UgXCJwYXRoK3NlYXJjaFwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh0aGlzLnBhdGhuYW1lKSArIFN0cmluZyh0aGlzLnNlYXJjaCk7XHJcbiAgICAgICAgICAgIGNhc2UgXCJzY2hlbWVcIjogcmV0dXJuIHRoaXMudG9TdHJpbmcoXCJwcm90b2NvbFwiKSArIFwiLy9cIjtcclxuICAgICAgICAgICAgY2FzZSBcInByb3RvY29sXCI6IHJldHVybiBTdHJpbmcodGhpcy5wcm90b2NvbCB8fCBcIlwiKTtcclxuICAgICAgICAgICAgY2FzZSBcImhvc3RuYW1lXCI6IHJldHVybiBTdHJpbmcodGhpcy5ob3N0bmFtZSB8fCBcIlwiKTtcclxuICAgICAgICAgICAgY2FzZSBcInBvcnRcIjpcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBvcnQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gU3RyaW5nKHRoaXMucG9ydCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wcm90b2NvbCAmJiBVcmlQb3J0c1t0aGlzLnByb3RvY29sXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcoVXJpUG9ydHNbdGhpcy5wcm90b2NvbF0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICAgICAgICAgIGNhc2UgXCJmaWxlXCI6XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wYXRobmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpID0gdGhpcy5wYXRobmFtZS5sYXN0SW5kZXhPZihcIi9cIikgKyAxO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRobmFtZS5zdWJzdHIoaSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICAgICAgICAgIGNhc2UgXCJkaXJcIjpcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBhdGhuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGkgPSB0aGlzLnBhdGhuYW1lLmxhc3RJbmRleE9mKFwiL1wiKSArIDE7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhuYW1lLnN1YnN0cigwLCBpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICAgICAgY2FzZSBcImV4dFwiOlxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGF0aG5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgaSA9IHRoaXMucGF0aG5hbWUubGFzdEluZGV4T2YoXCIvXCIpICsgMTtcclxuICAgICAgICAgICAgICAgICAgICBpID0gdGhpcy5wYXRobmFtZS5sYXN0SW5kZXhPZihcIi5cIiwgaSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhuYW1lLnN1YnN0cihpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICAgICAgY2FzZSBcImZpbGUtZXh0XCI6XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wYXRobmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpID0gdGhpcy5wYXRobmFtZS5sYXN0SW5kZXhPZihcIi9cIikgKyAxO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBqID0gdGhpcy5wYXRobmFtZS5sYXN0SW5kZXhPZihcIi5cIiwgaSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChqID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aG5hbWUuc3Vic3RyaW5nKGksIGopO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhuYW1lLnN1YnN0cihpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICAgICAgY2FzZSBcImZyYWdtZW50XCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJoYXNoXCI6XHJcbiAgICAgICAgICAgICAgICB2YXIgaGFzaCA9IFN0cmluZyh0aGlzLmhhc2ggfHwgXCJcIik7XHJcbiAgICAgICAgICAgICAgICBpZiAoaGFzaC5sZW5ndGggPiAwICYmIGhhc2guY2hhckF0KDApICE9IFwiI1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiI1wiICsgaGFzaDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBoYXNoO1xyXG4gICAgICAgICAgICBjYXNlIFwicGF0aFwiOlxyXG4gICAgICAgICAgICBjYXNlIFwicGF0aG5hbWVcIjpcclxuICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcodGhpcy5wYXRobmFtZSB8fCBcIlwiKTtcclxuICAgICAgICAgICAgY2FzZSBcInNlYXJjaFwiOlxyXG4gICAgICAgICAgICBjYXNlIFwicXVlcnlcIjpcclxuICAgICAgICAgICAgICAgIHZhciBzZWFyY2ggPSBTdHJpbmcodGhpcy5zZWFyY2ggfHwgXCJcIik7XHJcbiAgICAgICAgICAgICAgICBpZiAoc2VhcmNoLmxlbmd0aCA+IDAgJiYgc2VhcmNoLmNoYXJBdCgwKSAhPSBcIj9cIikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIj9cIiArIHNlYXJjaDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBzZWFyY2g7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50b1N0cmluZyhcIm9yaWdpblwiKSArIHRoaXMudG9TdHJpbmcoXCJwYXRobmFtZVwiKSArIHRoaXMudG9TdHJpbmcoXCJzZWFyY2hcIikgKyB0aGlzLnRvU3RyaW5nKFwiaGFzaFwiKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBQYXJzZXMgdGhlIHByb3ZpZGVkIHVyaSBzdHJpbmdcclxuICAgICAqIEBwYXJhbSB1cmkge1N0cmluZ30gVGhlIHVyaSBzdHJpbmcgdG8gcGFyc2VcclxuICAgICAqIEByZXR1cm5zIHtVcml9IFRoZSBwYXJzZWQgdXJpXHJcbiAgICAgKi9cclxuICAgIFVyaS5wYXJzZSA9IGZ1bmN0aW9uICh1cmkpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFVyaSh1cmkpO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQ29tYmluZXMgdHdvIHVyaXNcclxuICAgICAqIEBwYXJhbSBiYXNlVXJpIFRoZSBiYXNlIHVyaVxyXG4gICAgICogQHBhcmFtIHVyaSBUaGUgcmVsYXRpdmUgdXJpXHJcbiAgICAgKiBAcmV0dXJucyBUaGUgY29tYmluZWQgdXJpXHJcbiAgICAgKi9cclxuICAgIFVyaS5jb21iaW5lID0gZnVuY3Rpb24gKGJhc2VVcmksIHVyaSkge1xyXG4gICAgICAgIHJldHVybiBuZXcgVXJpKGJhc2VVcmksIHVyaSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIFVyaTtcclxufSkoKTtcclxuZXhwb3J0cy5VcmkgPSBVcmk7XHJcbnZhciBRdWVyeVN0cmluZztcclxuKGZ1bmN0aW9uIChRdWVyeVN0cmluZykge1xyXG4gICAgdmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XHJcbiAgICB2YXIgUXVlcnlTdHJpbmdQYXJzZXIgPSAvKD86XFw/fCZ8XikoW149Jl0qKSg/Oj0oW14mXSopKT8vZztcclxuICAgIGZ1bmN0aW9uIHN0cmluZ2lmeShvYmopIHtcclxuICAgICAgICBpZiAoIW9iaikge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHFzID0gW107XHJcbiAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XHJcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IG9ialtuYW1lXTtcclxuICAgICAgICAgICAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgXCJzdHJpbmdcIjpcclxuICAgICAgICAgICAgICAgIGNhc2UgXCJudW1iZXJcIjpcclxuICAgICAgICAgICAgICAgIGNhc2UgXCJib29sZWFuXCI6IHtcclxuICAgICAgICAgICAgICAgICAgICBxcy5wdXNoKGVuY29kZVVSSUNvbXBvbmVudChuYW1lKSArIFwiPVwiICsgZW5jb2RlVVJJQ29tcG9uZW50KFN0cmluZyh2YWx1ZSkpKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhciA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IGFyLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoICh0eXBlb2YgYXJbaV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIFwic3RyaW5nXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBcIm51bWJlclwiOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgXCJib29sZWFuXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHFzLnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KG5hbWUpICsgXCI9XCIgKyBlbmNvZGVVUklDb21wb25lbnQoU3RyaW5nKHZhbHVlKSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBxcy5wdXNoKGVuY29kZVVSSUNvbXBvbmVudChuYW1lKSArIFwiPVwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHFzLnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KG5hbWUpICsgXCI9XCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGlmIChxcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiP1wiICsgcXMuam9pbihcIiZcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgfVxyXG4gICAgUXVlcnlTdHJpbmcuc3RyaW5naWZ5ID0gc3RyaW5naWZ5O1xyXG4gICAgZnVuY3Rpb24gcGFyc2UodGV4dCkge1xyXG4gICAgICAgIHZhciBvYmogPSB7fTtcclxuICAgICAgICB2YXIgcGFydDtcclxuICAgICAgICB3aGlsZSAocGFydCA9IFF1ZXJ5U3RyaW5nUGFyc2VyLmV4ZWModGV4dCkpIHtcclxuICAgICAgICAgICAgdmFyIGtleSA9IGRlY29kZVVSSUNvbXBvbmVudChwYXJ0WzFdKTtcclxuICAgICAgICAgICAgaWYgKGtleS5sZW5ndGggJiYga2V5ICE9PSBcIl9fcHJvdG9fX1wiKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBkZWNvZGVVUklDb21wb25lbnQocGFydFsyXSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwob2JqLCBrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByZXZpb3VzID0gb2JqW2tleV07XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocHJldmlvdXMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhciA9IHByZXZpb3VzO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhci5wdXNoKHZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9ialtrZXldID0gW3ByZXZpb3VzLCB2YWx1ZV07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb2JqW2tleV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gb2JqO1xyXG4gICAgfVxyXG4gICAgUXVlcnlTdHJpbmcucGFyc2UgPSBwYXJzZTtcclxufSkoUXVlcnlTdHJpbmcgPSBleHBvcnRzLlF1ZXJ5U3RyaW5nIHx8IChleHBvcnRzLlF1ZXJ5U3RyaW5nID0ge30pKTtcclxuLyoqXHJcbiAqIEFuIEhUVFAgcmVxdWVzdCBmb3IgYW4gSHR0cENsaWVudFxyXG4gKi9cclxudmFyIEh0dHBSZXF1ZXN0ID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhbiBIVFRQIHJlcXVlc3QgZm9yIGFuIEh0dHBDbGllbnRcclxuICAgICAqIEBwYXJhbSBtZXRob2QgVGhlIEhUVFAgbWV0aG9kIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICogQHBhcmFtIHVybCBUaGUgdXJsIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBIdHRwUmVxdWVzdChtZXRob2QsIHVybCkge1xyXG4gICAgICAgIGlmIChtZXRob2QgPT09IHZvaWQgMCkgeyBtZXRob2QgPSBcIkdFVFwiOyB9XHJcbiAgICAgICAgdGhpcy5faGVhZGVycyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XHJcbiAgICAgICAgdGhpcy5tZXRob2QgPSBtZXRob2Q7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB1cmwgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgdGhpcy51cmwgPSBVcmkucGFyc2UodXJsKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAodXJsIGluc3RhbmNlb2YgVXJpKSB7XHJcbiAgICAgICAgICAgIHRoaXMudXJsID0gdXJsO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyB0aGUgbmFtZWQgcmVxdWVzdCBoZWFkZXJcclxuICAgICAqIEBwYXJhbSBrZXkge1N0cmluZ30gVGhlIGhlYWRlciBuYW1lXHJcbiAgICAgKiBAcGFyYW0gdmFsdWUge1N0cmluZ30gVGhlIGhlYWRlciB2YWx1ZVxyXG4gICAgICovXHJcbiAgICBIdHRwUmVxdWVzdC5wcm90b3R5cGUuc2V0UmVxdWVzdEhlYWRlciA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XHJcbiAgICAgICAgaWYgKGtleSAhPT0gXCJfX3Byb3RvX19cIikge1xyXG4gICAgICAgICAgICB0aGlzLl9oZWFkZXJzW2tleV0gPSB2YWx1ZTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEh0dHBSZXF1ZXN0O1xyXG59KSgpO1xyXG5leHBvcnRzLkh0dHBSZXF1ZXN0ID0gSHR0cFJlcXVlc3Q7XHJcbi8qKlxyXG4gKiBBIHJlc3BvbnNlIGZyb20gYW4gSHR0cENsaWVudFxyXG4gKi9cclxudmFyIEh0dHBSZXNwb25zZSA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICAvKipcclxuICAgICAqIEEgcmVzcG9uc2UgZnJvbSBhbiBIdHRwQ2xpZW50XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIEh0dHBSZXNwb25zZShyZXF1ZXN0LCB4aHIpIHtcclxuICAgICAgICB0aGlzLl9yZXF1ZXN0ID0gcmVxdWVzdDtcclxuICAgICAgICB0aGlzLl94aHIgPSB4aHI7XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoSHR0cFJlc3BvbnNlLnByb3RvdHlwZSwgXCJyZXF1ZXN0XCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSByZXF1ZXN0IGZvciB0aGlzIHJlc3BvbnNlXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZXF1ZXN0O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEh0dHBSZXNwb25zZS5wcm90b3R5cGUsIFwic3RhdHVzXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSBzdGF0dXMgY29kZSBvZiB0aGUgcmVzcG9uc2VcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3hoci5zdGF0dXM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoSHR0cFJlc3BvbnNlLnByb3RvdHlwZSwgXCJzdGF0dXNUZXh0XCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSBzdGF0dXMgdGV4dCBvZiB0aGUgcmVzcG9uc2VcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3hoci5zdGF0dXNUZXh0O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEh0dHBSZXNwb25zZS5wcm90b3R5cGUsIFwicmVzcG9uc2VUZXh0XCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSByZXNwb25zZSB0ZXh0IG9mIHRoZSByZXNwb25zZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5feGhyLnJlc3BvbnNlVGV4dDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyBhbGwgb2YgdGhlIHJlc3BvbnNlIGhlYWRlcyBpbiBhIHNpbmdsZSBzdHJpbmdcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IEEgc3RyaW5nIGNvbnRhaW5pbmcgYWxsIG9mIHRoZSByZXNwb25zZSBoZWFkZXJzXHJcbiAgICAgKi9cclxuICAgIEh0dHBSZXNwb25zZS5wcm90b3R5cGUuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl94aHIuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSB2YWx1ZSBmb3IgdGhlIG5hbWVkIHJlc3BvbnNlIGhlYWRlclxyXG4gICAgICogQHBhcmFtIGhlYWRlciB7U3RyaW5nfSBUaGUgbmFtZSBvZiB0aGUgaGVhZGVyXHJcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgdmFsdWUgZm9yIHRoZSBuYW1lZCBoZWFkZXJcclxuICAgICAqL1xyXG4gICAgSHR0cFJlc3BvbnNlLnByb3RvdHlwZS5nZXRSZXNwb25zZUhlYWRlciA9IGZ1bmN0aW9uIChoZWFkZXIpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5feGhyLmdldFJlc3BvbnNlSGVhZGVyKGhlYWRlcik7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEh0dHBSZXNwb25zZTtcclxufSkoKTtcclxuZXhwb3J0cy5IdHRwUmVzcG9uc2UgPSBIdHRwUmVzcG9uc2U7XHJcbi8qKlxyXG4gKiBBIGNsaWVudCBmb3IgSFRUUCByZXF1ZXN0c1xyXG4gKi9cclxudmFyIEh0dHBDbGllbnQgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgY2xpZW50IGZvciBIVFRQIHJlcXVlc3RzXHJcbiAgICAgKiBAcGFyYW0gYmFzZVVybCBUaGUgYmFzZSB1cmwgZm9yIHRoZSBjbGllbnRcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gSHR0cENsaWVudChiYXNlVXJsKSB7XHJcbiAgICAgICAgdGhpcy5faGVhZGVycyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XHJcbiAgICAgICAgdGhpcy5fY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XHJcbiAgICAgICAgdGhpcy5fY2xvc2VkID0gZmFsc2U7XHJcbiAgICAgICAgaWYgKGJhc2VVcmwpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBiYXNlVXJsID09PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmJhc2VVcmwgPSBVcmkucGFyc2UoYmFzZVVybCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAoYmFzZVVybCBpbnN0YW5jZW9mIFVyaSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5iYXNlVXJsID0gYmFzZVVybDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogQ2xvc2VzIHRoZSBjbGllbnQgYW5kIGNhbmNlbHMgYWxsIHBlbmRpbmcgcmVxdWVzdHNcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2Nsb3NlZClcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT2JqZWN0IGRvZXNuJ3Qgc3VwcG9ydCB0aGlzIGFjdGlvblwiKTtcclxuICAgICAgICB0aGlzLl9jbG9zZWQgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuX2N0cy5jYW5jZWwoKTtcclxuICAgICAgICB0aGlzLl9jdHMuY2xvc2UoKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIFNldHMgYSB2YWx1ZSBmb3IgYSBkZWZhdWx0IHJlcXVlc3QgaGVhZGVyXHJcbiAgICAgKiBAcGFyYW0ga2V5IFRoZSByZXF1ZXN0IGhlYWRlciBrZXlcclxuICAgICAqIEBwYXJhbSB2YWx1ZSBUaGUgcmVxdWVzdCBoZWFkZXIgdmFsdWVcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuc2V0UmVxdWVzdEhlYWRlciA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2Nsb3NlZClcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT2JqZWN0IGRvZXNuJ3Qgc3VwcG9ydCB0aGlzIGFjdGlvblwiKTtcclxuICAgICAgICBpZiAoa2V5ICE9PSBcIl9fcHJvdG9fX1wiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2hlYWRlcnNba2V5XSA9IHZhbHVlO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIHJlc3BvbnNlIHRleHQgZnJvbSB0aGUgcmVxdWVzdGVkIHVybFxyXG4gICAgICogQHBhcmFtIHVybCBUaGUgdXJsIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICogQHJldHVybnMgQSBmdXR1cmUgcmVzdWx0IGZvciB0aGUgc3RyaW5nXHJcbiAgICAgKi9cclxuICAgIEh0dHBDbGllbnQucHJvdG90eXBlLmdldFN0cmluZ0FzeW5jID0gZnVuY3Rpb24gKHVybCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmdldEFzeW5jKHVybCkudGhlbihmdW5jdGlvbiAocikgeyByZXR1cm4gci5yZXNwb25zZVRleHQ7IH0pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgcmVzcG9uc2UgZnJvbSBpc3N1aW5nIGFuIEhUVFAgR0VUIHRvIHRoZSByZXF1ZXN0ZWQgdXJsXHJcbiAgICAgKiBAcGFyYW0gdXJsIFRoZSB1cmwgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcGFyYW0gdG9rZW4gQSB0b2tlbiB0aGF0IGNhbiBiZSB1c2VkIHRvIGNhbmNlbCB0aGUgcmVxdWVzdFxyXG4gICAgICogQHJldHVybnMgQSBmdXR1cmUgcmVzdWx0IGZvciB0aGUgcmVzcG9uc2VcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuZ2V0QXN5bmMgPSBmdW5jdGlvbiAodXJsLCB0b2tlbikge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNlbmRBc3luYyhuZXcgSHR0cFJlcXVlc3QoXCJHRVRcIiwgdXJsKSwgdG9rZW4pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgcmVzcG9uc2UgZnJvbSBpc3N1aW5nIGFuIEhUVFAgUE9TVCB0byB0aGUgcmVxdWVzdGVkIHVybFxyXG4gICAgICogQHBhcmFtIHVybCBUaGUgdXJsIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICogQHBhcmFtIGJvZHkgVGhlIGJvZHkgb2YgdGhlIHJlcXVlc3RcclxuICAgICAqIEBwYXJhbSB0b2tlbiBBIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyBBIGZ1dHVyZSByZXN1bHQgZm9yIHRoZSByZXNwb25zZVxyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5wb3N0QXN5bmMgPSBmdW5jdGlvbiAodXJsLCBib2R5LCB0b2tlbikge1xyXG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IEh0dHBSZXF1ZXN0KFwiUE9TVFwiLCB1cmwpO1xyXG4gICAgICAgIHJlcXVlc3QuYm9keSA9IGJvZHk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VuZEFzeW5jKHJlcXVlc3QsIHRva2VuKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIHJlc3BvbnNlIGZyb20gaXNzdWluZyBhbiBIVFRQIFBPU1Qgb2YgYSBKU09OIHNlcmlhbGl6ZWQgdmFsdWUgdG8gdGhlIHJlcXVlc3RlZCB1cmxcclxuICAgICAqIEBwYXJhbSB1cmwgVGhlIHVybCBmb3IgdGhlIHJlcXVlc3RcclxuICAgICAqIEBwYXJhbSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2VyaWFsaXplXHJcbiAgICAgKiBAcGFyYW0ganNvblJlcGxhY2VyIEFuIGFycmF5IG9yIGNhbGxiYWNrIHVzZWQgdG8gcmVwbGFjZSB2YWx1ZXMgZHVyaW5nIHNlcmlhbGl6YXRpb25cclxuICAgICAqIEBwYXJhbSB0b2tlbiBBIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyBBIGZ1dHVyZSByZXN1bHQgZm9yIHRoZSByZXNwb25zZVxyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5wb3N0SnNvbkFzeW5jID0gZnVuY3Rpb24gKHVybCwgdmFsdWUsIGpzb25SZXBsYWNlciwgdG9rZW4pIHtcclxuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBIdHRwUmVxdWVzdChcIlBPU1RcIiwgdXJsKTtcclxuICAgICAgICByZXF1ZXN0LmJvZHkgPSBKU09OLnN0cmluZ2lmeSh2YWx1ZSwganNvblJlcGxhY2VyKTtcclxuICAgICAgICByZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNlbmRBc3luYyhyZXF1ZXN0LCB0b2tlbik7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSByZXNwb25zZSBmcm9tIGlzc3VpbmcgYW4gSFRUUCBQVVQgdG8gdGhlIHJlcXVlc3RlZCB1cmxcclxuICAgICAqIEBwYXJhbSB1cmwgVGhlIHVybCBmb3IgdGhlIHJlcXVlc3RcclxuICAgICAqIEBwYXJhbSBib2R5IFRoZSBib2R5IG9mIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcGFyYW0gdG9rZW4gQSB0b2tlbiB0aGF0IGNhbiBiZSB1c2VkIHRvIGNhbmNlbCB0aGUgcmVxdWVzdFxyXG4gICAgICogQHJldHVybnMgQSBmdXR1cmUgcmVzdWx0IGZvciB0aGUgcmVzcG9uc2VcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUucHV0QXN5bmMgPSBmdW5jdGlvbiAodXJsLCBib2R5LCB0b2tlbikge1xyXG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IEh0dHBSZXF1ZXN0KFwiUFVUXCIsIHVybCk7XHJcbiAgICAgICAgcmVxdWVzdC5ib2R5ID0gYm9keTtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZW5kQXN5bmMocmVxdWVzdCwgdG9rZW4pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgcmVzcG9uc2UgZnJvbSBpc3N1aW5nIGFuIEhUVFAgUFVUIG9mIGEgSlNPTiBzZXJpYWxpemVkIHZhbHVlIHRvIHRoZSByZXF1ZXN0ZWQgdXJsXHJcbiAgICAgKiBAcGFyYW0gdXJsIFRoZSB1cmwgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcGFyYW0gdmFsdWUgVGhlIHZhbHVlIHRvIHNlcmlhbGl6ZVxyXG4gICAgICogQHBhcmFtIGpzb25SZXBsYWNlciBBbiBhcnJheSBvciBjYWxsYmFjayB1c2VkIHRvIHJlcGxhY2UgdmFsdWVzIGR1cmluZyBzZXJpYWxpemF0aW9uXHJcbiAgICAgKiBAcGFyYW0gdG9rZW4gQSB0b2tlbiB0aGF0IGNhbiBiZSB1c2VkIHRvIGNhbmNlbCB0aGUgcmVxdWVzdFxyXG4gICAgICogQHJldHVybnMgQSBmdXR1cmUgcmVzdWx0IGZvciB0aGUgcmVzcG9uc2VcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUucHV0SnNvbkFzeW5jID0gZnVuY3Rpb24gKHVybCwgdmFsdWUsIGpzb25SZXBsYWNlciwgdG9rZW4pIHtcclxuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBIdHRwUmVxdWVzdChcIlBVVFwiLCB1cmwpO1xyXG4gICAgICAgIHJlcXVlc3QuYm9keSA9IEpTT04uc3RyaW5naWZ5KHZhbHVlLCBqc29uUmVwbGFjZXIpO1xyXG4gICAgICAgIHJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VuZEFzeW5jKHJlcXVlc3QsIHRva2VuKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIHJlc3BvbnNlIGZyb20gaXNzdWluZyBhbiBIVFRQIERFTEVURSB0byB0aGUgcmVxdWVzdGVkIHVybFxyXG4gICAgICogQHBhcmFtIHVybCBUaGUgdXJsIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICogQHBhcmFtIHRva2VuIEEgdG9rZW4gdGhhdCBjYW4gYmUgdXNlZCB0byBjYW5jZWwgdGhlIHJlcXVlc3RcclxuICAgICAqIEByZXR1cm5zIEEgZnV0dXJlIHJlc3VsdCBmb3IgdGhlIHJlc3BvbnNlXHJcbiAgICAgKi9cclxuICAgIEh0dHBDbGllbnQucHJvdG90eXBlLmRlbGV0ZUFzeW5jID0gZnVuY3Rpb24gKHVybCwgdG9rZW4pIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZW5kQXN5bmMobmV3IEh0dHBSZXF1ZXN0KFwiREVMRVRFXCIsIHVybCksIHRva2VuKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIFNlbmRzIHRoZSBwcm92aWRlZCByZXF1ZXN0IGFuZCByZXR1cm5zIHRoZSByZXNwb25zZVxyXG4gICAgICogQHBhcmFtIHJlcXVlc3Qge0h0dHBSZXF1ZXN0fSBBbiBIVFRQIHJlcXVlc3QgdG8gc2VuZFxyXG4gICAgICogQHBhcmFtIHRva2VuIHtmdXR1cmVzLkNhbmNlbGxhdGlvblRva2VufSBBIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyB7ZnV0dXJlcy5Qcm9taXNlPEh0dHBSZXNwb25zZT59IEEgZnV0dXJlIHJlc3VsdCBmb3IgdGhlIHJlc3BvbnNlXHJcbiAgICAgKi9cclxuICAgIEh0dHBDbGllbnQucHJvdG90eXBlLnNlbmRBc3luYyA9IGZ1bmN0aW9uIChyZXF1ZXN0LCB0b2tlbikge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgaWYgKHRoaXMuX2Nsb3NlZClcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT2JqZWN0IGRvZXNuJ3Qgc3VwcG9ydCB0aGlzIGFjdGlvblwiKTtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICAvLyBjcmVhdGUgYSBsaW5rZWQgdG9rZW5cclxuICAgICAgICAgICAgdmFyIGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZShbX3RoaXMuX2N0cy50b2tlbiwgdG9rZW5dKTtcclxuICAgICAgICAgICAgLy8gdGhyb3cgaWYgd2UncmUgYWxyZWFkeSBjYW5jZWxlZCwgdGhlIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZFxyXG4gICAgICAgICAgICBjdHMudG9rZW4udGhyb3dJZkNhbmNlbGVkKCk7XHJcbiAgICAgICAgICAgIC8vIG5vcm1hbGl6ZSB0aGUgdXJpXHJcbiAgICAgICAgICAgIHZhciB1cmwgPSBudWxsO1xyXG4gICAgICAgICAgICBpZiAoIXJlcXVlc3QudXJsKSB7XHJcbiAgICAgICAgICAgICAgICB1cmwgPSBfdGhpcy5iYXNlVXJsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKCFyZXF1ZXN0LnVybC5hYnNvbHV0ZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFfdGhpcy5iYXNlVXJsKVxyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgYXJndW1lbnQ6IHJlcXVlc3RcIik7XHJcbiAgICAgICAgICAgICAgICB1cmwgPSBuZXcgVXJpKF90aGlzLmJhc2VVcmwsIHJlcXVlc3QudXJsKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAodXJsKSB7XHJcbiAgICAgICAgICAgICAgICByZXF1ZXN0LnVybCA9IHVybDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICAgICAgICAgIHZhciByZXNwb25zZSA9IG5ldyBIdHRwUmVzcG9uc2UocmVxdWVzdCwgeGhyKTtcclxuICAgICAgICAgICAgdmFyIHJlcXVlc3RIZWFkZXJzID0gcmVxdWVzdC5faGVhZGVycztcclxuICAgICAgICAgICAgdmFyIGNsaWVudEhlYWRlcnMgPSBfdGhpcy5faGVhZGVycztcclxuICAgICAgICAgICAgLy8gY3JlYXRlIHRoZSBvbmxvYWQgY2FsbGJhY2tcclxuICAgICAgICAgICAgdmFyIG9ubG9hZCA9IGZ1bmN0aW9uIChldikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKVxyXG4gICAgICAgICAgICAgICAgICAgIERlYnVnLnNldE5vblVzZXJDb2RlRXhjZXB0aW9ucyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgICAgICAgICAvLyBjYXRjaCBhIGNhbmNlbGxhdGlvbiBhbmQgcmVqZWN0IHRoZSBwcm9taXNlXHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIGN0cy50b2tlbi50aHJvd0lmQ2FuY2VsZWQoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICh4aHIuc3RhdHVzID49IDIwMCAmJiB4aHIuc3RhdHVzIDwgMzAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyb3IgPSBjcmVhdGVIdHRwRXJyb3IoX3RoaXMsIHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAvLyBjcmVhdGUgdGhlIG9uZXJyb3IgY2FsbGJhY2tcclxuICAgICAgICAgICAgdmFyIG9uZXJyb3IgPSBmdW5jdGlvbiAoZXYpIHtcclxuICAgICAgICAgICAgICAgIGlmIChoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucylcclxuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgICAgICAgICAgLy8gY2F0Y2ggYSBjYW5jZWxsYXRpb24gYW5kIHJlamVjdCB0aGUgcHJvbWlzZVxyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICBjdHMudG9rZW4udGhyb3dJZkNhbmNlbGVkKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB2YXIgZXJyb3IgPSBjcmVhdGVIdHRwRXJyb3IoX3RoaXMsIHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIC8vIHJlZ2lzdGVyIGEgY2xlYW51cCBwaGFzZVxyXG4gICAgICAgICAgICB2YXIgcmVnaXN0cmF0aW9uID0gY3RzLnRva2VuLnJlZ2lzdGVyKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGlmIChoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucylcclxuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgICAgICAgICAgLy8gYWJvcnQgdGhlIHhoclxyXG4gICAgICAgICAgICAgICAgeGhyLmFib3J0KCk7XHJcbiAgICAgICAgICAgICAgICAvLyBjYXRjaCBhIGNhbmNlbGxhdGlvbiBhbmQgcmVqZWN0IHRoZSBwcm9taXNlXHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIGN0cy50b2tlbi50aHJvd0lmQ2FuY2VsZWQoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdmFyIGNsZWFudXAgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICB4aHIucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImxvYWRcIiwgb25sb2FkLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICB4aHIucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsIG9uZXJyb3IsIGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi51bnJlZ2lzdGVyKCk7XHJcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIC8vIGFkZCB0aGUgaGVhZGVycyBmcm9tIHRoZSBjbGllbnRcclxuICAgICAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoY2xpZW50SGVhZGVycykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XHJcbiAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIGNsaWVudEhlYWRlcnNba2V5XSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAvLyBhZGQgdGhlIGhlYWRlcnMgZnJvbSB0aGUgcmVxdWVzdFxyXG4gICAgICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhyZXF1ZXN0SGVhZGVycykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XHJcbiAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIHJlcXVlc3RIZWFkZXJzW2tleV0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgLy8gd2lyZSB1cCB0aGUgZXZlbnRzXHJcbiAgICAgICAgICAgIHhoci5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBvbmxvYWQsIGZhbHNlKTtcclxuICAgICAgICAgICAgeGhyLmFkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLCBvbmVycm9yLCBmYWxzZSk7XHJcbiAgICAgICAgICAgIC8vIGVuYWJsZSBjcmVkZW50aWFscyBpZiByZXF1ZXN0ZWRcclxuICAgICAgICAgICAgaWYgKF90aGlzLndpdGhDcmVkZW50aWFscykge1xyXG4gICAgICAgICAgICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gYXR0YWNoIGEgdGltZW91dFxyXG4gICAgICAgICAgICBpZiAoX3RoaXMudGltZW91dCA+IDApIHtcclxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkgeyByZXR1cm4gY3RzLmNhbmNlbChuZXcgRXJyb3IoXCJPcGVyYXRpb24gdGltZWQgb3V0LlwiKSk7IH0sIF90aGlzLnRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgICAgeGhyLnRpbWVvdXQgPSBfdGhpcy50aW1lb3V0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIHNlbmQgdGhlIHJlcXVlc3RcclxuICAgICAgICAgICAgeGhyLm9wZW4ocmVxdWVzdC5tZXRob2QsIHJlcXVlc3QudXJsLnRvU3RyaW5nKCksIHRydWUsIF90aGlzLnVzZXJuYW1lLCBfdGhpcy5wYXNzd29yZCk7XHJcbiAgICAgICAgICAgIHhoci5zZW5kKHJlcXVlc3QuYm9keSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuZ2V0SnNvbnBBc3luYyA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrQXJnLCBub0NhY2hlLCB0b2tlbikge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgaWYgKGNhbGxiYWNrQXJnID09PSB2b2lkIDApIHsgY2FsbGJhY2tBcmcgPSBcImNhbGxiYWNrXCI7IH1cclxuICAgICAgICBpZiAobm9DYWNoZSA9PT0gdm9pZCAwKSB7IG5vQ2FjaGUgPSBmYWxzZTsgfVxyXG4gICAgICAgIGlmICh0aGlzLl9jbG9zZWQpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk9iamVjdCBkb2Vzbid0IHN1cHBvcnQgdGhpcyBhY3Rpb25cIik7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gXCJ1bmRlZmluZWRcIilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSlNPTi1QIGlzIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBob3N0LlwiKTtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICAvLyBjcmVhdGUgYSBsaW5rZWQgdG9rZW5cclxuICAgICAgICAgICAgdmFyIGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZShbX3RoaXMuX2N0cy50b2tlbiwgdG9rZW5dKTtcclxuICAgICAgICAgICAgLy8gdGhyb3cgaWYgd2UncmUgYWxyZWFkeSBjYW5jZWxlZCwgdGhlIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZFxyXG4gICAgICAgICAgICBjdHMudG9rZW4udGhyb3dJZkNhbmNlbGVkKCk7XHJcbiAgICAgICAgICAgIC8vIG5vcm1hbGl6ZSB0aGUgdXJpXHJcbiAgICAgICAgICAgIHZhciByZXF1ZXN0VXJsID0gbnVsbDtcclxuICAgICAgICAgICAgaWYgKCF1cmwpIHtcclxuICAgICAgICAgICAgICAgIHJlcXVlc3RVcmwgPSBfdGhpcy5iYXNlVXJsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB1cmwgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0VXJsID0gbmV3IFVyaSh1cmwpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodXJsIGluc3RhbmNlb2YgVXJpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdFVybCA9IHVybDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICghcmVxdWVzdFVybC5hYnNvbHV0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICghX3RoaXMuYmFzZVVybClcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBhcmd1bWVudDogdXJsXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RVcmwgPSBuZXcgVXJpKF90aGlzLmJhc2VVcmwsIHJlcXVlc3RVcmwpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IGpzb25wUmVxdWVzdEluZGV4Kys7XHJcbiAgICAgICAgICAgIHZhciBuYW1lID0gXCJfX1Byb21pc2VfX2pzb25wX19cIiArIGluZGV4O1xyXG4gICAgICAgICAgICB2YXIgcXVlcnkgPSBRdWVyeVN0cmluZy5wYXJzZShyZXF1ZXN0VXJsLnNlYXJjaCk7XHJcbiAgICAgICAgICAgIHF1ZXJ5W2NhbGxiYWNrQXJnXSA9IG5hbWU7XHJcbiAgICAgICAgICAgIGlmIChub0NhY2hlKSB7XHJcbiAgICAgICAgICAgICAgICBxdWVyeVtcIl90XCJdID0gRGF0ZS5ub3coKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXF1ZXN0VXJsLnNlYXJjaCA9IFF1ZXJ5U3RyaW5nLnN0cmluZ2lmeShxdWVyeSk7XHJcbiAgICAgICAgICAgIHZhciBwZW5kaW5nID0gdHJ1ZTtcclxuICAgICAgICAgICAgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImhlYWRcIilbMF07XHJcbiAgICAgICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpO1xyXG4gICAgICAgICAgICBzY3JpcHQudHlwZSA9IFwidGV4dC9qYXZhc2NyaXB0XCI7XHJcbiAgICAgICAgICAgIHNjcmlwdC5hc3luYyA9IHRydWU7XHJcbiAgICAgICAgICAgIHNjcmlwdC5zcmMgPSByZXF1ZXN0VXJsLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgICAgIC8vIGNoZWNrcyB3aGV0aGVyIHRoZSByZXF1ZXN0IGhhcyBiZWVuIGNhbmNlbGVkXHJcbiAgICAgICAgICAgIHZhciBjaGVja0NhbmNlbGVkID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKVxyXG4gICAgICAgICAgICAgICAgICAgIERlYnVnLnNldE5vblVzZXJDb2RlRXhjZXB0aW9ucyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIGN0cy50b2tlbi50aHJvd0lmQ2FuY2VsZWQoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAvLyB3YWl0cyBmb3IgdGhlIHJlc3VsdFxyXG4gICAgICAgICAgICB2YXIgb25sb2FkID0gZnVuY3Rpb24gKHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgaWdub3JlKCk7XHJcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24udW5yZWdpc3RlcigpO1xyXG4gICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFjaGVja0NhbmNlbGVkKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIC8vIGlnbm9yZXMgZnVydGhlciBjYWxscyB0byBmdWxmaWxsIHRoZSByZXN1bHRcclxuICAgICAgICAgICAgdmFyIGlnbm9yZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIHBlbmRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIGRlbGV0ZSB3aW5kb3dbbmFtZV07XHJcbiAgICAgICAgICAgICAgICBkaXNjb25uZWN0KCk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIC8vIGRpc2Nvbm5lY3RzIHRoZSBzY3JpcHQgbm9kZVxyXG4gICAgICAgICAgICB2YXIgZGlzY29ubmVjdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGlmIChzY3JpcHQucGFyZW50Tm9kZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGhlYWQucmVtb3ZlQ2hpbGQoc2NyaXB0KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgLy8gcmVnaXN0ZXIgYSBjbGVhbnVwIHBoYXNlXHJcbiAgICAgICAgICAgIHZhciByZWdpc3RyYXRpb24gPSBjdHMudG9rZW4ucmVnaXN0ZXIoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHBlbmRpbmcpIHtcclxuICAgICAgICAgICAgICAgICAgICB3aW5kb3dbbmFtZV0gPSBpZ25vcmU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBkaXNjb25uZWN0KCk7XHJcbiAgICAgICAgICAgICAgICBjaGVja0NhbmNlbGVkKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAvLyBzZXQgYSB0aW1lb3V0IGJlZm9yZSB3ZSBubyBsb25nZXIgY2FyZSBhYm91dCB0aGUgcmVzdWx0LlxyXG4gICAgICAgICAgICBpZiAoX3RoaXMudGltZW91dCkge1xyXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7IHJldHVybiBjdHMuY2FuY2VsKG5ldyBFcnJvcihcIk9wZXJhdGlvbiB0aW1lZCBvdXQuXCIpKTsgfSwgX3RoaXMudGltZW91dCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgd2luZG93W25hbWVdID0gb25sb2FkO1xyXG4gICAgICAgICAgICBoZWFkLmFwcGVuZENoaWxkKHNjcmlwdCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEh0dHBDbGllbnQ7XHJcbn0pKCk7XHJcbmV4cG9ydHMuSHR0cENsaWVudCA9IEh0dHBDbGllbnQ7XHJcbmZ1bmN0aW9uIGNyZWF0ZUh0dHBFcnJvcihodHRwQ2xpZW50LCByZXNwb25zZSwgbWVzc2FnZSkge1xyXG4gICAgaWYgKG1lc3NhZ2UgPT09IHZvaWQgMCkgeyBtZXNzYWdlID0gXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBwcm9jZXNzaW5nIHlvdXIgcmVxdWVzdFwiOyB9XHJcbiAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IobWVzc2FnZSk7XHJcbiAgICBlcnJvci5uYW1lID0gXCJIdHRwRXJyb3JcIjtcclxuICAgIGVycm9yLmh0dHBDbGllbnQgPSBodHRwQ2xpZW50O1xyXG4gICAgZXJyb3IucmVzcG9uc2UgPSByZXNwb25zZTtcclxuICAgIGVycm9yLm1lc3NhZ2UgPSBtZXNzYWdlO1xyXG4gICAgcmV0dXJuIGVycm9yO1xyXG59XHJcbnZhciBVcmlQYXJzZXIgPSAvXigoPzooaHR0cHM/OilcXC9cXC8pKD86W146QF0qKD86XFw6W15AXSopP0ApPygoW2EtelxcZC1cXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZcXC5dKykoPzpcXDooXFxkKykpPyk/KT8oPyFbYS16XFxkLV0rXFw6KSgoPzpefFxcLylbXlxcP1xcI10qKT8oXFw/W14jXSopPygjLiopPyQvaTtcclxudmFyIFVyaVBhcnRzID0geyBcInByb3RvY29sXCI6IDIsIFwiaG9zdG5hbWVcIjogNCwgXCJwb3J0XCI6IDUsIFwicGF0aG5hbWVcIjogNiwgXCJzZWFyY2hcIjogNywgXCJoYXNoXCI6IDggfTtcclxudmFyIFVyaVBvcnRzID0geyBcImh0dHA6XCI6IDgwLCBcImh0dHBzOlwiOiA0NDMgfTtcclxudmFyIGpzb25wUmVxdWVzdEluZGV4ID0gMDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy9odHRwY2xpZW50LmpzLm1hcCIsIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKEMpIFJvbiBBLiBCdWNrdG9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpOyB5b3UgbWF5IG5vdCB1c2VcclxudGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGVcclxuTGljZW5zZSBhdCBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuXHJcblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuXHJcblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbnZhciBMaW5rZWRMaXN0Tm9kZSA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBMaW5rZWRMaXN0Tm9kZSh2YWx1ZSkge1xyXG4gICAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShMaW5rZWRMaXN0Tm9kZS5wcm90b3R5cGUsIFwibGlzdFwiLCB7XHJcbiAgICAgICAgLyoqIEdldHMgdGhlIExpbmtlZExpc3QgZm9yIHRoaXMgbm9kZSAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbGlzdDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShMaW5rZWRMaXN0Tm9kZS5wcm90b3R5cGUsIFwicHJldmlvdXNcIiwge1xyXG4gICAgICAgIC8qKiBHZXRzIHRoZSBwcmV2aW91cyBub2RlIGluIHRoZSBsaXN0ICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9wcmV2aW91cyAmJiB0aGlzICE9PSB0aGlzLl9saXN0LmZpcnN0KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fcHJldmlvdXM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShMaW5rZWRMaXN0Tm9kZS5wcm90b3R5cGUsIFwibmV4dFwiLCB7XHJcbiAgICAgICAgLyoqIEdldHMgdGhlIG5leHQgbm9kZSBpbiB0aGUgbGlzdCAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fbmV4dCAmJiB0aGlzLl9uZXh0ICE9PSB0aGlzLl9saXN0LmZpcnN0KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fbmV4dDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIExpbmtlZExpc3ROb2RlO1xyXG59KSgpO1xyXG5leHBvcnRzLkxpbmtlZExpc3ROb2RlID0gTGlua2VkTGlzdE5vZGU7XHJcbnZhciBMaW5rZWRMaXN0ID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIExpbmtlZExpc3QoKSB7XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoTGlua2VkTGlzdC5wcm90b3R5cGUsIFwiZmlyc3RcIiwge1xyXG4gICAgICAgIC8qKiBHZXRzIHRoZSBmaXJzdCBub2RlIGluIHRoZSBsaXN0ICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9oZWFkO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KExpbmtlZExpc3QucHJvdG90eXBlLCBcImxhc3RcIiwge1xyXG4gICAgICAgIC8qKiBHZXRzIHRoZSBsYXN0IG5vZGUgaW4gdGhlIGxpc3QgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2hlYWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9oZWFkLl9wcmV2aW91cztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KExpbmtlZExpc3QucHJvdG90eXBlLCBcInNpemVcIiwge1xyXG4gICAgICAgIC8qKiBHZXRzIHRoZSBzaXplIG9mIHRoZSBsaXN0ICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9zaXplO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuYWRkRmlyc3QgPSBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICB2YXIgbmV3Tm9kZSA9IG5ldyBMaW5rZWRMaXN0Tm9kZSh2YWx1ZSk7XHJcbiAgICAgICAgaWYgKHRoaXMuZmlyc3QpIHtcclxuICAgICAgICAgICAgdGhpcy5faW5zZXJ0KHRoaXMuZmlyc3QsIG5ld05vZGUpO1xyXG4gICAgICAgICAgICB0aGlzLl9oZWFkID0gbmV3Tm9kZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2luc2VydEVtcHR5KG5ld05vZGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbmV3Tm9kZTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5hZGROb2RlRmlyc3QgPSBmdW5jdGlvbiAobmV3Tm9kZSkge1xyXG4gICAgICAgIHRoaXMuX2NoZWNrTmV3Tm9kZShuZXdOb2RlKTtcclxuICAgICAgICBpZiAodGhpcy5maXJzdCkge1xyXG4gICAgICAgICAgICB0aGlzLl9pbnNlcnQodGhpcy5maXJzdCwgbmV3Tm9kZSk7XHJcbiAgICAgICAgICAgIHRoaXMuX2hlYWQgPSBuZXdOb2RlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5faW5zZXJ0RW1wdHkobmV3Tm9kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmFkZExhc3QgPSBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICB2YXIgbmV3Tm9kZSA9IG5ldyBMaW5rZWRMaXN0Tm9kZSh2YWx1ZSk7XHJcbiAgICAgICAgaWYgKHRoaXMuZmlyc3QpIHtcclxuICAgICAgICAgICAgdGhpcy5faW5zZXJ0KHRoaXMuZmlyc3QsIG5ld05vZGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5faW5zZXJ0RW1wdHkobmV3Tm9kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBuZXdOb2RlO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmFkZE5vZGVMYXN0ID0gZnVuY3Rpb24gKG5ld05vZGUpIHtcclxuICAgICAgICB0aGlzLl9jaGVja05ld05vZGUobmV3Tm9kZSk7XHJcbiAgICAgICAgaWYgKHRoaXMuZmlyc3QpIHtcclxuICAgICAgICAgICAgdGhpcy5faW5zZXJ0KHRoaXMuZmlyc3QsIG5ld05vZGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5faW5zZXJ0RW1wdHkobmV3Tm9kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmFkZEJlZm9yZSA9IGZ1bmN0aW9uIChub2RlLCB2YWx1ZSkge1xyXG4gICAgICAgIHRoaXMuX2NoZWNrTm9kZShub2RlKTtcclxuICAgICAgICB2YXIgbmV3Tm9kZSA9IG5ldyBMaW5rZWRMaXN0Tm9kZSh2YWx1ZSk7XHJcbiAgICAgICAgdGhpcy5faW5zZXJ0KG5vZGUsIG5ld05vZGUpO1xyXG4gICAgICAgIGlmICh0aGlzLl9oZWFkID09PSBub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2hlYWQgPSBuZXdOb2RlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbmV3Tm9kZTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5hZGROb2RlQmVmb3JlID0gZnVuY3Rpb24gKG5vZGUsIG5ld05vZGUpIHtcclxuICAgICAgICB0aGlzLl9jaGVja05vZGUobm9kZSk7XHJcbiAgICAgICAgdGhpcy5fY2hlY2tOZXdOb2RlKG5ld05vZGUpO1xyXG4gICAgICAgIHRoaXMuX2luc2VydChub2RlLCBuZXdOb2RlKTtcclxuICAgICAgICBpZiAodGhpcy5faGVhZCA9PT0gbm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLl9oZWFkID0gbmV3Tm9kZTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuYWRkQWZ0ZXIgPSBmdW5jdGlvbiAobm9kZSwgdmFsdWUpIHtcclxuICAgICAgICB0aGlzLl9jaGVja05vZGUobm9kZSk7XHJcbiAgICAgICAgdmFyIG5ld05vZGUgPSBuZXcgTGlua2VkTGlzdE5vZGUodmFsdWUpO1xyXG4gICAgICAgIHRoaXMuX2luc2VydChub2RlLl9uZXh0LCBuZXdOb2RlKTtcclxuICAgICAgICByZXR1cm4gbmV3Tm9kZTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5hZGROb2RlQWZ0ZXIgPSBmdW5jdGlvbiAobm9kZSwgbmV3Tm9kZSkge1xyXG4gICAgICAgIHRoaXMuX2NoZWNrTm9kZShub2RlKTtcclxuICAgICAgICB0aGlzLl9jaGVja05ld05vZGUobmV3Tm9kZSk7XHJcbiAgICAgICAgdGhpcy5faW5zZXJ0KG5vZGUuX25leHQsIG5ld05vZGUpO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIGlmICh0aGlzLl9jYWNoZSAmJiB0aGlzLl9jYWNoZS52YWx1ZSA9PT0gdmFsdWUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiAhIXRoaXMuZmluZCh2YWx1ZSk7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHZhciBub2RlID0gdGhpcy5faGVhZDtcclxuICAgICAgICBpZiAobm9kZSkge1xyXG4gICAgICAgICAgICBkbyB7XHJcbiAgICAgICAgICAgICAgICBpZiAobm9kZS52YWx1ZSA9PT0gdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYWNoZSA9IG5vZGU7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5vZGU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5fbmV4dDtcclxuICAgICAgICAgICAgfSB3aGlsZSAobm9kZSAhPT0gdGhpcy5faGVhZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuZmluZExhc3QgPSBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuX2hlYWQ7XHJcbiAgICAgICAgaWYgKG5vZGUpIHtcclxuICAgICAgICAgICAgbm9kZSA9IG5vZGUuX3ByZXZpb3VzO1xyXG4gICAgICAgICAgICB2YXIgdGFpbCA9IG5vZGU7XHJcbiAgICAgICAgICAgIGRvIHtcclxuICAgICAgICAgICAgICAgIGlmIChub2RlLnZhbHVlID09PSB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlID0gbm9kZTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm9kZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLl9wcmV2aW91cztcclxuICAgICAgICAgICAgfSB3aGlsZSAobm9kZSAhPT0gdGFpbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuZGVsZXRlID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLmZpbmQodmFsdWUpO1xyXG4gICAgICAgIGlmIChub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlbGV0ZShub2RlKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5kZWxldGVOb2RlID0gZnVuY3Rpb24gKG5vZGUpIHtcclxuICAgICAgICB0aGlzLl9jaGVja05vZGUobm9kZSk7XHJcbiAgICAgICAgdGhpcy5fZGVsZXRlKG5vZGUpO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmRlbGV0ZUZpcnN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICh0aGlzLl9oZWFkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlbGV0ZSh0aGlzLl9oZWFkKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5kZWxldGVMYXN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICh0aGlzLl9oZWFkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlbGV0ZSh0aGlzLl9oZWFkLl9wcmV2aW91cyk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUucmVtb3ZlRmlyc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLl9oZWFkO1xyXG4gICAgICAgIGlmIChub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlbGV0ZShub2RlKTtcclxuICAgICAgICAgICAgcmV0dXJuIG5vZGUudmFsdWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUucmVtb3ZlTGFzdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAodGhpcy5faGVhZCkge1xyXG4gICAgICAgICAgICB2YXIgbm9kZSA9IHRoaXMuX2hlYWQuX3ByZXZpb3VzO1xyXG4gICAgICAgICAgICB0aGlzLl9kZWxldGUobm9kZSk7XHJcbiAgICAgICAgICAgIHJldHVybiBub2RlLnZhbHVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBuZXh0ID0gdGhpcy5faGVhZDtcclxuICAgICAgICB3aGlsZSAobmV4dCkge1xyXG4gICAgICAgICAgICB2YXIgbm9kZSA9IG5leHQ7XHJcbiAgICAgICAgICAgIG5leHQgPSBub2RlLl9uZXh0O1xyXG4gICAgICAgICAgICB0aGlzLl9pbnZhbGlkYXRlKG5vZGUpO1xyXG4gICAgICAgICAgICBpZiAobmV4dCA9PT0gdGhpcy5faGVhZCkge1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fY2FjaGUgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgdGhpcy5fc2l6ZSA9IDA7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgICAgIHZhciBuZXh0ID0gdGhpcy5faGVhZDtcclxuICAgICAgICB3aGlsZSAobmV4dCkge1xyXG4gICAgICAgICAgICB2YXIgbm9kZSA9IG5leHQ7XHJcbiAgICAgICAgICAgIG5leHQgPSBub2RlLl9uZXh0O1xyXG4gICAgICAgICAgICBjYWxsYmFjayhub2RlLnZhbHVlLCBub2RlLCB0aGlzKTtcclxuICAgICAgICAgICAgaWYgKG5leHQgPT09IHRoaXMuX2hlYWQpIHtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLl9jaGVja05vZGUgPSBmdW5jdGlvbiAobm9kZSkge1xyXG4gICAgICAgIGlmICghbm9kZSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkFyZ3VtZW50IG5vdCBvcHRpb25hbDogbm9kZVwiKTtcclxuICAgICAgICBpZiAobm9kZS5saXN0ICE9PSB0aGlzKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJXcm9uZyBsaXN0LlwiKTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5fY2hlY2tOZXdOb2RlID0gZnVuY3Rpb24gKG5ld05vZGUpIHtcclxuICAgICAgICBpZiAoIW5ld05vZGUpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJBcmd1bWVudCBub3Qgb3B0aW9uYWw6IG5ld05vZGVcIik7XHJcbiAgICAgICAgaWYgKG5ld05vZGUubGlzdClcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm9kZSBpcyBhbHJlYWR5IGF0dGFjaGVkIHRvIGEgbGlzdC5cIik7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuX2luc2VydCA9IGZ1bmN0aW9uIChub2RlLCBuZXdOb2RlKSB7XHJcbiAgICAgICAgbmV3Tm9kZS5fbGlzdCA9IHRoaXM7XHJcbiAgICAgICAgbmV3Tm9kZS5fbmV4dCA9IG5vZGU7XHJcbiAgICAgICAgbmV3Tm9kZS5fcHJldmlvdXMgPSBub2RlLl9wcmV2aW91cztcclxuICAgICAgICBub2RlLl9wcmV2aW91cy5fbmV4dCA9IG5ld05vZGU7XHJcbiAgICAgICAgbm9kZS5fcHJldmlvdXMgPSBuZXdOb2RlO1xyXG4gICAgICAgIHRoaXMuX2NhY2hlID0gbmV3Tm9kZTtcclxuICAgICAgICB0aGlzLl9zaXplKys7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuX2luc2VydEVtcHR5ID0gZnVuY3Rpb24gKG5ld05vZGUpIHtcclxuICAgICAgICBuZXdOb2RlLl9saXN0ID0gdGhpcztcclxuICAgICAgICBuZXdOb2RlLl9uZXh0ID0gbmV3Tm9kZTtcclxuICAgICAgICBuZXdOb2RlLl9wcmV2aW91cyA9IG5ld05vZGU7XHJcbiAgICAgICAgdGhpcy5faGVhZCA9IG5ld05vZGU7XHJcbiAgICAgICAgdGhpcy5fY2FjaGUgPSBuZXdOb2RlO1xyXG4gICAgICAgIHRoaXMuX3NpemUrKztcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5fZGVsZXRlID0gZnVuY3Rpb24gKG5vZGUpIHtcclxuICAgICAgICBpZiAobm9kZS5fbmV4dCA9PT0gbm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLl9oZWFkID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgbm9kZS5fbmV4dC5fcHJldmlvdXMgPSBub2RlLl9wcmV2aW91cztcclxuICAgICAgICAgICAgbm9kZS5fcHJldmlvdXMuX25leHQgPSBub2RlLl9uZXh0O1xyXG4gICAgICAgICAgICBpZiAodGhpcy5faGVhZCA9PT0gbm9kZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5faGVhZCA9IG5vZGUuX25leHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5faW52YWxpZGF0ZShub2RlKTtcclxuICAgICAgICB0aGlzLl9jYWNoZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICB0aGlzLl9zaXplLS07XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuX2ludmFsaWRhdGUgPSBmdW5jdGlvbiAobm9kZSkge1xyXG4gICAgICAgIG5vZGUuX2xpc3QgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgbm9kZS5fbmV4dCA9IHVuZGVmaW5lZDtcclxuICAgICAgICBub2RlLl9wcmV2aW91cyA9IHVuZGVmaW5lZDtcclxuICAgIH07XHJcbiAgICByZXR1cm4gTGlua2VkTGlzdDtcclxufSkoKTtcclxuZXhwb3J0cy5MaW5rZWRMaXN0ID0gTGlua2VkTGlzdDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy9saXN0LmpzLm1hcCIsIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKEMpIFJvbiBBLiBCdWNrdG9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpOyB5b3UgbWF5IG5vdCB1c2VcclxudGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGVcclxuTGljZW5zZSBhdCBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuXHJcblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuXHJcblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbnZhciB0YXNrID0gcmVxdWlyZSgnLi90YXNrJyk7XHJcbnZhciBzY2hlZHVsZVRhc2sgPSB0YXNrLnNjaGVkdWxlVGFzaztcclxudmFyIGhhc01zRGVidWcgPSB0eXBlb2YgRGVidWcgIT09IFwidW5kZWZpbmVkXCIgJiZcclxudHlwZW9mIERlYnVnLm1zVHJhY2VBc3luY09wZXJhdGlvblN0YXJ0aW5nID09PSBcImZ1bmN0aW9uXCIgJiZcclxudHlwZW9mIERlYnVnLm1zVHJhY2VBc3luY09wZXJhdGlvbkNvbXBsZXRlZCA9PT0gXCJmdW5jdGlvblwiICYmXHJcbnR5cGVvZiBEZWJ1Zy5tc1RyYWNlQXN5bmNDYWxsYmFja1N0YXJ0aW5nID09PSBcImZ1bmN0aW9uXCIgJiZcclxudHlwZW9mIERlYnVnLm1zVHJhY2VBc3luY0NhbGxiYWNrQ29tcGxldGVkID09PSBcImZ1bmN0aW9uXCI7XHJcbnZhciBoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucyA9IHR5cGVvZiBEZWJ1ZyAhPT0gXCJ1bmRlZmluZWRcIiAmJlxyXG50eXBlb2YgRGVidWcuc2V0Tm9uVXNlckNvZGVFeGNlcHRpb25zID09PSBcImJvb2xlYW5cIjtcclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgdGhlIGNvbXBsZXRpb24gb2YgYW4gYXN5bmNocm9ub3VzIG9wZXJhdGlvblxyXG4gKi9cclxudmFyIFByb21pc2UgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgbmV3IFByb21pc2UuXHJcbiAgICAgKiBAcGFyYW0gaW5pdCBBIGNhbGxiYWNrIHVzZWQgdG8gaW5pdGlhbGl6ZSB0aGUgcHJvbWlzZS4gVGhpcyBjYWxsYmFjayBpcyBwYXNzZWQgdHdvIGFyZ3VtZW50czogYSByZXNvbHZlIGNhbGxiYWNrIHVzZWQgcmVzb2x2ZSB0aGUgcHJvbWlzZSB3aXRoIGEgdmFsdWUgb3IgdGhlIHJlc3VsdCBvZiBhbm90aGVyIHByb21pc2UsIGFuZCBhIHJlamVjdCBjYWxsYmFjayB1c2VkIHRvIHJlamVjdCB0aGUgcHJvbWlzZSB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIG9yIGVycm9yLlxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBQcm9taXNlKGluaXQpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIGlmICh0eXBlb2YgaW5pdCAhPT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcmd1bWVudCBpcyBub3QgYSBGdW5jdGlvbiBvYmplY3RcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucykge1xyXG4gICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgcmVzb2x2ZXIgPSBmdW5jdGlvbiAocmVqZWN0aW5nLCByZXN1bHQpIHtcclxuICAgICAgICAgICAgaWYgKHJlc29sdmVyKSB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlciA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICBfdGhpcy5fcmVzb2x2ZShyZWplY3RpbmcsIHJlc3VsdCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgICAgIHZhciByZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiByZXNvbHZlcihmYWxzZSwgdmFsdWUpOyB9O1xyXG4gICAgICAgIHZhciByZWplY3QgPSBmdW5jdGlvbiAocmVhc29uKSB7IHJldHVybiByZXNvbHZlcih0cnVlLCByZWFzb24pOyB9O1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGluaXQocmVzb2x2ZSwgcmVqZWN0KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgUHJvbWlzZS5yZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuICh2YWx1ZSBpbnN0YW5jZW9mIHRoaXMpID8gdmFsdWUgOiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXR1cm4gcmVzb2x2ZSh2YWx1ZSk7IH0pO1xyXG4gICAgfTtcclxuICAgIFByb21pc2UucmVqZWN0ID0gZnVuY3Rpb24gKHJlYXNvbikge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAoXywgcmVqZWN0KSB7IHJldHVybiByZWplY3QocmVhc29uKTsgfSk7XHJcbiAgICB9O1xyXG4gICAgUHJvbWlzZS5hbGwgPSBmdW5jdGlvbiAodmFsdWVzKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICByZXR1cm4gbmV3IHRoaXMoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICB2YXIgY291bnRkb3duID0gdmFsdWVzLmxlbmd0aCB8fCAwO1xyXG4gICAgICAgICAgICBpZiAoY291bnRkb3duIDw9IDApIHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoW10pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0gQXJyYXkoY291bnRkb3duKTtcclxuICAgICAgICAgICAgdmFyIHJlc29sdmVyID0gZnVuY3Rpb24gKGluZGV4KSB7IHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdHNbaW5kZXhdID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICBpZiAoLS1jb3VudGRvd24gPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdHMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9OyB9O1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIF90aGlzLnJlc29sdmUodmFsdWVzW2ldKS50aGVuKHJlc29sdmVyKGkpLCByZWplY3QpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgUHJvbWlzZS5yYWNlID0gZnVuY3Rpb24gKHZhbHVlcykge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgdmFyIHByb21pc2VzID0gdmFsdWVzLm1hcChmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIF90aGlzLnJlc29sdmUodmFsdWUpOyB9KTtcclxuICAgICAgICAgICAgcHJvbWlzZXMuZm9yRWFjaChmdW5jdGlvbiAocHJvbWlzZSkgeyByZXR1cm4gcHJvbWlzZS50aGVuKHJlc29sdmUsIHJlamVjdCk7IH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoZXMgY2FsbGJhY2tzIGZvciB0aGUgcmVzb2x1dGlvbiBhbmQvb3IgcmVqZWN0aW9uIG9mIHRoZSBQcm9taXNlLlxyXG4gICAgICogQHBhcmFtIG9uZnVsZmlsbGVkIFRoZSBjYWxsYmFjayB0byBleGVjdXRlIHdoZW4gdGhlIFByb21pc2UgaXMgcmVzb2x2ZWQuXHJcbiAgICAgKiBAcGFyYW0gb25yZWplY3RlZCBUaGUgY2FsbGJhY2sgdG8gZXhlY3V0ZSB3aGVuIHRoZSBQcm9taXNlIGlzIHJlamVjdGVkLlxyXG4gICAgICogQHJldHVybnMgQSBQcm9taXNlIGZvciB0aGUgY29tcGxldGlvbiBvZiB3aGljaCBldmVyIGNhbGxiYWNrIGlzIGV4ZWN1dGVkLlxyXG4gICAgICovXHJcbiAgICBQcm9taXNlLnByb3RvdHlwZS50aGVuID0gZnVuY3Rpb24gKG9uZnVsZmlsbGVkLCBvbnJlamVjdGVkKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F3YWl0KG9uZnVsZmlsbGVkLCBvbnJlamVjdGVkKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaGVzIGEgY2FsbGJhY2sgZm9yIG9ubHkgdGhlIHJlamVjdGlvbiBvZiB0aGUgUHJvbWlzZS5cclxuICAgICAqIEBwYXJhbSBvbnJlamVjdGVkIFRoZSBjYWxsYmFjayB0byBleGVjdXRlIHdoZW4gdGhlIFByb21pc2UgaXMgcmVqZWN0ZWQuXHJcbiAgICAgKiBAcmV0dXJucyBBIFByb21pc2UgZm9yIHRoZSBjb21wbGV0aW9uIG9mIHRoZSBjYWxsYmFjay5cclxuICAgICAqL1xyXG4gICAgUHJvbWlzZS5wcm90b3R5cGUuY2F0Y2ggPSBmdW5jdGlvbiAob25yZWplY3RlZCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hd2FpdCh1bmRlZmluZWQsIG9ucmVqZWN0ZWQpO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoZXMgYSBjYWxsYmFjayBmb3IgdGhhdCBpcyBleGVjdXRlZCByZWdhcmRsZXNzIG9mIHRoZSByZXNvbHV0aW9uIG9yIHJlamVjdGlvbiBvZiB0aGUgcHJvbWlzZS5cclxuICAgICAqIEBwYXJhbSBvbnNldHRsZWQgVGhlIGNhbGxiYWNrIHRvIGV4ZWN1dGUgd2hlbiB0aGUgUHJvbWlzZSBpcyBzZXR0bGVkLlxyXG4gICAgICogQHJldHVybnMgQSBQcm9taXNlIGZvciB0aGUgY29tcGxldGlvbiBvZiB0aGUgY2FsbGJhY2suXHJcbiAgICAgKi9cclxuICAgIFByb21pc2UucHJvdG90eXBlLmZpbmFsbHkgPSBmdW5jdGlvbiAob25zZXR0bGVkKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F3YWl0KGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmV0dXJuIHJlc29sdmUob25zZXR0bGVkKCkpOyB9KS50aGVuKGZ1bmN0aW9uICgpIHsgcmV0dXJuIHZhbHVlOyB9KTsgfSwgZnVuY3Rpb24gKHJlYXNvbikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmV0dXJuIHJlc29sdmUob25zZXR0bGVkKCkpOyB9KS50aGVuKGZ1bmN0aW9uICgpIHsgcmV0dXJuIFByb21pc2UucmVqZWN0KHJlYXNvbik7IH0pOyB9KTtcclxuICAgIH07XHJcbiAgICBQcm9taXNlLnByb3RvdHlwZS5fcmVzb2x2ZSA9IGZ1bmN0aW9uIChyZWplY3RpbmcsIHJlc3VsdCkge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgaWYgKCFyZWplY3RpbmcpIHtcclxuICAgICAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcyA9PT0gcmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZXNvbHZlIGEgcHJvbWlzZSB3aXRoIGl0c2VsZlwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgIT09IG51bGwgJiYgKHR5cGVvZiByZXN1bHQgPT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIHJlc3VsdCA9PT0gXCJmdW5jdGlvblwiKSAmJiBcInRoZW5cIiBpbiByZXN1bHQpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGhlbiA9IHJlc3VsdC50aGVuO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhlbiA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZXNvbHZlciA9IGZ1bmN0aW9uIChyZWplY3RpbmcsIHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc29sdmVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZXIgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9yZXNvbHZlKHJlamVjdGluZywgcmVzdWx0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc29sdmUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHJlc29sdmVyKGZhbHNlLCB2YWx1ZSk7IH07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWplY3QgPSBmdW5jdGlvbiAocmVhc29uKSB7IHJldHVybiByZXNvbHZlcih0cnVlLCByZWFzb24pOyB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhlbi5jYWxsKHJlc3VsdCwgcmVzb2x2ZSwgcmVqZWN0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGVycm9yO1xyXG4gICAgICAgICAgICAgICAgcmVqZWN0aW5nID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9zZXR0bGUocmVqZWN0aW5nLCByZXN1bHQpO1xyXG4gICAgfTtcclxuICAgIFByb21pc2UucHJvdG90eXBlLl9hd2FpdCA9IGZ1bmN0aW9uIChvbnJlc29sdmVkLCBvbnJlamVjdGVkKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB2YXIgaWQ7XHJcbiAgICAgICAgaWYgKGhhc01zRGVidWcpIHtcclxuICAgICAgICAgICAgRGVidWcubXNUcmFjZUFzeW5jT3BlcmF0aW9uU3RhcnRpbmcoXCJQcm9taXNlLnRoZW5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgIHZhciBwcmV2ID0gX3RoaXMuX3NldHRsZTtcclxuICAgICAgICAgICAgX3RoaXMuX3NldHRsZSA9IGZ1bmN0aW9uIChyZWplY3RpbmcsIHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgX3RoaXMuX2ZvcndhcmQocHJldiwgcmVzb2x2ZSwgcmVqZWN0LCByZWplY3RpbmcsIHJlc3VsdCwgb25yZXNvbHZlZCwgb25yZWplY3RlZCwgaWQpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFByb21pc2UucHJvdG90eXBlLl9zZXR0bGUgPSBmdW5jdGlvbiAocmVqZWN0aW5nLCByZXN1bHQpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHRoaXMuX3NldHRsZSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5fYXdhaXQgPSBmdW5jdGlvbiAob25mdWxmaWxsZWQsIG9ucmVqZWN0ZWQpIHtcclxuICAgICAgICAgICAgdmFyIGlkID0gaGFzTXNEZWJ1ZyAmJiBEZWJ1Zy5tc1RyYWNlQXN5bmNPcGVyYXRpb25TdGFydGluZyhcIlByb21pc2UudGhlblwiKTtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBfdGhpcy5jb25zdHJ1Y3RvcihmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICBfdGhpcy5fZm9yd2FyZChudWxsLCByZXNvbHZlLCByZWplY3QsIHJlamVjdGluZywgcmVzdWx0LCBvbmZ1bGZpbGxlZCwgb25yZWplY3RlZCwgaWQpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9O1xyXG4gICAgfTtcclxuICAgIFByb21pc2UucHJvdG90eXBlLl9mb3J3YXJkID0gZnVuY3Rpb24gKHByZXYsIHJlc29sdmUsIHJlamVjdCwgcmVqZWN0aW5nLCByZXN1bHQsIG9ucmVzb2x2ZWQsIG9ucmVqZWN0ZWQsIGlkKSB7XHJcbiAgICAgICAgaWYgKHByZXYpIHtcclxuICAgICAgICAgICAgcHJldi5jYWxsKHRoaXMsIHJlamVjdGluZywgcmVzdWx0KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc2NoZWR1bGVUYXNrKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChoYXNNc0RlYnVnKSB7XHJcbiAgICAgICAgICAgICAgICBEZWJ1Zy5tc1RyYWNlQXN5bmNPcGVyYXRpb25Db21wbGV0ZWQoaWQsIHJlamVjdGluZyA/IERlYnVnLk1TX0FTWU5DX09QX1NUQVRVU19FUlJPUiA6IERlYnVnLk1TX0FTWU5DX09QX1NUQVRVU19TVUNDRVNTKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgaGFuZGxlciA9IHJlamVjdGluZyA/IG9ucmVqZWN0ZWQgOiBvbnJlc29sdmVkO1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGhhbmRsZXIgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGhhc01zRGVidWcpIHtcclxuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5tc1RyYWNlQXN5bmNDYWxsYmFja1N0YXJ0aW5nKGlkKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gaGFuZGxlcihyZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBlO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdGluZyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBmaW5hbGx5IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaGFzTXNEZWJ1Zykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5tc1RyYWNlQXN5bmNDYWxsYmFja0NvbXBsZXRlZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAocmVqZWN0aW5nID8gcmVqZWN0IDogcmVzb2x2ZSkocmVzdWx0KTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gUHJvbWlzZTtcclxufSkoKTtcclxuZXhwb3J0cy5Qcm9taXNlID0gUHJvbWlzZTtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy9wcm9taXNlLmpzLm1hcCIsIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKEMpIFJvbiBBLiBCdWNrdG9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpOyB5b3UgbWF5IG5vdCB1c2VcclxudGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGVcclxuTGljZW5zZSBhdCBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuXHJcblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuXHJcblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbnZhciBsaXN0ID0gcmVxdWlyZSgnLi9saXN0Jyk7XHJcbnZhciBjYW5jZWxsYXRpb24gPSByZXF1aXJlKCcuL2NhbmNlbGxhdGlvbicpO1xyXG52YXIgTGlua2VkTGlzdCA9IGxpc3QuTGlua2VkTGlzdDtcclxudmFyIENhbmNlbGxhdGlvblRva2VuID0gY2FuY2VsbGF0aW9uLkNhbmNlbGxhdGlvblRva2VuO1xyXG5mdW5jdGlvbiBnZXRPckNyZWF0ZVF1ZXVlKCkge1xyXG4gICAgaWYgKCFxdWV1ZSkge1xyXG4gICAgICAgIHF1ZXVlID0gbmV3IExpbmtlZExpc3QoKTtcclxuICAgIH1cclxuICAgIHJldHVybiBxdWV1ZTtcclxufVxyXG5mdW5jdGlvbiBzY2hlZHVsZUltbWVkaWF0ZVRhc2sodGFzaywgdG9rZW4pIHtcclxuICAgIGlmICh0b2tlbi5jYW5CZUNhbmNlbGVkKSB7XHJcbiAgICAgICAgdmFyIHJlZ2lzdHJhdGlvbiA9IHRva2VuLnJlZ2lzdGVyKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG5vZGUubGlzdCA9PT0gcmVjb3ZlcnlRdWV1ZSB8fCBub2RlLmxpc3QgPT09IHF1ZXVlKSB7XHJcbiAgICAgICAgICAgICAgICBub2RlLmxpc3QuZGVsZXRlTm9kZShub2RlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAocmVjb3ZlcnlRdWV1ZSAmJiAhcmVjb3ZlcnlRdWV1ZS5maXJzdCkge1xyXG4gICAgICAgICAgICAgICAgcmVjb3ZlcnlRdWV1ZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAocXVldWUgJiYgIXF1ZXVlLmZpcnN0KSB7XHJcbiAgICAgICAgICAgICAgICBxdWV1ZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIXJlY292ZXJ5UXVldWUgJiYgIXF1ZXVlKSB7XHJcbiAgICAgICAgICAgICAgICBjYW5jZWxUaWNrKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICB2YXIgbm9kZSA9IGdldE9yQ3JlYXRlUXVldWUoKS5hZGRMYXN0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmVnaXN0cmF0aW9uLnVucmVnaXN0ZXIoKTtcclxuICAgICAgICAgICAgcmVnaXN0cmF0aW9uID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBpZiAoIXRva2VuLmNhbmNlbGVkKSB7XHJcbiAgICAgICAgICAgICAgICB0YXNrKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIGdldE9yQ3JlYXRlUXVldWUoKS5hZGRMYXN0KHRhc2spO1xyXG4gICAgfVxyXG4gICAgc2NoZWR1bGVUaWNrKCk7XHJcbn1cclxuZnVuY3Rpb24gc2NoZWR1bGVEZWxheWVkVGFzayh0YXNrLCBkZWxheSwgdG9rZW4pIHtcclxuICAgIGlmICh0b2tlbi5jYW5CZUNhbmNlbGVkKSB7XHJcbiAgICAgICAgdmFyIHJlZ2lzdHJhdGlvbiA9IHRva2VuLnJlZ2lzdGVyKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaGFuZGxlID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBjbGVhclRpbWVvdXQoaGFuZGxlKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICB2YXIgaGFuZGxlID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi51bnJlZ2lzdGVyKCk7XHJcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbiA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgaWYgKCF0b2tlbi5jYW5jZWxlZCkge1xyXG4gICAgICAgICAgICAgICAgdGFzaygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSwgZGVsYXkpO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgc2V0VGltZW91dCh0YXNrLCBkZWxheSk7XHJcbiAgICB9XHJcbn1cclxuZnVuY3Rpb24gc2NoZWR1bGVUYXNrKHRhc2ssIGRlbGF5LCB0b2tlbikge1xyXG4gICAgaWYgKGRlbGF5ID09PSB2b2lkIDApIHsgZGVsYXkgPSAwOyB9XHJcbiAgICBpZiAodG9rZW4gPT09IHZvaWQgMCkgeyB0b2tlbiA9IENhbmNlbGxhdGlvblRva2VuLm5vbmU7IH1cclxuICAgIGlmIChkZWxheSA+IDApIHtcclxuICAgICAgICBzY2hlZHVsZURlbGF5ZWRUYXNrKHRhc2ssIGRlbGF5LCB0b2tlbik7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICBzY2hlZHVsZUltbWVkaWF0ZVRhc2sodGFzaywgdG9rZW4pO1xyXG4gICAgfVxyXG59XHJcbmV4cG9ydHMuc2NoZWR1bGVUYXNrID0gc2NoZWR1bGVUYXNrO1xyXG52YXIgc2NoZWR1bGVyO1xyXG52YXIgaGFuZGxlO1xyXG52YXIgcmVjb3ZlcnlRdWV1ZTtcclxudmFyIHF1ZXVlO1xyXG5mdW5jdGlvbiBzY2hlZHVsZVRpY2soKSB7XHJcbiAgICBpZiAoaGFuZGxlICE9PSB2b2lkIDApIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZiAoIXNjaGVkdWxlcikge1xyXG4gICAgICAgIHNjaGVkdWxlciA9IGdldFNjaGVkdWxlcigpO1xyXG4gICAgfVxyXG4gICAgaGFuZGxlID0gc2NoZWR1bGVyLnNjaGVkdWxlVGljayhvblRpY2spO1xyXG59XHJcbmZ1bmN0aW9uIGNhbmNlbFRpY2soKSB7XHJcbiAgICBpZiAoaGFuZGxlID09PSB2b2lkIDAgfHwgIXNjaGVkdWxlcikge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHNjaGVkdWxlci5jYW5jZWxUaWNrKGhhbmRsZSk7XHJcbiAgICBoYW5kbGUgPSB1bmRlZmluZWQ7XHJcbn1cclxuZnVuY3Rpb24gb25UaWNrKCkge1xyXG4gICAgaGFuZGxlID0gdW5kZWZpbmVkO1xyXG4gICAgcHJvY2Vzc1F1ZXVlKHJlY292ZXJ5UXVldWUpO1xyXG4gICAgcmVjb3ZlcnlRdWV1ZSA9IHF1ZXVlO1xyXG4gICAgcXVldWUgPSB1bmRlZmluZWQ7XHJcbiAgICBwcm9jZXNzUXVldWUocmVjb3ZlcnlRdWV1ZSk7XHJcbiAgICByZWNvdmVyeVF1ZXVlID0gdW5kZWZpbmVkO1xyXG59XHJcbmZ1bmN0aW9uIHByb2Nlc3NRdWV1ZShxdWV1ZSkge1xyXG4gICAgaWYgKCFxdWV1ZSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHZhciBub2RlO1xyXG4gICAgdmFyIHRhc2tDb21wbGV0ZWQgPSBmYWxzZTtcclxuICAgIHdoaWxlIChub2RlID0gcXVldWUuZmlyc3QpIHtcclxuICAgICAgICBxdWV1ZS5kZWxldGVOb2RlKG5vZGUpO1xyXG4gICAgICAgIHZhciB0YXNrID0gbm9kZS52YWx1ZTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICB0YXNrKCk7XHJcbiAgICAgICAgICAgIHRhc2tDb21wbGV0ZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHtcclxuICAgICAgICAgICAgaWYgKCF0YXNrQ29tcGxldGVkKSB7XHJcbiAgICAgICAgICAgICAgICBzY2hlZHVsZVRpY2soKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5mdW5jdGlvbiBnZXRTY2hlZHVsZXIoKSB7XHJcbiAgICBmdW5jdGlvbiBnZXRTZXRJbW1lZGlhdGVTY2hlZHVsZXIoKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgc2NoZWR1bGVUaWNrOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBzZXRJbW1lZGlhdGUoY2FsbGJhY2spO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjYW5jZWxUaWNrOiBmdW5jdGlvbiAoaGFuZGxlKSB7XHJcbiAgICAgICAgICAgICAgICBjbGVhckltbWVkaWF0ZShoYW5kbGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGdldE1TU2V0SW1tZWRpYXRlU2NoZWR1bGVyKCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHNjaGVkdWxlVGljazogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbXNTZXRJbW1lZGlhdGUoY2FsbGJhY2spO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjYW5jZWxUaWNrOiBmdW5jdGlvbiAoaGFuZGxlKSB7XHJcbiAgICAgICAgICAgICAgICBtc0NsZWFySW1tZWRpYXRlKGhhbmRsZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gZ2V0TmV4dFRpY2tTY2hlZHVsZXIoKSB7XHJcbiAgICAgICAgdmFyIHF1ZXVlID0gbmV3IExpbmtlZExpc3QoKTtcclxuICAgICAgICBmdW5jdGlvbiBvbnRpY2soKSB7XHJcbiAgICAgICAgICAgIHZhciBub2RlID0gcXVldWUuZmlyc3Q7XHJcbiAgICAgICAgICAgIGlmIChub2RlKSB7XHJcbiAgICAgICAgICAgICAgICBxdWV1ZS5kZWxldGVGaXJzdCgpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGNhbGxiYWNrID0gbm9kZS52YWx1ZTtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgc2NoZWR1bGVUaWNrOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgIHZhciBoYW5kbGUgPSBxdWV1ZS5hZGRMYXN0KGNhbGxiYWNrKTtcclxuICAgICAgICAgICAgICAgIHByb2Nlc3MubmV4dFRpY2sob250aWNrKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBoYW5kbGU7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNhbmNlbFRpY2s6IGZ1bmN0aW9uIChoYW5kbGUpIHtcclxuICAgICAgICAgICAgICAgIGlmIChoYW5kbGUgJiYgaGFuZGxlLmxpc3QgPT09IHF1ZXVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcXVldWUuZGVsZXRlTm9kZShoYW5kbGUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGdldE1lc3NhZ2VDaGFubmVsU2NoZWR1bGVyKCkge1xyXG4gICAgICAgIHZhciBxdWV1ZSA9IG5ldyBMaW5rZWRMaXN0KCk7XHJcbiAgICAgICAgdmFyIGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcclxuICAgICAgICBjaGFubmVsLnBvcnQyLm9ubWVzc2FnZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIG5vZGUgPSBxdWV1ZS5maXJzdDtcclxuICAgICAgICAgICAgaWYgKG5vZGUpIHtcclxuICAgICAgICAgICAgICAgIHF1ZXVlLmRlbGV0ZUZpcnN0KCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgY2FsbGJhY2sgPSBub2RlLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgc2NoZWR1bGVUaWNrOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgIHZhciBoYW5kbGUgPSBxdWV1ZS5hZGRMYXN0KGNhbGxiYWNrKTtcclxuICAgICAgICAgICAgICAgIGNoYW5uZWwucG9ydDEucG9zdE1lc3NhZ2UodW5kZWZpbmVkKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBoYW5kbGU7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNhbmNlbFRpY2s6IGZ1bmN0aW9uIChoYW5kbGUpIHtcclxuICAgICAgICAgICAgICAgIGlmIChoYW5kbGUgJiYgaGFuZGxlLmxpc3QgPT09IHF1ZXVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcXVldWUuZGVsZXRlTm9kZShoYW5kbGUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGdldFNldFRpbWVvdXRTY2hlZHVsZXIoKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgc2NoZWR1bGVUaWNrOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGNhbGxiYWNrLCAwKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgY2FuY2VsVGljazogZnVuY3Rpb24gKGhhbmRsZSkge1xyXG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGhhbmRsZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gZ2V0TWlzc2luZ1NjaGVkdWxlcigpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzY2hlZHVsZVRpY2s6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU2NoZWR1bGVyIG5vdCBhdmFpbGFibGUuXCIpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjYW5jZWxUaWNrOiBmdW5jdGlvbiAoaGFuZGxlKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJTY2hlZHVsZXIgbm90IGF2YWlsYWJsZS5cIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgaWYgKHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgIHJldHVybiBnZXRTZXRJbW1lZGlhdGVTY2hlZHVsZXIoKTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKHR5cGVvZiBtc1NldEltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldE1TU2V0SW1tZWRpYXRlU2NoZWR1bGVyKCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmICh0eXBlb2YgTWVzc2FnZUNoYW5uZWwgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgIHJldHVybiBnZXRNZXNzYWdlQ2hhbm5lbFNjaGVkdWxlcigpO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAodHlwZW9mIHByb2Nlc3MgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHByb2Nlc3MubmV4dFRpY2sgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgIHJldHVybiBnZXROZXh0VGlja1NjaGVkdWxlcigpO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgIHJldHVybiBnZXRTZXRUaW1lb3V0U2NoZWR1bGVyKCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICByZXR1cm4gZ2V0TWlzc2luZ1NjaGVkdWxlcigpO1xyXG4gICAgfVxyXG59XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGU6Ly8vQ3wvZGV2L2FzeW5janMvdGFzay5qcy5tYXAiLCIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChDKSBSb24gQS4gQnVja3Rvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTsgeW91IG1heSBub3QgdXNlXHJcbnRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlXHJcbkxpY2Vuc2UgYXQgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcblxyXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcblxyXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG52YXIgcHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xyXG52YXIgY2FuY2VsbGF0aW9uID0gcmVxdWlyZSgnLi9jYW5jZWxsYXRpb24nKTtcclxudmFyIHRhc2sgPSByZXF1aXJlKCcuL3Rhc2snKTtcclxudmFyIFByb21pc2UgPSBwcm9taXNlLlByb21pc2U7XHJcbnZhciBDYW5jZWxsYXRpb25Ub2tlbiA9IGNhbmNlbGxhdGlvbi5DYW5jZWxsYXRpb25Ub2tlbjtcclxudmFyIHNjaGVkdWxlVGFzayA9IHRhc2suc2NoZWR1bGVUYXNrO1xyXG5mdW5jdGlvbiBzbGVlcChkZWxheSwgdG9rZW4pIHtcclxuICAgIGlmIChkZWxheSA9PT0gdm9pZCAwKSB7IGRlbGF5ID0gMDsgfVxyXG4gICAgaWYgKHRva2VuID09PSB2b2lkIDApIHsgdG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5ub25lOyB9XHJcbiAgICBpZiAodHlwZW9mIGRlbGF5ICE9PSBcIm51bWJlclwiKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk51bWJlciBleHBlY3RlZC5cIik7XHJcbiAgICB9XHJcbiAgICBpZiAodG9rZW4uY2FuY2VsZWQpIHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QodG9rZW4ucmVhc29uKTtcclxuICAgIH1cclxuICAgIGlmICghdG9rZW4uY2FuQmVDYW5jZWxlZCAmJiBkZWxheSA8PSAwKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICB0b2tlbi5yZWdpc3RlcihyZWplY3QpO1xyXG4gICAgICAgIHNjaGVkdWxlVGFzayhyZXNvbHZlLCBkZWxheSwgdG9rZW4pO1xyXG4gICAgfSk7XHJcbn1cclxuZXhwb3J0cy5zbGVlcCA9IHNsZWVwO1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1maWxlOi8vL0N8L2Rldi9hc3luY2pzL3V0aWxzLmpzLm1hcCJdfQ==
