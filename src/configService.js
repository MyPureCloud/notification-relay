const _ = require('lodash');
const deref = require('json-schema-deref-sync');

const Logger = require('./loggerService');

var log = new loggerService('config');



function Config() {
	// Parse command line args
	this.args = getNodeArgs();

	// Load config file
	if (!this.args.config)
		this.args.config = './config.json';
	log.verbose(`loading config from ${this.args.config}`);
	this.data = deref(require(this.args.config));
	this.data.get = function get(path) {
		try {
			var data = this.data;
			var parts = path.split('.');

			_.forEach(parts, function(part) {
				if (data[part]) {
					data = data[part];
				}	else {
					log.warn(`Failed to find "${path}" at "${part}"`);
					return undefined;
				}
			});

			return data;
		} catch (err) {
			log.error(err);
			return undefined;
		}
	}.bind(this);

	// Re-initialize logger
	log = new Logger('config', this.data.get('settings.logLevel'));

	// Override client ID and secret with command line values
	if (!this.data.pureCloud)
		this.data.pureCloud = {};
	if (this.args.clientid) {
		log.verbose('Using PureCloud client ID from command line');
		this.data.pureCloud.clientId = this.args.clientid;
	}
	if (this.args.clientsecret) {
		log.verbose('Using PureCloud client secret from command line');
		this.data.pureCloud.clientSecret = this.args.clientsecret;
	}
	if (this.args.environment) {
		log.verbose('Using PureCloud environment from command line');
		this.data.pureCloud.environment = this.args.environment;
	}
}



module.exports = new Config();



function getNodeArgs() {
	var args = {};

	// Parse into pretty object
	for (i = 2; i < process.argv.length; i++) {
		var arg = process.argv[i];
		var index = arg.indexOf('=');

		if (index > 0) {
			// format was key=value
			var key = arg.substr(0,index);
			var value = arg.substr(index + 1);

			// Remove leading slash and dash
			if (key.startsWith('/'))
				key = key.substr(1);
			if (key.startsWith('--'))
				key = key.substr(2);

			// Use boolean type or literal string value
			if (value.toLowerCase() == 'true') {
				args[key.toLowerCase()] = true;
			} else if (value.toLowerCase() == 'false') {
				args[key.toLowerCase()] = false;
			} else {
				args[key.toLowerCase()] = value;
			}
		} else {
			// No equals sign, set whole thing as key and value->true
			
			// Remove leading slash and dash
			if (arg.startsWith('/'))
				arg = arg.substr(1);
			if (arg.startsWith('--'))
				arg = arg.substr(2);

			args[arg.toLowerCase()] = true;
		}
	}
	return args;
}