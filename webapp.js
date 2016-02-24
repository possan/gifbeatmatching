var GifMatcher = require('./gifmatcher.js').GifMatcher;


function loadGif(target, url, overridenumbeats) {
    var h = new XMLHttpRequest();
    // new browsers (XMLHttpRequest2-compliant)
    h.open('GET', url, true);

    if ('overrideMimeType' in h) {
        h.overrideMimeType('text/plain; charset=x-user-defined');
    }

    // old browsers (XMLHttpRequest-compliant)
    else if ('responseType' in h) {
        h.responseType = 'arraybuffer';
    }

    // IE9 (Microsoft.XMLHTTP-compliant)
    else {
        h.setRequestHeader('Accept-Charset', 'x-user-defined');
    }

    h.onloadstart = function() {
        // Wait until connection is opened to replace the gif element with a canvas to avoid a blank img
        // if (!initialized) init();
    };
    h.onload = function(e) {
        if (this.status != 200) {
            doLoadError('xhr - response');
        }
        // emulating response field for IE9
        if (!('response' in this)) {
            this.response = new VBArray(this.responseText).toArray().map(String.fromCharCode).join('');
        }
        var data = this.response;
        if (data.toString().indexOf("ArrayBuffer") > 0) {
            data = new Uint8Array(data);
        }

        console.log('got ' + data.length + ' bytes');
        target.load(data, function(x) {
        	if (overridenumbeats) {
        		target.setNumberOfBeats(overridenumbeats);
			}
        });
        // stream = new Stream(data);
        // setTimeout(doParse, 0);
    };
    h.onprogress = function (e) {
        //  if (e.lengthComputable) doShowProgress(e.loaded, e.total, true);
    };
    h.onerror = function() {
    	// doLoadError('xhr');
    };
    h.send();
}




window.addEventListener('load', function() {

	console.log('ready.');

	var bpm = 60;
	var beat = 0;
	var beattimer = 0;
	var time_per_beat = 60.0 / bpm;

	var G1 = new GifMatcher();
	var G2 = new GifMatcher();
	var G3 = new GifMatcher();
	var G4 = new GifMatcher();
	var G5 = new GifMatcher();
	var G6 = new GifMatcher();

	var canvas_el = document.getElementById('canvasdisplay');
	var canvas_ctx = canvas_el.getContext('2d');

	var bpminput_el = document.getElementById('bpminput')
	var bpmdisplay_el = document.getElementById('bpmdisplay');
	var beatdisplay_el = document.getElementById('beatdisplay');
	var reset_el = document.getElementById('resetbtn');

	function drawGifFrame(G, x, y, GG) {

		G.strokeStyle = '#666';
		G.strokeWidth = 1.0;

		if (G.pixels.length > 0) {

			var d = canvas_ctx.getImageData(x, y, G.width, G.height);
			d.data[0] = Math.random() * 255;
			for(var j=0; j<G.width * G.height; j++) {
				d.data[j * 4 + 0] = (G.pixels[j] >> 0) & 255;
				d.data[j * 4 + 1] = (G.pixels[j] >> 8) & 255;
				d.data[j * 4 + 2] = (G.pixels[j] >> 16) & 255;
				d.data[j * 4 + 3] = (G.pixels[j] >> 24) & 255;
			}
			canvas_ctx.putImageData(d, x, y);

			for(var j=0; j<GG.getNumberOfFrames(); j++) {
				var xx = j * G.width / GG.getNumberOfFrames();
				canvas_ctx.beginPath();
				canvas_ctx.lineWidth = 5.0;
				canvas_ctx.strokeStyle = (j == GG.frame) ? '#000' : '#eee';
				canvas_ctx.moveTo(x + xx, y + G.height);
				canvas_ctx.lineTo(x + xx, y + G.height + 10 + GG.getFrameEnergy(j) / 3 );
				canvas_ctx.stroke();
			}


		}
	}

	function redrawtimer() {

		if (G1.dirty || G2.dirty) {
			if (G1.dirty) {
				var p1 = G1.getFrame(G1.frame);
				drawGifFrame(p1, 0, 0, G1);
			}

			if (G3.dirty) {
				var p3 = G3.getFrame(G3.frame);
				drawGifFrame(p3, 100, 0, G3);
			}

			if (G2.dirty) {
				var p2 = G2.getFrame(G2.frame);
				drawGifFrame(p2, 0, 100, G2);
			}

			if (G4.dirty) {
				var p3 = G4.getFrame(G4.frame);
				drawGifFrame(p3, 300, 0, G4);
			}

			if (G5.dirty) {
				var p3 = G5.getFrame(G5.frame);
				drawGifFrame(p3, 900, 0, G5);
			}

			if (G6.dirty) {
				var p3 = G6.getFrame(G6.frame);
				drawGifFrame(p3, 300, 400, G6);
			}
		}

		setTimeout(redrawtimer, 20);
	}

	function updateLabels() {
		bpmdisplay_el.innerText = '' + bpm;
		beatdisplay_el.innerText = '' + beat;
		G1.setBpm(bpm);
		G2.setBpm(bpm);
		G3.setBpm(bpm);
		G4.setBpm(bpm);
		G5.setBpm(bpm);
		G6.setBpm(bpm);
	}

	bpminput_el.addEventListener('change', function() {
		bpm = ~~bpminput_el.value;
		time_per_beat = 60.0 / bpm;
		updateLabels();
	});

	reset_el.addEventListener('click', function() {
		beat = 0;
		beattimer = 0;
		G1.seek(0);
		G2.seek(0);
		G3.seek(0);
		G4.seek(0);
		G5.seek(0);
		G6.seek(0);
		updateLabels();
	});

	var lastTick = 0;

	function tick() {
		var T = (new Date()).getTime() / 1000.0;
		if (lastTick == 0) lastTick = T;
		var D = T - lastTick;
		lastTick = T;
		beattimer += D;


		if (beattimer > time_per_beat) {
			beattimer -= time_per_beat;
			// beat time_per_beat
			beat ++;
			updateLabels();
		}

		G1.tick(D);
		G2.tick(D);
		G3.tick(D);
		G4.tick(D);
		G5.tick(D);
		G6.tick(D);

		// console.log('D', D, G1.frame, G2.frame);

		setTimeout(tick, 20);
	}

	tick();
	updateLabels();
	redrawtimer();

	setTimeout(function() {
		loadGif(G1, 'test3.gif');
	}, 500);

	setTimeout(function() {
		loadGif(G2, 'test4.gif');
	}, 1500);

	setTimeout(function() {
		loadGif(G3, 'test5.gif', 2);
	}, 2500);

	setTimeout(function() {
		loadGif(G4, 'test2.gif');
	}, 2500);

	setTimeout(function() {
		loadGif(G5, 'test1.gif');
	}, 3500);

	setTimeout(function() {
		loadGif(G6, 'test6.gif');
	}, 3500);

});

