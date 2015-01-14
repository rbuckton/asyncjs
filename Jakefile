var fs = require('fs');
var spawn = require('child_process').spawn;

var tscPath = "node_modules/typescript/bin/tsc.js";
var host = (process.env.host || process.env.SOURCEMAP_HOST || "node");
var main = "./lib/async.js";
var browser = "./async.js";
var release = false;

var opts = {
  "default": {
    "tsc": {
      "module": "commonjs",
      "target": "ES5",
      "noImplicitAny": true,
      "declaration": true,
    },
    "browserify": {
      "standalone": "Promise",
      "detectGlobals": false
    }
  },
  "release": {
    "tsc": {
      "removeComments": true,
      "noEmitOnError": true,
    }
  },
  "debug": {
    "tsc": {
      "sourceMap": true,
      "sourceRoot": asFileUri(__dirname, true),
      "mapRoot": asFileUri(__dirname, true),
      "preserveConstEnums": true,
    },
    "browserify": {
      "debug": true
    }
  }
};

var modules = [
  "./lib/task",
  "./lib/promise",
  "./lib/deferred",
  "./lib/cancellation",
  "./lib/utils",
  "./lib/httpclient",
  "./lib/async"
];

var external = [
  "./lib/node.d.ts",
  "./lib/msdebug.d.ts"
];

var prereqs = ["Jakefile"];
var sources = external.concat(modules.map(asTypeScript));
var compiledJavaScript = modules.map(asJavaScript);
var compiledDeclarations = modules.map(asDeclaration);
var compiledSourceMaps = modules.map(asSourceMap);
var outputs = compiledJavaScript.concat(compiledDeclarations).concat(compiledSourceMaps);

tsc(main, sources, { });
browserify(browser, compiledJavaScript, { });

task("release", function() { release = true; });
task("local", [main]);
task("clean", function() { outputs.forEach(cleanFile); });
task("default", ["local"]);
task("browser", ["local", browser]);

function mergeOptions(options, tool) {
    var merged = {};
    merged = copyProperties(opts.default[tool], merged);
    merged = copyProperties(release ? opts.release[tool] : opts.debug[tool], merged);
    merged = copyProperties(options, merged);
    return merged;
}

function browserify(outFile, sources, options) {
  file(outFile, prereqs.concat(sources), { async: true }, function() {
    options = mergeOptions(options, 'browserify');
    options.entries = sources;
    var _browserify = require("browserify");
    _browserify(options).bundle(function(error, src) {    
      if (error) {
        fail(error);
        return;
      }
      else {
        fs.writeFileSync(outFile, src);
        complete();
      }
    });
  });
}

function tsc(outFile, sources, options) {
  file(outFile, prereqs.concat(sources), { async: true }, function() {
    options = mergeOptions(options, "tsc");

    var args = [tscPath];
    for (var key in options) {
      var value = options[key];
      if (value === true) {
        args.push("--" + key);
      } else if (typeof value === "string") {
        args.push("--" + key, value);
      }
    }

    args = args.concat(sources);

    console.log("%s %s\n", host, args.join(" "));

    var tsc = spawn(host, args, { stdio: "inherit" });
    tsc.on("exit", function (code) {
      if (code === 0) {
        complete();
      }
      else {
        fail();
      }
    }); 
  });
}

function cleanFile(file) {
  if (fs.existsSync(file)) {
    jake.rmRf(file);
  }
}

function asFileUri(path, isDirectory) {
  var isDos = /^[a-z]:[\\/]/i.test(path);
  var isRooted = isDos || /^[\\/]/.test(path);
  if (isRooted) {
    var unc = /^[\\/]{2}([^\\/]+)([\\/].+)$/.exec(path);
    var host = '';
    if (unc) {
      host = unc[1];
    }
    path = path.replace(/^[\\/]/, '');
    path = path.replace(/\\/g, '/');
    path = path.replace(/:/, '|');
    path = "file://" + host + "/" + path;
  }
  if (isDirectory && !/\/$/.test(path)) {
    path = path + '/';
  }
  return path;
}

function asTypeScript(module) { 
  return module + ".ts"; 
}

function asJavaScript(module) { 
  return module + ".js"; 
}

function asDeclaration(module) { 
  return module + ".d.ts"; 
}

function asSourceMap(module) { 
  return module + ".js.map"; 
}

function copyProperties(source, dest) {
  if (Object(dest) !== dest) {
    dest = {};
  }

  if (Object(source) === source) {
    Object
      .getOwnPropertyNames(source)
      .forEach(function (name) { 
        Object.defineProperty(
          dest, 
          name, 
          Object.getOwnPropertyDescriptor(source, name)); 
      });
  }

  return dest;
}