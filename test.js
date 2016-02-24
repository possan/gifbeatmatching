// var giflib = require('./giflib');
var fs = require('fs');
var GifMatcher = require('./gifmatcher.js').GifMatcher;


function deumptreuk(filename, callback) {
	console.log('dumping ' + filename);
	var data = fs.readFileSync(filename, "binary");
	(new GifMatcher()).load(data, function(m) {
		console.log('m', m);

		for(var k=0; k<m.a.fullframes.length; k++) {
			var f = m.a.fullframes[k];
			console.log('frame #'+k+', energy ' + f.energy + ', duration ' + f.delay);
		}

		m.setBpm(60.0);
		for(var t=0.0; t<5.0; t+=0.0333) {
			var gf = m._findGifFrameFromGifTime(t);
			var mf = m._findBeatmatchedFrame(t);
			console.log('gif time ' + Math.round(t * 1000) + 'ms = gif frame #' + gf + ', beatmatched frame #' + mf);
		}
	});

}

// deumptreuk('20px_animated_arrow.gif', function(x) { console.log('gif report', x ); });
deumptreuk('dad-dance.gif', function(x) { console.log('gif report', x ); });
// deumptreuk('dad-dance2.gif', function(x) { console.log('gif report', x ); });
// deumptreuk('happy_dance.gif', function(x) { console.log('gif report', x ); });
// deumptreuk('drake1.gif', function(x) { console.log('gif report', x ); });
// deumptreuk('peanut1.gif', function(x) { console.log('gif report', x ); });
// deumptreuk('bart.gif', function(x) { console.log('gif report', x ); });
// deumptreuk('luigi.gif', function(x) { console.log('gif report', x ); });
// deumptreuk('luigi.gif', function(x) { console.log('gif report', x ); });
// deumptreuk('animated-cat-gifs-004.gif');
// deumptreuk('animated-cat-gifs-014.gif');
// deumptreuk('animated-cat-gifs-024.gif');
// deumptreuk('animated-cat-gifs-034.gif');
