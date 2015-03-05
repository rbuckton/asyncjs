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
var utils = require('./utils');
var promise = require('./promise');
var task = require('./task');
var LinkedList = list.LinkedList;
var resolvedPromise = utils.resolvedPromise;
var Promise = promise.Promise;
var scheduleImmediateTask = task.scheduleImmediateTask;
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
            return resolvedPromise;
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
            return new Promise(function (resolve, reject) {
                callbacks.forEach(function (callback, node) {
                    scheduleImmediateTask(function () {
                        if (node.list === callbacks) {
                            callbacks.deleteNode(node);
                            if (hasMsNonUserCodeExceptions) {
                                Debug.setNonUserCodeExceptions = true;
                            }
                            try {
                                callback(reason);
                                resolve();
                            }
                            catch (e) {
                                reject(e);
                            }
                        }
                    });
                });
            });
        }
        return resolvedPromise;
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
        var _this = this;
        if (this._canceled) {
            var scheduleCts = new CancellationTokenSource();
            scheduleImmediateTask(function () { callback(_this._reason); }, scheduleCts.token);
            return Object.freeze({
                unregister: function () {
                    scheduleCts.cancel();
                }
            });
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
},{"./list":undefined,"./promise":undefined,"./task":undefined,"./utils":undefined}],3:[function(require,module,exports){
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
    LinkedList.prototype.reduce = function (callback, initial) {
        var result = initial;
        var next = this._head;
        if (next) {
            if (arguments.length < 2) {
                result = next.value;
                next = next._next;
                if (next === this._head) {
                    return result;
                }
            }
            do {
                var node = next;
                next = node._next;
                result = callback(result, node.value, node, this);
            } while (next !== this._head);
        }
        return result;
    };
    LinkedList.prototype.reduceRight = function (callback, initial) {
        var result = initial;
        if (this._head) {
            var tail = this._head._previous;
            var previous = tail;
            if (arguments.length < 2) {
                result = previous.value;
                previous = previous._previous;
                if (previous === tail) {
                    return result;
                }
            }
            do {
                var node = previous;
                previous = node._previous;
                result = callback(result, node.value, node, this);
            } while (previous !== tail);
        }
        return result;
    };
    LinkedList.prototype.map = function (callback) {
        return this.reduce(function (result, value, node, list) {
            result.addLast(callback(value, node, list));
            return result;
        }, new LinkedList());
    };
    LinkedList.prototype.filter = function (callback) {
        return this.reduce(function (result, value, node, list) {
            if (callback(value, node, list)) {
                result.addLast(value);
            }
            return result;
        }, new LinkedList());
    };
    LinkedList.prototype.join = function (delimiter) {
        if (delimiter === void 0) { delimiter = ","; }
        var first = true;
        return this.reduce(function (result, value, node) {
            if (!first) {
                result += delimiter;
            }
            return result += String(value);
        }, "");
    };
    LinkedList.prototype.toArray = function (selector) {
        if (selector) {
            return this.reduce(function (result, value, node, list) {
                result.push(selector(value, node, list));
                return result;
            }, []);
        }
        else {
            return this.reduce(function (result, value) {
                result.push(value);
                return result;
            }, []);
        }
    };
    LinkedList.prototype.toString = function () {
        return this.join();
    };
    LinkedList.prototype.toJSON = function () {
        return this.toArray();
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
var scheduleImmediateTask = task.scheduleImmediateTask;
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
            for (var i = 0; i < values.length; i++) {
                _this.resolve(values[i]).then(resolve, reject);
            }
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
        scheduleImmediateTask(function () {
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
/*@internal*/
function scheduleImmediateTask(task, token) {
    if (token === void 0) { token = CancellationToken.none; }
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
exports.scheduleImmediateTask = scheduleImmediateTask;
/*@internal*/
function scheduleDelayedTask(task, delay, token) {
    if (token === void 0) { token = CancellationToken.none; }
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
exports.scheduleDelayedTask = scheduleDelayedTask;
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
var scheduleImmediateTask = task.scheduleImmediateTask;
var scheduleDelayedTask = task.scheduleDelayedTask;
function sleep(delay, token) {
    if (token === void 0) { token = CancellationToken.none; }
    if ((delay |= 0) < 0) {
        throw new RangeError();
    }
    if (token.canceled) {
        return Promise.reject(token.reason);
    }
    return new Promise(function (resolve, reject) {
        scheduleDelayedTask(resolve, delay, token);
        token.register(reject);
    });
}
exports.sleep = sleep;
function spin(token) {
    if (token === void 0) { token = CancellationToken.none; }
    if (token.canceled) {
        return Promise.reject(token.reason);
    }
    return new Promise(function (resolve, reject) {
        scheduleImmediateTask(resolve, token);
        token.register(reject);
    });
}
exports.spin = spin;
exports.resolvedPromise = Object.freeze(Promise.resolve());
//# sourceMappingURL=file:///C|/dev/asyncjs/utils.js.map
},{"./cancellation":undefined,"./promise":undefined,"./task":undefined}]},{},[5,7,6,3,2,8,4,1])(8)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwibGliXFxhc3luYy5qcyIsImxpYlxcY2FuY2VsbGF0aW9uLmpzIiwibGliXFxkZWZlcnJlZC5qcyIsImxpYlxcaHR0cGNsaWVudC5qcyIsImxpYlxcbGlzdC5qcyIsImxpYlxccHJvbWlzZS5qcyIsImxpYlxcdGFzay5qcyIsImxpYlxcdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3p6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9YQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDak5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKEMpIFJvbiBBLiBCdWNrdG9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpOyB5b3UgbWF5IG5vdCB1c2VcclxudGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGVcclxuTGljZW5zZSBhdCBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuXHJcblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuXHJcblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbnZhciBwcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XHJcbnZhciBkZWZlcnJlZCA9IHJlcXVpcmUoJy4vZGVmZXJyZWQnKTtcclxudmFyIGNhbmNlbGxhdGlvbiA9IHJlcXVpcmUoJy4vY2FuY2VsbGF0aW9uJyk7XHJcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcclxuZXhwb3J0cy5Qcm9taXNlID0gcHJvbWlzZS5Qcm9taXNlO1xyXG5leHBvcnRzLkRlZmVycmVkID0gZGVmZXJyZWQuRGVmZXJyZWQ7XHJcbmV4cG9ydHMuQ2FuY2VsbGF0aW9uVG9rZW4gPSBjYW5jZWxsYXRpb24uQ2FuY2VsbGF0aW9uVG9rZW47XHJcbmV4cG9ydHMuQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgPSBjYW5jZWxsYXRpb24uQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U7XHJcbmV4cG9ydHMuc2xlZXAgPSB1dGlscy5zbGVlcDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy9hc3luYy5qcy5tYXAiLCIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChDKSBSb24gQS4gQnVja3Rvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTsgeW91IG1heSBub3QgdXNlXHJcbnRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlXHJcbkxpY2Vuc2UgYXQgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcblxyXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcblxyXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG52YXIgbGlzdCA9IHJlcXVpcmUoJy4vbGlzdCcpO1xyXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XHJcbnZhciBwcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XHJcbnZhciB0YXNrID0gcmVxdWlyZSgnLi90YXNrJyk7XHJcbnZhciBMaW5rZWRMaXN0ID0gbGlzdC5MaW5rZWRMaXN0O1xyXG52YXIgcmVzb2x2ZWRQcm9taXNlID0gdXRpbHMucmVzb2x2ZWRQcm9taXNlO1xyXG52YXIgUHJvbWlzZSA9IHByb21pc2UuUHJvbWlzZTtcclxudmFyIHNjaGVkdWxlSW1tZWRpYXRlVGFzayA9IHRhc2suc2NoZWR1bGVJbW1lZGlhdGVUYXNrO1xyXG52YXIgaGFzTXNOb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0eXBlb2YgRGVidWcgIT09IFwidW5kZWZpbmVkXCIgJiZcclxudHlwZW9mIERlYnVnLnNldE5vblVzZXJDb2RlRXhjZXB0aW9ucyA9PT0gXCJib29sZWFuXCI7XHJcbi8qKlxyXG4gICogQSBzb3VyY2UgZm9yIGNhbmNlbGxhdGlvblxyXG4gICovXHJcbnZhciBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICAvKipcclxuICAgICAgKiBAcGFyYW0gbGlua3MgT3RoZXIgYENhbmNlbGxhdGlvblRva2VuYCBpbnN0YW5jZXMgdGhhdCB3aWxsIGNhbmNlbCB0aGlzIHNvdXJjZSBpZiB0aGUgdG9rZW5zIGFyZSBjYW5jZWxlZC5cclxuICAgICAgKi9cclxuICAgIGZ1bmN0aW9uIENhbmNlbGxhdGlvblRva2VuU291cmNlKGxpbmtzKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB0aGlzLl90b2tlbiA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlbih0aGlzKTtcclxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJfdG9rZW5cIiwgeyB3cml0YWJsZTogZmFsc2UsIGNvbmZpZ3VyYWJsZTogZmFsc2UgfSk7XHJcbiAgICAgICAgaWYgKGxpbmtzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xpbmtzID0gbmV3IEFycmF5KCk7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlua3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbGluayA9IGxpbmtzW2ldO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFsaW5rKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAobGluay5jYW5jZWxlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhbmNlbGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9yZWFzb24gPSBsaW5rLnJlYXNvbjtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9saW5rcy5wdXNoKGxpbmsucmVnaXN0ZXIoZnVuY3Rpb24gKHJlYXNvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmNhbmNlbChyZWFzb24pO1xyXG4gICAgICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KENhbmNlbGxhdGlvblRva2VuU291cmNlLnByb3RvdHlwZSwgXCJ0b2tlblwiLCB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogR2V0cyB0aGUgYENhbmNlbGxhdGlvblRva2VuYCBmb3IgdGhpcyBzb3VyY2UuXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl90b2tlbjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIC8qKlxyXG4gICAgICogU2lnbmFscyB0aGUgc291cmNlIGlzIGNhbmNlbGxlZC5cclxuICAgICAqIEBwYXJhbSByZWFzb24gQW4gb3B0aW9uYWwgcmVhc29uIGZvciB0aGUgY2FuY2VsbGF0aW9uLlxyXG4gICAgICovXHJcbiAgICBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5wcm90b3R5cGUuY2FuY2VsID0gZnVuY3Rpb24gKHJlYXNvbikge1xyXG4gICAgICAgIGlmICh0aGlzLl9jYW5jZWxlZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZWRQcm9taXNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl90aHJvd0lmRnJvemVuKCk7XHJcbiAgICAgICAgaWYgKHJlYXNvbiA9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJlYXNvbiA9IG5ldyBFcnJvcihcIm9wZXJhdGlvbiB3YXMgY2FuY2VsZWQuXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocmVhc29uIGluc3RhbmNlb2YgRXJyb3IgJiYgIShcInN0YWNrXCIgaW4gcmVhc29uKSkge1xyXG4gICAgICAgICAgICBpZiAoaGFzTXNOb25Vc2VyQ29kZUV4Y2VwdGlvbnMpIHtcclxuICAgICAgICAgICAgICAgIERlYnVnLnNldE5vblVzZXJDb2RlRXhjZXB0aW9ucyA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHRocm93IHJlYXNvbjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHJlYXNvbiA9IGVycm9yO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBjYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3M7XHJcbiAgICAgICAgdGhpcy5fY2FuY2VsZWQgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuX3JlYXNvbiA9IHJlYXNvbjtcclxuICAgICAgICB0aGlzLl9jYWxsYmFja3MgPSBudWxsO1xyXG4gICAgICAgIE9iamVjdC5mcmVlemUodGhpcyk7XHJcbiAgICAgICAgaWYgKGNhbGxiYWNrcykge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzLmZvckVhY2goZnVuY3Rpb24gKGNhbGxiYWNrLCBub2RlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2NoZWR1bGVJbW1lZGlhdGVUYXNrKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5vZGUubGlzdCA9PT0gY2FsbGJhY2tzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFja3MuZGVsZXRlTm9kZShub2RlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLnNldE5vblVzZXJDb2RlRXhjZXB0aW9ucyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHJlYXNvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc29sdmVkUHJvbWlzZTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIENsb3NlcyB0aGUgQ2FuY2VsbGF0aW9uU291cmNlLCBwcmV2ZW50aW5nIGFueSBmdXR1cmUgY2FuY2VsbGF0aW9uIHNpZ25hbC5cclxuICAgICAqL1xyXG4gICAgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmIChPYmplY3QuaXNGcm96ZW4odGhpcykpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5fbGlua3MpIHtcclxuICAgICAgICAgICAgdmFyIGxpbmtzID0gdGhpcy5fbGlua3M7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlua3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsaW5rc1tpXS51bnJlZ2lzdGVyKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuX2NhbGxiYWNrcykge1xyXG4gICAgICAgICAgICB0aGlzLl9jYWxsYmFja3MuY2xlYXIoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fbGlua3MgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuX2NhbGxiYWNrcyA9IG51bGw7XHJcbiAgICAgICAgT2JqZWN0LmZyZWV6ZSh0aGlzKTtcclxuICAgIH07XHJcbiAgICBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5wcm90b3R5cGUuX3JlZ2lzdGVyID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICBpZiAodGhpcy5fY2FuY2VsZWQpIHtcclxuICAgICAgICAgICAgdmFyIHNjaGVkdWxlQ3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XHJcbiAgICAgICAgICAgIHNjaGVkdWxlSW1tZWRpYXRlVGFzayhmdW5jdGlvbiAoKSB7IGNhbGxiYWNrKF90aGlzLl9yZWFzb24pOyB9LCBzY2hlZHVsZUN0cy50b2tlbik7XHJcbiAgICAgICAgICAgIHJldHVybiBPYmplY3QuZnJlZXplKHtcclxuICAgICAgICAgICAgICAgIHVucmVnaXN0ZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICBzY2hlZHVsZUN0cy5jYW5jZWwoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChPYmplY3QuaXNGcm96ZW4odGhpcykpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVtcHR5UmVnaXN0cmF0aW9uO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzO1xyXG4gICAgICAgIGlmICghY2FsbGJhY2tzKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrcyA9IG5ldyBMaW5rZWRMaXN0KCk7XHJcbiAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrcyA9IGNhbGxiYWNrcztcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIGNvb2tpZSA9IGNhbGxiYWNrcy5hZGRMYXN0KGNhbGxiYWNrKTtcclxuICAgICAgICByZXR1cm4gT2JqZWN0LmZyZWV6ZSh7XHJcbiAgICAgICAgICAgIHVucmVnaXN0ZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrcy5kZWxldGVOb2RlKGNvb2tpZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5wcm90b3R5cGUuX3Rocm93SWZGcm96ZW4gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKE9iamVjdC5pc0Zyb3plbih0aGlzKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjYW5ub3QgbW9kaWZ5IGEgY2xvc2VkIHNvdXJjZVwiKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIENhbmNlbGxhdGlvblRva2VuU291cmNlO1xyXG59KSgpO1xyXG5leHBvcnRzLkNhbmNlbGxhdGlvblRva2VuU291cmNlID0gQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U7XHJcbi8qKlxyXG4gICogQSB0b2tlbiB1c2VkIHRvIHJlY2lldmUgYSBjYW5jZWxsYXRpb24gc2lnbmFsLlxyXG4gICovXHJcbnZhciBDYW5jZWxsYXRpb25Ub2tlbiA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICAvKkBpbnRlcm5hbCovXHJcbiAgICBmdW5jdGlvbiBDYW5jZWxsYXRpb25Ub2tlbihzb3VyY2UpIHtcclxuICAgICAgICB0aGlzLl9zb3VyY2UgPSBzb3VyY2U7XHJcbiAgICAgICAgT2JqZWN0LmZyZWV6ZSh0aGlzKTtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDYW5jZWxsYXRpb25Ub2tlbiwgXCJub25lXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgICogR2V0cyBhbiBlbXB0eSBjYW5jZWxsYXRpb24gdG9rZW4gdGhhdCB3aWxsIG5ldmVyIGJlIGNhbmNlbGVkLlxyXG4gICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKCFDYW5jZWxsYXRpb25Ub2tlbi5fbm9uZSkge1xyXG4gICAgICAgICAgICAgICAgQ2FuY2VsbGF0aW9uVG9rZW4uX25vbmUgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW4odW5kZWZpbmVkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gQ2FuY2VsbGF0aW9uVG9rZW4uX25vbmU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ2FuY2VsbGF0aW9uVG9rZW4ucHJvdG90eXBlLCBcImNhbkJlQ2FuY2VsZWRcIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAgKiBHZXRzIGEgdmFsdWUgaW5kaWNhdGluZyB3aGV0aGVyIHRoZSB0b2tlbiBjYW4gYmUgY2FuY2VsZWQuXHJcbiAgICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gISF0aGlzLl9zb3VyY2UgJiYgIU9iamVjdC5pc0Zyb3plbih0aGlzLl9zb3VyY2UpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KENhbmNlbGxhdGlvblRva2VuLnByb3RvdHlwZSwgXCJjYW5jZWxlZFwiLCB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICAqIEdldHMgYSB2YWx1ZSBpbmRpY2F0aW5nIHdoZXRoZXIgdGhlIHRva2VuIGhhcyByZWNlaXZlZCBhIGNhbmNlbGxhdGlvbiBzaWduYWwuXHJcbiAgICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3NvdXJjZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9zb3VyY2UuX2NhbmNlbGVkO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KENhbmNlbGxhdGlvblRva2VuLnByb3RvdHlwZSwgXCJyZWFzb25cIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAgKiBHZXRzIHRoZSByZWFzb24gZm9yIGNhbmNlbGxhdGlvbiwgaWYgb25lIHdhcyBzdXBwbGllZC5cclxuICAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5fc291cmNlKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9zb3VyY2UuX3JlYXNvbjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIC8qKlxyXG4gICAgICAqIFRocm93cyBhbiBgRXJyb3JgIGlmIHRoZSB0b2tlbiBoYXMgcmVjZWl2ZWQgYSBjYW5jZWxsYXRpb24gc2lnbmFsLlxyXG4gICAgICAqL1xyXG4gICAgQ2FuY2VsbGF0aW9uVG9rZW4ucHJvdG90eXBlLnRocm93SWZDYW5jZWxlZCA9IGZ1bmN0aW9uIChyZWFzb24pIHtcclxuICAgICAgICBpZiAocmVhc29uID09PSB2b2lkIDApIHsgcmVhc29uID0gdGhpcy5yZWFzb247IH1cclxuICAgICAgICBpZiAoIXRoaXMuX3NvdXJjZSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmNhbmNlbGVkKSB7XHJcbiAgICAgICAgICAgIHRocm93IHJlYXNvbjtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgICogUmVxdWVzdHMgYSBjYWxsYmFjayB3aGVuIHRoZSB0b2tlbiByZWNlaXZlcyBhIGNhbmNlbGxhdGlvbiBzaWduYWwgdG8gcGVyZm9ybSBhZGRpdGlvbmFsIGNsZWFudXAuXHJcbiAgICAgICogQHBhcmFtIGNhbGxiYWNrIFRoZSBjYWxsYmFjayB0byBleGVjdXRlXHJcbiAgICAgICogQHJldHVybnMgQSBgQ2FuY2VsbGF0aW9uVG9rZW5SZWdpc3RyYXRpb25gIHRoYXQgdGhhdCBjYW4gYmUgdXNlZCB0byBjYW5jZWwgdGhlIGNsZWFudXAgcmVxdWVzdC5cclxuICAgICAgKi9cclxuICAgIENhbmNlbGxhdGlvblRva2VuLnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQXJndW1lbnQgaXMgbm90IGEgRnVuY3Rpb24gb2JqZWN0XCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIXRoaXMuX3NvdXJjZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZW1wdHlSZWdpc3RyYXRpb247XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzLl9zb3VyY2UuX3JlZ2lzdGVyKGNhbGxiYWNrKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gQ2FuY2VsbGF0aW9uVG9rZW47XHJcbn0pKCk7XHJcbmV4cG9ydHMuQ2FuY2VsbGF0aW9uVG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbjtcclxudmFyIGVtcHR5UmVnaXN0cmF0aW9uID0gT2JqZWN0LmZyZWV6ZSh7IHVucmVnaXN0ZXI6IGZ1bmN0aW9uICgpIHsgfSB9KTtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy9jYW5jZWxsYXRpb24uanMubWFwIiwiLyohICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoQykgUm9uIEEuIEJ1Y2t0b24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7IHlvdSBtYXkgbm90IHVzZVxyXG50aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS4gWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZVxyXG5MaWNlbnNlIGF0IGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxyXG5cclxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxyXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXHJcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxyXG5cclxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxudmFyIHByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcclxudmFyIFByb21pc2UgPSBwcm9taXNlLlByb21pc2U7XHJcbnZhciBEZWZlcnJlZCA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBEZWZlcnJlZCgpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHRoaXMuX3Byb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgIF90aGlzLl9yZXNvbHZlID0gcmVzb2x2ZTtcclxuICAgICAgICAgICAgX3RoaXMuX3JlamVjdCA9IHJlamVjdDtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShEZWZlcnJlZC5wcm90b3R5cGUsIFwicHJvbWlzZVwiLCB7XHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9wcm9taXNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgRGVmZXJyZWQucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICB0aGlzLl9yZXNvbHZlKHZhbHVlKTtcclxuICAgIH07XHJcbiAgICBEZWZlcnJlZC5wcm90b3R5cGUucmVqZWN0ID0gZnVuY3Rpb24gKHJlYXNvbikge1xyXG4gICAgICAgIHRoaXMuX3JlamVjdChyZWFzb24pO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBEZWZlcnJlZDtcclxufSkoKTtcclxuZXhwb3J0cy5EZWZlcnJlZCA9IERlZmVycmVkO1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1maWxlOi8vL0N8L2Rldi9hc3luY2pzL2RlZmVycmVkLmpzLm1hcCIsIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKEMpIFJvbiBBLiBCdWNrdG9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpOyB5b3UgbWF5IG5vdCB1c2VcclxudGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGVcclxuTGljZW5zZSBhdCBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuXHJcblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuXHJcblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbnZhciBwcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XHJcbnZhciBjYW5jZWxsYXRpb24gPSByZXF1aXJlKCcuL2NhbmNlbGxhdGlvbicpO1xyXG52YXIgUHJvbWlzZSA9IHByb21pc2UuUHJvbWlzZTtcclxudmFyIENhbmNlbGxhdGlvblRva2VuU291cmNlID0gY2FuY2VsbGF0aW9uLkNhbmNlbGxhdGlvblRva2VuU291cmNlO1xyXG52YXIgaGFzTXNOb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0eXBlb2YgRGVidWcgIT09IFwidW5kZWZpbmVkXCIgJiZcclxudHlwZW9mIERlYnVnLnNldE5vblVzZXJDb2RlRXhjZXB0aW9ucyA9PT0gXCJib29sZWFuXCI7XHJcbi8qKlxyXG4gKiBBIFVyaVxyXG4gKi9cclxudmFyIFVyaSA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBVcmkoKSB7XHJcbiAgICAgICAgdmFyIGFyZ3MgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBfaSA9IDA7IF9pIDwgYXJndW1lbnRzLmxlbmd0aDsgX2krKykge1xyXG4gICAgICAgICAgICBhcmdzW19pIC0gMF0gPSBhcmd1bWVudHNbX2ldO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUaGUgcHJvdG9jb2wgZm9yIHRoZSBVcmkgKGUuZy4gJ2h0dHA6JylcclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMucHJvdG9jb2wgPSBcIlwiO1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRoZSBob3N0bmFtZSBmb3IgdGhlIFVyaVxyXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5ob3N0bmFtZSA9IFwiXCI7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogVGhlIHBvcnQgbnVtYmVyIGZvciB0aGUgVXJpXHJcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnBvcnQgPSBudWxsO1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRoZSBwYXRoIG5hbWUgZm9yIHRoZSBVcmlcclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMucGF0aG5hbWUgPSBcIlwiO1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRoZSBzZWFyY2ggcG9ydGlvbiBvZiB0aGUgcGF0aCwgYWxzbyBrbm93biBhcyB0aGUgcXVlcnlzdHJpbmdcclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuc2VhcmNoID0gXCJcIjtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUaGUgZnJhZ21lbnQgcG9ydGlvbiBvZiB0aGUgcGF0aFxyXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5oYXNoID0gXCJcIjtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBBIHZhbHVlIGluZGljYXRpbmcgd2hldGhlciB0aGUgVXJsIGlzIGFuIGFic29sdXRlIHVybFxyXG4gICAgICAgICAqIEB0eXBlIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuYWJzb2x1dGUgPSBmYWxzZTtcclxuICAgICAgICBpZiAoYXJncy5sZW5ndGggPT09IDApXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkFyZ3VtZW50IG1pc3NpbmdcIik7XHJcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgICAgICAgIHZhciBtID0gVXJpUGFyc2VyLmV4ZWMoYXJnc1swXSk7XHJcbiAgICAgICAgICAgIGlmICghbSlcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBVUklFcnJvcigpO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIFVyaVBhcnRzKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSBVcmlQYXJ0c1tuYW1lXTtcclxuICAgICAgICAgICAgICAgIHZhciBwYXJ0ID0gbVtpbmRleF07XHJcbiAgICAgICAgICAgICAgICBpZiAocGFydCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA8IDUpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnQgPSBwYXJ0LnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoaW5kZXggPT09IDUpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnQgPSBwYXJzZUludChwYXJ0KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA9PT0gNSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFydCA9IG1bMV0gPyBVcmlQb3J0c1t0aGlzLnByb3RvY29sXSA6IG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzW25hbWVdID0gcGFydDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLmFic29sdXRlID0gISFtWzFdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGJhc2VVcmkgPSBhcmdzWzBdIGluc3RhbmNlb2YgVXJpID8gYXJnc1swXSA6IFVyaS5wYXJzZShhcmdzWzBdKTtcclxuICAgICAgICAgICAgdmFyIHVyaSA9IGFyZ3NbMF0gaW5zdGFuY2VvZiBVcmkgPyBhcmdzWzFdIDogVXJpLnBhcnNlKGFyZ3NbMV0pO1xyXG4gICAgICAgICAgICB0aGlzLmhhc2ggPSB1cmkuaGFzaDtcclxuICAgICAgICAgICAgaWYgKHVyaS5wcm90b2NvbCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wcm90b2NvbCA9IHVyaS5wcm90b2NvbDtcclxuICAgICAgICAgICAgICAgIHRoaXMuaG9zdG5hbWUgPSB1cmkuaG9zdG5hbWU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBvcnQgPSB1cmkucG9ydDtcclxuICAgICAgICAgICAgICAgIHRoaXMucGF0aG5hbWUgPSB1cmkucGF0aG5hbWU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNlYXJjaCA9IHVyaS5zZWFyY2g7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmhhc2ggPSB1cmkuaGFzaDtcclxuICAgICAgICAgICAgICAgIHRoaXMuYWJzb2x1dGUgPSB1cmkuYWJzb2x1dGU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnByb3RvY29sID0gYmFzZVVyaS5wcm90b2NvbDtcclxuICAgICAgICAgICAgICAgIGlmICh1cmkuaG9zdG5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmhvc3RuYW1lID0gdXJpLmhvc3RuYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucG9ydCA9IHVyaS5wb3J0O1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGF0aG5hbWUgPSB1cmkucGF0aG5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZWFyY2ggPSB1cmkuc2VhcmNoO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGFzaCA9IHVyaS5oYXNoO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWJzb2x1dGUgPSB1cmkuYWJzb2x1dGU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmhvc3RuYW1lID0gYmFzZVVyaS5ob3N0bmFtZTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBvcnQgPSBiYXNlVXJpLnBvcnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHVyaS5wYXRobmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXJpLnBhdGhuYW1lLmNoYXJBdCgwKSA9PT0gJy8nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhdGhuYW1lID0gdXJpLnBhdGhuYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKChiYXNlVXJpLmFic29sdXRlICYmICFiYXNlVXJpLnBhdGhuYW1lKSB8fCBiYXNlVXJpLnBhdGhuYW1lID09PSBcIi9cIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGF0aG5hbWUgPSAnLycgKyB1cmkucGF0aG5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChiYXNlVXJpLnBhdGhuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHBhcnRzID0gYmFzZVVyaS5wYXRobmFtZS5zcGxpdCgnLycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdID0gdXJpLnBhdGhuYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGF0aG5hbWUgPSBwYXJ0cy5qb2luKCcvJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGF0aG5hbWUgPSBiYXNlVXJpLnBhdGhuYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXJpLnNlYXJjaCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZWFyY2ggPSB1cmkuc2VhcmNoO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZWFyY2ggPSBiYXNlVXJpLnNlYXJjaDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBPYmplY3QuZnJlZXplKHRoaXMpO1xyXG4gICAgfVxyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFVyaS5wcm90b3R5cGUsIFwib3JpZ2luXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSBvcmlnaW4gb2YgdGhlIFVyaVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy50b1N0cmluZyhcIm9yaWdpblwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShVcmkucHJvdG90eXBlLCBcImhvc3RcIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEdldHMgdGhlIGhvc3QgZm9yIHRoZSB1cmksIGluY2x1ZGluZyB0aGUgaG9zdG5hbWUgYW5kIHBvcnRcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9TdHJpbmcoXCJob3N0XCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFVyaS5wcm90b3R5cGUsIFwic2NoZW1lXCIsIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBHZXRzIHRoZSBzY2hlbWUgZm9yIHRoZSB1cmkgKGUuZy4gJ2h0dHA6Ly8nJylcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9TdHJpbmcoXCJzY2hlbWVcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICAvKipcclxuICAgICAqIFRlc3RzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHVyaSBoYXMgdGhlIHNhbWUgb3JpZ2luIGFzIHRoaXMgdXJpXHJcbiAgICAgKiBAcGFyYW0gdXJpIFRoZSB1cmkgdG8gY29tcGFyZSBhZ2FpbnN0XHJcbiAgICAgKiBAcmV0dXJucyBUcnVlIGlmIHRoZSB1cmkncyBoYXZlIHRoZSBzYW1lIG9yaWdpbjsgb3RoZXJ3aXNlLCBmYWxzZVxyXG4gICAgICovXHJcbiAgICBVcmkucHJvdG90eXBlLmlzU2FtZU9yaWdpbiA9IGZ1bmN0aW9uICh1cmkpIHtcclxuICAgICAgICB2YXIgb3RoZXI7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB1cmkgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgb3RoZXIgPSBVcmkucGFyc2UodXJpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAodXJpIGluc3RhbmNlb2YgVXJpKSB7XHJcbiAgICAgICAgICAgIG90aGVyID0gdXJpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkFyZ3VtZW50IG5vdCBvcHRpb25hbC5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmFic29sdXRlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm9yaWdpbiA9PT0gb3RoZXIub3JpZ2luO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gIW90aGVyLmFic29sdXRlO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBVcmlcclxuICAgICAqIEBwYXJhbSBmb3JtYXQge1N0cmluZ30gQSBmb3JtYXQgc3BlY2lmaWVyLlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIHN0cmluZyBjb250ZW50IG9mIHRoZSBVcmlcclxuICAgICAqL1xyXG4gICAgVXJpLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIChmb3JtYXQpIHtcclxuICAgICAgICBzd2l0Y2ggKGZvcm1hdCkge1xyXG4gICAgICAgICAgICBjYXNlIFwib3JpZ2luXCI6XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wcm90b2NvbCAmJiB0aGlzLmhvc3RuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh0aGlzLnByb3RvY29sKSArIFwiLy9cIiArIHRoaXMudG9TdHJpbmcoXCJob3N0XCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICAgICAgICAgIGNhc2UgXCJhdXRob3JpdHlcIjpcclxuICAgICAgICAgICAgY2FzZSBcImhvc3RcIjpcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmhvc3RuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucG9ydCAhPT0gVXJpUG9ydHNbdGhpcy5wcm90b2NvbF0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh0aGlzLmhvc3RuYW1lKSArIFwiOlwiICsgdGhpcy50b1N0cmluZyhcInBvcnRcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcodGhpcy5ob3N0bmFtZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICAgICAgY2FzZSBcInBhdGgrc2VhcmNoXCI6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gU3RyaW5nKHRoaXMucGF0aG5hbWUpICsgU3RyaW5nKHRoaXMuc2VhcmNoKTtcclxuICAgICAgICAgICAgY2FzZSBcInNjaGVtZVwiOiByZXR1cm4gdGhpcy50b1N0cmluZyhcInByb3RvY29sXCIpICsgXCIvL1wiO1xyXG4gICAgICAgICAgICBjYXNlIFwicHJvdG9jb2xcIjogcmV0dXJuIFN0cmluZyh0aGlzLnByb3RvY29sIHx8IFwiXCIpO1xyXG4gICAgICAgICAgICBjYXNlIFwiaG9zdG5hbWVcIjogcmV0dXJuIFN0cmluZyh0aGlzLmhvc3RuYW1lIHx8IFwiXCIpO1xyXG4gICAgICAgICAgICBjYXNlIFwicG9ydFwiOlxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucG9ydCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcodGhpcy5wb3J0KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnByb3RvY29sICYmIFVyaVBvcnRzW3RoaXMucHJvdG9jb2xdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZyhVcmlQb3J0c1t0aGlzLnByb3RvY29sXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICAgICAgY2FzZSBcImZpbGVcIjpcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBhdGhuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGkgPSB0aGlzLnBhdGhuYW1lLmxhc3RJbmRleE9mKFwiL1wiKSArIDE7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhuYW1lLnN1YnN0cihpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICAgICAgY2FzZSBcImRpclwiOlxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGF0aG5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgaSA9IHRoaXMucGF0aG5hbWUubGFzdEluZGV4T2YoXCIvXCIpICsgMTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaSA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aG5hbWUuc3Vic3RyKDAsIGkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgICAgICAgICBjYXNlIFwiZXh0XCI6XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wYXRobmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpID0gdGhpcy5wYXRobmFtZS5sYXN0SW5kZXhPZihcIi9cIikgKyAxO1xyXG4gICAgICAgICAgICAgICAgICAgIGkgPSB0aGlzLnBhdGhuYW1lLmxhc3RJbmRleE9mKFwiLlwiLCBpKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaSA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aG5hbWUuc3Vic3RyKGkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgICAgICAgICBjYXNlIFwiZmlsZS1leHRcIjpcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBhdGhuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGkgPSB0aGlzLnBhdGhuYW1lLmxhc3RJbmRleE9mKFwiL1wiKSArIDE7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGogPSB0aGlzLnBhdGhuYW1lLmxhc3RJbmRleE9mKFwiLlwiLCBpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGogPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRobmFtZS5zdWJzdHJpbmcoaSwgaik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aG5hbWUuc3Vic3RyKGkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgICAgICAgICBjYXNlIFwiZnJhZ21lbnRcIjpcclxuICAgICAgICAgICAgY2FzZSBcImhhc2hcIjpcclxuICAgICAgICAgICAgICAgIHZhciBoYXNoID0gU3RyaW5nKHRoaXMuaGFzaCB8fCBcIlwiKTtcclxuICAgICAgICAgICAgICAgIGlmIChoYXNoLmxlbmd0aCA+IDAgJiYgaGFzaC5jaGFyQXQoMCkgIT0gXCIjXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCIjXCIgKyBoYXNoO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGhhc2g7XHJcbiAgICAgICAgICAgIGNhc2UgXCJwYXRoXCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJwYXRobmFtZVwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh0aGlzLnBhdGhuYW1lIHx8IFwiXCIpO1xyXG4gICAgICAgICAgICBjYXNlIFwic2VhcmNoXCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJxdWVyeVwiOlxyXG4gICAgICAgICAgICAgICAgdmFyIHNlYXJjaCA9IFN0cmluZyh0aGlzLnNlYXJjaCB8fCBcIlwiKTtcclxuICAgICAgICAgICAgICAgIGlmIChzZWFyY2gubGVuZ3RoID4gMCAmJiBzZWFyY2guY2hhckF0KDApICE9IFwiP1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiP1wiICsgc2VhcmNoO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlYXJjaDtcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnRvU3RyaW5nKFwib3JpZ2luXCIpICsgdGhpcy50b1N0cmluZyhcInBhdGhuYW1lXCIpICsgdGhpcy50b1N0cmluZyhcInNlYXJjaFwiKSArIHRoaXMudG9TdHJpbmcoXCJoYXNoXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIFBhcnNlcyB0aGUgcHJvdmlkZWQgdXJpIHN0cmluZ1xyXG4gICAgICogQHBhcmFtIHVyaSB7U3RyaW5nfSBUaGUgdXJpIHN0cmluZyB0byBwYXJzZVxyXG4gICAgICogQHJldHVybnMge1VyaX0gVGhlIHBhcnNlZCB1cmlcclxuICAgICAqL1xyXG4gICAgVXJpLnBhcnNlID0gZnVuY3Rpb24gKHVyaSkge1xyXG4gICAgICAgIHJldHVybiBuZXcgVXJpKHVyaSk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBDb21iaW5lcyB0d28gdXJpc1xyXG4gICAgICogQHBhcmFtIGJhc2VVcmkgVGhlIGJhc2UgdXJpXHJcbiAgICAgKiBAcGFyYW0gdXJpIFRoZSByZWxhdGl2ZSB1cmlcclxuICAgICAqIEByZXR1cm5zIFRoZSBjb21iaW5lZCB1cmlcclxuICAgICAqL1xyXG4gICAgVXJpLmNvbWJpbmUgPSBmdW5jdGlvbiAoYmFzZVVyaSwgdXJpKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBVcmkoYmFzZVVyaSwgdXJpKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gVXJpO1xyXG59KSgpO1xyXG5leHBvcnRzLlVyaSA9IFVyaTtcclxudmFyIFF1ZXJ5U3RyaW5nO1xyXG4oZnVuY3Rpb24gKFF1ZXJ5U3RyaW5nKSB7XHJcbiAgICB2YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcclxuICAgIHZhciBRdWVyeVN0cmluZ1BhcnNlciA9IC8oPzpcXD98JnxeKShbXj0mXSopKD86PShbXiZdKikpPy9nO1xyXG4gICAgZnVuY3Rpb24gc3RyaW5naWZ5KG9iaikge1xyXG4gICAgICAgIGlmICghb2JqKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgcXMgPSBbXTtcclxuICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvYmopLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcclxuICAgICAgICAgICAgdmFyIHZhbHVlID0gb2JqW25hbWVdO1xyXG4gICAgICAgICAgICBzd2l0Y2ggKHR5cGVvZiB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcInN0cmluZ1wiOlxyXG4gICAgICAgICAgICAgICAgY2FzZSBcIm51bWJlclwiOlxyXG4gICAgICAgICAgICAgICAgY2FzZSBcImJvb2xlYW5cIjoge1xyXG4gICAgICAgICAgICAgICAgICAgIHFzLnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KG5hbWUpICsgXCI9XCIgKyBlbmNvZGVVUklDb21wb25lbnQoU3RyaW5nKHZhbHVlKSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFyID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gYXIubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKHR5cGVvZiBhcltpXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgXCJzdHJpbmdcIjpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIFwibnVtYmVyXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBcImJvb2xlYW5cIjpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcXMucHVzaChlbmNvZGVVUklDb21wb25lbnQobmFtZSkgKyBcIj1cIiArIGVuY29kZVVSSUNvbXBvbmVudChTdHJpbmcodmFsdWUpKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHFzLnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KG5hbWUpICsgXCI9XCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcXMucHVzaChlbmNvZGVVUklDb21wb25lbnQobmFtZSkgKyBcIj1cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgaWYgKHFzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCI/XCIgKyBxcy5qb2luKFwiJlwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICB9XHJcbiAgICBRdWVyeVN0cmluZy5zdHJpbmdpZnkgPSBzdHJpbmdpZnk7XHJcbiAgICBmdW5jdGlvbiBwYXJzZSh0ZXh0KSB7XHJcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xyXG4gICAgICAgIHZhciBwYXJ0O1xyXG4gICAgICAgIHdoaWxlIChwYXJ0ID0gUXVlcnlTdHJpbmdQYXJzZXIuZXhlYyh0ZXh0KSkge1xyXG4gICAgICAgICAgICB2YXIga2V5ID0gZGVjb2RlVVJJQ29tcG9uZW50KHBhcnRbMV0pO1xyXG4gICAgICAgICAgICBpZiAoa2V5Lmxlbmd0aCAmJiBrZXkgIT09IFwiX19wcm90b19fXCIpIHtcclxuICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IGRlY29kZVVSSUNvbXBvbmVudChwYXJ0WzJdKTtcclxuICAgICAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbChvYmosIGtleSkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcHJldmlvdXMgPSBvYmpba2V5XTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwcmV2aW91cykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFyID0gcHJldmlvdXM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyLnB1c2godmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqW2tleV0gPSBbcHJldmlvdXMsIHZhbHVlXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBvYmpba2V5XSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBvYmo7XHJcbiAgICB9XHJcbiAgICBRdWVyeVN0cmluZy5wYXJzZSA9IHBhcnNlO1xyXG59KShRdWVyeVN0cmluZyA9IGV4cG9ydHMuUXVlcnlTdHJpbmcgfHwgKGV4cG9ydHMuUXVlcnlTdHJpbmcgPSB7fSkpO1xyXG4vKipcclxuICogQW4gSFRUUCByZXF1ZXN0IGZvciBhbiBIdHRwQ2xpZW50XHJcbiAqL1xyXG52YXIgSHR0cFJlcXVlc3QgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIEhUVFAgcmVxdWVzdCBmb3IgYW4gSHR0cENsaWVudFxyXG4gICAgICogQHBhcmFtIG1ldGhvZCBUaGUgSFRUUCBtZXRob2QgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcGFyYW0gdXJsIFRoZSB1cmwgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIEh0dHBSZXF1ZXN0KG1ldGhvZCwgdXJsKSB7XHJcbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gdm9pZCAwKSB7IG1ldGhvZCA9IFwiR0VUXCI7IH1cclxuICAgICAgICB0aGlzLl9oZWFkZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcclxuICAgICAgICB0aGlzLm1ldGhvZCA9IG1ldGhvZDtcclxuICAgICAgICBpZiAodHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgICB0aGlzLnVybCA9IFVyaS5wYXJzZSh1cmwpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh1cmwgaW5zdGFuY2VvZiBVcmkpIHtcclxuICAgICAgICAgICAgdGhpcy51cmwgPSB1cmw7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIHRoZSBuYW1lZCByZXF1ZXN0IGhlYWRlclxyXG4gICAgICogQHBhcmFtIGtleSB7U3RyaW5nfSBUaGUgaGVhZGVyIG5hbWVcclxuICAgICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfSBUaGUgaGVhZGVyIHZhbHVlXHJcbiAgICAgKi9cclxuICAgIEh0dHBSZXF1ZXN0LnByb3RvdHlwZS5zZXRSZXF1ZXN0SGVhZGVyID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcclxuICAgICAgICBpZiAoa2V5ICE9PSBcIl9fcHJvdG9fX1wiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2hlYWRlcnNba2V5XSA9IHZhbHVlO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICByZXR1cm4gSHR0cFJlcXVlc3Q7XHJcbn0pKCk7XHJcbmV4cG9ydHMuSHR0cFJlcXVlc3QgPSBIdHRwUmVxdWVzdDtcclxuLyoqXHJcbiAqIEEgcmVzcG9uc2UgZnJvbSBhbiBIdHRwQ2xpZW50XHJcbiAqL1xyXG52YXIgSHR0cFJlc3BvbnNlID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIC8qKlxyXG4gICAgICogQSByZXNwb25zZSBmcm9tIGFuIEh0dHBDbGllbnRcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gSHR0cFJlc3BvbnNlKHJlcXVlc3QsIHhocikge1xyXG4gICAgICAgIHRoaXMuX3JlcXVlc3QgPSByZXF1ZXN0O1xyXG4gICAgICAgIHRoaXMuX3hociA9IHhocjtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShIdHRwUmVzcG9uc2UucHJvdG90eXBlLCBcInJlcXVlc3RcIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEdldHMgdGhlIHJlcXVlc3QgZm9yIHRoaXMgcmVzcG9uc2VcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlcXVlc3Q7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoSHR0cFJlc3BvbnNlLnByb3RvdHlwZSwgXCJzdGF0dXNcIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEdldHMgdGhlIHN0YXR1cyBjb2RlIG9mIHRoZSByZXNwb25zZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5feGhyLnN0YXR1cztcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShIdHRwUmVzcG9uc2UucHJvdG90eXBlLCBcInN0YXR1c1RleHRcIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEdldHMgdGhlIHN0YXR1cyB0ZXh0IG9mIHRoZSByZXNwb25zZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5feGhyLnN0YXR1c1RleHQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoSHR0cFJlc3BvbnNlLnByb3RvdHlwZSwgXCJyZXNwb25zZVRleHRcIiwge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEdldHMgdGhlIHJlc3BvbnNlIHRleHQgb2YgdGhlIHJlc3BvbnNlXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl94aHIucmVzcG9uc2VUZXh0O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIGFsbCBvZiB0aGUgcmVzcG9uc2UgaGVhZGVzIGluIGEgc2luZ2xlIHN0cmluZ1xyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gQSBzdHJpbmcgY29udGFpbmluZyBhbGwgb2YgdGhlIHJlc3BvbnNlIGhlYWRlcnNcclxuICAgICAqL1xyXG4gICAgSHR0cFJlc3BvbnNlLnByb3RvdHlwZS5nZXRBbGxSZXNwb25zZUhlYWRlcnMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3hoci5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIHZhbHVlIGZvciB0aGUgbmFtZWQgcmVzcG9uc2UgaGVhZGVyXHJcbiAgICAgKiBAcGFyYW0gaGVhZGVyIHtTdHJpbmd9IFRoZSBuYW1lIG9mIHRoZSBoZWFkZXJcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSB2YWx1ZSBmb3IgdGhlIG5hbWVkIGhlYWRlclxyXG4gICAgICovXHJcbiAgICBIdHRwUmVzcG9uc2UucHJvdG90eXBlLmdldFJlc3BvbnNlSGVhZGVyID0gZnVuY3Rpb24gKGhlYWRlcikge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl94aHIuZ2V0UmVzcG9uc2VIZWFkZXIoaGVhZGVyKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gSHR0cFJlc3BvbnNlO1xyXG59KSgpO1xyXG5leHBvcnRzLkh0dHBSZXNwb25zZSA9IEh0dHBSZXNwb25zZTtcclxuLyoqXHJcbiAqIEEgY2xpZW50IGZvciBIVFRQIHJlcXVlc3RzXHJcbiAqL1xyXG52YXIgSHR0cENsaWVudCA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBjbGllbnQgZm9yIEhUVFAgcmVxdWVzdHNcclxuICAgICAqIEBwYXJhbSBiYXNlVXJsIFRoZSBiYXNlIHVybCBmb3IgdGhlIGNsaWVudFxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBIdHRwQ2xpZW50KGJhc2VVcmwpIHtcclxuICAgICAgICB0aGlzLl9oZWFkZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcclxuICAgICAgICB0aGlzLl9jdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcclxuICAgICAgICB0aGlzLl9jbG9zZWQgPSBmYWxzZTtcclxuICAgICAgICBpZiAoYmFzZVVybCkge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGJhc2VVcmwgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYmFzZVVybCA9IFVyaS5wYXJzZShiYXNlVXJsKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmIChiYXNlVXJsIGluc3RhbmNlb2YgVXJpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmJhc2VVcmwgPSBiYXNlVXJsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBDbG9zZXMgdGhlIGNsaWVudCBhbmQgY2FuY2VscyBhbGwgcGVuZGluZyByZXF1ZXN0c1xyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAodGhpcy5fY2xvc2VkKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPYmplY3QgZG9lc24ndCBzdXBwb3J0IHRoaXMgYWN0aW9uXCIpO1xyXG4gICAgICAgIHRoaXMuX2Nsb3NlZCA9IHRydWU7XHJcbiAgICAgICAgdGhpcy5fY3RzLmNhbmNlbCgpO1xyXG4gICAgICAgIHRoaXMuX2N0cy5jbG9zZSgpO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogU2V0cyBhIHZhbHVlIGZvciBhIGRlZmF1bHQgcmVxdWVzdCBoZWFkZXJcclxuICAgICAqIEBwYXJhbSBrZXkgVGhlIHJlcXVlc3QgaGVhZGVyIGtleVxyXG4gICAgICogQHBhcmFtIHZhbHVlIFRoZSByZXF1ZXN0IGhlYWRlciB2YWx1ZVxyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5zZXRSZXF1ZXN0SGVhZGVyID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcclxuICAgICAgICBpZiAodGhpcy5fY2xvc2VkKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPYmplY3QgZG9lc24ndCBzdXBwb3J0IHRoaXMgYWN0aW9uXCIpO1xyXG4gICAgICAgIGlmIChrZXkgIT09IFwiX19wcm90b19fXCIpIHtcclxuICAgICAgICAgICAgdGhpcy5faGVhZGVyc1trZXldID0gdmFsdWU7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgcmVzcG9uc2UgdGV4dCBmcm9tIHRoZSByZXF1ZXN0ZWQgdXJsXHJcbiAgICAgKiBAcGFyYW0gdXJsIFRoZSB1cmwgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyBBIGZ1dHVyZSByZXN1bHQgZm9yIHRoZSBzdHJpbmdcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuZ2V0U3RyaW5nQXN5bmMgPSBmdW5jdGlvbiAodXJsKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QXN5bmModXJsKS50aGVuKGZ1bmN0aW9uIChyKSB7IHJldHVybiByLnJlc3BvbnNlVGV4dDsgfSk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSByZXNwb25zZSBmcm9tIGlzc3VpbmcgYW4gSFRUUCBHRVQgdG8gdGhlIHJlcXVlc3RlZCB1cmxcclxuICAgICAqIEBwYXJhbSB1cmwgVGhlIHVybCBmb3IgdGhlIHJlcXVlc3RcclxuICAgICAqIEBwYXJhbSB0b2tlbiBBIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyBBIGZ1dHVyZSByZXN1bHQgZm9yIHRoZSByZXNwb25zZVxyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5nZXRBc3luYyA9IGZ1bmN0aW9uICh1cmwsIHRva2VuKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VuZEFzeW5jKG5ldyBIdHRwUmVxdWVzdChcIkdFVFwiLCB1cmwpLCB0b2tlbik7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSByZXNwb25zZSBmcm9tIGlzc3VpbmcgYW4gSFRUUCBQT1NUIHRvIHRoZSByZXF1ZXN0ZWQgdXJsXHJcbiAgICAgKiBAcGFyYW0gdXJsIFRoZSB1cmwgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcGFyYW0gYm9keSBUaGUgYm9keSBvZiB0aGUgcmVxdWVzdFxyXG4gICAgICogQHBhcmFtIHRva2VuIEEgdG9rZW4gdGhhdCBjYW4gYmUgdXNlZCB0byBjYW5jZWwgdGhlIHJlcXVlc3RcclxuICAgICAqIEByZXR1cm5zIEEgZnV0dXJlIHJlc3VsdCBmb3IgdGhlIHJlc3BvbnNlXHJcbiAgICAgKi9cclxuICAgIEh0dHBDbGllbnQucHJvdG90eXBlLnBvc3RBc3luYyA9IGZ1bmN0aW9uICh1cmwsIGJvZHksIHRva2VuKSB7XHJcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgSHR0cFJlcXVlc3QoXCJQT1NUXCIsIHVybCk7XHJcbiAgICAgICAgcmVxdWVzdC5ib2R5ID0gYm9keTtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZW5kQXN5bmMocmVxdWVzdCwgdG9rZW4pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgcmVzcG9uc2UgZnJvbSBpc3N1aW5nIGFuIEhUVFAgUE9TVCBvZiBhIEpTT04gc2VyaWFsaXplZCB2YWx1ZSB0byB0aGUgcmVxdWVzdGVkIHVybFxyXG4gICAgICogQHBhcmFtIHVybCBUaGUgdXJsIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICogQHBhcmFtIHZhbHVlIFRoZSB2YWx1ZSB0byBzZXJpYWxpemVcclxuICAgICAqIEBwYXJhbSBqc29uUmVwbGFjZXIgQW4gYXJyYXkgb3IgY2FsbGJhY2sgdXNlZCB0byByZXBsYWNlIHZhbHVlcyBkdXJpbmcgc2VyaWFsaXphdGlvblxyXG4gICAgICogQHBhcmFtIHRva2VuIEEgdG9rZW4gdGhhdCBjYW4gYmUgdXNlZCB0byBjYW5jZWwgdGhlIHJlcXVlc3RcclxuICAgICAqIEByZXR1cm5zIEEgZnV0dXJlIHJlc3VsdCBmb3IgdGhlIHJlc3BvbnNlXHJcbiAgICAgKi9cclxuICAgIEh0dHBDbGllbnQucHJvdG90eXBlLnBvc3RKc29uQXN5bmMgPSBmdW5jdGlvbiAodXJsLCB2YWx1ZSwganNvblJlcGxhY2VyLCB0b2tlbikge1xyXG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IEh0dHBSZXF1ZXN0KFwiUE9TVFwiLCB1cmwpO1xyXG4gICAgICAgIHJlcXVlc3QuYm9keSA9IEpTT04uc3RyaW5naWZ5KHZhbHVlLCBqc29uUmVwbGFjZXIpO1xyXG4gICAgICAgIHJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VuZEFzeW5jKHJlcXVlc3QsIHRva2VuKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIHJlc3BvbnNlIGZyb20gaXNzdWluZyBhbiBIVFRQIFBVVCB0byB0aGUgcmVxdWVzdGVkIHVybFxyXG4gICAgICogQHBhcmFtIHVybCBUaGUgdXJsIGZvciB0aGUgcmVxdWVzdFxyXG4gICAgICogQHBhcmFtIGJvZHkgVGhlIGJvZHkgb2YgdGhlIHJlcXVlc3RcclxuICAgICAqIEBwYXJhbSB0b2tlbiBBIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyBBIGZ1dHVyZSByZXN1bHQgZm9yIHRoZSByZXNwb25zZVxyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5wdXRBc3luYyA9IGZ1bmN0aW9uICh1cmwsIGJvZHksIHRva2VuKSB7XHJcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgSHR0cFJlcXVlc3QoXCJQVVRcIiwgdXJsKTtcclxuICAgICAgICByZXF1ZXN0LmJvZHkgPSBib2R5O1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNlbmRBc3luYyhyZXF1ZXN0LCB0b2tlbik7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSByZXNwb25zZSBmcm9tIGlzc3VpbmcgYW4gSFRUUCBQVVQgb2YgYSBKU09OIHNlcmlhbGl6ZWQgdmFsdWUgdG8gdGhlIHJlcXVlc3RlZCB1cmxcclxuICAgICAqIEBwYXJhbSB1cmwgVGhlIHVybCBmb3IgdGhlIHJlcXVlc3RcclxuICAgICAqIEBwYXJhbSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2VyaWFsaXplXHJcbiAgICAgKiBAcGFyYW0ganNvblJlcGxhY2VyIEFuIGFycmF5IG9yIGNhbGxiYWNrIHVzZWQgdG8gcmVwbGFjZSB2YWx1ZXMgZHVyaW5nIHNlcmlhbGl6YXRpb25cclxuICAgICAqIEBwYXJhbSB0b2tlbiBBIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcmV0dXJucyBBIGZ1dHVyZSByZXN1bHQgZm9yIHRoZSByZXNwb25zZVxyXG4gICAgICovXHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5wdXRKc29uQXN5bmMgPSBmdW5jdGlvbiAodXJsLCB2YWx1ZSwganNvblJlcGxhY2VyLCB0b2tlbikge1xyXG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IEh0dHBSZXF1ZXN0KFwiUFVUXCIsIHVybCk7XHJcbiAgICAgICAgcmVxdWVzdC5ib2R5ID0gSlNPTi5zdHJpbmdpZnkodmFsdWUsIGpzb25SZXBsYWNlcik7XHJcbiAgICAgICAgcmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZW5kQXN5bmMocmVxdWVzdCwgdG9rZW4pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgcmVzcG9uc2UgZnJvbSBpc3N1aW5nIGFuIEhUVFAgREVMRVRFIHRvIHRoZSByZXF1ZXN0ZWQgdXJsXHJcbiAgICAgKiBAcGFyYW0gdXJsIFRoZSB1cmwgZm9yIHRoZSByZXF1ZXN0XHJcbiAgICAgKiBAcGFyYW0gdG9rZW4gQSB0b2tlbiB0aGF0IGNhbiBiZSB1c2VkIHRvIGNhbmNlbCB0aGUgcmVxdWVzdFxyXG4gICAgICogQHJldHVybnMgQSBmdXR1cmUgcmVzdWx0IGZvciB0aGUgcmVzcG9uc2VcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuZGVsZXRlQXN5bmMgPSBmdW5jdGlvbiAodXJsLCB0b2tlbikge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNlbmRBc3luYyhuZXcgSHR0cFJlcXVlc3QoXCJERUxFVEVcIiwgdXJsKSwgdG9rZW4pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogU2VuZHMgdGhlIHByb3ZpZGVkIHJlcXVlc3QgYW5kIHJldHVybnMgdGhlIHJlc3BvbnNlXHJcbiAgICAgKiBAcGFyYW0gcmVxdWVzdCB7SHR0cFJlcXVlc3R9IEFuIEhUVFAgcmVxdWVzdCB0byBzZW5kXHJcbiAgICAgKiBAcGFyYW0gdG9rZW4ge2Z1dHVyZXMuQ2FuY2VsbGF0aW9uVG9rZW59IEEgdG9rZW4gdGhhdCBjYW4gYmUgdXNlZCB0byBjYW5jZWwgdGhlIHJlcXVlc3RcclxuICAgICAqIEByZXR1cm5zIHtmdXR1cmVzLlByb21pc2U8SHR0cFJlc3BvbnNlPn0gQSBmdXR1cmUgcmVzdWx0IGZvciB0aGUgcmVzcG9uc2VcclxuICAgICAqL1xyXG4gICAgSHR0cENsaWVudC5wcm90b3R5cGUuc2VuZEFzeW5jID0gZnVuY3Rpb24gKHJlcXVlc3QsIHRva2VuKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICBpZiAodGhpcy5fY2xvc2VkKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPYmplY3QgZG9lc24ndCBzdXBwb3J0IHRoaXMgYWN0aW9uXCIpO1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgIC8vIGNyZWF0ZSBhIGxpbmtlZCB0b2tlblxyXG4gICAgICAgICAgICB2YXIgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKFtfdGhpcy5fY3RzLnRva2VuLCB0b2tlbl0pO1xyXG4gICAgICAgICAgICAvLyB0aHJvdyBpZiB3ZSdyZSBhbHJlYWR5IGNhbmNlbGVkLCB0aGUgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkXHJcbiAgICAgICAgICAgIGN0cy50b2tlbi50aHJvd0lmQ2FuY2VsZWQoKTtcclxuICAgICAgICAgICAgLy8gbm9ybWFsaXplIHRoZSB1cmlcclxuICAgICAgICAgICAgdmFyIHVybCA9IG51bGw7XHJcbiAgICAgICAgICAgIGlmICghcmVxdWVzdC51cmwpIHtcclxuICAgICAgICAgICAgICAgIHVybCA9IF90aGlzLmJhc2VVcmw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAoIXJlcXVlc3QudXJsLmFic29sdXRlKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIV90aGlzLmJhc2VVcmwpXHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBhcmd1bWVudDogcmVxdWVzdFwiKTtcclxuICAgICAgICAgICAgICAgIHVybCA9IG5ldyBVcmkoX3RoaXMuYmFzZVVybCwgcmVxdWVzdC51cmwpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICh1cmwpIHtcclxuICAgICAgICAgICAgICAgIHJlcXVlc3QudXJsID0gdXJsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcclxuICAgICAgICAgICAgdmFyIHJlc3BvbnNlID0gbmV3IEh0dHBSZXNwb25zZShyZXF1ZXN0LCB4aHIpO1xyXG4gICAgICAgICAgICB2YXIgcmVxdWVzdEhlYWRlcnMgPSByZXF1ZXN0Ll9oZWFkZXJzO1xyXG4gICAgICAgICAgICB2YXIgY2xpZW50SGVhZGVycyA9IF90aGlzLl9oZWFkZXJzO1xyXG4gICAgICAgICAgICAvLyBjcmVhdGUgdGhlIG9ubG9hZCBjYWxsYmFja1xyXG4gICAgICAgICAgICB2YXIgb25sb2FkID0gZnVuY3Rpb24gKGV2KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaGFzTXNOb25Vc2VyQ29kZUV4Y2VwdGlvbnMpXHJcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuc2V0Tm9uVXNlckNvZGVFeGNlcHRpb25zID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgICAgICAgICAgIC8vIGNhdGNoIGEgY2FuY2VsbGF0aW9uIGFuZCByZWplY3QgdGhlIHByb21pc2VcclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3RzLnRva2VuLnRocm93SWZDYW5jZWxlZCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKHhoci5zdGF0dXMgPj0gMjAwICYmIHhoci5zdGF0dXMgPCAzMDApIHtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBlcnJvciA9IGNyZWF0ZUh0dHBFcnJvcihfdGhpcywgcmVzcG9uc2UpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIC8vIGNyZWF0ZSB0aGUgb25lcnJvciBjYWxsYmFja1xyXG4gICAgICAgICAgICB2YXIgb25lcnJvciA9IGZ1bmN0aW9uIChldikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKVxyXG4gICAgICAgICAgICAgICAgICAgIERlYnVnLnNldE5vblVzZXJDb2RlRXhjZXB0aW9ucyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgICAgICAgICAvLyBjYXRjaCBhIGNhbmNlbGxhdGlvbiBhbmQgcmVqZWN0IHRoZSBwcm9taXNlXHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIGN0cy50b2tlbi50aHJvd0lmQ2FuY2VsZWQoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHZhciBlcnJvciA9IGNyZWF0ZUh0dHBFcnJvcihfdGhpcywgcmVzcG9uc2UpO1xyXG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgLy8gcmVnaXN0ZXIgYSBjbGVhbnVwIHBoYXNlXHJcbiAgICAgICAgICAgIHZhciByZWdpc3RyYXRpb24gPSBjdHMudG9rZW4ucmVnaXN0ZXIoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGhhc01zTm9uVXNlckNvZGVFeGNlcHRpb25zKVxyXG4gICAgICAgICAgICAgICAgICAgIERlYnVnLnNldE5vblVzZXJDb2RlRXhjZXB0aW9ucyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgICAgICAgICAvLyBhYm9ydCB0aGUgeGhyXHJcbiAgICAgICAgICAgICAgICB4aHIuYWJvcnQoKTtcclxuICAgICAgICAgICAgICAgIC8vIGNhdGNoIGEgY2FuY2VsbGF0aW9uIGFuZCByZWplY3QgdGhlIHByb21pc2VcclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3RzLnRva2VuLnRocm93SWZDYW5jZWxlZCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB2YXIgY2xlYW51cCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIHhoci5yZW1vdmVFdmVudExpc3RlbmVyKFwibG9hZFwiLCBvbmxvYWQsIGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIHhoci5yZW1vdmVFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgb25lcnJvciwgZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uLnVucmVnaXN0ZXIoKTtcclxuICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbiA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgLy8gYWRkIHRoZSBoZWFkZXJzIGZyb20gdGhlIGNsaWVudFxyXG4gICAgICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhjbGllbnRIZWFkZXJzKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcclxuICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgY2xpZW50SGVhZGVyc1trZXldKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIC8vIGFkZCB0aGUgaGVhZGVycyBmcm9tIHRoZSByZXF1ZXN0XHJcbiAgICAgICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHJlcXVlc3RIZWFkZXJzKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcclxuICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgcmVxdWVzdEhlYWRlcnNba2V5XSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAvLyB3aXJlIHVwIHRoZSBldmVudHNcclxuICAgICAgICAgICAgeGhyLmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsIG9ubG9hZCwgZmFsc2UpO1xyXG4gICAgICAgICAgICB4aHIuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsIG9uZXJyb3IsIGZhbHNlKTtcclxuICAgICAgICAgICAgLy8gZW5hYmxlIGNyZWRlbnRpYWxzIGlmIHJlcXVlc3RlZFxyXG4gICAgICAgICAgICBpZiAoX3RoaXMud2l0aENyZWRlbnRpYWxzKSB7XHJcbiAgICAgICAgICAgICAgICB4aHIud2l0aENyZWRlbnRpYWxzID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBhdHRhY2ggYSB0aW1lb3V0XHJcbiAgICAgICAgICAgIGlmIChfdGhpcy50aW1lb3V0ID4gMCkge1xyXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7IHJldHVybiBjdHMuY2FuY2VsKG5ldyBFcnJvcihcIk9wZXJhdGlvbiB0aW1lZCBvdXQuXCIpKTsgfSwgX3RoaXMudGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICB4aHIudGltZW91dCA9IF90aGlzLnRpbWVvdXQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gc2VuZCB0aGUgcmVxdWVzdFxyXG4gICAgICAgICAgICB4aHIub3BlbihyZXF1ZXN0Lm1ldGhvZCwgcmVxdWVzdC51cmwudG9TdHJpbmcoKSwgdHJ1ZSwgX3RoaXMudXNlcm5hbWUsIF90aGlzLnBhc3N3b3JkKTtcclxuICAgICAgICAgICAgeGhyLnNlbmQocmVxdWVzdC5ib2R5KTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBIdHRwQ2xpZW50LnByb3RvdHlwZS5nZXRKc29ucEFzeW5jID0gZnVuY3Rpb24gKHVybCwgY2FsbGJhY2tBcmcsIG5vQ2FjaGUsIHRva2VuKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICBpZiAoY2FsbGJhY2tBcmcgPT09IHZvaWQgMCkgeyBjYWxsYmFja0FyZyA9IFwiY2FsbGJhY2tcIjsgfVxyXG4gICAgICAgIGlmIChub0NhY2hlID09PSB2b2lkIDApIHsgbm9DYWNoZSA9IGZhbHNlOyB9XHJcbiAgICAgICAgaWYgKHRoaXMuX2Nsb3NlZClcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT2JqZWN0IGRvZXNuJ3Qgc3VwcG9ydCB0aGlzIGFjdGlvblwiKTtcclxuICAgICAgICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSBcInVuZGVmaW5lZFwiKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJKU09OLVAgaXMgbm90IHN1cHBvcnRlZCBpbiB0aGlzIGhvc3QuXCIpO1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgIC8vIGNyZWF0ZSBhIGxpbmtlZCB0b2tlblxyXG4gICAgICAgICAgICB2YXIgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKFtfdGhpcy5fY3RzLnRva2VuLCB0b2tlbl0pO1xyXG4gICAgICAgICAgICAvLyB0aHJvdyBpZiB3ZSdyZSBhbHJlYWR5IGNhbmNlbGVkLCB0aGUgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkXHJcbiAgICAgICAgICAgIGN0cy50b2tlbi50aHJvd0lmQ2FuY2VsZWQoKTtcclxuICAgICAgICAgICAgLy8gbm9ybWFsaXplIHRoZSB1cmlcclxuICAgICAgICAgICAgdmFyIHJlcXVlc3RVcmwgPSBudWxsO1xyXG4gICAgICAgICAgICBpZiAoIXVybCkge1xyXG4gICAgICAgICAgICAgICAgcmVxdWVzdFVybCA9IF90aGlzLmJhc2VVcmw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RVcmwgPSBuZXcgVXJpKHVybCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh1cmwgaW5zdGFuY2VvZiBVcmkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0VXJsID0gdXJsO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKCFyZXF1ZXN0VXJsLmFic29sdXRlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFfdGhpcy5iYXNlVXJsKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGFyZ3VtZW50OiB1cmxcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdFVybCA9IG5ldyBVcmkoX3RoaXMuYmFzZVVybCwgcmVxdWVzdFVybCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFyIGluZGV4ID0ganNvbnBSZXF1ZXN0SW5kZXgrKztcclxuICAgICAgICAgICAgdmFyIG5hbWUgPSBcIl9fUHJvbWlzZV9fanNvbnBfX1wiICsgaW5kZXg7XHJcbiAgICAgICAgICAgIHZhciBxdWVyeSA9IFF1ZXJ5U3RyaW5nLnBhcnNlKHJlcXVlc3RVcmwuc2VhcmNoKTtcclxuICAgICAgICAgICAgcXVlcnlbY2FsbGJhY2tBcmddID0gbmFtZTtcclxuICAgICAgICAgICAgaWYgKG5vQ2FjaGUpIHtcclxuICAgICAgICAgICAgICAgIHF1ZXJ5W1wiX3RcIl0gPSBEYXRlLm5vdygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJlcXVlc3RVcmwuc2VhcmNoID0gUXVlcnlTdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5KTtcclxuICAgICAgICAgICAgdmFyIHBlbmRpbmcgPSB0cnVlO1xyXG4gICAgICAgICAgICB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiaGVhZFwiKVswXTtcclxuICAgICAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7XHJcbiAgICAgICAgICAgIHNjcmlwdC50eXBlID0gXCJ0ZXh0L2phdmFzY3JpcHRcIjtcclxuICAgICAgICAgICAgc2NyaXB0LmFzeW5jID0gdHJ1ZTtcclxuICAgICAgICAgICAgc2NyaXB0LnNyYyA9IHJlcXVlc3RVcmwudG9TdHJpbmcoKTtcclxuICAgICAgICAgICAgLy8gY2hlY2tzIHdoZXRoZXIgdGhlIHJlcXVlc3QgaGFzIGJlZW4gY2FuY2VsZWRcclxuICAgICAgICAgICAgdmFyIGNoZWNrQ2FuY2VsZWQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaGFzTXNOb25Vc2VyQ29kZUV4Y2VwdGlvbnMpXHJcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuc2V0Tm9uVXNlckNvZGVFeGNlcHRpb25zID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3RzLnRva2VuLnRocm93SWZDYW5jZWxlZCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIC8vIHdhaXRzIGZvciB0aGUgcmVzdWx0XHJcbiAgICAgICAgICAgIHZhciBvbmxvYWQgPSBmdW5jdGlvbiAocmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICBpZ25vcmUoKTtcclxuICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi51bnJlZ2lzdGVyKCk7XHJcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWNoZWNrQ2FuY2VsZWQoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgLy8gaWdub3JlcyBmdXJ0aGVyIGNhbGxzIHRvIGZ1bGZpbGwgdGhlIHJlc3VsdFxyXG4gICAgICAgICAgICB2YXIgaWdub3JlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgcGVuZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgZGVsZXRlIHdpbmRvd1tuYW1lXTtcclxuICAgICAgICAgICAgICAgIGRpc2Nvbm5lY3QoKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgLy8gZGlzY29ubmVjdHMgdGhlIHNjcmlwdCBub2RlXHJcbiAgICAgICAgICAgIHZhciBkaXNjb25uZWN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHNjcmlwdC5wYXJlbnROb2RlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaGVhZC5yZW1vdmVDaGlsZChzY3JpcHQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAvLyByZWdpc3RlciBhIGNsZWFudXAgcGhhc2VcclxuICAgICAgICAgICAgdmFyIHJlZ2lzdHJhdGlvbiA9IGN0cy50b2tlbi5yZWdpc3RlcihmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAocGVuZGluZykge1xyXG4gICAgICAgICAgICAgICAgICAgIHdpbmRvd1tuYW1lXSA9IGlnbm9yZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGRpc2Nvbm5lY3QoKTtcclxuICAgICAgICAgICAgICAgIGNoZWNrQ2FuY2VsZWQoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIC8vIHNldCBhIHRpbWVvdXQgYmVmb3JlIHdlIG5vIGxvbmdlciBjYXJlIGFib3V0IHRoZSByZXN1bHQuXHJcbiAgICAgICAgICAgIGlmIChfdGhpcy50aW1lb3V0KSB7XHJcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHsgcmV0dXJuIGN0cy5jYW5jZWwobmV3IEVycm9yKFwiT3BlcmF0aW9uIHRpbWVkIG91dC5cIikpOyB9LCBfdGhpcy50aW1lb3V0KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB3aW5kb3dbbmFtZV0gPSBvbmxvYWQ7XHJcbiAgICAgICAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gSHR0cENsaWVudDtcclxufSkoKTtcclxuZXhwb3J0cy5IdHRwQ2xpZW50ID0gSHR0cENsaWVudDtcclxuZnVuY3Rpb24gY3JlYXRlSHR0cEVycm9yKGh0dHBDbGllbnQsIHJlc3BvbnNlLCBtZXNzYWdlKSB7XHJcbiAgICBpZiAobWVzc2FnZSA9PT0gdm9pZCAwKSB7IG1lc3NhZ2UgPSBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHByb2Nlc3NpbmcgeW91ciByZXF1ZXN0XCI7IH1cclxuICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcclxuICAgIGVycm9yLm5hbWUgPSBcIkh0dHBFcnJvclwiO1xyXG4gICAgZXJyb3IuaHR0cENsaWVudCA9IGh0dHBDbGllbnQ7XHJcbiAgICBlcnJvci5yZXNwb25zZSA9IHJlc3BvbnNlO1xyXG4gICAgZXJyb3IubWVzc2FnZSA9IG1lc3NhZ2U7XHJcbiAgICByZXR1cm4gZXJyb3I7XHJcbn1cclxudmFyIFVyaVBhcnNlciA9IC9eKCg/OihodHRwcz86KVxcL1xcLykoPzpbXjpAXSooPzpcXDpbXkBdKik/QCk/KChbYS16XFxkLVxcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRlxcLl0rKSg/OlxcOihcXGQrKSk/KT8pPyg/IVthLXpcXGQtXStcXDopKCg/Ol58XFwvKVteXFw/XFwjXSopPyhcXD9bXiNdKik/KCMuKik/JC9pO1xyXG52YXIgVXJpUGFydHMgPSB7IFwicHJvdG9jb2xcIjogMiwgXCJob3N0bmFtZVwiOiA0LCBcInBvcnRcIjogNSwgXCJwYXRobmFtZVwiOiA2LCBcInNlYXJjaFwiOiA3LCBcImhhc2hcIjogOCB9O1xyXG52YXIgVXJpUG9ydHMgPSB7IFwiaHR0cDpcIjogODAsIFwiaHR0cHM6XCI6IDQ0MyB9O1xyXG52YXIganNvbnBSZXF1ZXN0SW5kZXggPSAwO1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1maWxlOi8vL0N8L2Rldi9hc3luY2pzL2h0dHBjbGllbnQuanMubWFwIiwiLyohICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoQykgUm9uIEEuIEJ1Y2t0b24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7IHlvdSBtYXkgbm90IHVzZVxyXG50aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS4gWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZVxyXG5MaWNlbnNlIGF0IGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxyXG5cclxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxyXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXHJcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxyXG5cclxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxudmFyIExpbmtlZExpc3ROb2RlID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIExpbmtlZExpc3ROb2RlKHZhbHVlKSB7XHJcbiAgICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xyXG4gICAgfVxyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KExpbmtlZExpc3ROb2RlLnByb3RvdHlwZSwgXCJsaXN0XCIsIHtcclxuICAgICAgICAvKiogR2V0cyB0aGUgTGlua2VkTGlzdCBmb3IgdGhpcyBub2RlICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9saXN0O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KExpbmtlZExpc3ROb2RlLnByb3RvdHlwZSwgXCJwcmV2aW91c1wiLCB7XHJcbiAgICAgICAgLyoqIEdldHMgdGhlIHByZXZpb3VzIG5vZGUgaW4gdGhlIGxpc3QgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX3ByZXZpb3VzICYmIHRoaXMgIT09IHRoaXMuX2xpc3QuZmlyc3QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9wcmV2aW91cztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KExpbmtlZExpc3ROb2RlLnByb3RvdHlwZSwgXCJuZXh0XCIsIHtcclxuICAgICAgICAvKiogR2V0cyB0aGUgbmV4dCBub2RlIGluIHRoZSBsaXN0ICovXHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9uZXh0ICYmIHRoaXMuX25leHQgIT09IHRoaXMuX2xpc3QuZmlyc3QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9uZXh0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gTGlua2VkTGlzdE5vZGU7XHJcbn0pKCk7XHJcbmV4cG9ydHMuTGlua2VkTGlzdE5vZGUgPSBMaW5rZWRMaXN0Tm9kZTtcclxudmFyIExpbmtlZExpc3QgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gTGlua2VkTGlzdCgpIHtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShMaW5rZWRMaXN0LnByb3RvdHlwZSwgXCJmaXJzdFwiLCB7XHJcbiAgICAgICAgLyoqIEdldHMgdGhlIGZpcnN0IG5vZGUgaW4gdGhlIGxpc3QgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2hlYWQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoTGlua2VkTGlzdC5wcm90b3R5cGUsIFwibGFzdFwiLCB7XHJcbiAgICAgICAgLyoqIEdldHMgdGhlIGxhc3Qgbm9kZSBpbiB0aGUgbGlzdCAqL1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5faGVhZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2hlYWQuX3ByZXZpb3VzO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoTGlua2VkTGlzdC5wcm90b3R5cGUsIFwic2l6ZVwiLCB7XHJcbiAgICAgICAgLyoqIEdldHMgdGhlIHNpemUgb2YgdGhlIGxpc3QgKi9cclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3NpemU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5hZGRGaXJzdCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHZhciBuZXdOb2RlID0gbmV3IExpbmtlZExpc3ROb2RlKHZhbHVlKTtcclxuICAgICAgICBpZiAodGhpcy5maXJzdCkge1xyXG4gICAgICAgICAgICB0aGlzLl9pbnNlcnQodGhpcy5maXJzdCwgbmV3Tm9kZSk7XHJcbiAgICAgICAgICAgIHRoaXMuX2hlYWQgPSBuZXdOb2RlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5faW5zZXJ0RW1wdHkobmV3Tm9kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBuZXdOb2RlO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmFkZE5vZGVGaXJzdCA9IGZ1bmN0aW9uIChuZXdOb2RlKSB7XHJcbiAgICAgICAgdGhpcy5fY2hlY2tOZXdOb2RlKG5ld05vZGUpO1xyXG4gICAgICAgIGlmICh0aGlzLmZpcnN0KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2luc2VydCh0aGlzLmZpcnN0LCBuZXdOb2RlKTtcclxuICAgICAgICAgICAgdGhpcy5faGVhZCA9IG5ld05vZGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9pbnNlcnRFbXB0eShuZXdOb2RlKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuYWRkTGFzdCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHZhciBuZXdOb2RlID0gbmV3IExpbmtlZExpc3ROb2RlKHZhbHVlKTtcclxuICAgICAgICBpZiAodGhpcy5maXJzdCkge1xyXG4gICAgICAgICAgICB0aGlzLl9pbnNlcnQodGhpcy5maXJzdCwgbmV3Tm9kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9pbnNlcnRFbXB0eShuZXdOb2RlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG5ld05vZGU7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuYWRkTm9kZUxhc3QgPSBmdW5jdGlvbiAobmV3Tm9kZSkge1xyXG4gICAgICAgIHRoaXMuX2NoZWNrTmV3Tm9kZShuZXdOb2RlKTtcclxuICAgICAgICBpZiAodGhpcy5maXJzdCkge1xyXG4gICAgICAgICAgICB0aGlzLl9pbnNlcnQodGhpcy5maXJzdCwgbmV3Tm9kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9pbnNlcnRFbXB0eShuZXdOb2RlKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuYWRkQmVmb3JlID0gZnVuY3Rpb24gKG5vZGUsIHZhbHVlKSB7XHJcbiAgICAgICAgdGhpcy5fY2hlY2tOb2RlKG5vZGUpO1xyXG4gICAgICAgIHZhciBuZXdOb2RlID0gbmV3IExpbmtlZExpc3ROb2RlKHZhbHVlKTtcclxuICAgICAgICB0aGlzLl9pbnNlcnQobm9kZSwgbmV3Tm9kZSk7XHJcbiAgICAgICAgaWYgKHRoaXMuX2hlYWQgPT09IG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5faGVhZCA9IG5ld05vZGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBuZXdOb2RlO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmFkZE5vZGVCZWZvcmUgPSBmdW5jdGlvbiAobm9kZSwgbmV3Tm9kZSkge1xyXG4gICAgICAgIHRoaXMuX2NoZWNrTm9kZShub2RlKTtcclxuICAgICAgICB0aGlzLl9jaGVja05ld05vZGUobmV3Tm9kZSk7XHJcbiAgICAgICAgdGhpcy5faW5zZXJ0KG5vZGUsIG5ld05vZGUpO1xyXG4gICAgICAgIGlmICh0aGlzLl9oZWFkID09PSBub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2hlYWQgPSBuZXdOb2RlO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5hZGRBZnRlciA9IGZ1bmN0aW9uIChub2RlLCB2YWx1ZSkge1xyXG4gICAgICAgIHRoaXMuX2NoZWNrTm9kZShub2RlKTtcclxuICAgICAgICB2YXIgbmV3Tm9kZSA9IG5ldyBMaW5rZWRMaXN0Tm9kZSh2YWx1ZSk7XHJcbiAgICAgICAgdGhpcy5faW5zZXJ0KG5vZGUuX25leHQsIG5ld05vZGUpO1xyXG4gICAgICAgIHJldHVybiBuZXdOb2RlO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmFkZE5vZGVBZnRlciA9IGZ1bmN0aW9uIChub2RlLCBuZXdOb2RlKSB7XHJcbiAgICAgICAgdGhpcy5fY2hlY2tOb2RlKG5vZGUpO1xyXG4gICAgICAgIHRoaXMuX2NoZWNrTmV3Tm9kZShuZXdOb2RlKTtcclxuICAgICAgICB0aGlzLl9pbnNlcnQobm9kZS5fbmV4dCwgbmV3Tm9kZSk7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2NhY2hlICYmIHRoaXMuX2NhY2hlLnZhbHVlID09PSB2YWx1ZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuICEhdGhpcy5maW5kKHZhbHVlKTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5maW5kID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLl9oZWFkO1xyXG4gICAgICAgIGlmIChub2RlKSB7XHJcbiAgICAgICAgICAgIGRvIHtcclxuICAgICAgICAgICAgICAgIGlmIChub2RlLnZhbHVlID09PSB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlID0gbm9kZTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm9kZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLl9uZXh0O1xyXG4gICAgICAgICAgICB9IHdoaWxlIChub2RlICE9PSB0aGlzLl9oZWFkKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5maW5kTGFzdCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHZhciBub2RlID0gdGhpcy5faGVhZDtcclxuICAgICAgICBpZiAobm9kZSkge1xyXG4gICAgICAgICAgICBub2RlID0gbm9kZS5fcHJldmlvdXM7XHJcbiAgICAgICAgICAgIHZhciB0YWlsID0gbm9kZTtcclxuICAgICAgICAgICAgZG8ge1xyXG4gICAgICAgICAgICAgICAgaWYgKG5vZGUudmFsdWUgPT09IHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FjaGUgPSBub2RlO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBub2RlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbm9kZSA9IG5vZGUuX3ByZXZpb3VzO1xyXG4gICAgICAgICAgICB9IHdoaWxlIChub2RlICE9PSB0YWlsKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuZmluZCh2YWx1ZSk7XHJcbiAgICAgICAgaWYgKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGVsZXRlKG5vZGUpO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmRlbGV0ZU5vZGUgPSBmdW5jdGlvbiAobm9kZSkge1xyXG4gICAgICAgIHRoaXMuX2NoZWNrTm9kZShub2RlKTtcclxuICAgICAgICB0aGlzLl9kZWxldGUobm9kZSk7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuZGVsZXRlRmlyc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2hlYWQpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGVsZXRlKHRoaXMuX2hlYWQpO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmRlbGV0ZUxhc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2hlYWQpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGVsZXRlKHRoaXMuX2hlYWQuX3ByZXZpb3VzKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5yZW1vdmVGaXJzdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuX2hlYWQ7XHJcbiAgICAgICAgaWYgKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGVsZXRlKG5vZGUpO1xyXG4gICAgICAgICAgICByZXR1cm4gbm9kZS52YWx1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5yZW1vdmVMYXN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICh0aGlzLl9oZWFkKSB7XHJcbiAgICAgICAgICAgIHZhciBub2RlID0gdGhpcy5faGVhZC5fcHJldmlvdXM7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlbGV0ZShub2RlKTtcclxuICAgICAgICAgICAgcmV0dXJuIG5vZGUudmFsdWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIG5leHQgPSB0aGlzLl9oZWFkO1xyXG4gICAgICAgIHdoaWxlIChuZXh0KSB7XHJcbiAgICAgICAgICAgIHZhciBub2RlID0gbmV4dDtcclxuICAgICAgICAgICAgbmV4dCA9IG5vZGUuX25leHQ7XHJcbiAgICAgICAgICAgIHRoaXMuX2ludmFsaWRhdGUobm9kZSk7XHJcbiAgICAgICAgICAgIGlmIChuZXh0ID09PSB0aGlzLl9oZWFkKSB7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9jYWNoZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICB0aGlzLl9zaXplID0gMDtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgdmFyIG5leHQgPSB0aGlzLl9oZWFkO1xyXG4gICAgICAgIHdoaWxlIChuZXh0KSB7XHJcbiAgICAgICAgICAgIHZhciBub2RlID0gbmV4dDtcclxuICAgICAgICAgICAgbmV4dCA9IG5vZGUuX25leHQ7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKG5vZGUudmFsdWUsIG5vZGUsIHRoaXMpO1xyXG4gICAgICAgICAgICBpZiAobmV4dCA9PT0gdGhpcy5faGVhZCkge1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUucmVkdWNlID0gZnVuY3Rpb24gKGNhbGxiYWNrLCBpbml0aWFsKSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IGluaXRpYWw7XHJcbiAgICAgICAgdmFyIG5leHQgPSB0aGlzLl9oZWFkO1xyXG4gICAgICAgIGlmIChuZXh0KSB7XHJcbiAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gbmV4dC52YWx1ZTtcclxuICAgICAgICAgICAgICAgIG5leHQgPSBuZXh0Ll9uZXh0O1xyXG4gICAgICAgICAgICAgICAgaWYgKG5leHQgPT09IHRoaXMuX2hlYWQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGRvIHtcclxuICAgICAgICAgICAgICAgIHZhciBub2RlID0gbmV4dDtcclxuICAgICAgICAgICAgICAgIG5leHQgPSBub2RlLl9uZXh0O1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gY2FsbGJhY2socmVzdWx0LCBub2RlLnZhbHVlLCBub2RlLCB0aGlzKTtcclxuICAgICAgICAgICAgfSB3aGlsZSAobmV4dCAhPT0gdGhpcy5faGVhZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUucmVkdWNlUmlnaHQgPSBmdW5jdGlvbiAoY2FsbGJhY2ssIGluaXRpYWwpIHtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gaW5pdGlhbDtcclxuICAgICAgICBpZiAodGhpcy5faGVhZCkge1xyXG4gICAgICAgICAgICB2YXIgdGFpbCA9IHRoaXMuX2hlYWQuX3ByZXZpb3VzO1xyXG4gICAgICAgICAgICB2YXIgcHJldmlvdXMgPSB0YWlsO1xyXG4gICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHByZXZpb3VzLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgcHJldmlvdXMgPSBwcmV2aW91cy5fcHJldmlvdXM7XHJcbiAgICAgICAgICAgICAgICBpZiAocHJldmlvdXMgPT09IHRhaWwpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGRvIHtcclxuICAgICAgICAgICAgICAgIHZhciBub2RlID0gcHJldmlvdXM7XHJcbiAgICAgICAgICAgICAgICBwcmV2aW91cyA9IG5vZGUuX3ByZXZpb3VzO1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gY2FsbGJhY2socmVzdWx0LCBub2RlLnZhbHVlLCBub2RlLCB0aGlzKTtcclxuICAgICAgICAgICAgfSB3aGlsZSAocHJldmlvdXMgIT09IHRhaWwpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLm1hcCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnJlZHVjZShmdW5jdGlvbiAocmVzdWx0LCB2YWx1ZSwgbm9kZSwgbGlzdCkge1xyXG4gICAgICAgICAgICByZXN1bHQuYWRkTGFzdChjYWxsYmFjayh2YWx1ZSwgbm9kZSwgbGlzdCkpO1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgIH0sIG5ldyBMaW5rZWRMaXN0KCkpO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLmZpbHRlciA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnJlZHVjZShmdW5jdGlvbiAocmVzdWx0LCB2YWx1ZSwgbm9kZSwgbGlzdCkge1xyXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2sodmFsdWUsIG5vZGUsIGxpc3QpKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQuYWRkTGFzdCh2YWx1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9LCBuZXcgTGlua2VkTGlzdCgpKTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5qb2luID0gZnVuY3Rpb24gKGRlbGltaXRlcikge1xyXG4gICAgICAgIGlmIChkZWxpbWl0ZXIgPT09IHZvaWQgMCkgeyBkZWxpbWl0ZXIgPSBcIixcIjsgfVxyXG4gICAgICAgIHZhciBmaXJzdCA9IHRydWU7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucmVkdWNlKGZ1bmN0aW9uIChyZXN1bHQsIHZhbHVlLCBub2RlKSB7XHJcbiAgICAgICAgICAgIGlmICghZmlyc3QpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCArPSBkZWxpbWl0ZXI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdCArPSBTdHJpbmcodmFsdWUpO1xyXG4gICAgICAgIH0sIFwiXCIpO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLnRvQXJyYXkgPSBmdW5jdGlvbiAoc2VsZWN0b3IpIHtcclxuICAgICAgICBpZiAoc2VsZWN0b3IpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVkdWNlKGZ1bmN0aW9uIChyZXN1bHQsIHZhbHVlLCBub2RlLCBsaXN0KSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaChzZWxlY3Rvcih2YWx1ZSwgbm9kZSwgbGlzdCkpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICAgICAgfSwgW10pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVkdWNlKGZ1bmN0aW9uIChyZXN1bHQsIHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgICAgICB9LCBbXSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmpvaW4oKTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudG9BcnJheSgpO1xyXG4gICAgfTtcclxuICAgIExpbmtlZExpc3QucHJvdG90eXBlLl9jaGVja05vZGUgPSBmdW5jdGlvbiAobm9kZSkge1xyXG4gICAgICAgIGlmICghbm9kZSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkFyZ3VtZW50IG5vdCBvcHRpb25hbDogbm9kZVwiKTtcclxuICAgICAgICBpZiAobm9kZS5saXN0ICE9PSB0aGlzKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJXcm9uZyBsaXN0LlwiKTtcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5fY2hlY2tOZXdOb2RlID0gZnVuY3Rpb24gKG5ld05vZGUpIHtcclxuICAgICAgICBpZiAoIW5ld05vZGUpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJBcmd1bWVudCBub3Qgb3B0aW9uYWw6IG5ld05vZGVcIik7XHJcbiAgICAgICAgaWYgKG5ld05vZGUubGlzdClcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm9kZSBpcyBhbHJlYWR5IGF0dGFjaGVkIHRvIGEgbGlzdC5cIik7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuX2luc2VydCA9IGZ1bmN0aW9uIChub2RlLCBuZXdOb2RlKSB7XHJcbiAgICAgICAgbmV3Tm9kZS5fbGlzdCA9IHRoaXM7XHJcbiAgICAgICAgbmV3Tm9kZS5fbmV4dCA9IG5vZGU7XHJcbiAgICAgICAgbmV3Tm9kZS5fcHJldmlvdXMgPSBub2RlLl9wcmV2aW91cztcclxuICAgICAgICBub2RlLl9wcmV2aW91cy5fbmV4dCA9IG5ld05vZGU7XHJcbiAgICAgICAgbm9kZS5fcHJldmlvdXMgPSBuZXdOb2RlO1xyXG4gICAgICAgIHRoaXMuX2NhY2hlID0gbmV3Tm9kZTtcclxuICAgICAgICB0aGlzLl9zaXplKys7XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuX2luc2VydEVtcHR5ID0gZnVuY3Rpb24gKG5ld05vZGUpIHtcclxuICAgICAgICBuZXdOb2RlLl9saXN0ID0gdGhpcztcclxuICAgICAgICBuZXdOb2RlLl9uZXh0ID0gbmV3Tm9kZTtcclxuICAgICAgICBuZXdOb2RlLl9wcmV2aW91cyA9IG5ld05vZGU7XHJcbiAgICAgICAgdGhpcy5faGVhZCA9IG5ld05vZGU7XHJcbiAgICAgICAgdGhpcy5fY2FjaGUgPSBuZXdOb2RlO1xyXG4gICAgICAgIHRoaXMuX3NpemUrKztcclxuICAgIH07XHJcbiAgICBMaW5rZWRMaXN0LnByb3RvdHlwZS5fZGVsZXRlID0gZnVuY3Rpb24gKG5vZGUpIHtcclxuICAgICAgICBpZiAobm9kZS5fbmV4dCA9PT0gbm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLl9oZWFkID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgbm9kZS5fbmV4dC5fcHJldmlvdXMgPSBub2RlLl9wcmV2aW91cztcclxuICAgICAgICAgICAgbm9kZS5fcHJldmlvdXMuX25leHQgPSBub2RlLl9uZXh0O1xyXG4gICAgICAgICAgICBpZiAodGhpcy5faGVhZCA9PT0gbm9kZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5faGVhZCA9IG5vZGUuX25leHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5faW52YWxpZGF0ZShub2RlKTtcclxuICAgICAgICB0aGlzLl9jYWNoZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICB0aGlzLl9zaXplLS07XHJcbiAgICB9O1xyXG4gICAgTGlua2VkTGlzdC5wcm90b3R5cGUuX2ludmFsaWRhdGUgPSBmdW5jdGlvbiAobm9kZSkge1xyXG4gICAgICAgIG5vZGUuX2xpc3QgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgbm9kZS5fbmV4dCA9IHVuZGVmaW5lZDtcclxuICAgICAgICBub2RlLl9wcmV2aW91cyA9IHVuZGVmaW5lZDtcclxuICAgIH07XHJcbiAgICByZXR1cm4gTGlua2VkTGlzdDtcclxufSkoKTtcclxuZXhwb3J0cy5MaW5rZWRMaXN0ID0gTGlua2VkTGlzdDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy9saXN0LmpzLm1hcCIsIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKEMpIFJvbiBBLiBCdWNrdG9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpOyB5b3UgbWF5IG5vdCB1c2VcclxudGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGVcclxuTGljZW5zZSBhdCBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuXHJcblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuXHJcblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbnZhciB0YXNrID0gcmVxdWlyZSgnLi90YXNrJyk7XHJcbnZhciBzY2hlZHVsZUltbWVkaWF0ZVRhc2sgPSB0YXNrLnNjaGVkdWxlSW1tZWRpYXRlVGFzaztcclxudmFyIGhhc01zRGVidWcgPSB0eXBlb2YgRGVidWcgIT09IFwidW5kZWZpbmVkXCIgJiZcclxudHlwZW9mIERlYnVnLm1zVHJhY2VBc3luY09wZXJhdGlvblN0YXJ0aW5nID09PSBcImZ1bmN0aW9uXCIgJiZcclxudHlwZW9mIERlYnVnLm1zVHJhY2VBc3luY09wZXJhdGlvbkNvbXBsZXRlZCA9PT0gXCJmdW5jdGlvblwiICYmXHJcbnR5cGVvZiBEZWJ1Zy5tc1RyYWNlQXN5bmNDYWxsYmFja1N0YXJ0aW5nID09PSBcImZ1bmN0aW9uXCIgJiZcclxudHlwZW9mIERlYnVnLm1zVHJhY2VBc3luY0NhbGxiYWNrQ29tcGxldGVkID09PSBcImZ1bmN0aW9uXCI7XHJcbnZhciBoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucyA9IHR5cGVvZiBEZWJ1ZyAhPT0gXCJ1bmRlZmluZWRcIiAmJlxyXG50eXBlb2YgRGVidWcuc2V0Tm9uVXNlckNvZGVFeGNlcHRpb25zID09PSBcImJvb2xlYW5cIjtcclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgdGhlIGNvbXBsZXRpb24gb2YgYW4gYXN5bmNocm9ub3VzIG9wZXJhdGlvblxyXG4gKi9cclxudmFyIFByb21pc2UgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgbmV3IFByb21pc2UuXHJcbiAgICAgKiBAcGFyYW0gaW5pdCBBIGNhbGxiYWNrIHVzZWQgdG8gaW5pdGlhbGl6ZSB0aGUgcHJvbWlzZS4gVGhpcyBjYWxsYmFjayBpcyBwYXNzZWQgdHdvIGFyZ3VtZW50czogYSByZXNvbHZlIGNhbGxiYWNrIHVzZWQgcmVzb2x2ZSB0aGUgcHJvbWlzZSB3aXRoIGEgdmFsdWUgb3IgdGhlIHJlc3VsdCBvZiBhbm90aGVyIHByb21pc2UsIGFuZCBhIHJlamVjdCBjYWxsYmFjayB1c2VkIHRvIHJlamVjdCB0aGUgcHJvbWlzZSB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIG9yIGVycm9yLlxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBQcm9taXNlKGluaXQpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIGlmICh0eXBlb2YgaW5pdCAhPT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcmd1bWVudCBpcyBub3QgYSBGdW5jdGlvbiBvYmplY3RcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucykge1xyXG4gICAgICAgICAgICBEZWJ1Zy5zZXROb25Vc2VyQ29kZUV4Y2VwdGlvbnMgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgcmVzb2x2ZXIgPSBmdW5jdGlvbiAocmVqZWN0aW5nLCByZXN1bHQpIHtcclxuICAgICAgICAgICAgaWYgKHJlc29sdmVyKSB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlciA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICBfdGhpcy5fcmVzb2x2ZShyZWplY3RpbmcsIHJlc3VsdCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgICAgIHZhciByZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiByZXNvbHZlcihmYWxzZSwgdmFsdWUpOyB9O1xyXG4gICAgICAgIHZhciByZWplY3QgPSBmdW5jdGlvbiAocmVhc29uKSB7IHJldHVybiByZXNvbHZlcih0cnVlLCByZWFzb24pOyB9O1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGluaXQocmVzb2x2ZSwgcmVqZWN0KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgUHJvbWlzZS5yZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuICh2YWx1ZSBpbnN0YW5jZW9mIHRoaXMpID8gdmFsdWUgOiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXR1cm4gcmVzb2x2ZSh2YWx1ZSk7IH0pO1xyXG4gICAgfTtcclxuICAgIFByb21pc2UucmVqZWN0ID0gZnVuY3Rpb24gKHJlYXNvbikge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAoXywgcmVqZWN0KSB7IHJldHVybiByZWplY3QocmVhc29uKTsgfSk7XHJcbiAgICB9O1xyXG4gICAgUHJvbWlzZS5hbGwgPSBmdW5jdGlvbiAodmFsdWVzKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICByZXR1cm4gbmV3IHRoaXMoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICB2YXIgY291bnRkb3duID0gdmFsdWVzLmxlbmd0aCB8fCAwO1xyXG4gICAgICAgICAgICBpZiAoY291bnRkb3duIDw9IDApIHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoW10pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0gQXJyYXkoY291bnRkb3duKTtcclxuICAgICAgICAgICAgdmFyIHJlc29sdmVyID0gZnVuY3Rpb24gKGluZGV4KSB7IHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdHNbaW5kZXhdID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICBpZiAoLS1jb3VudGRvd24gPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdHMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9OyB9O1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIF90aGlzLnJlc29sdmUodmFsdWVzW2ldKS50aGVuKHJlc29sdmVyKGkpLCByZWplY3QpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgUHJvbWlzZS5yYWNlID0gZnVuY3Rpb24gKHZhbHVlcykge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIF90aGlzLnJlc29sdmUodmFsdWVzW2ldKS50aGVuKHJlc29sdmUsIHJlamVjdCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaGVzIGNhbGxiYWNrcyBmb3IgdGhlIHJlc29sdXRpb24gYW5kL29yIHJlamVjdGlvbiBvZiB0aGUgUHJvbWlzZS5cclxuICAgICAqIEBwYXJhbSBvbmZ1bGZpbGxlZCBUaGUgY2FsbGJhY2sgdG8gZXhlY3V0ZSB3aGVuIHRoZSBQcm9taXNlIGlzIHJlc29sdmVkLlxyXG4gICAgICogQHBhcmFtIG9ucmVqZWN0ZWQgVGhlIGNhbGxiYWNrIHRvIGV4ZWN1dGUgd2hlbiB0aGUgUHJvbWlzZSBpcyByZWplY3RlZC5cclxuICAgICAqIEByZXR1cm5zIEEgUHJvbWlzZSBmb3IgdGhlIGNvbXBsZXRpb24gb2Ygd2hpY2ggZXZlciBjYWxsYmFjayBpcyBleGVjdXRlZC5cclxuICAgICAqL1xyXG4gICAgUHJvbWlzZS5wcm90b3R5cGUudGhlbiA9IGZ1bmN0aW9uIChvbmZ1bGZpbGxlZCwgb25yZWplY3RlZCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hd2FpdChvbmZ1bGZpbGxlZCwgb25yZWplY3RlZCk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2hlcyBhIGNhbGxiYWNrIGZvciBvbmx5IHRoZSByZWplY3Rpb24gb2YgdGhlIFByb21pc2UuXHJcbiAgICAgKiBAcGFyYW0gb25yZWplY3RlZCBUaGUgY2FsbGJhY2sgdG8gZXhlY3V0ZSB3aGVuIHRoZSBQcm9taXNlIGlzIHJlamVjdGVkLlxyXG4gICAgICogQHJldHVybnMgQSBQcm9taXNlIGZvciB0aGUgY29tcGxldGlvbiBvZiB0aGUgY2FsbGJhY2suXHJcbiAgICAgKi9cclxuICAgIFByb21pc2UucHJvdG90eXBlLmNhdGNoID0gZnVuY3Rpb24gKG9ucmVqZWN0ZWQpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fYXdhaXQodW5kZWZpbmVkLCBvbnJlamVjdGVkKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaGVzIGEgY2FsbGJhY2sgZm9yIHRoYXQgaXMgZXhlY3V0ZWQgcmVnYXJkbGVzcyBvZiB0aGUgcmVzb2x1dGlvbiBvciByZWplY3Rpb24gb2YgdGhlIHByb21pc2UuXHJcbiAgICAgKiBAcGFyYW0gb25zZXR0bGVkIFRoZSBjYWxsYmFjayB0byBleGVjdXRlIHdoZW4gdGhlIFByb21pc2UgaXMgc2V0dGxlZC5cclxuICAgICAqIEByZXR1cm5zIEEgUHJvbWlzZSBmb3IgdGhlIGNvbXBsZXRpb24gb2YgdGhlIGNhbGxiYWNrLlxyXG4gICAgICovXHJcbiAgICBQcm9taXNlLnByb3RvdHlwZS5maW5hbGx5ID0gZnVuY3Rpb24gKG9uc2V0dGxlZCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hd2FpdChmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJldHVybiByZXNvbHZlKG9uc2V0dGxlZCgpKTsgfSkudGhlbihmdW5jdGlvbiAoKSB7IHJldHVybiB2YWx1ZTsgfSk7IH0sIGZ1bmN0aW9uIChyZWFzb24pIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJldHVybiByZXNvbHZlKG9uc2V0dGxlZCgpKTsgfSkudGhlbihmdW5jdGlvbiAoKSB7IHJldHVybiBQcm9taXNlLnJlamVjdChyZWFzb24pOyB9KTsgfSk7XHJcbiAgICB9O1xyXG4gICAgUHJvbWlzZS5wcm90b3R5cGUuX3Jlc29sdmUgPSBmdW5jdGlvbiAocmVqZWN0aW5nLCByZXN1bHQpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIGlmICghcmVqZWN0aW5nKSB7XHJcbiAgICAgICAgICAgIGlmIChoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgRGVidWcuc2V0Tm9uVXNlckNvZGVFeGNlcHRpb25zID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMgPT09IHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVzb2x2ZSBhIHByb21pc2Ugd2l0aCBpdHNlbGZcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICE9PSBudWxsICYmICh0eXBlb2YgcmVzdWx0ID09PSBcIm9iamVjdFwiIHx8IHR5cGVvZiByZXN1bHQgPT09IFwiZnVuY3Rpb25cIikgJiYgXCJ0aGVuXCIgaW4gcmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRoZW4gPSByZXN1bHQudGhlbjtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoZW4gPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVzb2x2ZXIgPSBmdW5jdGlvbiAocmVqZWN0aW5nLCByZXN1bHQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXNvbHZlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmVyID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fcmVzb2x2ZShyZWplY3RpbmcsIHJlc3VsdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiByZXNvbHZlcihmYWxzZSwgdmFsdWUpOyB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVqZWN0ID0gZnVuY3Rpb24gKHJlYXNvbikgeyByZXR1cm4gcmVzb2x2ZXIodHJ1ZSwgcmVhc29uKTsgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoZW4uY2FsbChyZXN1bHQsIHJlc29sdmUsIHJlamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBlcnJvcjtcclxuICAgICAgICAgICAgICAgIHJlamVjdGluZyA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fc2V0dGxlKHJlamVjdGluZywgcmVzdWx0KTtcclxuICAgIH07XHJcbiAgICBQcm9taXNlLnByb3RvdHlwZS5fYXdhaXQgPSBmdW5jdGlvbiAob25yZXNvbHZlZCwgb25yZWplY3RlZCkge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgdmFyIGlkO1xyXG4gICAgICAgIGlmIChoYXNNc0RlYnVnKSB7XHJcbiAgICAgICAgICAgIERlYnVnLm1zVHJhY2VBc3luY09wZXJhdGlvblN0YXJ0aW5nKFwiUHJvbWlzZS50aGVuXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICB2YXIgcHJldiA9IF90aGlzLl9zZXR0bGU7XHJcbiAgICAgICAgICAgIF90aGlzLl9zZXR0bGUgPSBmdW5jdGlvbiAocmVqZWN0aW5nLCByZXN1bHQpIHtcclxuICAgICAgICAgICAgICAgIF90aGlzLl9mb3J3YXJkKHByZXYsIHJlc29sdmUsIHJlamVjdCwgcmVqZWN0aW5nLCByZXN1bHQsIG9ucmVzb2x2ZWQsIG9ucmVqZWN0ZWQsIGlkKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBQcm9taXNlLnByb3RvdHlwZS5fc2V0dGxlID0gZnVuY3Rpb24gKHJlamVjdGluZywgcmVzdWx0KSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB0aGlzLl9zZXR0bGUgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuX2F3YWl0ID0gZnVuY3Rpb24gKG9uZnVsZmlsbGVkLCBvbnJlamVjdGVkKSB7XHJcbiAgICAgICAgICAgIHZhciBpZCA9IGhhc01zRGVidWcgJiYgRGVidWcubXNUcmFjZUFzeW5jT3BlcmF0aW9uU3RhcnRpbmcoXCJQcm9taXNlLnRoZW5cIik7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgX3RoaXMuY29uc3RydWN0b3IoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICAgICAgX3RoaXMuX2ZvcndhcmQobnVsbCwgcmVzb2x2ZSwgcmVqZWN0LCByZWplY3RpbmcsIHJlc3VsdCwgb25mdWxmaWxsZWQsIG9ucmVqZWN0ZWQsIGlkKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfTtcclxuICAgIH07XHJcbiAgICBQcm9taXNlLnByb3RvdHlwZS5fZm9yd2FyZCA9IGZ1bmN0aW9uIChwcmV2LCByZXNvbHZlLCByZWplY3QsIHJlamVjdGluZywgcmVzdWx0LCBvbnJlc29sdmVkLCBvbnJlamVjdGVkLCBpZCkge1xyXG4gICAgICAgIGlmIChwcmV2KSB7XHJcbiAgICAgICAgICAgIHByZXYuY2FsbCh0aGlzLCByZWplY3RpbmcsIHJlc3VsdCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHNjaGVkdWxlSW1tZWRpYXRlVGFzayhmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChoYXNNc05vblVzZXJDb2RlRXhjZXB0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgRGVidWcuc2V0Tm9uVXNlckNvZGVFeGNlcHRpb25zID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoaGFzTXNEZWJ1Zykge1xyXG4gICAgICAgICAgICAgICAgRGVidWcubXNUcmFjZUFzeW5jT3BlcmF0aW9uQ29tcGxldGVkKGlkLCByZWplY3RpbmcgPyBEZWJ1Zy5NU19BU1lOQ19PUF9TVEFUVVNfRVJST1IgOiBEZWJ1Zy5NU19BU1lOQ19PUF9TVEFUVVNfU1VDQ0VTUyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFyIGhhbmRsZXIgPSByZWplY3RpbmcgPyBvbnJlamVjdGVkIDogb25yZXNvbHZlZDtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICAgICAgICAgIGlmIChoYXNNc0RlYnVnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgRGVidWcubXNUcmFjZUFzeW5jQ2FsbGJhY2tTdGFydGluZyhpZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGhhbmRsZXIocmVzdWx0KTtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3RpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZTtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3RpbmcgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZmluYWxseSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhhc01zRGVidWcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcubXNUcmFjZUFzeW5jQ2FsbGJhY2tDb21wbGV0ZWQoKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgKHJlamVjdGluZyA/IHJlamVjdCA6IHJlc29sdmUpKHJlc3VsdCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIFByb21pc2U7XHJcbn0pKCk7XHJcbmV4cG9ydHMuUHJvbWlzZSA9IFByb21pc2U7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGU6Ly8vQ3wvZGV2L2FzeW5janMvcHJvbWlzZS5qcy5tYXAiLCIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChDKSBSb24gQS4gQnVja3Rvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTsgeW91IG1heSBub3QgdXNlXHJcbnRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlXHJcbkxpY2Vuc2UgYXQgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcblxyXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcblxyXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG52YXIgbGlzdCA9IHJlcXVpcmUoJy4vbGlzdCcpO1xyXG52YXIgY2FuY2VsbGF0aW9uID0gcmVxdWlyZSgnLi9jYW5jZWxsYXRpb24nKTtcclxudmFyIExpbmtlZExpc3QgPSBsaXN0LkxpbmtlZExpc3Q7XHJcbnZhciBDYW5jZWxsYXRpb25Ub2tlbiA9IGNhbmNlbGxhdGlvbi5DYW5jZWxsYXRpb25Ub2tlbjtcclxuZnVuY3Rpb24gZ2V0T3JDcmVhdGVRdWV1ZSgpIHtcclxuICAgIGlmICghcXVldWUpIHtcclxuICAgICAgICBxdWV1ZSA9IG5ldyBMaW5rZWRMaXN0KCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcXVldWU7XHJcbn1cclxuLypAaW50ZXJuYWwqL1xyXG5mdW5jdGlvbiBzY2hlZHVsZUltbWVkaWF0ZVRhc2sodGFzaywgdG9rZW4pIHtcclxuICAgIGlmICh0b2tlbiA9PT0gdm9pZCAwKSB7IHRva2VuID0gQ2FuY2VsbGF0aW9uVG9rZW4ubm9uZTsgfVxyXG4gICAgaWYgKHRva2VuLmNhbkJlQ2FuY2VsZWQpIHtcclxuICAgICAgICB2YXIgcmVnaXN0cmF0aW9uID0gdG9rZW4ucmVnaXN0ZXIoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAobm9kZS5saXN0ID09PSByZWNvdmVyeVF1ZXVlIHx8IG5vZGUubGlzdCA9PT0gcXVldWUpIHtcclxuICAgICAgICAgICAgICAgIG5vZGUubGlzdC5kZWxldGVOb2RlKG5vZGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChyZWNvdmVyeVF1ZXVlICYmICFyZWNvdmVyeVF1ZXVlLmZpcnN0KSB7XHJcbiAgICAgICAgICAgICAgICByZWNvdmVyeVF1ZXVlID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChxdWV1ZSAmJiAhcXVldWUuZmlyc3QpIHtcclxuICAgICAgICAgICAgICAgIHF1ZXVlID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghcmVjb3ZlcnlRdWV1ZSAmJiAhcXVldWUpIHtcclxuICAgICAgICAgICAgICAgIGNhbmNlbFRpY2soKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHZhciBub2RlID0gZ2V0T3JDcmVhdGVRdWV1ZSgpLmFkZExhc3QoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZWdpc3RyYXRpb24udW5yZWdpc3RlcigpO1xyXG4gICAgICAgICAgICByZWdpc3RyYXRpb24gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGlmICghdG9rZW4uY2FuY2VsZWQpIHtcclxuICAgICAgICAgICAgICAgIHRhc2soKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgZ2V0T3JDcmVhdGVRdWV1ZSgpLmFkZExhc3QodGFzayk7XHJcbiAgICB9XHJcbiAgICBzY2hlZHVsZVRpY2soKTtcclxufVxyXG5leHBvcnRzLnNjaGVkdWxlSW1tZWRpYXRlVGFzayA9IHNjaGVkdWxlSW1tZWRpYXRlVGFzaztcclxuLypAaW50ZXJuYWwqL1xyXG5mdW5jdGlvbiBzY2hlZHVsZURlbGF5ZWRUYXNrKHRhc2ssIGRlbGF5LCB0b2tlbikge1xyXG4gICAgaWYgKHRva2VuID09PSB2b2lkIDApIHsgdG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5ub25lOyB9XHJcbiAgICBpZiAodG9rZW4uY2FuQmVDYW5jZWxlZCkge1xyXG4gICAgICAgIHZhciByZWdpc3RyYXRpb24gPSB0b2tlbi5yZWdpc3RlcihmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGhhbmRsZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGhhbmRsZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdmFyIGhhbmRsZSA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZWdpc3RyYXRpb24udW5yZWdpc3RlcigpO1xyXG4gICAgICAgICAgICByZWdpc3RyYXRpb24gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGlmICghdG9rZW4uY2FuY2VsZWQpIHtcclxuICAgICAgICAgICAgICAgIHRhc2soKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sIGRlbGF5KTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIHNldFRpbWVvdXQodGFzaywgZGVsYXkpO1xyXG4gICAgfVxyXG59XHJcbmV4cG9ydHMuc2NoZWR1bGVEZWxheWVkVGFzayA9IHNjaGVkdWxlRGVsYXllZFRhc2s7XHJcbnZhciBzY2hlZHVsZXI7XHJcbnZhciBoYW5kbGU7XHJcbnZhciByZWNvdmVyeVF1ZXVlO1xyXG52YXIgcXVldWU7XHJcbmZ1bmN0aW9uIHNjaGVkdWxlVGljaygpIHtcclxuICAgIGlmIChoYW5kbGUgIT09IHZvaWQgMCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGlmICghc2NoZWR1bGVyKSB7XHJcbiAgICAgICAgc2NoZWR1bGVyID0gZ2V0U2NoZWR1bGVyKCk7XHJcbiAgICB9XHJcbiAgICBoYW5kbGUgPSBzY2hlZHVsZXIuc2NoZWR1bGVUaWNrKG9uVGljayk7XHJcbn1cclxuZnVuY3Rpb24gY2FuY2VsVGljaygpIHtcclxuICAgIGlmIChoYW5kbGUgPT09IHZvaWQgMCB8fCAhc2NoZWR1bGVyKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgc2NoZWR1bGVyLmNhbmNlbFRpY2soaGFuZGxlKTtcclxuICAgIGhhbmRsZSA9IHVuZGVmaW5lZDtcclxufVxyXG5mdW5jdGlvbiBvblRpY2soKSB7XHJcbiAgICBoYW5kbGUgPSB1bmRlZmluZWQ7XHJcbiAgICBwcm9jZXNzUXVldWUocmVjb3ZlcnlRdWV1ZSk7XHJcbiAgICByZWNvdmVyeVF1ZXVlID0gcXVldWU7XHJcbiAgICBxdWV1ZSA9IHVuZGVmaW5lZDtcclxuICAgIHByb2Nlc3NRdWV1ZShyZWNvdmVyeVF1ZXVlKTtcclxuICAgIHJlY292ZXJ5UXVldWUgPSB1bmRlZmluZWQ7XHJcbn1cclxuZnVuY3Rpb24gcHJvY2Vzc1F1ZXVlKHF1ZXVlKSB7XHJcbiAgICBpZiAoIXF1ZXVlKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdmFyIG5vZGU7XHJcbiAgICB2YXIgdGFza0NvbXBsZXRlZCA9IGZhbHNlO1xyXG4gICAgd2hpbGUgKG5vZGUgPSBxdWV1ZS5maXJzdCkge1xyXG4gICAgICAgIHF1ZXVlLmRlbGV0ZU5vZGUobm9kZSk7XHJcbiAgICAgICAgdmFyIHRhc2sgPSBub2RlLnZhbHVlO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHRhc2soKTtcclxuICAgICAgICAgICAgdGFza0NvbXBsZXRlZCA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkge1xyXG4gICAgICAgICAgICBpZiAoIXRhc2tDb21wbGV0ZWQpIHtcclxuICAgICAgICAgICAgICAgIHNjaGVkdWxlVGljaygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbmZ1bmN0aW9uIGdldFNjaGVkdWxlcigpIHtcclxuICAgIGZ1bmN0aW9uIGdldFNldEltbWVkaWF0ZVNjaGVkdWxlcigpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzY2hlZHVsZVRpY2s6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNldEltbWVkaWF0ZShjYWxsYmFjayk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNhbmNlbFRpY2s6IGZ1bmN0aW9uIChoYW5kbGUpIHtcclxuICAgICAgICAgICAgICAgIGNsZWFySW1tZWRpYXRlKGhhbmRsZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gZ2V0TVNTZXRJbW1lZGlhdGVTY2hlZHVsZXIoKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgc2NoZWR1bGVUaWNrOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtc1NldEltbWVkaWF0ZShjYWxsYmFjayk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNhbmNlbFRpY2s6IGZ1bmN0aW9uIChoYW5kbGUpIHtcclxuICAgICAgICAgICAgICAgIG1zQ2xlYXJJbW1lZGlhdGUoaGFuZGxlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBnZXROZXh0VGlja1NjaGVkdWxlcigpIHtcclxuICAgICAgICB2YXIgcXVldWUgPSBuZXcgTGlua2VkTGlzdCgpO1xyXG4gICAgICAgIGZ1bmN0aW9uIG9udGljaygpIHtcclxuICAgICAgICAgICAgdmFyIG5vZGUgPSBxdWV1ZS5maXJzdDtcclxuICAgICAgICAgICAgaWYgKG5vZGUpIHtcclxuICAgICAgICAgICAgICAgIHF1ZXVlLmRlbGV0ZUZpcnN0KCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgY2FsbGJhY2sgPSBub2RlLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzY2hlZHVsZVRpY2s6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgdmFyIGhhbmRsZSA9IHF1ZXVlLmFkZExhc3QoY2FsbGJhY2spO1xyXG4gICAgICAgICAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhvbnRpY2spO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGhhbmRsZTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgY2FuY2VsVGljazogZnVuY3Rpb24gKGhhbmRsZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGhhbmRsZSAmJiBoYW5kbGUubGlzdCA9PT0gcXVldWUpIHtcclxuICAgICAgICAgICAgICAgICAgICBxdWV1ZS5kZWxldGVOb2RlKGhhbmRsZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gZ2V0TWVzc2FnZUNoYW5uZWxTY2hlZHVsZXIoKSB7XHJcbiAgICAgICAgdmFyIHF1ZXVlID0gbmV3IExpbmtlZExpc3QoKTtcclxuICAgICAgICB2YXIgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xyXG4gICAgICAgIGNoYW5uZWwucG9ydDIub25tZXNzYWdlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgbm9kZSA9IHF1ZXVlLmZpcnN0O1xyXG4gICAgICAgICAgICBpZiAobm9kZSkge1xyXG4gICAgICAgICAgICAgICAgcXVldWUuZGVsZXRlRmlyc3QoKTtcclxuICAgICAgICAgICAgICAgIHZhciBjYWxsYmFjayA9IG5vZGUudmFsdWU7XHJcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzY2hlZHVsZVRpY2s6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgdmFyIGhhbmRsZSA9IHF1ZXVlLmFkZExhc3QoY2FsbGJhY2spO1xyXG4gICAgICAgICAgICAgICAgY2hhbm5lbC5wb3J0MS5wb3N0TWVzc2FnZSh1bmRlZmluZWQpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGhhbmRsZTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgY2FuY2VsVGljazogZnVuY3Rpb24gKGhhbmRsZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGhhbmRsZSAmJiBoYW5kbGUubGlzdCA9PT0gcXVldWUpIHtcclxuICAgICAgICAgICAgICAgICAgICBxdWV1ZS5kZWxldGVOb2RlKGhhbmRsZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gZ2V0U2V0VGltZW91dFNjaGVkdWxlcigpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzY2hlZHVsZVRpY2s6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoY2FsbGJhY2ssIDApO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjYW5jZWxUaWNrOiBmdW5jdGlvbiAoaGFuZGxlKSB7XHJcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoaGFuZGxlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBnZXRNaXNzaW5nU2NoZWR1bGVyKCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHNjaGVkdWxlVGljazogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJTY2hlZHVsZXIgbm90IGF2YWlsYWJsZS5cIik7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNhbmNlbFRpY2s6IGZ1bmN0aW9uIChoYW5kbGUpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlNjaGVkdWxlciBub3QgYXZhaWxhYmxlLlwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICBpZiAodHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldFNldEltbWVkaWF0ZVNjaGVkdWxlcigpO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAodHlwZW9mIG1zU2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICByZXR1cm4gZ2V0TVNTZXRJbW1lZGlhdGVTY2hlZHVsZXIoKTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldE1lc3NhZ2VDaGFubmVsU2NoZWR1bGVyKCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmICh0eXBlb2YgcHJvY2VzcyA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgcHJvY2Vzcy5uZXh0VGljayA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldE5leHRUaWNrU2NoZWR1bGVyKCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldFNldFRpbWVvdXRTY2hlZHVsZXIoKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBnZXRNaXNzaW5nU2NoZWR1bGVyKCk7XHJcbiAgICB9XHJcbn1cclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy90YXNrLmpzLm1hcCIsIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKEMpIFJvbiBBLiBCdWNrdG9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpOyB5b3UgbWF5IG5vdCB1c2VcclxudGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGVcclxuTGljZW5zZSBhdCBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuXHJcblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuXHJcblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbnZhciBwcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XHJcbnZhciBjYW5jZWxsYXRpb24gPSByZXF1aXJlKCcuL2NhbmNlbGxhdGlvbicpO1xyXG52YXIgdGFzayA9IHJlcXVpcmUoJy4vdGFzaycpO1xyXG52YXIgUHJvbWlzZSA9IHByb21pc2UuUHJvbWlzZTtcclxudmFyIENhbmNlbGxhdGlvblRva2VuID0gY2FuY2VsbGF0aW9uLkNhbmNlbGxhdGlvblRva2VuO1xyXG52YXIgc2NoZWR1bGVJbW1lZGlhdGVUYXNrID0gdGFzay5zY2hlZHVsZUltbWVkaWF0ZVRhc2s7XHJcbnZhciBzY2hlZHVsZURlbGF5ZWRUYXNrID0gdGFzay5zY2hlZHVsZURlbGF5ZWRUYXNrO1xyXG5mdW5jdGlvbiBzbGVlcChkZWxheSwgdG9rZW4pIHtcclxuICAgIGlmICh0b2tlbiA9PT0gdm9pZCAwKSB7IHRva2VuID0gQ2FuY2VsbGF0aW9uVG9rZW4ubm9uZTsgfVxyXG4gICAgaWYgKChkZWxheSB8PSAwKSA8IDApIHtcclxuICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcigpO1xyXG4gICAgfVxyXG4gICAgaWYgKHRva2VuLmNhbmNlbGVkKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KHRva2VuLnJlYXNvbik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIHNjaGVkdWxlRGVsYXllZFRhc2socmVzb2x2ZSwgZGVsYXksIHRva2VuKTtcclxuICAgICAgICB0b2tlbi5yZWdpc3RlcihyZWplY3QpO1xyXG4gICAgfSk7XHJcbn1cclxuZXhwb3J0cy5zbGVlcCA9IHNsZWVwO1xyXG5mdW5jdGlvbiBzcGluKHRva2VuKSB7XHJcbiAgICBpZiAodG9rZW4gPT09IHZvaWQgMCkgeyB0b2tlbiA9IENhbmNlbGxhdGlvblRva2VuLm5vbmU7IH1cclxuICAgIGlmICh0b2tlbi5jYW5jZWxlZCkge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdCh0b2tlbi5yZWFzb24pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBzY2hlZHVsZUltbWVkaWF0ZVRhc2socmVzb2x2ZSwgdG9rZW4pO1xyXG4gICAgICAgIHRva2VuLnJlZ2lzdGVyKHJlamVjdCk7XHJcbiAgICB9KTtcclxufVxyXG5leHBvcnRzLnNwaW4gPSBzcGluO1xyXG5leHBvcnRzLnJlc29sdmVkUHJvbWlzZSA9IE9iamVjdC5mcmVlemUoUHJvbWlzZS5yZXNvbHZlKCkpO1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1maWxlOi8vL0N8L2Rldi9hc3luY2pzL3V0aWxzLmpzLm1hcCJdfQ==
