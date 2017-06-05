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

function Stroke(index, firstTouch, ctx, strokeStyle){
 this.index = index;
 this.points = [];
 if(arguments.length >= 4)
  this.strokeStyle = strokeStyle;
 this.addPoint(firstTouch.screenX, firstTouch.screenY, ctx);
}
Stroke.prototype.strokeStyle = "#000000";
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
 this.ctx.strokeStyle = "#8080ff";
 drawLine(this.ctx, this.x, this.y, x, y);
 this.addPoint(x, y, ctx);
};
Stroke.prototype.draw = function(){
 this.ctx.strokeStyle = this.strokeStyle;
 var that = this;
 var colors = [
  "#ff0000",
  "#ff8000",
  "#ffff00",
  "#80ff00",
  "#00ff00",
  "#00ff80",
  "#00ffff",
  "#0080ff",
  "#0000ff",
  "#8000ff",
  "#ff00ff",
  "#ff0080"
 ];
 return this.points.map(
  function(x, i, a){
   if(!that.done)
    that.ctx.strokeStyle = colors[i % colors.length];
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
 function endStroke(touch, ctx){
  var stroke = strokes[touch.identifier];
  stroke.moveTo(touch, ctx);
  stroke.end();
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
    var f = Promise.resolve();
    for(var i = 0; i < 4; i++)
     f = f.then(promiseNextFrame);
    return f.then(animate);
   }
   var vp = getBrowserViewport();
   canv.width = vp.w - 16;
   canv.height = vp.h - 16;

   function consumeTouchEvent(evt){
    evt.preventDefault();
    dirty = true;
   }

   function makeStartStop(processTouch){
    return function eventHandler(touchEvent){
     consumeTouchEvent(touchEvent);
     return [].slice.call(touchEvent.changedTouches).map(
      function(touch){
       return processTouch(touch, ctx);
      }
     );
    };
   }
   function go(touchEvent){
    consumeTouchEvent(touchEvent);
    return [].slice.call(touchEvent.touches).map(
     function(touch){
      var stroke = strokes[touch.identifier];
      stroke.moveTo(touch, ctx);
      return stroke;
     }
    );
   }

   canv.addEventListener("touchstart", makeStartStop(beginStroke));
   canv.addEventListener("touchmove", go);
   canv.addEventListener("touchend", makeStartStop(endStroke));

   animate();
   return ctx;
  }
 );
}
