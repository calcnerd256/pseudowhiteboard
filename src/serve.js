// notes on this server should be in ../prose/server.html

var staticHtml = {
 "/": "./static/index.html"
}

function respond(q, s){
 var url = q.url.split("?")[0];
 if(url in staticHtml){
  s.setHeader("Content-Type", "text/html");
  return require("fs").readFile(
   staticHtml[url],
   function(err, data){
    if(err){
     console.log(err);
     s.setHeader("Content-Type", "text/plain");
     s.statusCode = 500;
     return s.end("oops!")
    }
    s.setHeader("Content-Type", "text/html");
    s.statusCode = 200;
    s.end(data);
   }
  );
 }
 s.setHeader("Content-Type", "text/plain");
 s.statusCode = 404;
 s.end("Not Found");
}

function serve(port){
 return require("http").createServer(respond).listen(
  port,
  console.log.bind(console, "http://localhost:" + (+port))
 );
}

serve(8080);
