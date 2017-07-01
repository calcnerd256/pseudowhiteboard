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
 function endStroke(touch, vehicle){
  var stroke = strokes[touch.identifier];
  stroke.moveTo(touch, vehicle.camera);
  stroke.end();
  if(activeGesture.isDone()){
   activeGesture.end(vehicle.camera);
   var endingGesture = activeGesture;
   var result = Promise.resolve(
    Promise.all(
     [
      activeGesture.updateCamera(vehicle.camera),
      activeGesture.isZoomPan() ?
       null :
       Promise.resolve(
        activeGesture.promiseToLisp()
       ).then(
        promiseSendLisp
       )
     ].map(
      Promise.resolve.bind(Promise)
     )
    ).then(
     function(args){
      var cam = args[0];
      var gid = args[1];
      var symbolicExpressions = chatRoom.lines.map(chatRecordLispHavers).filter(
       function(lispHavers){return lispHavers.length;}
      ).map(function(nabtl){return nabtl[0].lisp;});;
      var gestures = symbolicExpressions.filter(
       function(expr){return has(expr, "gesture");}
      ).map(
       function(ge){return ge.gesture}
      );
      return Promise.all(
       gestures.map(Promise.resolve.bind(Promise))
      ).then(
       function(gs){
        return [].concat(gs, [endingGesture]);
       }
      ).then(
       function(gestures){
        var canv = cam.ctx.canvas;
        cam.ctx.clearRect(0, 0, canv.width, canv.height);
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
      ).then(K(cam));
     }
    )
   ).then(
    function(cam){
     vehicle.camera = cam;
    }
   ).then(K(touch));
   activeGesture = null;
   return result;
  }
  return touch;
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
   result.camera = new Camera(0, 0, 1, ctx);
   function getActiveCamera(){
    if(!activeGesture) return result.camera;
    var strokes = activeGesture.strokes;
    if(2 != strokes.length) return result.camera;
    var zp = new ZoomPan(strokes[0], strokes[1]);
    return zp.transform(result.camera);
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

   chatRoom.middleware.push(lispParseMiddleware);
   chatRoom.middleware.push(StrokePoint.chatMiddleware);
   chatRoom.middleware.push(Stroke.chatMiddleware);
   chatRoom.middleware.push(Gesture.chatMiddleware);

   chatRoom.run(1000);
   animate();
   return result;
  }
 );
}
