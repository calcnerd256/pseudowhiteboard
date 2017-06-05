function getViewport(){
 // thanks https://github.com/ryanve/verge/blob/master/src/verge.js
 var win = null;
 var doc = null;
 var x = 0;
 var y = 0;
 if(typeof window != "undefined") win = window;
 if(typeof document != "undefined") doc = document.documentElement;
 x = Math.max(doc["clientWidth"], win["innerWidth"]);
 y = Math.max(doc["clientHeight"], win["innerHeight"]);
 return {w: x, h: y};
}
function line(ctx, xs, ys, xe, ye){
 ctx.beginPath();
 ctx.moveTo(xs, ys);
 ctx.lineTo(xe, ye);
 ctx.stroke();
}
function promiseInitCanvas(canv){
 var posn = {};
 function start(touchEvent){
  touchEvent.preventDefault;
  [].slice.call(touchEvent.changedTouches).map(
   function(touch){
    posn[touch.identifier] = [touch.screenX, touch.screenY];
   }
  );
 }
 return Promise.resolve(canv.getContext("2d")).then(
  function(ctx){
   var vp = getViewport();
   canv.width = vp.w - 16;
   canv.height = vp.h - 16;
   canv.addEventListener("touchstart", start);

   function l(te){
    te.preventDefault();
    var strs = [].slice.call(te.touches).map(
     function(t){
      var p = posn[t.identifier];
      line(ctx, p[0], p[1], t.screenX, t.screenY);
      posn[t.identifier] = [t.screenX, t.screenY];
      return "(" + t.identifier + ": " + [
       "x=" + t.screenX,
       "y=" + t.screenY
      ].join(" ") + ")";
     }
    );
   }
   canv.addEventListener("touchmove", l);
   canv.addEventListener("touchend", l);
   return ctx;
  }
 );
}
