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
 "/desktop.js": ["application/javascript", "./static/desktop.js"],
 "/ajax.js": ["application/javascript", "./static/ajax.js"]
};

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

function make_respond(sip){
 var strings = {
  "/ssid.txt": sip[0],
  "/url.txt": "http://" + sip[1] + ":" + (+(sip[2])) + "/"
 };
 function respond(q, s){
  var url = q.url.split("?")[0];
  if(url in staticHtml)
   return respondStaticHtml(url, s);
  if(url in staticFiles)
   return respondStatic(url, s);
  if(url == "/src/serve.js")
   return redirectToGithub(s);
  if(url in strings)
   return respondPlain(s, 200, strings[url]);
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
