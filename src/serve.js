// notes on this server should be in ../prose/server.html

var staticHtml = {
 "/": "./static/index.html"
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
   console.log(err);
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
