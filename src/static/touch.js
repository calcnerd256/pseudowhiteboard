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
function drawLine(ctx, xs, ys, xe, ye, w){
 if(arguments.length < 6) w = 0;
 if(w < 0) w = 0;
 w += .125;
 ctx.lineWidth = w * 10;
 ctx.lineCap = "round";
 ctx.beginPath();
 ctx.moveTo(xs, ys);
 ctx.lineTo(xe, ye);
 ctx.stroke();
}
function promiseDrawRoom(ctx){
 function isStroke(line){
  var prefix = "stroke ";
  return prefix = line[1].substring(0, prefix.length);
 }
 return promiseReadChatroom().then(
  function(lines){
   return lines.filter(isStroke).map(
    function(stroke){
     var tokens = stroke[1].split(" ");
     if("stroke" != tokens.shift()) return [];
     var points = tokens.map(
      function(token){
       var pm = token.split(";").map(
        function(s){return s.split(",");}
       );
       var xy = pm[0];
       var t = pm[1][0];
       var r = 0;
       if(pm[1].length > 1) r = pm[1][1];
       return [xy[0], xy[1], t, r];
      }
     );
     points.map(
      function(x, i, a){
       var p = a[i?i-1:i];
       ctx.strokeStyle = "#808080";
       drawLine(ctx, p[0], p[1], x[0], x[1], Math.min(p[3], x[3]));
      }
     );
     return points;
    }
   );
  }
 );
}

function Stroke(index, firstTouch, ctx, strokeStyle){
 this.index = index;
 this.points = [];
 if(arguments.length >= 4)
  this.strokeStyle = strokeStyle;
 this.addPoint(firstTouch, ctx);
}
Stroke.Point = function Point(x, y, t, r){
 this.x = x;
 this.y = y;
 this.t = t;
 this.r = r;
};
Stroke.Point.fromTouch = function fromTouch(touch, ctx){
 var x = touch.clientX;
 var y = touch.clientY;
 var t = new Date();
 var r = Math.max(touch.radiusX, touch.radiusY);
 return new this(x, y, t, r);
};
Stroke.Point.prototype.toArray = function(){
 return [this.x, this.y, this.t, this.r];
};
Stroke.prototype.strokeStyle = "#000000";
Stroke.prototype.addPoint = function addPoint(touch, ctx){
 var x = touch.clientX;
 var y = touch.clientY;
 var r = Math.max(touch.radiusX, touch.radiusY);
 this.x = x;
 this.y = y;
 this.ctx = ctx;
 var p = new Stroke.Point(x, y, new Date(), r);
 this.points.push(p.toArray());
}
Stroke.prototype.done = false;
Stroke.prototype.send = function send(){
 if("msgid" in this) return Promise.resolve(this.msgid);
 this.msgid = "pending";
 var that = this;
 var msg = "stroke " +
  this.points.map(
   function(xytr){
    var xy = xytr[0] + "," + xytr[1];
    var stamp = (xytr[2] - new Date(0));
    var tr = stamp + "," + xytr[3];
    return xy + ";" + tr;
   }
  ).join(" ");
 return promiseSendMessage(msg).then(
  function(msgid){
   if(!msgid)
    delete that.msgid;
   else
    that.msgid = +msgid;
   if("msgid" in that)
    return that.msgid;
   return Promise.reject(that);
  }
 );
}
Stroke.prototype.end = function end(){
 this.done = true;
 var that = this;
 this.send().then(
  function(){
   return promiseDrawRoom(that.ctx);
  }
 );
};
Stroke.prototype.moveTo = function moveTo(nextTouch, ctx){
 var x = nextTouch.clientX;
 var y = nextTouch.clientY;
 this.ctx.strokeStyle = "#8080ff";
 drawLine(this.ctx, this.x, this.y, x, y, 2);
 this.addPoint(nextTouch, ctx);
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
   return drawLine(that.ctx, p[0], p[1], x[0], x[1], Math.min(p[3], x[3]));
  }
 );
};

function Gesture(){
 this.strokes = [];
}
Gesture.prototype.addStroke = function addStroke(stroke){
 this.strokes.push(stroke);
};
Gesture.prototype.isDone = function isDone(){
 return this.strokes.every(
  function(stroke){
   return stroke.done;
  }
 );
};
Gesture.prototype.end = function end(){
 return Promise.all(
  this.strokes.map(
   function(stroke){
    return stroke.send();
   }
  )
 ).then(
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
 var strokes = {};
 var dirty = true;
 var activeGesture = null;
 var gestures = [];
 function beginGesture(stroke){
  var gesture = new Gesture();
  activeGesture = gesture;
  gesture.addStroke(stroke);
  gestures.push(gesture);
 }
 function beginStroke(touch, ctx){
  var index = touch.identifier;
  if(index in strokes) strokes[index].end();
  var stroke = new Stroke(index, touch, ctx);
  strokes[index] = stroke;
  if(!activeGesture) beginGesture(stroke);
  else activeGesture.addStroke(stroke);
  return stroke;
 }
 function endStroke(touch, ctx){
  var stroke = strokes[touch.identifier];
  stroke.moveTo(touch, ctx);
  stroke.end();
  if(activeGesture.isDone()){
   activeGesture.end();
   activeGesture = null;
  }
  return stroke;
 }
 return Promise.resolve(canv.getContext("2d")).then(
  function(ctx){
   function animate(){
    if(!dirty)
     return promiseNextFrame().then(animate);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    [].concat.apply(
     [],
     gestures.map(
      function(gesture){
       return gesture.strokes;
      }
     )
    ).map(
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
