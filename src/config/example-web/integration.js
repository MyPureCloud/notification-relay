/*
 * This example: 
 * - subscribes to user topics for all users
 * - caches user data
 * - hosts an express server to serve a web page displaying user data
 * - hosts a web socket server to send updates to web pages
 */

// Import node modules
const _  = require('lodash');
const platformClient = require('purecloud-platform-client-v2');

// Import the def module used in the templates
const defs = require('./defs');

const CHANNEL_METADATA_TOPIC = "channel.metadata";

// Set instance variables
var _this;
var usersApi = new platformClient.UsersApi();

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
	_.forEach(this.cache.getInstance('users').getData(), function(user) {
		topics.push(`v2.users.${user.id}.presence`);
		topics.push(`v2.users.${user.id}.routingStatus`);
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
	this.log.debug('subscribing notifications');
	this.integration.subscribeNotifications(topics);

	// Open web socket server
	this.serverSockets = [];
	this.socketManager.listenWebSocket(9000, connectionCallback, errorCallback, listeningCallback, headersCallback);
}

// TODO handle closed socket

function connectionCallback(socket, request) {
	_this.log.info('Incoming connection received');

  // Add socket to list
  _this.serverSockets.push(socket);

	// Set incoming message callback
	socket.on('message', function incoming(message) {
    _this.log.info('received: ', message);
    if (message === 'cacheinit') {
    	_.forEach(_.keys(_this.cache.getInstance('users').getData()), function(userId) {
				sendSocketMessage(getUserForTransport(userId));
    	});
    }
  });

  socket.on('close', function closed(code, reason) {
  	_this.log.info(`Socket closed: ${code} - ${reason}`);
  	_.remove(_this.serverSockets, socket);
  });
 
 	// Send connection accepted message
  sendSocketMessage({ state: 'ready' }, socket);
}

function errorCallback(error) {
	_this.log.error(error);
}

function listeningCallback() {
	_this.log.info('listeningCallback');
}

function headersCallback(headers, request) {
	_this.log.silly(`headersCallback-headers:`, headers);
	_this.log.silly(`headersCallback-request:`, request);
}

function sendSocketMessage(message, socket) {
	try {
		// Can only send strings
		var messageString = message;
		if (typeof message === 'object')
			messageString = JSON.stringify(message);
		else if (message && typeof message != 'string' && typeof message.toString === 'function')
			messageString = message.toString();

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




module.exports = Integration;



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

	return presence;
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

	return presence;
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

	return routingStatus;
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

function getUserForTransport(userId, initiator) {
	var user = getUser(userId);
	var presence = getUserPresence(userId);
	var routingStatus = getUserRoutingStatus(userId);
	var conversationSummary = getUserConversationSummary(userId);

	var body = {
		user: {
			id: user.id,
			name: user.name
		},
		initiator: initiator
	};

	if (presence) {
		body.presence = {
			label: presence.presenceDefinition.label,
			systemPresence: presence.presenceDefinition.systemPresence,
			modifiedDate: presence.modifiedDate
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



// Event callbacks

function onInitialized(topic, data) {
	_this.log.debug(`onInitialized: topic=${topic} data=`, data);
}

function onSocketOpen(topic, data) {
	_this.log.debug(`onSocketOpen: topic=${topic} data=`, data);
}

function onNotification(topic, data) {
	/*
	 * For more information on template formatting, see the doT docs: http://olado.github.io/doT/
	 */
	
	try {
		var userId, user;

		// Heartbeat
		if (topic.toLowerCase() == CHANNEL_METADATA_TOPIC) {
				_this.log.info(_this.templateService.executeTemplate("Heartbeat ({{# def.now() }}): {{= it.eventBody.message }}", data, defs));
				return;
		}


		// Presence
		var presenceMatch = topic.match(/v2\.users\.([0-9a-f\-]{36})\.presence/i);
		if (presenceMatch) {
			userId = presenceMatch[1];

			// Update presence in cache
			data.eventBody.presenceDefinition = getPresence(data.eventBody.presenceDefinition.id);
			_this.cache.getInstance('presence').set(userId, data.eventBody);

			sendSocketMessage(getUserForTransport(userId, 'presence'));
			
			return;
		}


		// Routing status
		var routingStatusMatch = topic.match(/v2\.users\.([0-9a-f\-]{36})\.routingStatus/i);
		if (routingStatusMatch) {
			userId = routingStatusMatch[1];

			// Update routingStatus in cache
			_this.cache.getInstance('routingStatus').set(userId, data.eventBody.routingStatus);

			sendSocketMessage(getUserForTransport(userId, 'routingStatus'));

			return;
		}


		// Conversation summary
		var conversationSummaryMatch = topic.match(/v2\.users\.([0-9a-f\-]{36})\.conversationsummary/i);
		if (conversationSummaryMatch) {
			userId = conversationSummaryMatch[1];

			// Update routingStatus in cache
			setUserConversationSummary(userId, data.eventBody);

			sendSocketMessage(getUserForTransport(userId, 'conversationSummary'));

			return;
		}

		_this.log.info(`On notification: topic=${topic} data=`, data);
	} catch(err) {
		_this.log.error(`Error handling notification: ${err.message}`);
		_this.log.error(err);
	}
}

function onError(topic, data) {
	_this.log.debug(`On error: topic=${topic} message=${data.message}`);
	_this.log.error(data);
}