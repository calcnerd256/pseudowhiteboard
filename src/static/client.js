function promiseSendMessage(message){
 var payload = "message=" + message.split(" ").map(
  encodeURIComponent
 ).join("+");
 return promiseRequest("POST", "/chatopsdb", payload);
}
function promiseReadChatroom(){
 return promiseGET("/chatopsdb").then(
  function(db){
   return db.split("\n").map(
    function(line){
     var pieces = line.split(": ");
     var whowhen = pieces.shift();
     var body = pieces.join(": ");
     var usrid = whowhen.split("@")[0];
     var timestamp = whowhen.split("@")[1]
     return [+usrid, body, +timestamp];
    }
   );
  }
 );
}
function hello(){
 return promiseSendMessage("Hello.").then(
  function(msgid){
   return promiseReadChatroom().then(
    function(db){
     return db[+msgid][0];
    }
   )
  }
 ).then(
  function(usrid){
   return promiseSendMessage(
    "The time is: " + (+(new Date() - new Date(0)))
   ).then(
    function(){
     return +usrid;
    }
   );
  }
 );
}
