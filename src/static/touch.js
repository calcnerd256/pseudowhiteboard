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
 this.ctx = this.canvas.getContext("2d");
 this.camera = new Camera(0, 0, 1, this.ctx);
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
TouchInputCanvas.prototype.getActiveCamera = function(){
 if(!this.activeGesture) return this.camera;
 var strokes = this.activeGesture.strokes;
 if(2 != strokes.length) return this.camera;
 var zp = new ZoomPan(strokes[0], strokes[1]);
 return zp.transform(this.camera);
};
TouchInputCanvas.prototype.consumeTouchEvent = function(evt){
 evt.preventDefault();
 this.dirty = true;
};
TouchInputCanvas.prototype.paint = function(roomDrawablesCache){
 this.sizeCanvas();
 var drawables = this.gestures.filter(
  function hasUnsent(gesture){
   if(!gesture.isDone()) return true;
   return gesture.strokes.some(
    function unsent(stroke){
     return !("msgid" in stroke);
    }
   );
  }
 ).concat(roomDrawablesCache);
 var activeCamera = this.getActiveCamera();
 var ctx = activeCamera.ctx;
 var canvas = ctx.canvas;
 ctx.clearRect(0, 0, canvas.width, canvas.height);
 var strokeses = drawables.map(
  function drawIt(drawable){
   return drawable.draw(activeCamera);
  }
 );
 var strokes = [].concat.apply([], strokeses);
 this.dirty = false;
};

function promiseInitCanvas(canv){
 return Promise.resolve(new TouchInputCanvas(canv)).then(
  function(toucher){
   toucher.gestureEndStream.listen(
    function(interpretation){
     function drawEm(drawables){
      var ctx = toucher.camera.ctx;
      var canvas = ctx.canvas;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var strokeses = drawables.map(
       function drawIt(drawable){
        return drawable.draw(toucher.camera);
       }
      );
      return [].concat.apply([], strokeses);
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

   var updatingRoomGestures = false;
   var roomGestures = [];
   function promiseUpdateRoomGestures(){
    if(updatingRoomGestures) return Promise.resolve();
    updatingRoomGestures = true;
    return Promise.resolve(
     toucher.drawablesFromRoom()
    ).then(
     function(drawables){
      if(drawables.length != roomGestures.length)
       toucher.dirty = true;
      roomGestures = drawables;
      updatingRoomGestures = false;
     }
    );
   }

   function animate(){
    if(!toucher.dirty)
     return promiseNextFrame().then(animate);
    toucher.paint(roomGestures);
    var f = Promise.resolve();
    for(var i = 0; i < 4; i++)
     f = f.then(promiseNextFrame);
    promiseUpdateRoomGestures();
    return f.then(animate);
   }

   toucher.sizeCanvas();

   canv.addEventListener(
    "touchstart",
    function strokeStart(touchEvent){
     toucher.consumeTouchEvent(touchEvent);
     return [].slice.call(touchEvent.changedTouches).map(
      function(touch){
       toucher.beginStroke(touch, toucher);
       return Promise.resolve(touch);
      }
     );
    }
   );
   canv.addEventListener(
    "touchmove",
    function go(touchEvent){
     toucher.consumeTouchEvent(touchEvent);
     return [].slice.call(touchEvent.touches).map(
      function(touch){
       var stroke = toucher.strokes[touch.identifier];
       stroke.moveTo(touch, toucher.camera);
       return stroke;
      }
     );
    }
   );

   canv.addEventListener(
    "touchend",
    function eventHandler(touchEvent){
     toucher.consumeTouchEvent(touchEvent);
     return [].slice.call(touchEvent.changedTouches).map(
      function(touch){
       return Promise.resolve(
        Promise.resolve(
         toucher.endStroke(touch, toucher)
        ).then(
         K(touch)
        )
       );
      }
     );
    }
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
