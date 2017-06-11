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

function K(x){
 return function konstant(){
  return x;
 };
}
function allKeptPromises(proms){
 return Promise.all(
  proms.map(
   Promise.resolve.bind(Promise)
  ).map(
   function(p){
    return p.then(
     function(x){return [x];},
     K(false)
    );
   }
  )
 ).then(
  function(xs){
   return xs.filter(I).map(
    function(x){return x[0];}
   );
  }
 );
}

function promiseDrawRoom(cam){
 return promiseReadChatroom().then(
  function(lines){
   return allKeptPromises(
    lines.map(
     function(line){
      return Gesture.promiseFromChat(line, lines);
     }
    )
   )
  }
 ).then(
  function(gestures){
   return gestures.filter(I).map(
    function(gesture){
     return gesture.draw(cam);
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
Gesture.promiseFromChat = function promiseFromChat(line, room){
 if(arguments.length < 2) room = promiseReadChatroom();
 var author = line[0];
 var body = line[1];
 var tokens = body.split(" ").filter(I);
 var assertion = {
  expected: "(gesture",
  found: tokens.shift()
 };
 if(assertion.expected != assertion.found)
  return Promise.reject(assertion);
 var result = new this();
 return Promise.all(
  tokens.map(
   function(token){
    return promiseDerefChat(
     token.split(")")[0],
     room
    ).then(
     function(line){
      return Stroke.promiseFromChat(line, room);
     }
    );
   }
  )
 ).then(
  function(xs){
   return xs.filter(I);
  }
 ).then(
  function(strokes){
   result.strokes = strokes;
   return result;
  }
 );
};
Gesture.prototype.toPromiseChat = function toPromiseChat(){
 return Promise.all(
  this.strokes.map(
   function(stroke){
    if("msgid" in stroke)
     return Promise.resolve(stroke.msgid);
    return stroke.send();
   }
  )
 ).then(
  function(stids){
   var tokens = [].concat(
    [
     "gesture"
    ],
    stids.map(
     function(strokeId){
      return "@" + (+strokeId);
     }
    )
   );
   return "(" + tokens.join(" ") + ")";
  }
 );
};
Gesture.prototype.send = Stroke.prototype.send;
Gesture.prototype.end = function end(cam){
 return this.send().then(
  function(msgid){
   return promiseDrawRoom(cam);
  }
 );
};
Gesture.prototype.draw = function draw(cam){
 return this.strokes.map(
  function(stroke){
   return stroke.draw(cam);
  }
 );
};

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
  var stroke = new Stroke(index, cam);
  stroke.moveTo(touch, cam);
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
       return gesture.draw(camera);
      }
     )
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
