// notes on this server should be in ../prose/server.html

var staticHtml = {
 "/": "./static/index.html",
 "/desktop.html": "./static/desktop.html",

 "/index.html": "../index.html",
 "/prose/browserbased.html": "../prose/browserbased.html",
 "/prose/zui.html": "../prose/zui.html",
 "/prose/collaboration.html": "../prose/collaboration.html",
 "/prose/drawing.html": "../prose/drawing.html",
 "/prose/server.html": "../prose/server.html",
 "/prose/client.html": "../prose/client.html",
 "/prose/desktop.html": "../prose/desktop.html",
 "/prose/mobile.html": "../prose/mobile.html",
 "/prose/contact.html": "../prose/contact.html",
 "/prose/todo.html": "../prose/todo.html",
 "/prose/contributing.html": "../prose/contributing.html",
 "/prose/license.html": "../prose/license.html"
};
var staticFiles = {
 "/desktop.js": [
  "application/javascript; charset=utf-8",
  "./static/desktop.js"
 ],
 "/ajax.js": ["application/javascript; charset=utf-8", "./static/ajax.js"],
 "/client.js": ["application/javascript; charset=utf-8", "./static/client.js"]
};

function respondPlain(response, status, body){
 response.setHeader("Content-Type", "text/plain; charset=utf-8");
 response.statusCode = status;
 return response.end("" + body);
}

function respondNotFound(s){
 return respondPlain(s, 404, "Not Found");
}
function respondInternalFailure(s){
 return respondPlain(s, 500, "oops!");
}

function respondFile(response, path, mimetype){
 function fileback(err, data){
  if(err){
   if(34 == err.errno)
    if("ENOENT" == err.code){
     console.log("not found:", path);
     return respondNotFound(response);
    }
   console.log([err.errno, err.code]);
   return respondInternalFailure(response);
  }

  response.setHeader("Content-Type", mimetype);
  response.statusCode = 200;
  return response.end(data);
 }
 return require("fs").readFile(path, fileback);
}
function respondStaticHtml(url, response){
 if(!(url in staticHtml)) return respondNotFound(response);
 return respondFile(response, staticHtml[url], "text/html; charset=utf-8");
}
function respondStatic(url, response){
 if(!(url in staticFiles)) return respondNotFound(response);
 var resource = staticFiles[url];
 return respondFile(response, resource[1], resource[0]);
}

function redirectToGithub(response){
 var protocol = "https";
 var domain = ["github", "com"].join(".");
 var username = "calcnerd256";
 var repository = "pseudowhiteboard";
 var url = [
  protocol + "://" + domain,
  username,
  repository,
  "blob",
  "master",
  "src",
  "serve.js"
 ].join("/");
 response.setHeader("Location", url);
 return respondPlain(response, 302, "redirecting to GitHub")
}

function Future(){
 this.done = false;
 this.listeners = [];
}
Future.prototype.listen = function listen(listener){
 if(this.done) return listener(this.value);
 this.listeners.push(listener);
};
Future.prototype.resolve = function resolve(value){
 if(this.done) return;
 this.done = true;
 this.value = value;
 return this.listeners.map(
  function(f){return f(value);}
 );
};
function Maybe(value, error){
 if(arguments.length > 1) this.error = error;
 else this.value = value;
 this["throw"] = function(){
  throw(this.error);
 }
}
Maybe.prototype["throw"] = function(){
 if("error" in this)
  throw(this.error);
};

var Promise;
if(!Promise){
 Promise = function Promise(maker){
  var future = new Future();
  function resolve(value){
   if("then" in value)
    value.then(
     function(v){
      future.resolve(new Maybe(v));
     },
     function(e){
      future.resolve(new Maybe(null, e));
     }
    );
   else
    future.resolve(new Maybe(value));
  }
  function reject(error){
   future.resolve(new Maybe(null, error));
  }
  try{
   maker(resolve, reject);
  }
  catch(e){
   reject(e);
  }
  this.then = function(goodback, badback){
   return new Promise(
    function(res, rej){
     future.listen(
      function(m){
       var eim = "error" in m;
       var pass = eim ? rej : res;
       var p = eim ? m.error : m.value;
       var back = eim ? badback : goodback;
       if(!back) return pass(p);
       try{
        return res(back(p));
       }
       catch(e){
        return rej(e);
       }
      }
     );
    }
   );
  };
 }
 Promise.resolve = function(value){
  if("then" in value) return value;
  return new Promise(
   function(res){
    return res(value);
   }
  );
 }
}

function dict(pairs){
 var result = {};
 pairs.map(
  function(kv){
   result[kv[0]] = kv[1];
  }
 );
 return result;
}

function promiseReadUrlencodedForm(q){
 var body = "";
 function chomp(chunk){
  body += chunk.toString("ascii");
 }
 q.on("data", chomp);
 return new Promise(
  function(res, rej){
   q.on(
    "end",
    function(lastChunk){
     if(lastChunk) chomp(lastChunk);
     var pairs = body.split("&").map(
      function(kv){
       var tokens = kv.split("=");
       var k = tokens.shift();
       var v = tokens.join("=");
       return [k, v.split("+").join(" ")].map(decodeURIComponent);
      }
     );
     res(pairs);
    }
   );
  }
 );
}

function respondChatopsdbPOST(q, s, db){
 var addr = q.socket.remoteAddress;
 var clients = db.clients;
 var handle = null;
 if(addr in clients)
  handle = clients[addr];
 else{
  handle = Object.keys(clients).length;
  clients[addr] = handle;
 }
 promiseReadUrlencodedForm(q).then(dict).then(
  function(formData){
   if("message" in formData){
    var log = db.messages;
    var body = formData.message.split("\n").map(
     function(line){
      var result = log.length;
      log.push(handle + ": " + line);
      return result;
     }
    ).join("\n");
    return respondPlain(s, 200, body);
   }
   return respondNotFound(s);
  }
 );
}
function respondChatopsdb(request, response, db){
 if("POST" == request.method.toUpperCase())
  return respondChatopsdbPOST(request, response, db);
 var body = db.messages.map(
  function(line){
   return line.split("\n").join(" ");
  }
 ).join("\n");
 return respondPlain(response, 200, body);
}

function make_respond(sip){
 var strings = {
  "/ssid.txt": sip[0],
  "/url.txt": "http://" + sip[1] + ":" + (+(sip[2])) + "/"
 };
 var db = {messages: [], clients: {}};
 function respond(q, s){
  var url = q.url.split("?")[0];
  if("GET" == q.method.toUpperCase()){
   if(url in staticHtml)
    return respondStaticHtml(url, s);
   if(url in staticFiles)
    return respondStatic(url, s);
   if(url == "/src/serve.js")
    return redirectToGithub(s);
   if(url in strings)
    return respondPlain(s, 200, strings[url]);
  }
  var codUrl = "/chatopsdb"
  if(codUrl == url || (codUrl + "/") == url.substring(0, codUrl.length + 1))
   return respondChatopsdb(q, s, db);
  return respondNotFound(s);
 }
 return respond;
}

function serve(port, ssid, ip){
 var http = require("http");
 var server = http.createServer(make_respond([ssid, ip, port]));
 var domain = ip ? ip : "localhost";
 var path = "/desktop.html";
 var url = "http://" + domain + ":" + (+port) + path;
 var afterListen = console.log.bind(console, url);
 return server.listen(port, afterListen);
}

serve(
 process.argv[2],
 process.argv[3],
 process.argv[4]
);
