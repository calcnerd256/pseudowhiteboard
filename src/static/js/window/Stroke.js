function Stroke(index, camera, strokeStyle){
 this.points = [];
 if(arguments.length >= 1)
  this.index = index;
 if(arguments.length >= 2)
  this.camera = camera;
 if(arguments.length >= 3)
  this.strokeStyle = strokeStyle;
}
Stroke.prototype.typeName = "stroke";

Stroke.prototype.strokeStyle = "#000000";
Stroke.prototype.done = false;

Stroke.prototype.moveTo = function moveTo(nextTouch, cam){
 this.camera = cam;
 this.ctx = cam.ctx;
 var p = cam.touchToPoint(nextTouch);
 this.x = p.x;
 this.y = p.y;
 this.points.push(p);
 if("previousTouch" in this)
  cam.drawSegment(
   this.previousTouch,
   p,
   "#8080ff",
   2
  );
 this.previousTouch = p;
};
Stroke.prototype.end = function end(){
 this.done = true;
};

Stroke.prototype.toRefString = StrokePoint.prototype.toRefString;
Stroke.prototype.hasRef = StrokePoint.prototype.hasRef;
Stroke.prototype.toString = function(){
 if(this.hasRef())
   return this.toRefString();
 return "(stroke " + this.points.join(" ") + ")";
};


Stroke.promiseFromLispPromise = function promiseFromLispPromise(sp){
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
    function hydrate(points){
     return Promise.all(
      points.map(
       StrokePoint.promiseFromLispPromise.bind(StrokePoint)
      )
     );
    }
   ).then(
    function construct(points){
     var result = new that();
     result.points = points.filter(I);
     result.done = true;
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
Stroke.prototype.promiseToLisp = function promiseToLisp(){
 var key = this.typeName;
 var data = this.points.map(
  function(point){
   return point.promiseToLisp();
  }
 );
 var that = this;
 return arrayToLispCons(key, data).then(
  function(result){
   result[key] = that;
   result.typeName = key;
   return result;
  }
 );
};

Stroke.chatMiddleware = lispMiddlewareFactory(Stroke);

Stroke.prototype.draw = function(camera){
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
 var done = this.done;
 var color = this.strokeStyle;
 return this.points.map(
  function(x, i, a){
   return camera.drawSegment(
    a[i?i-1:i],
    x,
    done ? color : colors[i % colors.length]
   );
  }
 );
};
