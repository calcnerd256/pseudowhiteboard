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

function promiseDrawRoom(cam, clearFirst, room){
 if(3 > arguments.length) room = promiseReadChatroom();
 return Promise.resolve(room).then(
  function(db){
   if(db instanceof ChatDb) db = db.getLegacyLines();
   return allKeptPromises(
    db.map(
     function(line){
      return Gesture.promiseFromChat(line, db);
     }
    )
   );
  }
 ).then(
  function(gestures){
   if(clearFirst)
    cam.ctx.clearRect(
     0,
     0,
     cam.ctx.canvas.width,
     cam.ctx.canvas.height
    );
   return gestures.filter(I).filter(
    function(gesture){
     return 1 == gesture.strokes.length;
    }
   ).map(
    function(gesture){
     return gesture.draw(cam);
    }
   );
  }
 );
}

function ZoomPan(thumb, finger){
 this.thumb = thumb;
 this.finger = finger;
}
ZoomPan.prototype.endpoints = function endpoints(){
 var tps = this.thumb.points;
 if(!tps.length) return [];
 var fps = this.finger.points;
 if(!fps.length) return [];
 if(tps.length < 2)
  if(fps.length < 2)
   return [];
 return [tps[0], fps[0], tps[tps.length - 1], fps[fps.length - 1]];
};
ZoomPan.prototype.transformators = function(){
 var endpoints = this.endpoints();
 if(4 != endpoints.length) return [];
 var ta = endpoints[0];
 var tb = endpoints[2];
 var fa = endpoints[1];
 var fb = endpoints[3];
 var max = (ta.x + fa.x) / 2;
 var may = (ta.y + fa.y) / 2;
 var mbx = (tb.x + fb.x) / 2;
 var mby = (tb.y + fb.y) / 2;
 var dx = mbx - max;
 var dy = mby - may;
 var dxa = fa.x - ta.x;
 var dya = fa.y - ta.y;
 var dxb = fb.x - tb.x;
 var dyb = fb.y - tb.y;
 var ra = dxa * dxa + dya * dya;
 var rb = dxb * dxb + dyb * dyb;
 if(!ra) ra = rb;
 return [dx, dy, Math.sqrt(rb / ra)];
};
ZoomPan.prototype.draw = function draw(cam){};
ZoomPan.prototype.transform = function(camera){
 var transformers = this.transformators();
 if(3 != transformers.length) return camera;
 var dx = transformers[0];
 var dy = transformers[1];
 var rho = transformers[2];
 return camera.zoomPan(dx, dy, rho);
};

function Gesture(){
 this.strokes = [];
 var resolve = null;
 this.promise = new Promise(
  function(res, rej){
   resolve = res;
  }
 );
 this.end = function end(cam, room){
  resolve(this);
  return this.endDraw(cam, room);
 }
}
Gesture.prototype.isZoomPan = function isZoomPan(){
 return 2 == this.strokes.length;
};
Gesture.prototype.toZoomPan = function toZoomPan(){
 return new ZoomPan(this.strokes[0], this.strokes[1]);
};
Gesture.prototype.updateCamera = function updateCamera(cam){
 if(!this.isZoomPan()) return cam;
 return this.toZoomPan().transform(cam);
};
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
 var assertion = new AssertEqual("(gesture", tokens.shift());
 if(!assertion.satisfiedp()) return Promise.reject(assertion);
 var result = new this();
 return Promise.all(
  tokens.map(
   function(token){
    return promiseDerefChat(
     token.split(")")[0],
     room
    ).then(
     function(line){
      return Promise.resolve(chatBodyToLisp(line[1], room)).then(
       Stroke.promiseFromLispPromise.bind(Stroke)
      );
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

Gesture.prototype.send = function send(){
 if("msgid" in this)
  return Promise.resolve(this.msgid);
 var that = this;
 this.msgid = this.toPromiseChat().then(
  promiseSendMessage
 ).then(
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
 return this.msgid;
};
Gesture.prototype.draw = function draw(cam){
 if(!this.isDone())
  return this.strokes.map(
   function(stroke){
    return stroke.draw(cam);
   }
  );
 if(1 == this.strokes.length)
  return [this.strokes[0].draw(cam)];
 if(2 < this.strokes.length) // TODO: remove this case
  return this.strokes.map(
   function(stroke){
    return stroke.draw(cam);
   }
  );
};
Gesture.prototype.endDraw = function endDraw(cam, room){
 return Promise.all(
  [
   this.updateCamera(cam),
   this.isZoomPan() ? null : this.send()
  ].map(Promise.resolve.bind(Promise))
 ).then(
  function(args){
   return args[0];
  }
 ).then(
  function(c){
   return promiseDrawRoom(c, true, room).then(K(c));
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
 return {
  w: x,
  h: y,
  vw: window.innerWidth,
  vh: window.innerHeight
 };
}
function promiseInitCanvas(canv){
 var strokes = {};
 var dirty = true;
 var activeGesture = null;
 var gestures = [];
 var chatRoom = new ChatDb();
 var gestureEmitter = null;
 function beginGesture(stroke){
  var gesture = new Gesture();
  gestures.push(gesture);
  activeGesture = gesture;
  gestureEmitter(activeGesture);
  return gesture;
 }
 function beginStroke(touch, cam){
  var index = touch.identifier;
  if(index in strokes) strokes[index].end();
  var stroke = new Stroke(index, cam);
  stroke.moveTo(touch, cam);
  strokes[index] = stroke;
  if(!activeGesture) beginGesture(stroke);
  activeGesture.addStroke(stroke);
  return cam;
 }
 function endStroke(touch, cam){
  var stroke = strokes[touch.identifier];
  stroke.moveTo(touch, cam);
  stroke.end();
  if(activeGesture.isDone()){
   cam = activeGesture.end(cam, chatRoom);
   activeGesture = null;
  }
  return cam;
 }
 var result = {};
 result.gestureStream = new Stream(
  function(emit){
   gestureEmitter = emit;
  }
 );
 result.room = chatRoom;
 return Promise.resolve(canv.getContext("2d")).then(
  function(ctx){
   result.ctx = ctx;
   var camera = new Camera(0, 0, 1, ctx);
   result.camera = camera;
   function getActiveCamera(){
    if(!activeGesture) return camera;
    var strokes = activeGesture.strokes;
    if(2 != strokes.length) return camera;
    var zp = new ZoomPan(strokes[0], strokes[1]);
    return zp.transform(camera);
   }
   function drawGestures(){
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    var cam = getActiveCamera();
    return [].concat.apply(
     [],
     gestures.filter(
      function(gesture){
return true; // TODO: remove
       return !("msgid" in gesture);
      }
     ).concat(
      [] // TODO: get strokes from room cache
     ).map(
      function(gesture){
       return gesture.draw(cam);
      }
     )
    );
   }
   function sizeCanvas(){
    var vp = getBrowserViewport();
    canv.width = vp.vw - 16;
    canv.height = vp.vh - 16 - 32;
    return vp;
   }
   function animate(){
    if(!dirty)
     return promiseNextFrame().then(animate);
    sizeCanvas();
    drawGestures();
    dirty = false;
    var f = Promise.resolve();
    for(var i = 0; i < 4; i++)
     f = f.then(promiseNextFrame);
    return f.then(animate);
   }
   sizeCanvas();

   function consumeTouchEvent(evt){
    evt.preventDefault();
    dirty = true;
   }

   function makeStartStop(processTouch){
    return function eventHandler(touchEvent){
     consumeTouchEvent(touchEvent);
     return [].slice.call(touchEvent.changedTouches).map(
      function(touch){
       return Promise.resolve(
        processTouch(touch, camera)
       ).then(
        function(cam){
         camera = cam;
         result.camera = cam;
         return touch;
        }
       );
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

   chatRoom.run(1000);
   animate();
   return result;
  }
 );
}
