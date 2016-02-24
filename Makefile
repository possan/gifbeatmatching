all: build-js build-html

build-js: webapp.js gifmatcher.js pixelanalyser.js
	browserify webapp.js | uglifyjs > build/webapp.js
	# browserify webapp.js > build/webapp.js

build-html: webapp.html
	cp webapp.html build/index.html

