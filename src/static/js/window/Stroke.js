function Stroke(index, firstTouch, ctx, strokeStyle){
 this.index = index;
 this.points = [];
 if(arguments.length >= 4)
  this.strokeStyle = strokeStyle;
 this.addPoint(firstTouch, ctx);
}

Stroke.prototype.strokeStyle = "#000000";

Stroke.prototype.addPoint = function addPoint(touch, ctx){
 this.x = touch.clientX;
 this.y = touch.clientY;
 this.ctx = ctx;
 this.points.push(
  Stroke.Point.fromTouch(touch, ctx)
 );
}

Stroke.Point = function Point(x, y, t, r){
 this.x = x;
 this.y = y;
 this.t = t;
 this.r = r;
};
Stroke.Point.fromTouch = function fromTouch(touch, ctx){
 var x = touch.clientX;
 var y = touch.clientY;
 var t = new Date();
 var r = Math.max(touch.radiusX, touch.radiusY);
 return new this(x, y, t, r);
};
