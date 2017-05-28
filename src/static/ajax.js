function promiseRequest(method, path, data){
 return new Promise(
  function(resolve, reject){
   var xhr = new XMLHttpRequest();
   xhr.open("GET", path, true);
   xhr.onreadystatechange = function(){
    if(xhr.readyState == XMLHttpRequest.DONE)
     if(200 == xhr.status)
      return resolve(xhr.responseText);
    // TODO: handle failure
   };
   xhr.send(data);
  }
 );
}
function promiseGET(path){
 return promiseRequest("GET", path);
}
