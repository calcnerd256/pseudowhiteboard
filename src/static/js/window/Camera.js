function Camera(x, y, scale, ctx){
 // ctx is a canvas 2D drawing context
 this.x = x;
 this.y = y;
 this.scale = scale;
 this.ctx = ctx;
}

function canvasContextShortSide(ctx){
 var canv = ctx.canvas;
 var w = canv.width;
 var h = canv.height;
 return Math.min(w, h);
}

Camera.prototype.touchToPoint = function touchToPoint(touch){
 // touch is from a DOM touch event
 // return value is a StrokePoint
 var canv = this.ctx.canvas;
 var s = canvasContextShortSide(this.ctx);
 var canvRect = canv.getBoundingClientRect();
 var left = touch.clientX - (canvRect.left + canv.clientLeft);
 var top = touch.clientY - (canvRect.top + canv.clientTop);
 var x = left - canv.width / 2;
 var y = canv.height / 2 - top;
 var rx = touch.radiusX;
 var ry = touch.radiusY;
 var r = Math.max(rx, ry);
 if(r < 1) r = 1;
 if(r > s) r = s;
 var scale = this.scale / s;
 return new StrokePoint(
  this.x + x * scale,
  this.y + y * scale,
  new Date(),
  r * this.scale
 );
};

Camera.prototype.drawSegment = function drawSegment(from, to, style, radius){
 if(arguments.length >= 3) this.ctx.strokeStyle = style;
 if(arguments.length < 4) r = Math.min(from.r, to.r);
 var canv = this.ctx.canvas;
 r /= this.scale;
 if(r < 2) r = 2;
 this.ctx.lineWidth = r;
 this.ctx.lineCap = "round";
 var that = this;
 var s = canvasContextShortSide(this.ctx);
 function transform(absolute, zero, axis){
  var relative = absolute - zero;
  var center = axis / 2;
  var scale = s / that.scale;
  return relative * scale + center;
 }
 var fromx = transform(from.x, this.x, canv.width);
 var fromy = transform(from.y, this.y, canv.height);
 var tox = transform(to.x, this.x, canv.width);
 var toy = transform(to.y, this.y, canv.height);
 this.ctx.beginPath();
 this.ctx.moveTo(fromx, canv.height - fromy);
 this.ctx.lineTo(tox, canv.height - toy);
 if(r > 1) this.ctx.globalAlpha = 1 / r;
 this.ctx.stroke();
 this.ctx.globalAlpha = 1;
};

Camera.prototype.toString = function toString(){
 var coords = "<" + [this.x, this.y].join(", ") + ">";
 return coords + "*" + this.scale;
};

Camera.prototype.zoomPan = function(dx, dy, ratio){
 if(!ratio) ratio = 1;
 var x = this.x - dx;
 var y = this.y - dy;
 var scale = this.scale / ratio
 return new Camera(x, y, scale, this.ctx);
};
