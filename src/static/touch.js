function promiseNextFrame(){
 return new Promise(
  function(res, rej){
   return requestAnimationFrame(res);
  }
 );
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
 chatRoom.middleware.push(lispParseMiddleware);
 chatRoom.middleware.push(StrokePoint.chatMiddleware);
 chatRoom.middleware.push(Stroke.chatMiddleware);
 chatRoom.middleware.push(Gesture.chatMiddleware);
 function promiseChatSymbolicExpressions(){
  return Promise.resolve(chatRoom).then(
   function getLines(db){
    return db.lines;
   }
  ).then(
   function flattenPromise(lines){
    return Promise.all(lines.map(Promise.resolve.bind(Promise)));
   }
  ).then(
   function onlyLispHavers(lines){
    return lines.map(chatRecordLispHavers).map(Promise.resolve.bind(Promise));
   }
  ).then(Promise.all.bind(Promise)).then(
   function onlyNonempty(lines){
    return lines.filter(function(lispHavers){return lispHavers.length;});
   }
  ).then(
   function firstPer(lines){
    return lines.map(function(lispHavers){return lispHavers[0].lisp;});
   }
  );
 }
 function promiseRoomGestures(){
  return Promise.resolve(promiseChatSymbolicExpressions()).then(
   function onlyGestures(exprs){
    return exprs.filter(
     function(expr){
      return has(expr, Gesture.prototype.typeName);
     }
    ).map(
     function(expr){
      return expr[Gesture.prototype.typeName];
     }
    );
   }
  ).then(
   function onlySome(gs){
    return gs.filter(I).filter(
     function oneStroke(g){
      return 1 == g.strokes.length;
     }
    );
   }
  );
 }
 function drawGestures(gestures, camera){
  var ctx = camera.ctx;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  return [].concat.apply(
   [],
   gestures.map(
    function(gesture){
     return gesture.draw(camera);
    }
   )
  );
 }

 var gestureEmitter = null;
 function beginGesture(stroke){
  var gesture = new Gesture();
  gestures.push(gesture);
  activeGesture = gesture;
  gestureEmitter(activeGesture);
  return gesture;
 }
 function beginStroke(touch, vehicle){
  var index = touch.identifier;
  if(index in strokes) strokes[index].end();
  var stroke = new Stroke(index, vehicle.camera);
  stroke.moveTo(touch, vehicle.camera);
  strokes[index] = stroke;
  if(!activeGesture) beginGesture(stroke);
  activeGesture.addStroke(stroke);
  return touch;
 }
 function endGesture(vehicle){
  var endingGesture = activeGesture;
  activeGesture = null;
  endingGesture.end(vehicle.camera);
  var promiseGestureMsgid = null;
  var es = endingGesture.strokes;
  var interpretation = endingGesture.interpret();
  var isZoomPan = interpretation instanceof ZoomPan;
  if(!isZoomPan)
   promiseGestureMsgid = endingGesture.promiseToLisp().then(promiseSendLisp);
  var key = Gesture.prototype.typeName;
  var cameraUpdate = vehicle.camera;
  if(isZoomPan)
   cameraUpdate = (new ZoomPan(es[0], es[1])).transform(vehicle.camera);
  return Promise.all(
   [
    cameraUpdate,
    promiseRoomGestures(),
    promiseGestureMsgid
   ].map(Promise.resolve.bind(Promise))
  ).then(
   function(args){
    vehicle.camera = args[0];
    return args[1];
   }
  ).then(
   function appendNewest(gs){
    return [].concat(gs, [endingGesture]);
   }
  ).then(
   function drawAll(gs){
    return drawGestures(gs, vehicle.camera);
   }
  );
 }
 function endStroke(touch, vehicle){
  var stroke = strokes[touch.identifier];
  stroke.moveTo(touch, vehicle.camera);
  stroke.end();
  var promiseEndGesture = null;
  if(activeGesture.isDone())
   promiseEndGesture = endGesture(vehicle);
  return Promise.resolve(promiseEndGesture).then(K(touch));
 }
 var result = {};
 result.gestureStream = new Stream(
  function(emit){
   gestureEmitter = emit;
  }
 );
 var emitForeignGestures = false;
 if(emitForeignGestures)
  chatRoom.lineEmitter.stream.listen(
   function emitFirstGesture(line){
    var lispHavers = chatRecordLispHavers(line);
    if(!!lispHavers.length) return;
    var candidates = lispHavers.map(
     function(lispHaver){
      return lispHaver.lisp;
     }
    );
    var key = Gesture.prototype.typeName;
    var gestures = candidates.filter(
     function(expr){
     return has(expr, key);
    }
    ).map(
     function(expr){
     return expr[key];
    }
    );
    if(gestures.length) return gestureEmitter(gestures[0]);
   }
  );
 result.room = chatRoom;
 function sizeCanvas(){
  var vp = getBrowserViewport();
  canv.width = vp.vw - 16;
  canv.height = vp.vh - 16 - 32;
  return vp;
 }
 return Promise.resolve(canv.getContext("2d")).then(
  function(ctx){
   result.ctx = ctx;
   result.camera = new Camera(0, 0, 1, ctx);
   function getActiveCamera(){
    if(!activeGesture) return result.camera;
    var strokes = activeGesture.strokes;
    if(2 != strokes.length) return result.camera;
    var zp = new ZoomPan(strokes[0], strokes[1]);
    return zp.transform(result.camera);
   }
   var roomGestures = [];
   var updatingRoomGestures = false;
   function animate(){
    if(!dirty)
     return promiseNextFrame().then(animate);
    sizeCanvas(canv);
    var gs = gestures.filter(
     function unsent(gesture){
      return !("msgid" in gesture);
     }
    ).concat(
     roomGestures
    );
    drawGestures(gs, getActiveCamera());
    dirty = false;
    var f = Promise.resolve();
    for(var i = 0; i < 4; i++)
     f = f.then(promiseNextFrame);
    if(!updatingRoomGestures){
     updatingRoomGestures = true;
     promiseRoomGestures().then(
      function(gs){
       if(gs.length != roomGestures.length)
        dirty = true;
       roomGestures = gs;
       updatingRoomGestures = false;
      }
     );
    }
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
       return Promise.resolve(processTouch(touch, result));
      }
     );
    };
   }
   function go(touchEvent){
    consumeTouchEvent(touchEvent);
    return [].slice.call(touchEvent.touches).map(
     function(touch){
      var stroke = strokes[touch.identifier];
      stroke.moveTo(touch, result.camera);
      return stroke;
     }
    );
   }

   canv.addEventListener("touchstart", makeStartStop(beginStroke));
   canv.addEventListener("touchmove", go);
   canv.addEventListener("touchend", makeStartStop(endStroke));

   chatRoom.run(1000);
   chatRoom.lineEmitter.stream.listen(function(){dirty = true;});
   dirty = true;
   animate();
   return result;
  }
 );
}
