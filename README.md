# asyncjs #

Asynchronous coordination for JavaScript and TypeScript.

## Promise ##
This contains a polyfill for the native ES6 promise, along with a number of additional coordination primitives to assist in asynchronous application development in JavaScript and TypeScript.

A normal function call in JavaScript is completed synchronously in one of two 
ways: normal completion that exits the function with a possible return value, or an abrupt 
completion which results in an exception.

An asynchronous function can return a Promise, which represents the eventual completion of the 
asynchronous operation in one of two ways: fulfillment of the Promise with a possible return value 
(an asynchronous 'normal completion'), or rejection of the Promise with a reason (an asynchronous 
'abrupt completion').

For example, if you wanted to fetch a remote resource from the browser, you might use the following 
code to perform a synchronous fetch:

```js
function fetch(url) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, /*async:*/ false);
  xhr.send(null);
  return xhr.responseText;
}

try {
  var res = fetch("...");
  /*do something with res*/
  var value = next(res);
  /*do something with value*/
}
catch(err) {
  /*handle err*/
}
```

The above example has the unfortunate side effect of blocking the browser's UI thread until the resource is loaded.
To be more efficient, we might rewrite this to be asynchronous using Continuation Passing Style:

```js
function fetchCPS(url, callback, errback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, /*async:*/ true);
  xhr.onload = event => callback(xhr.responseText);
  xhr.onerror = event => errback(xhr.statusText);
  xhr.send(null);
}

fetchCPS("...", 
  res => {
    /*do something with res*/
    nextCPS(res, 
      value => {
        /*do something with value*/
      }, 
      err => {
        /*handle err*/ 
      })},
  err => {
    /*handle err*/
  })
```

If you need to perform a large number of nested asynchronous calls, Continuation 
Passing Style can start to look complicated very quickly.

With Promises you would instead write:

```js
function fetchAsync(url) {
  return new Promise((resolve, reject) => {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, /*async:*/ true);
    xhr.onload = event => resolve(xhr.responseText);
    xhr.onerror = event => reject(xhr.statusText);
    xhr.send(null);
  });
}

var resP = fetchAsync("...");
resP.then(res => {
      /*do something with res*/
      return nextAsync(res);
    })
    .then(value => {
      /*do something with value*/
    })
    .catch(err => {
      /*handle err*/
    })
```

More information can be found in the [wiki](https://github.com/rbuckton/asyncjs/wiki).
