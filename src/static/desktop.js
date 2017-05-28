function promiseGET(path){
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
   xhr.send();
  }
 );
}
function initMobile(){
 var ssidSpan = document.getElementById("ssid");
 ssidSpan.innerHTML = "&hellip;";
 var url = document.getElementById("url");
 url.innerText = url.href;
 promiseGET("/ssid.txt").then(
  function(ssid){
   ssidSpan.innerText = ssid;
  }
 );
}
function init(){
 initMobile();
}
window.onload = init;
