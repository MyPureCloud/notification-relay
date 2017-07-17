const _ = require('lodash');
const Winston = require('winston');



function Logger(topic) {
	var self = this;

	if (topic)
		this.topic = topic;

	this.log = new Winston.Logger({
	    transports: [
	        new Winston.transports.Console({
	            level: 'silly',
	            handleExceptions: true,
	            json: false,
	            colorize: true
	        })
	    ],
	    filters: [
	    	function(level, msg, meta) {
	    		if (self.topic)
					return `[${self.topic}] ${msg}`;
				else
					return msg;
			}
	    ]
	});
}




Logger.prototype.setLogLevel = function(level) {
	level = checkLevel(level);
	this.log.transports.console.level = level;
	this.log.info(`Log level set to ${level}`);
};

Logger.prototype.setUseColor = function(useColor) {
	this.log.transports.console.colorize = useColor === true;
	this.log.info(`Logger will use color: ${useColor}`);
};

// Passthrough functions
Logger.prototype.silly = function(msg, data) { this.log.silly(this.formatMessage(msg, data)); };
Logger.prototype.debug = function(msg, data) { this.log.debug(this.formatMessage(msg, data)); };
Logger.prototype.verbose = function(msg, data) { this.log.verbose(this.formatMessage(msg, data)); };
Logger.prototype.info = function(msg, data) { this.log.info(this.formatMessage(msg, data)); };
Logger.prototype.warn = function(msg, data) { this.log.warn(this.formatMessage(msg, data)); };
Logger.prototype.error = function(msg, data) { this.log.error(this.formatMessage(msg, data)); };

Logger.prototype.profile = function(msg) { this.log.profile(msg); };

Logger.prototype.formatMessage = function(msg, data) {
	var trace = '';
	if (msg && typeof(msg) === 'object') {
		trace += JSON.stringify(msg,null,2);
	}	else {
		trace += msg;
		if (data && typeof(data) === 'object') {
			trace += ' ' + JSON.stringify(data,null,2);
		} else if (data) {
			trace += data;
		}
	}

	return trace;
};


Logger.prototype.writeBoxedLine = function(string, width, padchar, level) {
	level = checkLevel(level);
	if (!width) width = this.defaultWidth;
	if (!padchar) padchar = ' ';
	var cWidth = width - 4;
	var words = string.split(' ');
	var rows = [];
	var c = 0;
	_.forEach(words, function(word, index) {
		if (!rows[c]) rows[c] = '';
		if (rows[c].length + word.length + 1 > cWidth) {
			c++;
			rows[c] = '';
		}
		rows[c] += word + ' ';
	});

	// Lodash messes with this/self. self is set to the Builder object for some reason.
	var logObject = this.log;
	_.forEach(rows, function(row, index) {
		logObject.log(level, '║ ' + pad(row.trimRight(), cWidth, padchar) + ' ║');
	});
};

Logger.prototype.writeBoxTop = function(width, level) {
	level = checkLevel(level);
	if (!width) width = this.defaultWidth;
	this.log.log(level, '╔' + pad('', width - 2, '═') + '╗');
};

Logger.prototype.writeBoxSeparator = function(width, level) {
	level = checkLevel(level);
	if (!width) width = this.defaultWidth;
	this.log.log(level, '╟' + pad('', width - 2, '─') + '╢');
};

Logger.prototype.writeBoxBottom = function(width, level) {
	level = checkLevel(level);
	if (!width) width = this.defaultWidth;
	this.log.log(level, '╚' + pad('', width - 2, '═') + '╝');
};

Logger.prototype.writeBox = function(string, width, level) {
	var self = this;

	// Find width
	var strings = string.split("\n");
	var maxWidth = strings.reduce(function (a, b) { return a.length > b.length ? a : b; }).length;
	if (!width)
		width = maxWidth > this.defaultWidth ? this.defaultWidth : maxWidth + 5;

	// default boxes to info
	level = level ? level : 'info';

	// Write box
	this.writeBoxTop(width, level);
	_.forEach(strings, function(str) {
		self.writeBoxedLine(str, width, null, level);	
	});
	this.writeBoxBottom(width, level);
};

function pad(value, length, padchar) {
    return (value.toString().length < length) ? pad(value+padchar, length, padchar):value;
}

function checkLevel(level) { return level ? level : 'debug'; }

self = module.exports = Logger;
