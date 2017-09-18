const _ = require('lodash');
const net = require('net');
const Q = require('q');
const WebSocket = require('ws');

const Logger = require('./loggerService');
const config = require('./configService');



var webSockets = {};
var webSocketServers = {};
var tcpSockets = {};
var tcpSocketServers = {};



function SocketManager() {
	this.log = new Logger('SocketManager', config.data.get('settings.logLevel'));
}


/* 
 * Web Sockets
 */

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

		webSockets[url] = socket;
	} catch(err) {
		_this.log.error(err);
	}
};

SocketManager.prototype.getWebSocket = function(url) {
	return webSockets[url];
};

SocketManager.prototype.listenWebSocket = function(port, connectionCallback, errorCallback, listeningCallback) {
	// https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketserveroptions-callback
	var wss = new WebSocket.Server({ port: port });
	
	wss.on('connection', connectionCallback);
	wss.on('error', errorCallback);
	wss.on('listening', listeningCallback);

	webSocketServers[port] = wss;

	this.log.info(`Listening for incoming web socket connections on port ${port}`);

	return wss;
};

SocketManager.prototype.getWebSocketServer = function(port) {
	return webSocketServers[port];
};


/* 
 * TCP Sockets
 */

SocketManager.prototype.connectTcpSocket = function(url, callback) {
	var _this = this;

	try {
		var socket = new net.Socket();

		socket.connect(url, function() {
	    _this.log.silly(`TCP socket opened to ${url}`);
	    callback('open', event);
		});

		socket.on('data', function(data) {
	    _this.log.silly(`Message from server ${event}`);
	    callback('message', JSON.parse(event));
		});

		tcpSockets[url] = socket;
	} catch(err) {
		_this.log.error(err);
	}
};

SocketManager.prototype.getTcpSocket = function(url) {
	return tcpSockets[url];
};

SocketManager.prototype.listenTcpSocket = function(port, connectionCallback, errorCallback, listeningCallback, closedCallback) {
	var server = net.createServer();

	server.on('connection', connectionCallback);
	server.on('error', errorCallback);
	server.on('listening', listeningCallback);
	server.on('close', closedCallback);

	this.log.info(`Listening for incoming TCP socket connections on port ${port}`);

	server.listen(port);

	tcpSocketServers[port] = server;
};

SocketManager.prototype.getTcpSocketServer = function(port) {
	return tcpSocketServers[port];
};



module.exports = new SocketManager();
