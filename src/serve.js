// notes on this server should be in ../prose/server.html

require("http").createServer(
 function(q, s){
  s.setHeader("Content-Type", "text/html");
  s.statusCode = 200;
  s.end("");
 }
).listen(
 8080,
 console.log.bind(console, "http://localhost:8080")
);
