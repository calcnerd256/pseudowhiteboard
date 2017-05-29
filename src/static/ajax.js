function promiseRequest(method, path, data){
 return new Promise(
  function(resolve, reject){
   var xhr = new XMLHttpRequest();
   xhr.open(method, path, true);
   xhr.onreadystatechange = function(){
    if(XMLHttpRequest.HEADERS_RECEIVED == xhr.readyState)
     return;
    if(xhr.readyState == XMLHttpRequest.DONE){
     if(200 == xhr.status)
      return resolve(xhr.responseText);
     // TODO: handle failure better than this
     return reject(xhr.responseText);
    }
   };
   xhr.send(data);
  }
 );
}
function promiseGET(path){
 return promiseRequest("GET", path);
}
