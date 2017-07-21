// Force working directory to be where this script resides
// The purpose of this is for relative paths loaded in configs to be relative to the script, not where it was invoked from
process.chdir(__dirname);

const _ = require('lodash');
const moment = require('moment');

const config = require('./configService');
const log = new (require('./loggerService'))('main', config.data.get('settings.logLevel'));
const Integration = require('./integrationService');
const pureCloud = require('./pureCloudService');



var integrations = [];


log.writeBox(`Notification Relay\n${(new moment()).format('h:m:s a')}`);

log.debug('Debug message');


pureCloud.login()
	.then(function() {
		// Load integrations
		_.forEach(config.data.integrations, function(integration) {
			integrations.push(new Integration(integration));
		});
	})
	.catch(function(err) {
		console.log(err);
	});