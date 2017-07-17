// Force working directory to be where this script resides
// The purpose of this is for relative paths loaded in configs to be relative to the script, not where it was invoked from
process.chdir(__dirname);

const _ = require('lodash');
const moment = require('moment');

const log = new (require('./loggerService'))('main');
const config = require('./configService');
const Integration = require('./integrationService');
const pureCloud = require('./pureCloudService');


log.writeBox(`Notification Relay\n${(new moment()).format('h:m:s a')}`);

log.debug('Debug message');


pureCloud.login()
	.then(function() {
		console.log('logged in!');
		_.forEach(config.data.integrations, function(integration) {
			var i = new Integration(integration);

			log.debug(`testing events for ${i.selfConfig.name}`);
			//i.raiseEvent(i.eventStrings.INITIALIZED, i.eventStrings.INITIALIZED, 'say initialized');
			//i.raiseEvent(i.eventStrings.NOTIFICATION, 'v2.users.1234.presence', 'say notification');
			//i.raiseEvent(i.eventStrings.ERROR, i.eventStrings.ERROR, 'say errrrrr');
		});
	})
	.catch(function(err) {
		console.log(err);
	});