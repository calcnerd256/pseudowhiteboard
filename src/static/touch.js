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
Stroke.prototype.draw = function(){
 this.ctx.strokeStyle = "#0000ff";
 if(!this.done)
  this.ctx.strokeStyle = "#ff0000";
 var that = this;
 return this.points.map(
  function(x, i, a){
   var p = a[i?i-1:i];
   return drawLine(that.ctx, p[0], p[1], x[0], x[1]);
  }
 );
}

function promiseNextFrame(){
 return new Promise(
  function(res, rej){
   return requestAnimationFrame(res);
  }
 );
}

function promiseInitCanvas(canv){
 var strokeQueue = [];
 var strokes = {};
 var dirty = true;
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
   function animate(){
    if(!dirty)
     return promiseNextFrame().then(animate);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    strokeQueue.map(
     function(stroke, i){
      stroke.draw();
     }
    );
    dirty = false;
    return promiseNextFrame().then(animate);
   }
   var vp = getBrowserViewport();
   canv.width = vp.w - 16;
   canv.height = vp.h - 16;

   function consumeTouchEvent(evt){
    evt.preventDefault();
    dirty = true;
   }

   function start(touchEvent){
    consumeTouchEvent(touchEvent);
    return [].slice.call(touchEvent.changedTouches).map(
     function(touch){
      return beginStroke(touch, ctx);
     }
    );
   }
   canv.addEventListener("touchstart", start);

   function go(te){
    consumeTouchEvent(te);
    return [].slice.call(te.touches).map(
     function(t){
      var stroke = strokes[t.identifier];
      stroke.moveTo(t, ctx);
      return stroke;
     }
    );
   }
   canv.addEventListener("touchmove", go);

   function stop(touchEvent){
    consumeTouchEvent(touchEvent);
    return [].slice.call(touchEvent.changedTouches).map(
     function(touch, i, a){
      var stroke = strokes[touch.identifier];
      stroke.moveTo(touch, ctx);
      stroke.end();
      return stroke;
     }
    );
   }
   canv.addEventListener("touchend", stop);

   animate();
   return ctx;
  }
 );
}
