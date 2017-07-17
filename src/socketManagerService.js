const _ = require('lodash');
const Q = require('q');
const WebSocket = require('ws');

const Logger = require('./loggerService');
const config = require('./configService');



var sockets = [];



function SocketManager() {
	this.log = new Logger('SocketManager');
}



SocketManager.prototype.connect = function(url, callback) {
	var _this = this;
	
	try {
		var socket = new WebSocket(url);
		// Connection opened
		socket.on('open', function (event) {
		    _this.log.silly(`WebSocket opened to ${url}`);
		    callback('open', event);
		});

		// Listen for messages
		socket.on('message', function (event) {
		    _this.log.silly(`Message from server ${event}`);
		    callback('message', JSON.parse(event));
		});

		sockets.push(socket);
	} catch(err) {
		_this.log.error(err);
	}
};



module.exports = new SocketManager();