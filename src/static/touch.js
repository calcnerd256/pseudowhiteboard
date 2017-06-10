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

Stroke.prototype.toString = function(){
 return "stroke " + this.index;
};
Stroke.Point.prototype.toString = function(){
 return "<" + [this.x, this.y].join(", ") + ">(" + this.r + ")@" + this.t;
};

Stroke.Point.fromChatStroke = function fromChatStroke(token){
 var pm = token.split(";").map(
  function(s){return s.split(",");}
 );
 if(1 == pm.length) return null;
 var xy = pm[0];
 var tr = pm[1];
 var t = tr[0];
 var r = 0;
 if(tr.length > 1) r = tr[1];
 return new this(
  +(xy[0]),
  +(xy[1]),
  new Date(+t),
  +r
 );
}
Stroke.Point.prototype.toChatStroke = function toChatStroke(){
 return [
  [this.x, this.y],
  [
   this.t - new Date(0),
   this.r
  ]
 ].map(
  function(halves){
   return halves.join(",");
  }
 ).join(";");
}

function drawSegment(ctx, p, q, style){
 if(arguments.length >= 4)
  ctx.strokeStyle = style;
 var w = Math.min(p.r, q.r);
 if(w < 0) w = 0;
 w += .125;
 ctx.lineWidth = w * 10;
 ctx.lineCap = "round";
 ctx.beginPath();
 ctx.moveTo(p.x, p.y);
 ctx.lineTo(q.x, q.y);
 ctx.stroke();
}


Stroke.prototype.done = false;
Stroke.prototype.send = function send(){
 if("msgid" in this) return Promise.resolve(this.msgid);
 this.msgid = "pending";
 var that = this;
 var msg = "stroke " +
  this.points.map(
   function(p){
    return p.toChatStroke();
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
 return this.send();
};
Stroke.prototype.draw = function(){
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
   var color = that.done ? that.strokeStyle : colors[i % colors.length];
   return that.camera.drawSegment(a[i?i-1:i],x,color);
  }
 );
};

function Place(x, y, scale, ctx){
 this.x = x;
 this.y = y;
 this.scale = scale;
 this.ctx = ctx;
}
Place.prototype.touchToPoint = function touchToPoint(touch){
 var canv = this.ctx.canvas;
 var w = canv.width;
 var h = canv.height;
 var s = w;
 if(h < s) s = h;
 var canvRect = canv.getBoundingClientRect();
 var l = touch.clientX - (canvRect.left + canv.clientLeft);
 var t = touch.clientY - (canvRect.top + canv.clientTop);
 var x = l - w / 2;
 var y = h / 2 - t;
 var r = Math.max(touch.radiusX, touch.radiusY, .125);
 return new Stroke.Point(
  this.x + x * this.scale / s,
  this.y + y * this.scale / s,
  new Date(),
  r * this.scale
 );
};
Place.prototype.drawSegment = function drawSegment(p, q, style, r){
 if(arguments.length >= 3) this.ctx.strokeStyle = style;
 if(arguments.length < 4)
  r = Math.min(p.r, q.r);
 var w = this.ctx.canvas.width;
 var h = this.ctx.canvas.height;
 var s = w;
 if(h < s) s = h;
 r *= 10 / this.scale;
 if(r < 0) r = 0;
 if(r < .125) return;
 this.ctx.lineWidth = r;
 this.ctx.lineCap = "round";
 this.ctx.beginPath();
 var that = this;
 function f(a, z, c){
  return (a - z) * s /  that.scale + c / 2;
 }
 this.ctx.moveTo(f(p.x, this.x, w), h - f(p.y, this.y, h));
 this.ctx.lineTo(f(q.x, this.x, w), h - f(q.y, this.y, h));
 if(r > 1)
  this.ctx.globalAlpha = 1/r;
 this.ctx.stroke();
 this.ctx.globalAlpha = 1;
};
Place.prototype.toString = function toString(){
 return "<" + [this.x, this.y].join(", ") + ">*" + this.scale;
}

function I(x){return x;}
function promiseDrawRoom(cam){
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
       return Stroke.Point.fromChatStroke(token);
      }
     ).filter(I);
     points.map(
      function(x, i, a){
       return cam.drawSegment(a[i?i-1:i], x, "#808080");
      }
     );
     return points;
    }
   );
  }
 );
}

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
Gesture.prototype.end = function end(cam){
 return Promise.all(
  this.strokes.map(
   function(stroke){
    return stroke.send();
   }
  )
 ).then(
  function(msgids){
   return promiseDrawRoom(cam);
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
 function beginStroke(touch, cam){
  var index = touch.identifier;
  if(index in strokes) strokes[index].end();
  var stroke = new Stroke(index, touch, cam);
  strokes[index] = stroke;
  if(!activeGesture) beginGesture(stroke);
  else activeGesture.addStroke(stroke);
  return stroke;
 }
 function endStroke(touch, cam){
  var stroke = strokes[touch.identifier];
  stroke.moveTo(touch, cam);
  stroke.end();
  if(activeGesture.isDone()){
   activeGesture.end(cam);
   activeGesture = null;
  }
  return stroke;
 }
 return Promise.resolve(canv.getContext("2d")).then(
  function(ctx){
   var camera = new Place(0, 0, 1, ctx);
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
       return processTouch(touch, camera);
      }
     );
    };
   }
   function go(touchEvent){
    consumeTouchEvent(touchEvent);
    return [].slice.call(touchEvent.touches).map(
     function(touch){
      var stroke = strokes[touch.identifier];
      stroke.moveTo(touch, camera);
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
