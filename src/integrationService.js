const _ = require('lodash');
const Q = require('q');

const Logger = require('./loggerService');
const config = require('./configService');
const pureCloud = require('./pureCloudService');
const socketManager = require('./socketManagerService');



function Integration(integrationConfiguration) {
	this.callbacks = {};

	this.selfConfig = integrationConfiguration;
	this.log = new Logger(this.selfConfig.logTopic, config.data.get('settings.logLevel'));
	this.log.info(`Loading integration: ${this.selfConfig.name}`);

	if (this.selfConfig.modulePath) {
		this.log.info(`Loading module from ${this.selfConfig.modulePath}`);
		this.module = new (require(this.selfConfig.modulePath))(Logger, this);
	}

	this.handleMessage(this.eventStrings.INITIALIZED, { topicName: this.eventStrings.INITIALIZED });
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
	this.log.debug(`Raising event "${event}" with topic "${topic}"`);
	if (this.callbacks[event]) {
		this.callbacks[event](topic, data);
	} else {
		this.log.warn('No callback found!');
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
			_.forOwn(subscriptions, function(value, key) {
				_.forEach(value, function(id) {
					var topic = key.replace(/{.*}/ig, id);
					topics.push(topic);
				});
			});

			// Subscribe to the topics
			_this.log.debug(`Subscribing to topics: ${topics}`);
			_this.log.debug(_this.channel);
			pureCloud.subscribeTopics(topics, _this.channel.id)
				.then(function(){
					deferred.resolve();
				})
				.catch(function(err) {
					deferred.reject(err);
				});
		});

	return deferred.promise;
};

Integration.prototype.handleMessage = function(event, data) {
	// Validate data
	if (!event)
		throw new Error(`handleMessage: event cannot be empty`);
	if (!data) {
		this.log.warn(`handleMessage: data was empty, event=${event}`);
		data = {};
	}
	if (!data.topicName) {
		this.log.warn(`handleMessage: data.topicName was empty, event=${event}`);
		data.topicName = 'unknown';
	}

	// Handle event
	switch(event.toLowerCase()) {
		case this.eventStrings.INITIALIZED.toLowerCase(): {
			this.raiseEvent(this.eventStrings.INITIALIZED, data.topicName, data);
			break;
		}
		case 'open':
		case this.eventStrings.SOCKETOPEN.toLowerCase(): {
			this.raiseEvent(this.eventStrings.SOCKETOPEN, data.topicName, data);
			break;
		}
		case this.eventStrings.ERROR.toLowerCase(): {
			this.raiseEvent(this.eventStrings.ERROR, data.topicName, data);
			break;
		}
		case 'message':
		case this.eventStrings.NOTIFICATION.toLowerCase(): {
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
			socketManager.connect(channel.connectUri, _this.handleMessage.bind(_this));
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
