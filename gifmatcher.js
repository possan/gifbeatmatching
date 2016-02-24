
var PixelAnalyser = require('./pixelanalyser.js').PixelAnalyser;



// loosely stolen from the buzzfeed supergif library (https://github.com/buzzfeed/libgif-js) which was based upon the jsgif project (https://github.com/shachaf/jsgif

var bitsToNum = function (ba) {
    return ba.reduce(function (s, n) {
        return s * 2 + n;
    }, 0);
};

var byteToBitArr = function (bite) {
    var a = [];
    for (var i = 7; i >= 0; i--) {
        a.push( !! (bite & (1 << i)));
    }
    return a;
};

var Stream = function (data) {
    this.data = data;
    this.len = this.data.length;
    this.pos = 0;

    this.readByte = function () {
        if (this.pos >= this.data.length) {
            throw new Error('Attempted to read past end of stream.');
        }
        if (data instanceof Uint8Array)
            return data[this.pos++];
        else
            return data.charCodeAt(this.pos++) & 0xFF;
    };

    this.readBytes = function (n) {
        var bytes = [];
        for (var i = 0; i < n; i++) {
            bytes.push(this.readByte());
        }
        return bytes;
    };

    this.read = function (n) {
        var s = '';
        for (var i = 0; i < n; i++) {
            s += String.fromCharCode(this.readByte());
        }
        return s;
    };

    this.readUnsigned = function () { // Little-endian.
        var a = this.readBytes(2);
        return (a[1] << 8) + a[0];
    };
};

var lzwDecode = function (minCodeSize, data) {
    // TODO: Now that the GIF parser is a bit different, maybe this should get an array of bytes instead of a String?
    var pos = 0; // Maybe this streaming thing should be merged with the Stream?
    var readCode = function (size) {
        var code = 0;
        for (var i = 0; i < size; i++) {
            if (data.charCodeAt(pos >> 3) & (1 << (pos & 7))) {
                code |= 1 << i;
            }
            pos++;
        }
        return code;
    };

    var output = [];

    var clearCode = 1 << minCodeSize;
    var eoiCode = clearCode + 1;

    var codeSize = minCodeSize + 1;

    var dict = [];

    var clear = function () {
        dict = [];
        codeSize = minCodeSize + 1;
        for (var i = 0; i < clearCode; i++) {
            dict[i] = [i];
        }
        dict[clearCode] = [];
        dict[eoiCode] = null;

    };

    var code;
    var last;

    while (true) {
        last = code;
        code = readCode(codeSize);

        if (code === clearCode) {
            clear();
            continue;
        }
        if (code === eoiCode) break;

        if (code < dict.length) {
            if (last !== clearCode) {
                dict.push(dict[last].concat(dict[code][0]));
            }
        }
        else {
            if (code !== dict.length) throw new Error('Invalid LZW code.');
            dict.push(dict[last].concat(dict[last][0]));
        }
        output.push.apply(output, dict[code]);

        if (dict.length === (1 << codeSize) && codeSize < 12) {
            // If we're at the last code and codeSize is 12, the next code will be a clearCode, and it'll be 12 bits long.
            codeSize++;
        }
    }

    // I don't know if this is technically an error, but some GIFs do it.
    //if (Math.ceil(pos / 8) !== data.length) throw new Error('Extraneous LZW bytes.');
    return output;
};


// The actual parsing; returns an object with properties.
var parseGIF = function (st, handler) {
    handler || (handler = {});

    // LZW (GIF-specific)
    var parseCT = function (entries) { // Each entry is 3 bytes, for RGB.
        var ct = [];
        for (var i = 0; i < entries; i++) {
            ct.push(st.readBytes(3));
        }
        return ct;
    };

    var readSubBlocks = function () {
        var size, data;
        data = '';
        do {
            size = st.readByte();
            data += st.read(size);
        } while (size !== 0);
        return data;
    };

    var parseHeader = function () {
        var hdr = {};
        hdr.sig = st.read(3);
        hdr.ver = st.read(3);
        if (hdr.sig !== 'GIF') throw new Error('Not a GIF file.'); // XXX: This should probably be handled more nicely.
        hdr.width = st.readUnsigned();
        hdr.height = st.readUnsigned();

        var bits = byteToBitArr(st.readByte());
        hdr.gctFlag = bits.shift();
        hdr.colorRes = bitsToNum(bits.splice(0, 3));
        hdr.sorted = bits.shift();
        hdr.gctSize = bitsToNum(bits.splice(0, 3));

        hdr.bgColor = st.readByte();
        hdr.pixelAspectRatio = st.readByte(); // if not 0, aspectRatio = (pixelAspectRatio + 15) / 64
        if (hdr.gctFlag) {
            hdr.gct = parseCT(1 << (hdr.gctSize + 1));
        }
        handler.hdr && handler.hdr(hdr);
    };

    var parseExt = function (block) {
        var parseGCExt = function (block) {
            var blockSize = st.readByte(); // Always 4
            var bits = byteToBitArr(st.readByte());
            block.reserved = bits.splice(0, 3); // Reserved; should be 000.
            block.disposalMethod = bitsToNum(bits.splice(0, 3));
            block.userInput = bits.shift();
            block.transparencyGiven = bits.shift();

            block.delayTime = st.readUnsigned();

            block.transparencyIndex = st.readByte();

            block.terminator = st.readByte();

            handler.gce && handler.gce(block);
        };

        var parseComExt = function (block) {
            block.comment = readSubBlocks();
            handler.com && handler.com(block);
        };

        var parsePTExt = function (block) {
            // No one *ever* uses this. If you use it, deal with parsing it yourself.
            var blockSize = st.readByte(); // Always 12
            block.ptHeader = st.readBytes(12);
            block.ptData = readSubBlocks();
            handler.pte && handler.pte(block);
        };

        var parseAppExt = function (block) {
            var parseNetscapeExt = function (block) {
                var blockSize = st.readByte(); // Always 3
                block.unknown = st.readByte(); // ??? Always 1? What is this?
                block.iterations = st.readUnsigned();
                block.terminator = st.readByte();
                handler.app && handler.app.NETSCAPE && handler.app.NETSCAPE(block);
            };

            var parseUnknownAppExt = function (block) {
                block.appData = readSubBlocks();
                // FIXME: This won't work if a handler wants to match on any identifier.
                handler.app && handler.app[block.identifier] && handler.app[block.identifier](block);
            };

            var blockSize = st.readByte(); // Always 11
            block.identifier = st.read(8);
            block.authCode = st.read(3);
            switch (block.identifier) {
                case 'NETSCAPE':
                    parseNetscapeExt(block);
                    break;
                default:
                    parseUnknownAppExt(block);
                    break;
            }
        };

        var parseUnknownExt = function (block) {
            block.data = readSubBlocks();
            handler.unknown && handler.unknown(block);
        };

        block.label = st.readByte();
        switch (block.label) {
            case 0xF9:
                block.extType = 'gce';
                parseGCExt(block);
                break;
            case 0xFE:
                block.extType = 'com';
                parseComExt(block);
                break;
            case 0x01:
                block.extType = 'pte';
                parsePTExt(block);
                break;
            case 0xFF:
                block.extType = 'app';
                parseAppExt(block);
                break;
            default:
                block.extType = 'unknown';
                parseUnknownExt(block);
                break;
        }
    };

    var parseImg = function (img) {
        var deinterlace = function (pixels, width) {
            // Of course this defeats the purpose of interlacing. And it's *probably*
            // the least efficient way it's ever been implemented. But nevertheless...
            var newPixels = new Array(pixels.length);
            var rows = pixels.length / width;
            var cpRow = function (toRow, fromRow) {
                var fromPixels = pixels.slice(fromRow * width, (fromRow + 1) * width);
                newPixels.splice.apply(newPixels, [toRow * width, width].concat(fromPixels));
            };

            // See appendix E.
            var offsets = [0, 4, 2, 1];
            var steps = [8, 8, 4, 2];

            var fromRow = 0;
            for (var pass = 0; pass < 4; pass++) {
                for (var toRow = offsets[pass]; toRow < rows; toRow += steps[pass]) {
                    cpRow(toRow, fromRow)
                    fromRow++;
                }
            }

            return newPixels;
        };

        img.leftPos = st.readUnsigned();
        img.topPos = st.readUnsigned();
        img.width = st.readUnsigned();
        img.height = st.readUnsigned();

        var bits = byteToBitArr(st.readByte());
        img.lctFlag = bits.shift();
        img.interlaced = bits.shift();
        img.sorted = bits.shift();
        img.reserved = bits.splice(0, 2);
        img.lctSize = bitsToNum(bits.splice(0, 3));

        if (img.lctFlag) {
            img.lct = parseCT(1 << (img.lctSize + 1));
        }

        img.lzwMinCodeSize = st.readByte();

        var lzwData = readSubBlocks();

        img.pixels = lzwDecode(img.lzwMinCodeSize, lzwData);

        if (img.interlaced) { // Move
            img.pixels = deinterlace(img.pixels, img.width);
        }

        handler.img && handler.img(img);
    };

    var parseBlock = function () {
        var block = {};
        block.sentinel = st.readByte();

        switch (String.fromCharCode(block.sentinel)) { // For ease of matching
            case '!':
                block.type = 'ext';
                parseExt(block);
                break;
            case ',':
                block.type = 'img';
                parseImg(block);
                break;
            case ';':
                block.type = 'eof';
                handler.eof && handler.eof(block);
                break;
            default:
                throw new Error('Unknown block: 0x' + block.sentinel.toString(16)); // TODO: Pad this with a 0.
        }

        if (block.type !== 'eof') setTimeout(parseBlock, 0);
    };

    var parse = function () {
        parseHeader();
        setTimeout(parseBlock, 0);
    };

    parse();
};










function GifMatcher() {
	this.a = new PixelAnalyser(0,0,0);
	this.time = 0.0;
	this.frame = 0;
	this.frame_duration = 0.0;
	this.playbackbpm = 120;
	this.lastframe = -1;
	this.dirty = false;
}

GifMatcher.prototype.load = function(buffer, callback) {
	var _this = this;
	var st = new Stream(buffer);
	var last_palette = [];
	var last_delay = 0;
	var last_bg = 0;
	var last_transp = -1;
    var last_clear = 0;

	// console.log(st);
	var handler = {
        hdr: function(x) {
        	// console.log('hdr', x);
        	last_bg = x.bgColor;
        	last_palette = x.gct;
        	var c = 0;
        	if (x.gct) {
				var p = last_palette[x.bgColor || 0];
	        	c = (p[0] + (p[1] << 8) + (p[2] << 16) + (255 << 24));
	        }
        	_this.a.init(x.width, x.height, c);
        },
        gce: function(x) {
        	// console.log('gce', x);
        	last_delay = x.delayTime;
        	last_transp = x.transparencyIndex;
            last_clear = x.disposalMethod == 2;
        },
        com: function(x) {
        	console.log('com', x);
        },
        unknown: function(x) {
        	console.log('unknown', x);
        },
        app: function(x) {
        	console.log('app', x);
        },
        pte: function(x) {
        	console.log('pte', x);
        },
        img: function(x) {
        	// console.log('img', x);
        	if (x.lct) {
        		last_palette = x.lct;
        	}
        	_this.a.frame({
        		x: x.leftPos,
        		y: x.topPos,
        		width: x.width,
        		height: x.height,
        		delay: last_delay * 0.01,
                clear: last_clear,
        		pixels: x.pixels.map(function(x) {
        			if (x == last_transp) {
        				return 0;
        			}

        			var p = 0;
        			if (last_palette) {
	        			p = last_palette[x];
	        			if (p) {
	        				p = p[0] + (p[1] << 8) + (p[2] << 16) + (255 << 24);
	        			}
        			}
    				return p;
        		})
        	});
        },
        eof: function(x) {
        	_this.a.calc(function(y) {
        		_this.frame = _this.a.beat_start_frame;
        		_this.frame_duration = 0;
        		if (_this.a.fullframes.length > 0) {
        			_this.frame_duration = _this.a.fullframes[_this.frame].delay;
        		}
        		_this.time = 0.0;
        		callback(_this);
        	});
        }
    };
	parseGIF(st, handler);
}

GifMatcher.prototype.setBpm = function(bpm) {
	this.playbackbpm = bpm;
}

GifMatcher.prototype.getFrame = function() {
}

GifMatcher.prototype.getWidth = function() {
    return this.a.width;
}

GifMatcher.prototype.getHeight = function() {
    return this.a.height;
}

GifMatcher.prototype.setNumberOfBeats = function(b) {
    this.a.setNumberOfBeats(b);
}

GifMatcher.prototype.getNumberOfFrames = function() {
    return this.a.fullframes.length;
}

GifMatcher.prototype.getFrameDuration = function(f) {
    if (this.a.fullframes.length < 1)
        return 0;
    return this.a.fullframes[f].delay;
}

GifMatcher.prototype.getFrameEnergy = function(f) {
    if (this.a.fullframes.length < 1)
        return 0;
    return this.a.fullframes[f].energy;
}

GifMatcher.prototype.getFrame = function() {
    if (this.a.fullframes.length < 1) {
        return {
            width: 0,
            height: 0,
            pixels: []
        }
    }

	var f = this.a.fullframes[this.frame];
	this.dirty = false;
	this.lastframe = this.frame;
	return {
		width: this.a.width,
		height: this.a.height,
		pixels: f.pixels
	}
}

GifMatcher.prototype._findGifFrameFromGifTime = function(gt) {
	while (gt < 0) {
		gt += this.a.total_time;
	}
	gt %= this.a.total_time;
	var tt = 0.0;
	var ff = 0;
	for(var j=0; j<this.a.fullframes.length; j++) {
		var fn = j;//(j + this.a.beat_start_frame) % this.a.fullframes.length;
		if (tt <= gt) {
			ff = fn;
		}
		tt += this.a.fullframes[fn].delay;
		// console.log('j',j,'fn',fn,'tt',tt);
	}
	return ff;
}

GifMatcher.prototype._remapTime = function(t) {
    var gt = t * this.playbackbpm / this.a.bpm;
    return gt;
}

GifMatcher.prototype._findBeatmatchedFrame = function(t) {
	var gt = this._remapTime(t);
	return this._findGifFrameFromGifTime(gt);
}

GifMatcher.prototype.seek = function(seconds) {
	// console.log('seek to', seconds);
	this.time = seconds;
	this.frame = this._findBeatmatchedFrame(this.time);
	this.dirty = (this.frame != this.lastframe);
}

GifMatcher.prototype.tick = function(seconds) {
	// console.log('seek by', seconds);
	this.time += seconds;
	this.frame = this._findBeatmatchedFrame(this.time);
	this.dirty = (this.frame != this.lastframe);
}


exports.GifMatcher = GifMatcher;
