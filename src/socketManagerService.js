const _ = require('lodash');
const Q = require('q');
const WebSocket = require('ws');

const Logger = require('./loggerService');
const config = require('./configService');



var sockets = {};
var webSocketServers = {};



function SocketManager() {
	this.log = new Logger('SocketManager', config.data.get('settings.logLevel'));
}

// Web Sockets

SocketManager.prototype.connectWebSocket = function(url, callback) {
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

		sockets[url] = socket;
	} catch(err) {
		_this.log.error(err);
	}
};

SocketManager.prototype.getWebSocket = function(url) {
	return sockets[url];
};

SocketManager.prototype.listenWebSocket = function(port, connectionCallback, errorCallback, listeningCallback, headersCallback) {
	// https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketserveroptions-callback
	var wss = new WebSocket.Server({ port: port });
	
	wss.on('connection', connectionCallback);
	wss.on('error', errorCallback);
	wss.on('headers', headersCallback);
	wss.on('listening', listeningCallback);

	webSocketServers[port] = wss;

	this.log.info(`Listening for incoming web socket connections on port ${port}`);

	return wss;
};

SocketManager.prototype.getWebSocketServer = function(port) {
	return webSocketServers[port];
};

// TCP sockets

SocketManager.prototype.connectTcpSocket = function(url, callback) {

};

SocketManager.prototype.getTcpSocket = function(url, callback) {

};

SocketManager.prototype.listenTcpSocket = function(url, callback) {

};

SocketManager.prototype.getTcpSocketServer = function(url, callback) {

};



module.exports = new SocketManager();