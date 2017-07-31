"use strict";
let commands = require('./commands_map');
let config = require('./mock_dl/server_config.json');
let Nightmare = require('nightmare');
let assert = require('assert');
let vo = require('vo');
let host = "http://localhost:" + config.port;
let params = {
	domain: host + "/mock"
};

let nightmare = Nightmare({
	show: true,
	executionTimeout: 6000
});

Nightmare.prototype.do = function (doFn) {
	if (doFn) {
		doFn(this);
	}
	return this;
}

function getUrl() {
    var paramArray = [{}, params].concat(Array.prototype.slice.call(arguments));
	var merged = Object.assign.apply(Object, paramArray);
	var pairs = [];
	for (var name in merged) {
		var value = merged[name];
		if (typeof value === 'object') {
			value = JSON.stringify(value);
		}
		pairs.push(`${name}=${encodeURIComponent(value)}`);
	}
	return host + '?' + pairs.join('&');
}

describe('nightmare UI tests', function () {
	let devices = config.widthTests;
	let keys = Object.keys(commands);
	this.timeout(devices.length * keys.length * 20000);

	it('Evaluates all UI widthTests for all commands_map file', function (done) {
		let tab = "\t";
		let results = [];

		let isTrueColor = "\x1b[32m";
		let isFalseColor = "\x1b[31m";
		let deviceColor = "\x1b[36m%s\x1b[0m";
		let resultToConsole = function (consoleLog, result) {
			const resultBoolean = !!result;
			console.log(resultBoolean ? isTrueColor : isFalseColor, `${tab}${tab}${consoleLog}${resultBoolean}`);
		}
		let deviceToConsole = function (device, width) {
			console.log(deviceColor, `${tab}${device} (width: ${width}px)`);
		}

		let testOneCommand = function* (testurl, index, width, consoleLog) {
			const cmd = keys[index];
			let result = "";
			//Starting server and reload the page.
			if (index == 0) {
				result = yield nightmare.goto(testurl)
					.viewport(width, 768);
			}

			result = yield nightmare.goto(testurl)
				.viewport(width, 768)
				.wait(2000)
				.type('.wc-textbox input', commands[cmd].alternateText || cmd)
				.click('.wc-send')
				.wait(3000)
				.do(commands[cmd].do)
				.evaluate(commands[cmd].client);

			resultToConsole(consoleLog, result);
			results.push(result);
		}

		//Testing devices and commands 
		let testAllCommands = function* () {
			for (let device in devices) {
				let width = devices[device];
				deviceToConsole(device, width);

				for (let cmd_index = 0; cmd_index < keys.length; cmd_index++) {
					const cmd = keys[cmd_index];

					console.log(`${tab}${tab}Command: ${cmd}`);

					// All tests should be passed under speech enabled environment
					let testUrl = getUrl({ t: cmd, speech: 'enabled/ui' }, commands[cmd].urlAppend);
					yield testOneCommand(testUrl, cmd_index, width, "Speech enabled: ")


					const speechCmd = /speech[ \t]([^ ]*)/g.exec(cmd);
					if (!speechCmd || speechCmd.length === 0) {
						// Non speech specific tests should also be passed under speech disabled environment
						testUrl = getUrl({ t: cmd, speech: 'disabled/ui' }, commands[cmd].urlAppend);
						yield testOneCommand(testUrl, cmd_index, width, "Speech disabled: ")
					}
				}
			}
			yield nightmare.end();
			return results;
		}

		vo(testAllCommands)(function (err, results) {
			done();
		});
	});
});
