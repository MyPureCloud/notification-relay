const _ = require('lodash');
const platformClient = require('purecloud-platform-client-v2');
const Q = require('q');

const config = require('./configService');
const Logger = require('./loggerService');

const logLevel = config.data.get('settings.logLevel');
const log = new Logger('purecloud', logLevel);



var client = platformClient.ApiClient.instance;
if (config.data.settings.enableSdkDebugging === true) {
	var sdkDebugLog = new Logger('purecloud-sdk', logLevel);
	client.setDebugLog(sdkDebugLog.debug.bind(sdkDebugLog), 25);
}
if (config.data.pureCloud && config.data.pureCloud.environment) {
	log.debug(`Setting PureCloud environment: ${config.data.pureCloud.environment}`);
	client.setEnvironment(config.data.pureCloud.environment);
}
var authorizationApi = new platformClient.AuthorizationApi();
var notificationsApi = new platformClient.NotificationsApi();
var presenceApi = new platformClient.PresenceApi();
var routingApi = new platformClient.RoutingApi();
var usersApi = new platformClient.UsersApi();



function PureCloud() {}

PureCloud.prototype.login = function() {
	var deferred = Q.defer();
	var _this = this;

	client.loginClientCredentialsGrant(config.data.pureCloud.clientId, config.data.pureCloud.clientSecret)
		.then(function() {
			return authorizationApi.getAuthorizationPermissions();
		})
		.then(function(data) {
    	log.silly(`getAuthorizationPermissions success! permissions count: ${data.total}`);
			deferred.resolve();
		})
		.catch(function(response) {
			traceError(response, 'Authentication failed');
			deferred.reject(response);
		});

	return deferred.promise;
};

PureCloud.prototype.createChannel = function() {
	var deferred = Q.defer();
	var _this = this;

	notificationsApi.postNotificationsChannels()
		.then(function(data) {
    	log.debug(`Created channel ID: ${data.id}`);
			deferred.resolve(data);
		})
		.catch(function(response) {
			traceError(response);
			deferred.reject(response);
		});

	return deferred.promise;
};

PureCloud.prototype.getOrCreateChannel = function() {
	var deferred = Q.defer();
	var _this = this;

	/*
	 * Potential bug
	 * This process isn't threadsafe if it's called again before the first response returns. Need to put in
	 * some kind of locking/blocking mechanism to prevent multiple concurrent requests. Return a shared promise?
	 */

	if (this.notificationChannel) {
		// Return existing channel
		deferred.resolve(this.notificationChannel);
	} else {
		// Create new channel
		this.createChannel()
			.then(function(channel) {
				deferred.resolve(channel);
			})
			.catch(function(response) {
				traceError(response);
				deferred.reject(response);
			});
	}

	return deferred.promise;
};

PureCloud.prototype.subscribeTopics = function(topics, channelId, replace) {
	var deferred = Q.defer();
	var _this = this;

	// Format request body
	var body = [];
	_.forEach(topics, function(topic) {
		body.push({ 'id': topic });
	});
	body = JSON.stringify(body);

	// Make request
	var request;
	if (replace === true) {
		request = notificationsApi.putNotificationsChannelSubscriptions(channelId, body);
	} else {
		request = notificationsApi.postNotificationsChannelSubscriptions(channelId, body);
	}
	// Handle response
	request
		.then(function(data) {
			deferred.resolve(data);
		})
		.catch(function(response) {
			traceError(response);
			deferred.reject(response);
		});

	return deferred.promise;
};



/*
 * Helpers
 */

function traceError(error, customMessage) {
	try {
		var status = '0';
		var message;

		if (error.status)
			status = error.status;
		if (error.error) {
			message = error.error.message;
		} else if (error.message) {
			message = error.message;
		}

		if (customMessage)
			customMessage = customMessage.toString().trim() + ': ';
		else
			customMessage = '';
		
		log.error(`${customMessage}${status} - ${message}`);
	} catch(err) {
		log.error(err);
	}
}

PureCloud.prototype.getUsers = function(expand) {
	// Returns a promise
	return getUsersImpl(undefined, expand);
};

function getUsersImpl(users = {}, expand = [], deferred = Q.defer(), pageNumber = 1) {
	var _this = this;

	usersApi.getUsers({ 'pageSize': 100, 'pageNumber': pageNumber, expand: expand })
	  .then(function(data) {
	  	// Add users to cache
	  	_.forEach(data.entities, function(user) {
	  		users[user.id] = user;
	  	});

	  	// Done processing?
	  	if (pageNumber >= data.pageCount) {
	  		log.debug(`getUsers: Got ${_.keys(users).length} users`);
	  		deferred.resolve(users);
	  		return;
	  	}

	  	// Recurse function
	  	getUsersImpl(users, expand, deferred, pageNumber + 1);
	  })
		.catch(function(response) {
			traceError(response);
			deferred.reject(response);
		});

	return deferred.promise;
}

PureCloud.prototype.getQueues = function() {
	// Returns a promise
	return getQueuesImpl();
};

function getQueuesImpl(queues = {}, deferred = Q.defer(), pageNumber = 1) {
	var _this = this;

	routingApi.getRoutingQueues({ 'pageSize': 100, 'pageNumber': pageNumber, active: true })
	  .then(function(data) {
	  	// Add queues to cache
	  	_.forEach(data.entities, function(queue) {
	  		queues[queue.id] = queue;
	  	});

	  	// Done processing?
	  	if (pageNumber >= data.pageCount) {
	  		log.debug(`getQueues: Got ${_.keys(queues).length} queues`);
	  		deferred.resolve(queues);
	  		return;
	  	}

	  	// Recurse function
	  	getQueuesImpl(queues, deferred, pageNumber + 1);
	  })
		.catch(function(response) {
			traceError(response);
			deferred.reject(response);
		});

	return deferred.promise;
}

PureCloud.prototype.getPresences = function() {
	// Returns a promise
	return getPresencesImpl();
};

function getPresencesImpl(presences = {}, deferred = Q.defer(), pageNumber = 1) {
	var _this = this;

	presenceApi.getPresencedefinitions({ 'pageSize': 100, 'pageNumber': pageNumber, localeCode: "en_US" })
	  .then(function(data) {
	  	// Add presences to cache
	  	_.forEach(data.entities, function(presence) {
	  		presences[presence.id] = presence;
	  	});

	  	// Done processing?
	  	if (pageNumber >= data.pageCount) {
	  		log.debug(`getPresences: Got ${_.keys(presences).length} presences`);
	  		deferred.resolve(presences);
	  		return;
	  	}

	  	// Recurse function
	  	getPresencesImpl(presences, deferred, pageNumber + 1);
	  })
		.catch(function(response) {
			traceError(response);
			deferred.reject(response);
		});

	return deferred.promise;
}




module.exports = new PureCloud();