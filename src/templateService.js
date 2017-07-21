const _ = require('lodash');
const dot = require('dot');
const Q = require('q');



const config = require('./configService');
const log = new (require('./loggerService'))('template', config.data.get('settings.logLevel'));



function TemplateService() {
	dot.templateSettings.strip = false;
}



TemplateService.prototype.executeTemplate = function(templateString, data, defs) {
	try {
		log.silly(`Compiling template...\n---templateString--\n${templateString}\n-------data-------\n${data ? JSON.stringify(data) : data}\n-------defs-------\n${defs ? JSON.stringify(defs) : defs}`);
		var template = dot.template(templateString, null, defs);

		log.silly('Executing template...');
		return template(data);
	} catch(err) {
		log.error(`Error compiling/executing template! Template: ${templateString}`);
		log.error(err);
	}
};



module.exports = TemplateService;