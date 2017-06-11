function Stroke(index, camera, strokeStyle){
 this.index = index;
 this.points = [];
 this.camera = camera;
 if(arguments.length >= 3)
  this.strokeStyle = strokeStyle;
}

Stroke.prototype.strokeStyle = "#000000";

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

Stroke.prototype.toString = function(){
 return "stroke " + this.index;
};

Stroke.prototype.done = false;
