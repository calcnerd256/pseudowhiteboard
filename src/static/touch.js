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
  vh: window.innerHeight - 16
 };
}

function TouchInputCanvas(canvas){
 this.canvas = canvas;
 this.strokes = {};
 this.dirty = true;
 this.activeGesture = null;
 this.gestures = [];
 this.room = new ChatDb();
 this.room.middleware.push(lispParseMiddleware);
 this.room.middleware.push(StrokePoint.chatMiddleware);
 this.room.middleware.push(Stroke.chatMiddleware);
 this.room.middleware.push(Gesture.chatMiddleware);
 var that = this;
 this.gestureBeginStream = new Stream(
  function emitFromMethod(emitGestureBegin){
   that.beginGesture = function(stroke){
    this.activeGesture = new Gesture();
    this.gestures.push(this.activeGesture);
    emitGestureBegin(this.activeGesture);
   };
  }
 );
 this.gestureStream = this.gestureBeginStream;
 this.gestureRoomStream = new Stream(
  function emitFromLines(emitRoomGesture){
   that.room.lineEmitter.stream.listen(
    function emitFirstGesture(line){
     var lispHavers = chatRecordLispHavers(line);
     if(!!lispHavers.length) return;
     var key = Gesture.prototype.typeName;
     var gestures = lispHavers.map(
      function getLisp(lispHaver){
       return lispHaver.lisp;
      }
     ).filter(
      function hasKey(expr){
       return has(expr, key);
      }
     ).map(
      function getKey(expr){
       return expr[key];
      }
     );
     if(gestures.length)
      return emitRoomGesture(gestures[0].interpret());
    }
   );
  }
 );
 this.emitForeignGestures = false;
 this.gestureEndStream = new Stream(
  function twoSources(emitGestureEnd){
   that.gestureBeginStream.listen(
    function emitFromPromisedEnd(gesture){
     return gesture.promise.then(emitGestureEnd);
    }
   );
   that.gestureRoomStream.listen(
    function emitIfEnabled(interp){
     if(that.emitForeignGestures)
      emitGestureEnd(interp);
    }
   );
  }
 );
}
TouchInputCanvas.prototype.symbolicExpressionsFromRoom = function(){
 return Promise.resolve(this.room).then(
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
 ).then(
  Promise.all.bind(Promise)
 ).then(
  function onlyNonempty(lines){
   return lines.filter(
    function hasSome(lispHavers){
     return lispHavers.length;
    }
   );
  }
 ).then(
  function firstPer(lines){
   return lines.map(
    function firstSymbolicExpression(lispHavers){
     return lispHavers[0].lisp;
    }
   );
  }
 );
};
TouchInputCanvas.prototype.hydratedValuesFromRoom = function(){
 return Promise.resolve(
  this.symbolicExpressionsFromRoom()
 ).then(
  function onlyTypeHavers(exprs){
   return exprs.filter(
    function hasLine(expr){
     return has(expr, "line");
    }
   ).map(
    function getLine(expr){
     return expr.line;
    }
   ).filter(
    function hasTypeName(line){
     return has(line, "typeName");
    }
   ).filter(
    function hasKey(line){
     return line.typeName in line;
    }
   ).map(
    function(line){
     return line[line.typeName];
    }
   );
  }
 );
};
TouchInputCanvas.prototype.drawablesFromRoom = function(){
 return Promise.resolve(
  this.hydratedValuesFromRoom()
 ).then(
  function onlyDrawHavers(hydrates){
   return hydrates.filter(
    function hasDraw(ob){
     return has(ob, "draw");
    }
   );
  }
 );
};
TouchInputCanvas.prototype.gesturesFromRoom = function(){
 return Promise.resolve(
  this.symbolicExpressionsFromRoom()
 ).then(
  function onlyGestures(exprs){
   var key = Gesture.prototype.typeName;
   return exprs.filter(
    function hasKey(expr){
     return has(expr, key);
    }
   ).map(
    function getGesture(expr){
     return expr[key];
    }
   );
  }
 ).then(
  function onlySome(gs){
   return gs.filter(I).filter(
    function monostrophicp(g){
     return 1 == g.strokes.length;
    }
   );
  }
 );
};
TouchInputCanvas.prototype.beginStroke = function(touch, vehicle){
 var index = touch.identifier;
 if(index in this.strokes) this.strokes[index].end();
 var stroke = new Stroke(index, vehicle.camera);
 stroke.moveTo(touch, vehicle.camera);
 this.strokes[index] = stroke;
 if(!this.activeGesture) this.beginGesture(stroke);
 return this.activeGesture.addStroke(stroke);
};
TouchInputCanvas.prototype.endGesture = function(vehicle){
 var endingGesture = this.activeGesture;
 this.activeGesture = null;
 return endingGesture.end(vehicle.camera);
};
TouchInputCanvas.prototype.endStroke = function(touch, vehicle){
 var stroke = this.strokes[touch.identifier];
 stroke.moveTo(touch, vehicle.camera);
 stroke.end();
 if(this.activeGesture.isDone())
  return this.endGesture(vehicle);
};
TouchInputCanvas.prototype.sizeCanvas = function(){
 var vp = getBrowserViewport();
 this.canvas.width = vp.vw - 16;
 this.canvas.height = vp.vh - 16;
 return vp;
};

function promiseInitCanvas(canv){
 return Promise.resolve(new TouchInputCanvas(canv)).then(
  function(toucher){
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
   toucher.gestureEndStream.listen(
    function(interpretation){
     function drawEm(ds){
      drawGestures(ds, toucher.camera);
     }
     if(interpretation instanceof ZoomPan)
      return Promise.resolve(
       interpretation.transform(toucher.camera)
      ).then(
       function(cam){
        toucher.camera = cam;
       }
      ).then(
       function(){
        return toucher.drawablesFromRoom();
       }
      ).then(drawEm);
     else
      return interpretation.promiseToLisp().then(promiseSendLisp).then(
       function getDrawables(){
        return toucher.drawablesFromRoom();
       }
      ).then(
       function appendNewest(ds){
       return [].concat(ds, [interpretation]);
      }
      ).then(drawEm);
    }
   );

   var ctx = toucher.canvas.getContext("2d");
   toucher.ctx = ctx;
   toucher.camera = new Camera(0, 0, 1, ctx);
   function getActiveCamera(){
    if(!toucher.activeGesture) return toucher.camera;
    var strokes = toucher.activeGesture.strokes;
    if(2 != strokes.length) return toucher.camera;
    var zp = new ZoomPan(strokes[0], strokes[1]);
    return zp.transform(toucher.camera);
   }
   var roomGestures = [];
   var updatingRoomGestures = false;
   function animate(){
    if(!toucher.dirty)
     return promiseNextFrame().then(animate);
    toucher.sizeCanvas();
    var gs = toucher.gestures.filter(
     function unsent(gesture){
      return !("msgid" in gesture);
     }
    ).concat(
     roomGestures
    );
    drawGestures(gs, getActiveCamera());
    toucher.dirty = false;
    var f = Promise.resolve();
    for(var i = 0; i < 4; i++)
     f = f.then(promiseNextFrame);
    if(!updatingRoomGestures){
     updatingRoomGestures = true;
     toucher.drawablesFromRoom().then(
      function(gs){
       if(gs.length != roomGestures.length)
        toucher.dirty = true;
       roomGestures = gs;
       updatingRoomGestures = false;
      }
     );
    }
    return f.then(animate);
   }
   toucher.sizeCanvas();

   function consumeTouchEvent(evt){
    evt.preventDefault();
    toucher.dirty = true;
   }

   function makeStartStop(processTouch){
    return function eventHandler(touchEvent){
     consumeTouchEvent(touchEvent);
     return [].slice.call(touchEvent.changedTouches).map(
      function(touch){
       return Promise.resolve(processTouch(touch, toucher));
      }
     );
    };
   }
   function go(touchEvent){
    consumeTouchEvent(touchEvent);
    return [].slice.call(touchEvent.touches).map(
     function(touch){
      var stroke = toucher.strokes[touch.identifier];
      stroke.moveTo(touch, toucher.camera);
      return stroke;
     }
    );
   }

   canv.addEventListener(
    "touchstart",
    makeStartStop(
     function beginStroke(touch, vehicle){
      toucher.beginStroke(touch, vehicle);
      return touch;
     }
    )
   );
   canv.addEventListener("touchmove", go);
   canv.addEventListener(
    "touchend",
    makeStartStop(
     function(touch, vehicle){
      return Promise.resolve(
       toucher.endStroke(touch, vehicle)
      ).then(
       K(touch)
      );
     }
    )
   );

   toucher.room.run(1000);
   toucher.room.lineEmitter.stream.listen(
    function(){toucher.dirty = true;}
   );
   toucher.dirty = true;
   animate();
   return toucher;
  }
 );
}
