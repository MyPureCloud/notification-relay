/*
 * This example: 
 * - subscribes to user topics for all users
 * - caches user data
 * - hosts an express server to serve a web page displaying user data
 * - hosts a web socket server to send updates to web pages
 */

// Import node modules
const _  = require('lodash');
const express = require('express');
const moment = require('moment');
const path = require('path');
const platformClient = require('purecloud-platform-client-v2');

// Import the def module used in the templates
const defs = require('./defs');

const CHANNEL_METADATA_TOPIC = "channel.metadata";

// Set instance variables
var _this;
var usersApi = new platformClient.UsersApi();
var webServer = express();



// Module constructor
function Integration(serviceProvder) {
	// Keep track of services
	_this = this;
	this.integration = serviceProvder.integrationService;
	this.log = serviceProvder.logger;
	this.templateService = serviceProvder.templateService;
	this.cache = serviceProvder.instanceCache;
	this.defaultCache = serviceProvder.defaultCache;
	this.socketManager = serviceProvder.socketManager;

	// Add additional caches
	this.cache.addInstance('users');
	this.cache.addInstance('presence');
	this.cache.addInstance('routingStatus');
	this.cache.addInstance('conversationSummary');

	// Set callbacks for events
	this.integration.setCallback(this.integration.eventStrings.INITIALIZED, onInitialized);
	this.integration.setCallback(this.integration.eventStrings.SOCKETOPEN, onSocketOpen);
	this.integration.setCallback(this.integration.eventStrings.NOTIFICATION, onNotification);
	this.integration.setCallback(this.integration.eventStrings.ERROR, onError);

	// Generate list of topics to which to subscribe
	var topics = [];
	if (this.integration.selfConfig.users) {
		this.log.debug(`There are ${this.integration.selfConfig.users.length} users defined in the config`);
		_.forEach(this.integration.selfConfig.users, function(userId) {
			var user = _this.defaultCache.get('users')[userId];
			if (user)
				_this.cache.getInstance('users').set(userId, user);
			else
				_this.log.error(`Unable to find user ${userId} in user cache! Skipping user`);
		});
	} else {
		this.log.debug(`There are ${_.keys(this.defaultCache.get('users')).length} users in the default cache`);
		_.forEach(this.defaultCache.get('users'), function(user) {
			_this.cache.getInstance('users').set(user.id, user);
		});
	}
	var i = 0;
	_.forEach(this.cache.getInstance('users').getData(), function(user) {
		if (i >= 500) {
			_this.log.warn('Max topics reached!');
			return false;
		} else {
			i++;
		}
		topics.push(`v2.users.${user.id}.activity`);
		topics.push(`v2.users.${user.id}.conversationsummary`);

		// Load items from default cache
		if (user.presence) {
			user.presence.presenceDefinition = getPresence(user.presence.presenceDefinition.id);
			_this.cache.getInstance('presence').set(user.id, user.presence);
		}

		if (user.routingStatus) {
			_this.cache.getInstance('routingStatus').set(user.id, user.routingStatus);
		}
		
		if (user.conversationSummary) {
			setUserConversationSummary(user.id, user.conversationSummary);
		}

	});

	// Subscribe to notifications via config object
	this.log.debug(`subscribing to ${topics.length} notifications`);
	this.integration.subscribeNotifications(topics);

	// Listen for incoming socket connections
	this.isTcpSocket = this.integration.selfConfig.serverSocketType && this.integration.selfConfig.serverSocketType.toLowerCase() === 'tcp';
	this.serverSockets = [];
	if (this.isTcpSocket === true) {
		// Use TCP socket
		this.socketManager.listenTcpSocket(
			this.integration.selfConfig.serverSocketPort, 
			tcpSocketConnectionCallback, 
			tcpSocketErrorCallback, 
			tcpSocketListeningCallback, 
			tcpSocketClosedCallback
		);
	} else {
		// Default to using a web socket
		this.socketManager.listenWebSocket(
			this.integration.selfConfig.serverSocketPort, 
			webSocketConnectionCallback, 
			webSocketErrorCallback, 
			webSocketListeningCallback
		);

		// Start the express web server
		startWebServer();
	}
}



/* 
 * WebSocket Callbacks 
 */

function webSocketConnectionCallback(socket, request) {
	_this.log.info('Incoming WebSocket connection received');

  // Add socket to list
  _this.serverSockets.push(socket);

	// Set incoming message callback
	socket.on('message', function incoming(message) {
    _this.log.info('received: ', message);
    if (message === 'cacheinit') {
    	_.forEach(_.keys(_this.cache.getInstance('users').getData()), function(userId) {
				sendSocketMessage(wrapDataForTransport('user', getUserForTransport(userId)));
    	});
    }
  });

	// Handle socket closed
  socket.on('close', function closed(code, reason) {
  	_this.log.info(`Socket closed: ${code} - ${reason}`);
  	_.remove(_this.serverSockets, socket);
  });
 
 	// Send connection accepted message
  sendSocketMessage(wrapDataForTransport('state', { state: 'ready' }), socket);
}

function webSocketErrorCallback(error) {
	_this.log.error(error);
}

function webSocketListeningCallback() {
	_this.log.info('webSocketListeningCallback');
}

function sendWebSocketMessage(message, socket) {
	try {
		var messageString = socketMessageToString(message);
		if (socket) {
			socket.send(messageString);
		} else {
			_.forEach(_this.serverSockets, function(socket) {
				_this.log.debug(`sending message ${messageString}`);
				socket.send(messageString);
			});
		}
	} catch(err) {
		_this.log.error(err);
	}
}



/*
 * TCP Socket functions
 */

function tcpSocketConnectionCallback(socket) {
	_this.log.info('Incoming TCP connection received');

  // Add socket to list
  _this.serverSockets.push(socket);

	// Set incoming message callback
	socket.on('data', function incoming(message) {
		// byte array to string
		message = message.toString();

    _this.log.info('received: ', message);
    if (message === 'cacheinit') {
    	_.forEach(_.keys(_this.cache.getInstance('users').getData()), function(userId) {
				sendSocketMessage(wrapDataForTransport('user', getUserForTransport(userId)));
    	});
    }
  });

	// Handle socket closed
  socket.on('close', function closed() {
  	_this.log.info(`TCP socket closed`);
  	_.remove(_this.serverSockets, socket);
  });
 
 	// Send connection accepted message
  sendSocketMessage(wrapDataForTransport('state', { state: 'ready' }), socket);
}

function tcpSocketErrorCallback(error) {
	_this.log.error(error);
}

function tcpSocketListeningCallback() {
	_this.log.info('TCP server started');
}

function tcpSocketClosedCallback() {
	_this.log.info('TCP server stopped');
}

function sendTcpSocketMessage(message, socket) {
	try {
		var messageString = socketMessageToString(message);
		if (socket) {
			socket.write(messageString);
		} else {
			_.forEach(_this.serverSockets, function(socket) {
				_this.log.debug(`sending message ${messageString}`);
				socket.write(messageString);
			});
		}
	} catch(err) {
		_this.log.error(err);
	}
}



/*
 * Generic socket functions
 */

function sendSocketMessage(message, socket) {
	if (_this.isTcpSocket === true)
		sendTcpSocketMessage(message, socket);
	else
		sendWebSocketMessage(message, socket);
}

function socketMessageToString(message) {
	try {
		// Can only send strings
		var messageString = message;
		if (typeof message === 'object')
			messageString = JSON.stringify(message);
		else if (message && typeof message != 'string' && typeof message.toString === 'function')
			messageString = message.toString();

		return messageString;
	} catch(err) {
		_this.log.error(err);
		return '';
	}
}




module.exports = Integration;



function startWebServer() {
	// Path: / or /index.html
	webServer.get(/^\/$|^\/index.html$/, function(req, res) {
		try {
			// Serve the index file from this directory
			res.sendFile(path.join(__dirname, 'assets/index.html'));
		} catch(err) {
			_this.log.error(err);
			if (res.headersSent !== true)
				res.status(500).send(err.message ? `Error serving file: ${err.message}` : 'internal server error');
		}
	});

	// Path: /favicon.ico
	webServer.get('/favicon.ico', function(req, res) {
		try {
			// Serve the index file from this directory
			res.sendFile(path.join(__dirname, 'assets/favicon.ico'));
		} catch(err) {
			_this.log.error(err);
			if (res.headersSent !== true)
				res.status(500).send(err.message ? `Error serving file: ${err.message}` : 'internal server error');
		}
	});

	// Start express web server
	var webServerPort = _this.integration.selfConfig.webServerPort ? _this.integration.selfConfig.webServerPort : 8080;
	webServer.listen(webServerPort, function () {
	  _this.log.debug(`Web server is running on port ${webServerPort}`);
	});
}

function wrapDataForTransport(type, data, additionalData) {
	var message = {
		type: type,
		body: data
	};

	if (additionalData) {
		_.forEach(additionalData, function(value, key) {
			message[key] = value;
		});
	}

	return message;
}

/**
 * Gets a user object by ID from the default cache
 * @param  {string/guid}	id 	The ID of the user to get
 * @return {object/user}			The user object
 */
function getUser(id) {
	if (!id) return;
	if (id.length != 36) {
		_this.log.warn(`getUser: ID ${id} is not a GUID!`);
		return;
	}

	var user = _this.cache.getInstance('users').get(id);
	if (!user)
		_this.log.warn(`getUser: No user in cache for ID ${id}`);

	return user;
}

/**
 * Gets a presence object by ID from the default cache
 * @param  {string/guid}			id 	The ID of the presence to get
 * @return {object/presence}			The presence object
 */
function getPresence(id) {
	if (!id) return;
	if (id.length != 36) {
		_this.log.warn(`getPresence: ID ${id} is not a GUID!`);
		return;
	}

	var presence = _this.defaultCache.get('presences')[id];
	if (!presence) {
		_this.log.warn(`getPresence: No presence in cache for ID ${id}`);
		return;
	}

	// Set label
	presence.label = presence.languageLabels['en_US'];

	return JSON.parse(JSON.stringify(presence));
}

function getUserPresence(id) {
	if (!id) return;
	if (id.length != 36) {
		_this.log.warn(`getUserPresence: ID ${id} is not a GUID!`);
		return;
	}

	var presence = _this.cache.getInstance('presence').get(id);
	if (!presence) {
		_this.log.warn(`getUserPresence: No presence in cache for user ID ${id}`);
		return;
	}

	return JSON.parse(JSON.stringify(presence));
}

function getUserRoutingStatus(id) {
	if (!id) return;
	if (id.length != 36) {
		_this.log.warn(`getUserRoutingStatus: ID ${id} is not a GUID!`);
		return;
	}

	var routingStatus = _this.cache.getInstance('routingStatus').get(id);
	if (!routingStatus) {
		_this.log.warn(`getUserRoutingStatus: No routing status in cache for user ID ${id}`);
		return;
	}

	return JSON.parse(JSON.stringify(routingStatus));
}

function setUserConversationSummary(id, summary) {
	var mediaKeys = [ 'call', 'callback', 'email', 'chat', 'socialExpression', 'video' ];

	// Ensure full structure. The user expand from the API leaves out values
	_.forEach(mediaKeys, function(key) {
		if (!summary[key]) {
			summary[key] = { contactCenter: { active: 0, acw: 0 }, enterprise: { active: 0, acw: 0 } };
		} else {
			if (!summary[key].contactCenter) summary[key].contactCenter = {};
			if (!summary[key].contactCenter.active) summary[key].contactCenter.active = 0;
			if (!summary[key].contactCenter.acw) summary[key].contactCenter.acw = 0;

			if (!summary[key].enterprise) summary[key].enterprise = {};
			if (!summary[key].enterprise.active) summary[key].enterprise.active = 0;
			if (!summary[key].enterprise.acw) summary[key].enterprise.acw = 0;
		}
	});

	_this.cache.getInstance('conversationSummary').set(id, summary);
}

function setUserPresence(userId, presence) {
	_this.log.debug('presence object: '+ JSON.stringify(presence,null,2));

	// Get full presence object
	var presenceObject = getPresence(presence.presenceDefinition.id);
	_this.log.debug('before: ', presence);

	// Add to user's presence
	presence.presenceDefinition.label = presenceObject.label;
	_this.log.debug('after: ', presence);

	// Set in cache
	_this.cache.getInstance('presence').set(userId, presence);
}

function setUserRoutingStatus(userId, routingStatus) {
	_this.cache.getInstance('routingStatus').set(userId, routingStatus);
}

function getUserConversationSummary(id) {
	if (!id) return;
	if (id.length != 36) {
		_this.log.warn(`getUserConversationSummary: ID ${id} is not a GUID!`);
		return;
	}

	var conversationSummary = _this.cache.getInstance('conversationSummary').get(id);
	if (!conversationSummary) {
		_this.log.warn(`getUserConversationSummary: No conversation data in cache for user ID ${id}`);
		return;
	}

	return conversationSummary;
}

function getUserForTransport(userId) {
	var user = getUser(userId);
	var presence = getUserPresence(userId);
	var routingStatus = getUserRoutingStatus(userId);
	var conversationSummary = getUserConversationSummary(userId);

	var body = {
		user: {
			id: user.id,
			name: user.name
		}
	};

	if (presence) {
		body.presence = {
			label: presence.presenceDefinition.label,
			systemPresence: presence.presenceDefinition.systemPresence,
			modifiedTime: presence.modifiedDate
		};
	} else {
		body.presence = {
			label: '',
			systemPresence: '',
			modifiedDate: ''
		};
	}
	
	if (routingStatus) {
		body.routingStatus = {
			status: routingStatus.status,
			modifiedDate: routingStatus.startTime
		};
	} else {
		body.routingStatus = {
			status: '',
			modifiedDate: ''
		};
	}
	
	if (conversationSummary) {
		body.conversationSummary = conversationSummary;
	} else {
		body.conversationSummary = { 
			"call": { "contactCenter": { "active": 0, "acw": 0 }, "enterprise": { "active": 0, "acw": 0 } }, 
			"callback": { "contactCenter": { "active": 0, "acw": 0 }, "enterprise": { "active": 0, "acw": 0 } }, 
			"email": { "contactCenter": { "active": 0, "acw": 0 }, "enterprise": { "active": 0, "acw": 0 } }, 
			"chat": { "contactCenter": { "active": 0, "acw": 0 }, "enterprise": { "active": 0, "acw": 0 } }, 
			"socialExpression": { "contactCenter": { "active": 0, "acw": 0 }, "enterprise": { "active": 0, "acw": 0 } }, 
			"video": { "contactCenter": { "active": 0, "acw": 0 }, "enterprise": { "active": 0, "acw": 0 } } 
		};
	}

	return body;
}



// PureCloud event callbacks

function onInitialized(topic, data) {
	_this.log.debug(`onInitialized: topic=${topic} data=`, data);
}

function onSocketOpen(topic, data) {
	_this.log.debug(`onSocketOpen: topic=${topic} data=`, data);
}

function onNotification(topic, data) {
	/*
	 * For more information on template formatting, see the doT docs: http://olado.github.io/doT/
	 *
	 * This function receives a notification from PureCloud, matches the topic, updates data in the 
	 * cache where appropriate, formats a message, and sends the message to all connected clients. 
	 */
	
	try {
		var userId, user;

		// Heartbeat
		if (topic.toLowerCase() == CHANNEL_METADATA_TOPIC) {
			// The 'defs' module is available as 'def' and the 'data' object is available as 'it'
			_this.log.info(_this.templateService.executeTemplate(
				"Heartbeat ({{# def.now() }}): {{= it.eventBody.message }}", data, defs));

			sendSocketMessage(wrapDataForTransport('heartbeat', data.eventBody));
			return;
		}


		// Conversation summary
		var conversationSummaryMatch = topic.match(/v2\.users\.([0-9a-f\-]{36})\.conversationsummary/i);
		if (conversationSummaryMatch) {
			userId = conversationSummaryMatch[1];
			_this.log.info(`(${defs.now(undefined, new moment())}) Conversation summary changed for user ${userId}`);

			// Update routingStatus in cache
			setUserConversationSummary(userId, data.eventBody);

			sendSocketMessage(wrapDataForTransport('user', getUserForTransport(userId), { initiator: 'conversationSummary' }));

			return;
		}


		// Activity
		var activityMatch = topic.match(/v2\.users\.([0-9a-f\-]{36})\.activity/i);
		if (activityMatch) {
			userId = activityMatch[1];
			_this.log.info(`User activity for ${activityMatch[1]}`, data.eventBody);

			if (data.eventBody.routingStatus)
				setUserRoutingStatus(userId, data.eventBody.routingStatus);	

			if (data.eventBody.presence)
				setUserPresence(userId, data.eventBody.presence);

			sendSocketMessage(wrapDataForTransport('user', getUserForTransport(userId), { initiator: 'activity' }));

			return;
		}

		// Only called when topic isn't matched
		_this.log.warn(`Unmatched notification topic: ${topic}`);
	} catch(err) {
		_this.log.error(`Error handling notification: ${err.message}`);
		_this.log.error(err);
	}
}

function onError(topic, data) {
	_this.log.debug(`On error: topic=${topic} message=${data.message}`);
	_this.log.error(data);
}
