(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){var PixelAnalyser=require("./pixelanalyser.js").PixelAnalyser;var bitsToNum=function(ba){return ba.reduce(function(s,n){return s*2+n},0)};var byteToBitArr=function(bite){var a=[];for(var i=7;i>=0;i--){a.push(!!(bite&1<<i))}return a};var Stream=function(data){this.data=data;this.len=this.data.length;this.pos=0;this.readByte=function(){if(this.pos>=this.data.length){throw new Error("Attempted to read past end of stream.")}if(data instanceof Uint8Array)return data[this.pos++];else return data.charCodeAt(this.pos++)&255};this.readBytes=function(n){var bytes=[];for(var i=0;i<n;i++){bytes.push(this.readByte())}return bytes};this.read=function(n){var s="";for(var i=0;i<n;i++){s+=String.fromCharCode(this.readByte())}return s};this.readUnsigned=function(){var a=this.readBytes(2);return(a[1]<<8)+a[0]}};var lzwDecode=function(minCodeSize,data){var pos=0;var readCode=function(size){var code=0;for(var i=0;i<size;i++){if(data.charCodeAt(pos>>3)&1<<(pos&7)){code|=1<<i}pos++}return code};var output=[];var clearCode=1<<minCodeSize;var eoiCode=clearCode+1;var codeSize=minCodeSize+1;var dict=[];var clear=function(){dict=[];codeSize=minCodeSize+1;for(var i=0;i<clearCode;i++){dict[i]=[i]}dict[clearCode]=[];dict[eoiCode]=null};var code;var last;while(true){last=code;code=readCode(codeSize);if(code===clearCode){clear();continue}if(code===eoiCode)break;if(code<dict.length){if(last!==clearCode){dict.push(dict[last].concat(dict[code][0]))}}else{if(code!==dict.length)throw new Error("Invalid LZW code.");dict.push(dict[last].concat(dict[last][0]))}output.push.apply(output,dict[code]);if(dict.length===1<<codeSize&&codeSize<12){codeSize++}}return output};var parseGIF=function(st,handler){handler||(handler={});var parseCT=function(entries){var ct=[];for(var i=0;i<entries;i++){ct.push(st.readBytes(3))}return ct};var readSubBlocks=function(){var size,data;data="";do{size=st.readByte();data+=st.read(size)}while(size!==0);return data};var parseHeader=function(){var hdr={};hdr.sig=st.read(3);hdr.ver=st.read(3);if(hdr.sig!=="GIF")throw new Error("Not a GIF file.");hdr.width=st.readUnsigned();hdr.height=st.readUnsigned();var bits=byteToBitArr(st.readByte());hdr.gctFlag=bits.shift();hdr.colorRes=bitsToNum(bits.splice(0,3));hdr.sorted=bits.shift();hdr.gctSize=bitsToNum(bits.splice(0,3));hdr.bgColor=st.readByte();hdr.pixelAspectRatio=st.readByte();if(hdr.gctFlag){hdr.gct=parseCT(1<<hdr.gctSize+1)}handler.hdr&&handler.hdr(hdr)};var parseExt=function(block){var parseGCExt=function(block){var blockSize=st.readByte();var bits=byteToBitArr(st.readByte());block.reserved=bits.splice(0,3);block.disposalMethod=bitsToNum(bits.splice(0,3));block.userInput=bits.shift();block.transparencyGiven=bits.shift();block.delayTime=st.readUnsigned();block.transparencyIndex=st.readByte();block.terminator=st.readByte();handler.gce&&handler.gce(block)};var parseComExt=function(block){block.comment=readSubBlocks();handler.com&&handler.com(block)};var parsePTExt=function(block){var blockSize=st.readByte();block.ptHeader=st.readBytes(12);block.ptData=readSubBlocks();handler.pte&&handler.pte(block)};var parseAppExt=function(block){var parseNetscapeExt=function(block){var blockSize=st.readByte();block.unknown=st.readByte();block.iterations=st.readUnsigned();block.terminator=st.readByte();handler.app&&handler.app.NETSCAPE&&handler.app.NETSCAPE(block)};var parseUnknownAppExt=function(block){block.appData=readSubBlocks();handler.app&&handler.app[block.identifier]&&handler.app[block.identifier](block)};var blockSize=st.readByte();block.identifier=st.read(8);block.authCode=st.read(3);switch(block.identifier){case"NETSCAPE":parseNetscapeExt(block);break;default:parseUnknownAppExt(block);break}};var parseUnknownExt=function(block){block.data=readSubBlocks();handler.unknown&&handler.unknown(block)};block.label=st.readByte();switch(block.label){case 249:block.extType="gce";parseGCExt(block);break;case 254:block.extType="com";parseComExt(block);break;case 1:block.extType="pte";parsePTExt(block);break;case 255:block.extType="app";parseAppExt(block);break;default:block.extType="unknown";parseUnknownExt(block);break}};var parseImg=function(img){var deinterlace=function(pixels,width){var newPixels=new Array(pixels.length);var rows=pixels.length/width;var cpRow=function(toRow,fromRow){var fromPixels=pixels.slice(fromRow*width,(fromRow+1)*width);newPixels.splice.apply(newPixels,[toRow*width,width].concat(fromPixels))};var offsets=[0,4,2,1];var steps=[8,8,4,2];var fromRow=0;for(var pass=0;pass<4;pass++){for(var toRow=offsets[pass];toRow<rows;toRow+=steps[pass]){cpRow(toRow,fromRow);fromRow++}}return newPixels};img.leftPos=st.readUnsigned();img.topPos=st.readUnsigned();img.width=st.readUnsigned();img.height=st.readUnsigned();var bits=byteToBitArr(st.readByte());img.lctFlag=bits.shift();img.interlaced=bits.shift();img.sorted=bits.shift();img.reserved=bits.splice(0,2);img.lctSize=bitsToNum(bits.splice(0,3));if(img.lctFlag){img.lct=parseCT(1<<img.lctSize+1)}img.lzwMinCodeSize=st.readByte();var lzwData=readSubBlocks();img.pixels=lzwDecode(img.lzwMinCodeSize,lzwData);if(img.interlaced){img.pixels=deinterlace(img.pixels,img.width)}handler.img&&handler.img(img)};var parseBlock=function(){var block={};block.sentinel=st.readByte();switch(String.fromCharCode(block.sentinel)){case"!":block.type="ext";parseExt(block);break;case",":block.type="img";parseImg(block);break;case";":block.type="eof";handler.eof&&handler.eof(block);break;default:throw new Error("Unknown block: 0x"+block.sentinel.toString(16))}if(block.type!=="eof")setTimeout(parseBlock,0)};var parse=function(){parseHeader();setTimeout(parseBlock,0)};parse()};function GifMatcher(){this.a=new PixelAnalyser(0,0,0);this.time=0;this.frame=0;this.frame_duration=0;this.playbackbpm=120;this.lastframe=-1;this.dirty=false}GifMatcher.prototype.load=function(buffer,callback){var _this=this;var st=new Stream(buffer);var last_palette=[];var last_delay=0;var last_bg=0;var last_transp=-1;var last_clear=0;var handler={hdr:function(x){last_bg=x.bgColor;last_palette=x.gct;var c=0;if(x.gct){var p=last_palette[x.bgColor||0];c=p[0]+(p[1]<<8)+(p[2]<<16)+(255<<24)}_this.a.init(x.width,x.height,c)},gce:function(x){last_delay=x.delayTime;last_transp=x.transparencyIndex;last_clear=x.disposalMethod==2},com:function(x){console.log("com",x)},unknown:function(x){console.log("unknown",x)},app:function(x){console.log("app",x)},pte:function(x){console.log("pte",x)},img:function(x){if(x.lct){last_palette=x.lct}_this.a.frame({x:x.leftPos,y:x.topPos,width:x.width,height:x.height,delay:last_delay*.01,clear:last_clear,pixels:x.pixels.map(function(x){if(x==last_transp){return 0}var p=0;if(last_palette){p=last_palette[x];if(p){p=p[0]+(p[1]<<8)+(p[2]<<16)+(255<<24)}}return p})})},eof:function(x){_this.a.calc(function(y){_this.frame=_this.a.beat_start_frame;_this.frame_duration=0;if(_this.a.fullframes.length>0){_this.frame_duration=_this.a.fullframes[_this.frame].delay}_this.time=0;callback(_this)})}};parseGIF(st,handler)};GifMatcher.prototype.setBpm=function(bpm){this.playbackbpm=bpm};GifMatcher.prototype.getFrame=function(){};GifMatcher.prototype.getWidth=function(){return this.a.width};GifMatcher.prototype.getHeight=function(){return this.a.height};GifMatcher.prototype.setNumberOfBeats=function(b){this.a.setNumberOfBeats(b)};GifMatcher.prototype.getNumberOfFrames=function(){return this.a.fullframes.length};GifMatcher.prototype.getFrameDuration=function(f){if(this.a.fullframes.length<1)return 0;return this.a.fullframes[f].delay};GifMatcher.prototype.getFrameEnergy=function(f){if(this.a.fullframes.length<1)return 0;return this.a.fullframes[f].energy};GifMatcher.prototype.getFrame=function(){if(this.a.fullframes.length<1){return{width:0,height:0,pixels:[]}}var f=this.a.fullframes[this.frame];this.dirty=false;this.lastframe=this.frame;return{width:this.a.width,height:this.a.height,pixels:f.pixels}};GifMatcher.prototype._findGifFrameFromGifTime=function(gt){while(gt<0){gt+=this.a.total_time}gt%=this.a.total_time;var tt=0;var ff=0;for(var j=0;j<this.a.fullframes.length;j++){var fn=j;if(tt<=gt){ff=fn}tt+=this.a.fullframes[fn].delay}return ff};GifMatcher.prototype._remapTime=function(t){var gt=t*this.playbackbpm/this.a.bpm;return gt};GifMatcher.prototype._findBeatmatchedFrame=function(t){var gt=this._remapTime(t);return this._findGifFrameFromGifTime(gt)};GifMatcher.prototype.seek=function(seconds){this.time=seconds;this.frame=this._findBeatmatchedFrame(this.time);this.dirty=this.frame!=this.lastframe};GifMatcher.prototype.tick=function(seconds){this.time+=seconds;this.frame=this._findBeatmatchedFrame(this.time);this.dirty=this.frame!=this.lastframe};exports.GifMatcher=GifMatcher},{"./pixelanalyser.js":2}],2:[function(require,module,exports){function PixelAnalyser(width,height,clearcolor){this.width=width;this.height=height;this.clearcolor=clearcolor;this.frames=[];this.fullframes=[];this.beat_start_frame=0;this.num_beats=1;this.total_time=0}PixelAnalyser.prototype.init=function(width,height,clearcolor){this.clearcolor=clearcolor;this.width=width;this.height=height};PixelAnalyser.prototype.frame=function(fr){this.frames.push(fr)};PixelAnalyser.prototype.calc=function(callback){var _this=this;var pixels=new Array(this.width*this.height);for(var i=0;i<this.width*this.height;i++)pixels[i]=this.clearcolor;this.frames.forEach(function(f){if(f.clear){for(var i=0;i<_this.width*_this.height;i++){pixels[i]=_this.clearcolor}}for(var j=0;j<f.height;j++){for(var i=0;i<f.width;i++){var x=f.x+i;var y=f.y+j;var c=f.pixels[j*f.width+i];if((c>>24&255)>128){pixels[y*_this.width+x]=c}}}_this.fullframes.push({energy:0,diff:0,delay:f.delay,pixels:[].concat(pixels)})});var min_diff=99999999999;var max_diff=0;for(var j=0;j<this.fullframes.length;j++){var f2=(j+this.fullframes.length-1)%this.fullframes.length;var cf=this.fullframes[j];var lf=this.fullframes[f2];console.log("calc diff "+f2+" -> "+j);var d=0;for(var i=0;i<this.height*this.width;i++){var lc=lf.pixels[i];var cc=cf.pixels[i];var lr=lc>>0&255;var lg=lc>>8&255;var lb=lc>>16&255;var la=lc>>24&255;var cr=cc>>0&255;var cg=cc>>8&255;var cb=cc>>16&255;var ca=cc>>24&255;var dr=Math.abs(cr-lr);var dg=Math.abs(cg-lg);var db=Math.abs(cb-lb);var da=Math.abs(ca-la);d+=Math.sqrt(dr*dr+dg*dg+db*db)}d/=1e3;d=Math.round(d);console.log("d",d);if(d<min_diff)min_diff=d;if(d>max_diff)max_diff=d;this.fullframes[j].diff=d}for(var j=0;j<this.fullframes.length;j++){var e=Math.round((this.fullframes[j].diff-min_diff)*100/(max_diff-min_diff));this.fullframes[j].energy=e;console.log("frame "+j+" energy "+e)}var max_energy_frame=0;var max_energy_value=0;var total_time=0;for(var j=this.fullframes.length-1;j>=0;j--){if(this.fullframes[j].energy>max_energy_value){max_energy_frame=j;max_energy_value=this.fullframes[j].energy}total_time+=this.fullframes[j].delay}this.total_time=total_time;this.beat_start_frame=max_energy_frame;var defaultbpmtime=60/120;if(total_time>defaultbpmtime*5){this.num_beats=8}else if(total_time>defaultbpmtime*3){this.num_beats=4}else if(total_time>defaultbpmtime*2){this.num_beats=2}else{this.num_beats=1}this.bpm=Math.round(60*this.num_beats*1/this.total_time);var newfullframes=[];for(var j=0;j<this.fullframes.length;j++){var fn=(j+this.beat_start_frame)%this.fullframes.length;var f=this.fullframes[fn];newfullframes.push(f)}this.fullframes=newfullframes;setTimeout(function(){callback({})},1)};PixelAnalyser.prototype.setNumberOfBeats=function(b){this.num_beats=b;this.bpm=Math.round(60*this.num_beats*1/this.total_time)};exports.PixelAnalyser=PixelAnalyser},{}],3:[function(require,module,exports){var GifMatcher=require("./gifmatcher.js").GifMatcher;function loadGif(target,url,overridenumbeats){var h=new XMLHttpRequest;h.open("GET",url,true);if("overrideMimeType"in h){h.overrideMimeType("text/plain; charset=x-user-defined")}else if("responseType"in h){h.responseType="arraybuffer"}else{h.setRequestHeader("Accept-Charset","x-user-defined")}h.onloadstart=function(){};h.onload=function(e){if(this.status!=200){doLoadError("xhr - response")}if(!("response"in this)){this.response=new VBArray(this.responseText).toArray().map(String.fromCharCode).join("")}var data=this.response;if(data.toString().indexOf("ArrayBuffer")>0){data=new Uint8Array(data)}console.log("got "+data.length+" bytes");target.load(data,function(x){if(overridenumbeats){target.setNumberOfBeats(overridenumbeats)}})};h.onprogress=function(e){};h.onerror=function(){};h.send()}window.addEventListener("load",function(){console.log("ready.");var bpm=60;var beat=0;var beattimer=0;var time_per_beat=60/bpm;var G1=new GifMatcher;var G2=new GifMatcher;var G3=new GifMatcher;var G4=new GifMatcher;var G5=new GifMatcher;var G6=new GifMatcher;var canvas_el=document.getElementById("canvasdisplay");var canvas_ctx=canvas_el.getContext("2d");var bpminput_el=document.getElementById("bpminput");var bpmdisplay_el=document.getElementById("bpmdisplay");var beatdisplay_el=document.getElementById("beatdisplay");var reset_el=document.getElementById("resetbtn");function drawGifFrame(G,x,y,GG){G.strokeStyle="#666";G.strokeWidth=1;if(G.pixels.length>0){var d=canvas_ctx.getImageData(x,y,G.width,G.height);d.data[0]=Math.random()*255;for(var j=0;j<G.width*G.height;j++){d.data[j*4+0]=G.pixels[j]>>0&255;d.data[j*4+1]=G.pixels[j]>>8&255;d.data[j*4+2]=G.pixels[j]>>16&255;d.data[j*4+3]=G.pixels[j]>>24&255}canvas_ctx.putImageData(d,x,y);for(var j=0;j<GG.getNumberOfFrames();j++){var xx=j*G.width/GG.getNumberOfFrames();canvas_ctx.beginPath();canvas_ctx.lineWidth=5;canvas_ctx.strokeStyle=j==GG.frame?"#000":"#eee";canvas_ctx.moveTo(x+xx,y+G.height);canvas_ctx.lineTo(x+xx,y+G.height+10+GG.getFrameEnergy(j)/3);canvas_ctx.stroke()}}}function redrawtimer(){if(G1.dirty||G2.dirty){if(G1.dirty){var p1=G1.getFrame(G1.frame);drawGifFrame(p1,0,0,G1)}if(G3.dirty){var p3=G3.getFrame(G3.frame);drawGifFrame(p3,100,0,G3)}if(G2.dirty){var p2=G2.getFrame(G2.frame);drawGifFrame(p2,0,100,G2)}if(G4.dirty){var p3=G4.getFrame(G4.frame);drawGifFrame(p3,300,0,G4)}if(G5.dirty){var p3=G5.getFrame(G5.frame);drawGifFrame(p3,900,0,G5)}if(G6.dirty){var p3=G6.getFrame(G6.frame);drawGifFrame(p3,300,400,G6)}}setTimeout(redrawtimer,20)}function updateLabels(){bpmdisplay_el.innerText=""+bpm;beatdisplay_el.innerText=""+beat;G1.setBpm(bpm);G2.setBpm(bpm);G3.setBpm(bpm);G4.setBpm(bpm);G5.setBpm(bpm);G6.setBpm(bpm)}bpminput_el.addEventListener("change",function(){bpm=~~bpminput_el.value;time_per_beat=60/bpm;updateLabels()});reset_el.addEventListener("click",function(){beat=0;beattimer=0;G1.seek(0);G2.seek(0);G3.seek(0);G4.seek(0);G5.seek(0);G6.seek(0);updateLabels()});var lastTick=0;function tick(){var T=(new Date).getTime()/1e3;if(lastTick==0)lastTick=T;var D=T-lastTick;lastTick=T;beattimer+=D;if(beattimer>time_per_beat){beattimer-=time_per_beat;beat++;updateLabels()}G1.tick(D);G2.tick(D);G3.tick(D);G4.tick(D);G5.tick(D);G6.tick(D);setTimeout(tick,20)}tick();updateLabels();redrawtimer();setTimeout(function(){loadGif(G1,"test3.gif")},500);setTimeout(function(){loadGif(G2,"test4.gif")},1500);setTimeout(function(){loadGif(G3,"test5.gif",2)},2500);setTimeout(function(){loadGif(G4,"test2.gif")},2500);setTimeout(function(){loadGif(G5,"test1.gif")},3500);setTimeout(function(){loadGif(G6,"test6.gif")},3500)})},{"./gifmatcher.js":1}]},{},[3]);