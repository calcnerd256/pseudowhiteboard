function StrokePoint(x, y, time, radius){
 // for use in Stroke
 this.x = x;
 this.y = y;
 this.t = time; // Date
 this.r = radius;
}
StrokePoint.prototype.typeName = "point"

StrokePoint.fromTouch = function fromTouch(touch, ctx){
 // touch comes from a touch event from the DOM
 // ctx is a canvas context and maybe shouldn't be here anymore
 var x = touch.clientX;
 var y = touch.clientY;
 var t = new Date();
 var rx = touch.radiusX;
 var ry = touch.radiusY;
 var r = Math.max(rx, ry);
 return new this(x, y, t, r);
};

StrokePoint.prototype.toRefString = function toRefString(){
 return "@" + (+(this.msgid)) + ":" + this.typeName;
};
StrokePoint.prototype.hasRef = function hasRef(){
 if(!("msgid" in this)) return false;
 var m = this.msgid;
 if(m instanceof Promise) return false;
 var n = +m;
 var s = "" + m;
 var sn = "" + n;
 return sn == s;
};
StrokePoint.prototype.toString = function toString(){
 if(this.hasRef())
  return this.toRefString();
 var xy = [this.x, this.y].join(", ");
 var coords = "<" + xy + ">";
 var size = "(" + this.r + ")";
 var when = "@" + this.t
 return coords + size + when;
};

StrokePoint.promiseFromLispPromise = function promiseFromLispPromise(sp){
 var that = this;
 function checkCar(expr){
  return lispCar(expr).then(
   function(oper){
    return new AssertEqual(that.prototype.typeName, oper).resolve();
   }
  ).then(K(expr));
 }
 var key = that.prototype.typeName;
 return Promise.resolve(sp).then(
  function(expr){
   if(has(expr, "line"))
    if(key in expr.line)
     return expr.line[key];
   return checkCar(expr).then(arrayFromLispCdr).then(
    function checkLength(xyrt){
     return new AssertEqual(4, xyrt.length).resolve(xyrt);
    }
   ).then(
    function construct(xyrt){
     var x = xyrt[0];
     var y = xyrt[1];
     var r = xyrt[2];
     var t = xyrt[3];
     return new that(+x, +y, new Date(+t), +r);
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
StrokePoint.prototype.promiseToLisp = function promiseToLisp(){
 var key = this.typeName;
 var data = [
  +(this.x),
  +(this.y),
  +(this.r),
  +(this.t - new Date(0))
 ];
 var that = this;
 return arrayToLispCons(key, data).then(
  function(result){
   result[key] = that;
   result.typeName = key;
   return result;
  }
 );
};

StrokePoint.chatMiddleware = lispMiddlewareFactory(StrokePoint);
