/*
 * This example subscribes to topics based on the subscriptions config in the config file and 
 * logs information to the console window. 
 */


// Import the def module used in the templates
const defs = require('./defs');

const CHANNEL_METADATA_TOPIC = "channel.metadata";

var _this;

function Test1(integration, logger, templateService) {
	// Keep track of services
	_this = this;
	this.integration = integration;
	this.log = logger;
	this.templateService = templateService;

	// Set callbacks for events
	this.integration.setCallback(this.integration.eventStrings.INITIALIZED, onInitialized);
	this.integration.setCallback(this.integration.eventStrings.NOTIFICATION, onNotification);
	this.integration.setCallback(this.integration.eventStrings.ERROR, onError);

	// Subscribe to notifications
	this.log.debug('subscribing notifications');
	// Via config object
	this.integration.subscribeNotifications(this.integration.selfConfig.subscriptions);
}



module.exports = Test1;



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
			data.eventBody.userId = presenceMatch[1];
			_this.log.info(_this.templateService.executeTemplate("{{# def.now() }} - User {{= it.userId }} is now {{= it.presenceDefinition.id }}", data.eventBody, defs));
			return;
		}

		// RoutingStatus
		var routingStatusMatch = topic.match(/v2\.users\.([0-9a-f\-]{36})\.routingStatus/i);
		if (routingStatusMatch) {
			data.eventBody.userId = routingStatusMatch[1];
			_this.log.info(_this.templateService.executeTemplate("{{# def.now() }} - User {{= it.userId }} is now {{= it.routingStatus.status }}", data.eventBody, defs));
			return;
		}

		// Conversation summary
		var conversationMatch = topic.match(/v2\.users\.([0-9a-f\-]{36})\.conversationsummary/i);
		if (conversationMatch) {
			data.eventBody.userId = conversationMatch[1];
			_this.log.info(_this.templateService.executeTemplate("{{# def.now() }} - User {{= it.userId }}: \n" + 
				"calls: CC: {{= it.call.contactCenter.active }}/{{= it.call.contactCenter.acw }}, " +
				"Enterprise: {{= it.call.enterprise.active }}/{{= it.call.enterprise.acw }}\n" + 
				"callbacks: CC: {{= it.callback.contactCenter.active }}/{{= it.callback.contactCenter.acw }}, " +
				"Enterprise: {{= it.callback.enterprise.active }}/{{= it.callback.enterprise.acw }}\n" + 
				"emails: CC: {{= it.email.contactCenter.active }}/{{= it.email.contactCenter.acw }}, " +
				"Enterprise: {{= it.email.enterprise.active }}/{{= it.email.enterprise.acw }}\n" + 
				"chats: CC: {{= it.chat.contactCenter.active }}/{{= it.chat.contactCenter.acw }}, " +
				"Enterprise: {{= it.chat.enterprise.active }}/{{= it.chat.enterprise.acw }}", data.eventBody, defs));
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