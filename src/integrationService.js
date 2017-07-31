const _ = require('lodash');
const Q = require('q');

const Logger = require('./loggerService');
const cache = require('./cacheService');
const config = require('./configService');
const pureCloud = require('./pureCloudService');
const socketManager = require('./socketManagerService');
const TemplateService = require('./templateService');



function Integration(integrationConfiguration) {
	this.callbacks = {};

	this.selfConfig = integrationConfiguration;
	this.appConfig = config;
	this.log = new Logger(this.selfConfig.logTopic + '-service', config.data.get('settings.logLevel'));
	this.log.info(`Loading integration: ${this.selfConfig.name}`);

	if (this.selfConfig.modulePath) {
		this.log.info(`Loading module from ${this.selfConfig.modulePath}`);
		this.module = new (require(this.selfConfig.modulePath))({
			'integrationService': this,
			'logger': new Logger(this.selfConfig.logTopic, config.data.get('settings.logLevel')),
			'templateService': new TemplateService(),
			'instanceCache': cache.addInstance(this.selfConfig.name),
			'defaultCache': cache,
			'socketManager': socketManager
		});
	}

	this.handleMessage(this.eventStrings.INITIALIZED);
}



Integration.prototype.eventStrings = {
	"INITIALIZED": "initialized",
	"SOCKETOPEN": "socketopen",
	"NOTIFICATION": "notification",
	"ERROR": "error",
	"SHUTDOWN": "shutdown" //TODO
};



Integration.prototype.setCallback = function(event, callback) {
	// Validate
	if (!_.find(_.values(this.eventStrings), function(eventString) { return event === eventString; }))
		throw new Error(`Unknown event: ${event}`);
	if (callback !== undefined && !isFunction(callback))
		throw new Error('Callback must be a function!');

	// Save callback
	if (callback)
		this.log.info(`Setting callback for ${event}`);
	else
		this.log.info(`Clearing callback for ${event}`);
	this.callbacks[event] = callback;
};

Integration.prototype.raiseEvent = function(event, topic, data) {
	if (this.callbacks[event]) {
		this.log.debug(`Raising event "${event}" with topic "${topic}"`);
		this.callbacks[event](topic, data);
	} else {
		this.log.info(`No callback found for event: ${event}`);
	}
};

Integration.prototype.subscribeNotifications = function(subscriptions, replaceExisting) {
	var deferred = Q.defer();
	var _this = this;

	this.ensureChannel()
		.then(function(channel) {
			_this.channel = channel;
			var topics = [];
			
			// Build topics array
			if (Array.isArray(subscriptions)) {
				// Assume array of topics
				topics = subscriptions;
			} else {
				// Assume config object
				_.forOwn(subscriptions, function(value, key) {
					_.forEach(value, function(id) {
						var topic = key.replace(/{.*}/ig, id);
						topics.push(topic);
					});
				});
			}

			// Subscribe to the topics
			_this.log.debug(`Using channel ${_this.channel.id} to subscribe to topics: ${topics}`);
			pureCloud.subscribeTopics(topics, _this.channel.id)
				.then(function(){
					deferred.resolve();
				})
				.catch(function(err) {
					deferred.reject(err);
				});
		})
		.catch(function(err) {
			deferred.reject(err);
		});

	return deferred.promise;
};

Integration.prototype.handleMessage = function(event, data) {
	// Validate data
	if (!event)
		throw new Error(`handleMessage: event cannot be empty`);

	// Handle event
	switch(event.toLowerCase()) {
		case this.eventStrings.INITIALIZED.toLowerCase(): {
			this.raiseEvent(this.eventStrings.INITIALIZED, this.eventStrings.INITIALIZED, data);
			break;
		}
		case 'open': // websocket open
		case this.eventStrings.SOCKETOPEN.toLowerCase(): {
			this.raiseEvent(this.eventStrings.SOCKETOPEN, this.eventStrings.SOCKETOPEN, data);
			break;
		}
		case this.eventStrings.ERROR.toLowerCase(): {
			this.raiseEvent(this.eventStrings.ERROR, this.eventStrings.ERROR, data);
			break;
		}
		case 'message': // websocket message
		case this.eventStrings.NOTIFICATION.toLowerCase(): {
			if (!data) {
				this.log.warn(`handleMessage: data was empty, event=${event}`);
				data = { topicName: 'unknown' };
			}
			if (!data.topicName) {
				this.log.warn(`handleMessage: data.topicName was empty, event=${event}`);
				data.topicName = 'unknown';
			}
			this.raiseEvent(this.eventStrings.NOTIFICATION, data.topicName, data);
			break;
		}
		default: {
			this.log.warn(`Unexpected event: ${event}`);
			break;
		}
	}
};

Integration.prototype.ensureChannel = function() {
	var deferred = Q.defer();
	var _this = this;

	pureCloud.getOrCreateChannel()
		.then(function(channel) {
			socketManager.connectWebSocket(channel.connectUri, _this.handleMessage.bind(_this));
			deferred.resolve(channel);
		})
		.catch(function(err) {
			deferred.reject(err);
		});

	return deferred.promise;
};



module.exports = Integration;



function isFunction(func) {
	var getType = {};
	return func && getType.toString.call(func) === '[object Function]';
}
