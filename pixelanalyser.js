

function PixelAnalyser(width, height, clearcolor) {
	this.width = width;
	this.height = height;
	this.clearcolor = clearcolor;
	this.frames = [];
	this.fullframes = [];
	this.beat_start_frame = 0;
	this.num_beats = 1;
	this.total_time = 0;
}

PixelAnalyser.prototype.init = function(width, height, clearcolor) {
	this.clearcolor = clearcolor;
	this.width = width;
	this.height = height;
}

PixelAnalyser.prototype.frame = function(fr) {
	this.frames.push(fr);
}

PixelAnalyser.prototype.calc = function(callback) {
	var _this = this;
	var pixels = new Array(this.width * this.height);
	for(var i=0; i<this.width * this.height; i++)
		pixels[i] = this.clearcolor;

	this.frames.forEach(function(f) {
		// console.log('f', f);

		if (f.clear) {
			for(var i=0; i<_this.width * _this.height; i++) {
				pixels[i] = _this.clearcolor;
			}
		}

		for(var j=0; j<f.height; j++) {
			for(var i=0; i<f.width; i++) {
				var x = f.x + i;
				var y = f.y + j;
				var c = f.pixels[j * f.width + i];
				if (((c >> 24) & 255) > 128) {
					pixels[y * _this.width + x] = c;
				}
			}
		}
		_this.fullframes.push({
			energy: 0,
			diff: 0,
			delay: f.delay,
			pixels: [].concat(pixels)
		});
	});

	var min_diff = 99999999999;
	var max_diff = 0;

	for(var j=0; j<this.fullframes.length; j++) {
		var f2 = (j + this.fullframes.length - 1) % this.fullframes.length;
		var cf = this.fullframes[j];
		var lf = this.fullframes[f2];

		console.log('calc diff ' + f2 + ' -> ' + j);

		var d = 0;
		for(var i=0; i<this.height*this.width; i++) {
			var lc = lf.pixels[i];
			var cc = cf.pixels[i];

			var lr = (lc >> 0) & 0xFF;
			var lg = (lc >> 8) & 0xFF;
			var lb = (lc >> 16) & 0xFF;
			var la = (lc >> 24) & 0xFF;

			var cr = (cc >> 0) & 0xFF;
			var cg = (cc >> 8) & 0xFF;
			var cb = (cc >> 16) & 0xFF;
			var ca = (cc >> 24) & 0xFF;

			var dr = Math.abs(cr - lr);
			var dg = Math.abs(cg - lg);
			var db = Math.abs(cb - lb);
			var da = Math.abs(ca - la);

			d += Math.sqrt(dr*dr + dg*dg + db*db); //  + da*da);
		}

		d /= 1000.0;

		d = Math.round(d);

		console.log('d', d);

		if (d < min_diff) min_diff = d;
		if (d > max_diff) max_diff = d;

		this.fullframes[j].diff = d;
	}

	for(var j=0; j<this.fullframes.length; j++) {
		var e = Math.round((this.fullframes[j].diff - min_diff) * 100 / (max_diff - min_diff));
		this.fullframes[j].energy = e;
		console.log('frame ' + j + ' energy ' + e);
	}

	var max_energy_frame = 0;
	var max_energy_value = 0;
	var total_time = 0;
	for(var j=this.fullframes.length-1; j>=0; j--) {
		if (this.fullframes[j].energy > max_energy_value) {
			max_energy_frame = j;
			max_energy_value = this.fullframes[j].energy;
		}
		total_time += this.fullframes[j].delay;
	}

	this.total_time = total_time;
	this.beat_start_frame = max_energy_frame;

	var defaultbpmtime = 60.0 / 120.0;

	if (total_time > defaultbpmtime * 5.0) {
		this.num_beats = 8;
	}
	else if (total_time > defaultbpmtime * 3.0) {
		this.num_beats = 4;
	}
	else if (total_time > defaultbpmtime * 2.0) {
		this.num_beats = 2;
	}
	else {
		this.num_beats = 1;
	}

	this.bpm = Math.round(60.0 * this.num_beats * 1.0 / this.total_time);

	// shift the frames around to make first beat frame first.

	var newfullframes = [];
	for(var j=0; j<this.fullframes.length; j++) {
		var fn = (j + this.beat_start_frame) % this.fullframes.length;
		var f = this.fullframes[fn];
		newfullframes.push(f);
	}

	this.fullframes = newfullframes;

	setTimeout(function() {
		callback({});
	}, 1);
}

PixelAnalyser.prototype.setNumberOfBeats = function(b) {
	this.num_beats = b;
	this.bpm = Math.round(60.0 * this.num_beats * 1.0 / this.total_time);
}

exports.PixelAnalyser = PixelAnalyser;
