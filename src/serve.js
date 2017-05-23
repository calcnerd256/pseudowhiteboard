// notes on this server should be in ../prose/server.html

var staticHtml = {
 "/": "./static/index.html",

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
}

function respondPlain(response, status, body){
 response.setHeader("Content-Type", "text/plain");
 response.statusCode = status;
 return response.end(body);
}

function respondNotFound(s){
 return respondPlain(s, 404, "Not Found");
}
function respondInternalFailure(s){
 return respondPlain(s, 500, "oops!");
}

function respondStatic(url, response){
 if(!(url in staticHtml)) return respondNotFound(response);
 var fs = require("fs");
 var path = staticHtml[url];
 function fileback(err, data){
  if(err){
   if(34 == err.errno)
    if("ENOENT" == err.code){
     console.log("not found:", url, "->", err.path);
     return respondNotFound(response);
    }
   console.log([err.errno, err.code]);
   return respondInternalFailure(response);
  }

  response.setHeader("Content-Type", "text/html");
  response.statusCode = 200;
  return response.end(data);
 }
 return fs.readFile(path, fileback);
}

function respond(q, s){
 var url = q.url.split("?")[0];
 if(url in staticHtml)
  return respondStatic(url, s);
 if(url == "/src/serve.js"){
  var ghu = "https://github.com/calcnerd256/pseudowhiteboard/blob/master/src/serve.js";
  s.setHeader("Location", ghu);
  return respondPlain(s, 302, "redirecting to GitHub")
 }
 return respondNotFound(s);
}

function serve(port){
 var http = require("http");
 var server = http.createServer(respond);
 var url = "http://localhost:" + (+port);
 var afterListen = console.log.bind(console, url);
 return server.listen(port, afterListen);
}

serve(8080);
