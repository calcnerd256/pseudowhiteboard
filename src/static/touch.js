function I(x){return x;}
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
       return Stroke.Point.fromChatStroke(token);
      }
     ).filter(I);
     points.map(
      function(x, i, a){
       return drawSegment(ctx, a[i?i-1:i], x, "#808080");
      }
     );
     return points;
    }
   );
  }
 );
}

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
Stroke.prototype.moveTo = function moveTo(nextTouch, ctx){
 var x = nextTouch.clientX;
 var y = nextTouch.clientY;
 drawSegment(
  ctx,
  new Stroke.Point(this.x, this.y, new Date(), 2),
  new Stroke.Point(x, y, new Date(), 2),
  "#8080ff"
 );
 this.addPoint(nextTouch, ctx);
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
   return drawSegment(
    that.ctx,
    a[i ? i - 1 : i],
    x,
    that.done ? that.strokeStyle : colors[i % colors.length]
   );
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
Gesture.prototype.end = function end(ctx){
 return Promise.all(
  this.strokes.map(
   function(stroke){
    return stroke.send();
   }
  )
 ).then(
  function(msgids){
   return promiseDrawRoom(ctx);
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
   activeGesture.end(ctx);
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
