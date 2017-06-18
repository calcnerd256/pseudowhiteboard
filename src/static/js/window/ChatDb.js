function ChatDb(){
 this.lines = [];
}
ChatDb.prototype.append = function(line){
 this.lines.push(line);
}
ChatDb.prototype.sync = function sync(){
 var that = this;
 return promiseReadChatroom().then(
  function(lines){
   if(lines.length == that.lines.length) return;
   return lines.slice(that.lines.length).map(that.append.bind(that));
  }
 );
}
ChatDb.prototype.run = function run(timestep){
 return this.sync().then(
  function(updates){
   return new Promise(
    function(res, rej){
     setTimeout(res, timestep);
    }
   );
  }
 ).then(
  this.run.bind(this, timestep)
 );
}
