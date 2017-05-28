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
