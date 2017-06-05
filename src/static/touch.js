function getBrowserViewport(){
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
function drawLine(ctx, xs, ys, xe, ye){
 ctx.beginPath();
 ctx.moveTo(xs, ys);
 ctx.lineTo(xe, ye);
 ctx.stroke();
}

function Stroke(index, firstTouch, ctx){
 this.index = index;
 this.points = [];
 this.addPoint(firstTouch.screenX, firstTouch.screenY, ctx);
}
Stroke.prototype.addPoint = function addPoint(x, y, ctx){
 this.x = x;
 this.y = y;
 this.ctx = ctx;
 this.points.push([x, y]);
}
Stroke.prototype.done = false;
Stroke.prototype.end = function end(){
 this.done = true;
};
Stroke.prototype.moveTo = function moveTo(nextTouch, ctx){
 var x = nextTouch.screenX;
 var y = nextTouch.screenY;
 drawLine(this.ctx, this.x, this.y, x, y);
 this.addPoint(x, y, ctx);
};

function promiseInitCanvas(canv){
 var strokeQueue = [];
 var strokes = {};
 function beginStroke(touch, ctx){
  var index = touch.identifier;
  if(index in strokes) strokes[index].end();
  var stroke = new Stroke(index, touch, ctx);
  strokes[index] = stroke;
  strokeQueue.push(stroke);
  return stroke;
 }
 return Promise.resolve(canv.getContext("2d")).then(
  function(ctx){
   var vp = getBrowserViewport();
   canv.width = vp.w - 16;
   canv.height = vp.h - 16;

   function start(touchEvent){
    [].slice.call(touchEvent.changedTouches).map(
     function(touch){
      var stroke = beginStroke(touch, ctx);
      touchEvent.preventDefault;
     }
    );
   }
   canv.addEventListener("touchstart", start);

   function route(te){
    te.preventDefault();
    [].slice.call(te.touches).map(
     function(t){
      strokes[t.identifier].moveTo(t, ctx);
     }
    );
   }
   canv.addEventListener("touchmove", route);
   canv.addEventListener("touchend", route);
   return ctx;
  }
 );
}
