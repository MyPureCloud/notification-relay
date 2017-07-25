/*
 * This example subscribes to topics based on the subscriptions config in the config file and 
 * logs information to the console window. 
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

function Test1(integration, logger, templateService, instanceCache, defaultCache) {
	// Keep track of services
	_this = this;
	this.integration = integration;
	this.log = logger;
	this.templateService = templateService;
	this.cache = instanceCache;
	this.defaultCache = defaultCache;

	// Set callbacks for events
	this.integration.setCallback(this.integration.eventStrings.INITIALIZED, onInitialized);
	this.integration.setCallback(this.integration.eventStrings.NOTIFICATION, onNotification);
	this.integration.setCallback(this.integration.eventStrings.ERROR, onError);

	// Subscribe to notifications via config object
	this.log.debug('subscribing notifications');
	this.integration.subscribeNotifications(this.integration.selfConfig.subscriptions);

	this.log.debug(`There are ${_.keys(_this.defaultCache.get('users')).length} users in the default cache`);
}



module.exports = Test1;



function getUser(id) {
	if (!id) return;
	if (id.length != 36) {
		_this.log.warn(`getUser: ID ${id} is not a GUID!`);
		return;
	}

	var user = _this.defaultCache.get('users')[id];
	if (!user)
		_this.log.warn(`getUser: No user in cache for ID ${id}`);

	return user;
}



function onInitialized(topic, data) {
	_this.log.debug(`onInitialized: topic=${topic} data=`, data);
}

function onNotification(topic, data) {
	/*
	 * For more information on template formatting, see the doT docs: http://olado.github.io/doT/
	 */
	
	try {
		// Heartbeat
		if (topic.toLowerCase() == CHANNEL_METADATA_TOPIC) {
				_this.log.info(_this.templateService.executeTemplate("Heartbeat ({{# def.now() }}): {{= it.eventBody.message }}", data, defs));
				return;
		}

		// Presence
		var presenceMatch = topic.match(/v2\.users\.([0-9a-f\-]{36})\.presence/i);
		if (presenceMatch) {
			// Add extra data to event
			data.eventBody.user = getUser(presenceMatch[1]);

			// Execute template
			var presenceMessage = _this.templateService.executeTemplate(
				"{{# def.now() }} - User {{= it.user.name }} ({{= it.user.id }}) is now {{= it.presenceDefinition.id }}", 
				data.eventBody, 
				defs);

			// Success?
			if (presenceMessage)
				_this.log.info(presenceMessage);
			else
				_this.log.warn('Template execution failed! No message returned.');
			return;
		}

		// RoutingStatus
		var routingStatusMatch = topic.match(/v2\.users\.([0-9a-f\-]{36})\.routingStatus/i);
		if (routingStatusMatch) {
			// Add extra data to event
			data.eventBody.user = getUser(routingStatusMatch[1]);

			// Execute template
			var routingMessage = _this.templateService.executeTemplate(
				"{{# def.now() }} - User {{= it.user.name }} ({{= it.user.id }}) is now {{= it.routingStatus.status }}", 
				data.eventBody, 
				defs);

			// Success?
			if (routingMessage)
				_this.log.info(routingMessage);
			else
				_this.log.warn('Template execution failed! No message returned.');
			return;
		}

		// Conversation summary
		var conversationMatch = topic.match(/v2\.users\.([0-9a-f\-]{36})\.conversationsummary/i);
		if (conversationMatch) {
			// Add extra data to event
			data.eventBody.user = getUser(conversationMatch[1]);

			// Execute template
			var conversationMessage = _this.templateService.executeTemplate("{{# def.now() }} - User {{= it.user.name }} ({{= it.user.id }}): \n" + 
				"calls: CC: {{= it.call.contactCenter.active }}/{{= it.call.contactCenter.acw }}, " +
				"Enterprise: {{= it.call.enterprise.active }}/{{= it.call.enterprise.acw }}\n" + 
				"callbacks: CC: {{= it.callback.contactCenter.active }}/{{= it.callback.contactCenter.acw }}, " +
				"Enterprise: {{= it.callback.enterprise.active }}/{{= it.callback.enterprise.acw }}\n" + 
				"emails: CC: {{= it.email.contactCenter.active }}/{{= it.email.contactCenter.acw }}, " +
				"Enterprise: {{= it.email.enterprise.active }}/{{= it.email.enterprise.acw }}\n" + 
				"chats: CC: {{= it.chat.contactCenter.active }}/{{= it.chat.contactCenter.acw }}, " +
				"Enterprise: {{= it.chat.enterprise.active }}/{{= it.chat.enterprise.acw }}", data.eventBody, defs);

			// Success?
			if (conversationMessage)
				_this.log.info(conversationMessage);
			else
				_this.log.warn('Template execution failed! No message returned.');
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