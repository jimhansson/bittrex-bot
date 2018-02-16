
var twilio_accountSid = "";
var twilio_accountAuthToken = "";


//registers  SIGINT(ctrl+c) as termination handler
process.on('SIGINT', function() {
		process.exit();
});



var bittrex = require('node-bittrex-api');
var twilio = require('twilio');
var twilio_client = new twilio(twilio_accountSid, twilio_accountAuthToken);

bittrex.options({
		'apikey': "NONE AT THIS TIME",
		'apisecret': "NAHA"
});

var markets = {};
var summaries = {};
var currencies =  {};
var triggers = {};

// setup some structures for storing data.
bittrex.getmarkets(function(data, err) {
		console.log("parsing getmarkets and setting up structures");
		for(var i in data.result) {
				// setup the currencies things needed for make simple dropdowns in webpage.
				if(currencies[data.result[i].BaseCurrency] === undefined)
						currencies[data.result[i].BaseCurrency] = []; // create array
				currencies[data.result[i].BaseCurrency].push(data.result[i].MarketCurrency);

				// setup triggers maps, 1 level
				if(triggers[data.result[i].BaseCurrency] === undefined)
						triggers[data.result[i].BaseCurrency] = {}
				// 2 level
				if(triggers[data.result[i].BaseCurrency][data.result[i].MarketCurrency] === undefined)
						triggers[data.result[i].BaseCurrency][data.result[i].MarketCurrency] = [];
				// not of any use yet
				markets[data.result[i].MarketName] = data.result[i];
		}
		//console.log(triggers);
});

function base_currency(name) {
		return name.split("-")[0];
}

function market_currency(name) {
		return name.split("-")[1];
}

function update_ticker(name, ticker) {
		if(ticker !== null) {
				if(ticker.success) {
						console.log(name + ": " + JSON.stringify(ticker));
						// get triggers for just this pair
						console.log(triggers);
						var trigs = triggers[base_currency(name)][market_currency(name)];
						var remove_list = [];
						// we will check every trigger if the conditions are meet, if they are and we
						// are able to fire the trigger add the index on the remove_list, so we later
						// can remove all those that have fired. we can't do that in this loop because
						// that is the array we are iterating over.
						for(var i in trigs) {
								if(trigs[i].on === "LastBelow") {
										if(trigs[i].value > ticker.result.Last) {
												if(trigger(trigs[i]))
														remove_list.push(i);
												else
														console.error("failed to trigger");
										}
								} else if(trigs[i].on === "LastAbove") {
										if(trigs[i].value < ticker.result.Last) {
												if(trigger(trigs[i]))
														remove_list.push(i);
												else
														console.error("failed to trigger");
										}
								} else {
										console.err("Unknown trigger type:" +  trigs[i].on);
								}
						}
						// going backwards because we are going to use splice. had we had walked it
						// forward we would have to modify the index with the number allready done
						// modifications. 
						for(var i = remove_list.length; i-- > 0;) {
								// removes one element;
								trigs.splice(remove_list[i],1);
						}
				}
				else
						console.err("error when updating ticker for " + name);
		}
}

function update_tickers() {
		bittrex.getmarketsummaries(function (data ,err) {
				if(err) {
						console.err("error in update_tickers()");
						return console.error(err);
				}
				for(var i in data.result) {
						var marketname = data.result[i].MarketName;
						var updater = update_ticker.bind(undefined, marketname);
						bittrex.getticker( { market: marketname }, updater);
				}
		});
}

function trigger(trigger) {
		console.log("fireing trigger");
		if(trigger.method === "twilio") {
				twilio_client.messages.create({
						body: "triggered on",
						to: "", // who to send to, seems it might need country code.
						from: "" // must be a vaild twilio number. should also include country code.
				}).then((message) => console.log("sent message " + message.sid));
				return true;
		} else {
				console.log("unknown trigger method: " + trigger.method); 
		}
		return true;
}

function loop() {
		update_tickers();
		// 1000 * 60 = will update about once a minute.
		setTimeout(loop, 1000 * 60, "updating tickers");
}

// start it, but wait a bit to let everthing get in ready;
setTimeout(loop, 1000 * 3, "waiting to loop");
