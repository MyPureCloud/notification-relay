/*
 * Run this file via: node tcpclient.js
 *
 * This will create a TCP client and connect to the TCP server at the specified server address and port
 */


var net = require('net');

var server = '127.0.0.1';
var port = 9000;

var client = new net.Socket();

client.connect(port, server, function() {
	console.log('Connected');

	// Send cacheinit message
	client.write('cacheinit');
});

client.on('data', function(data) {
	console.log('Received: ' + data);
	//client.destroy();
});

client.on('close', function() {
	console.log('Connection closed');
});