function Gesture(){
 this.strokes = [];
 var resolve = null;
 this.promise = new Promise(
  function(res, rej){
   resolve = res;
  }
 );
 this.end = function end(cam){
  resolve(this.interpret());
 }
}
Gesture.prototype.middleware = [];
Gesture.prototype.typeName = "gesture";
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
Gesture.prototype.interpret = function interpret(){
 var mw = this.middleware;
 var result = this;
 mw.map(
  function(p){
   var pred = p[0];
   var transform = p[1];
   var match = pred.call(result);
   if(match)
    result = transform.call(result);
  }
 );
 return result;
};
Gesture.prototype.toString = function(){
 var s = this.strokes;
 var l = s.length;
 if(!this.isDone()) return "(incomplete gesture " + l + ")";
 var interpretation = this.interpret();
 if(this != interpretation)
  return "(gesture.interpret " + (""+interpretation) + ")";
 return "(gesture.strokes " + l + ")";
}

Gesture.promiseFromLispPromise = function promiseFromLispPromise(sp){
 var key = this.prototype.typeName;
 function checkCar(expr){
  return lispCar(expr).then(
   function(oper){
    return new AssertEqual(key, oper).resolve();
   }
  ).then(K(expr));
 }
 var that = this;
 return Promise.resolve(sp).then(
  function(expr){
   if(has(expr, "line"))
    if(key in expr)
     return expr[key];
   return checkCar(expr).then(arrayFromLispCdr).then(
    function hydrate(strokes){
     return Promise.all(
      strokes.map(
       Stroke.promiseFromLispPromise.bind(Stroke)
      )
     );
    }
   ).then(
    function construct(strokes){
     var result = new that();
     strokes.map(result.addStroke.bind(result));
     result.end();
     return result;
    }
   ).then(
    function memoize(result){
     expr[key] = result;
     return result;
    }
   );
  }
 );
};
Gesture.prototype.promiseToLisp = function promiseToLisp(){
 var key = this.typeName;
 var that = this;
 return Promise.all(
  this.strokes.map(
   function(stroke){
    return stroke.promiseToLisp();
   }
  ).map(Promise.resolve.bind(Promise))
 ).then(
  function(data){
   return arrayToLispCons(key, data).then(
    function(result){
     result[key] = that;
     result.typeName = key;
     return result;
    }
   );
  }
 );
};

Gesture.chatMiddleware = lispMiddlewareFactory(Gesture);

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

Gesture.prototype.middleware.push(
 [
  function(){
   return 1 == this.strokes.length;
  },
  function(){
   return this.strokes[0];
  }
 ]
);


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
Gesture.prototype.middleware.push(
 [
  function(){
   if(!(this instanceof Gesture)) return false;
   return 2 == this.strokes.length;
  },
  function(){
   return new ZoomPan(this.strokes[0], this.strokes[1]);
  }
 ]
);
