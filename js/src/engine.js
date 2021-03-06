// reference: https://docs.google.com/spreadsheets/d/1rjZZg19gH4ST3XFfPaUmvgC90ACKgRw8x-MgoozkLfI/edit#gid=0


function shockingUpdate(inputs) {

	// Debug flag
	var debug = false;
	if ('debug' in inputs) {
		debug = true;
	}

	if (debug) {
		console.log("Inputs: " + JSON.stringify(inputs));
	}

	var baseline         = getBaseline();
	var gen_production   = baseline['gen_production'];
	var gen_emissions    = baseline['gen_emissions'];
	var gen_cost         = baseline['gen_cost'];
	var gen_capital_cost = baseline['gen_capital_cost'];
	var fleet_emissions  = baseline['fleet_emissions'];
 
	// ********************************************
	// Business logic
	// ********************************************
	
	// -----------------
	// [0] Set up some arrays and data we'll need
	// -----------------

	// work out total current generation
	var total_gen = 0;
	for (var key in gen_production) {
		total_gen += gen_production[key];
	}

	var generation_delta = {};


	// -----------------
	// [1] Transport
	// -----------------

	var electric_cars = inputs['carNumber'];
	var bikes = inputs['bicycleNumber'];

	// ASSUMPTION: there are essentially 0 electric cars in the current fleet
	// ASSUMPTION: there are essentially 0 car-free people currently
	// ASSUMPTION - in a gross oversimplification, riding a bike simply
	//              takes your car off the road.  100% bikes == 0 cars.
	// ASSUMPTION - bikes trumps cars.  Take bikes off the top first,
	//              then the remainder is divided up according to the
	//              electric car percentage
	var fleet_reduction = 1;
	fleet_reduction -= bikes/100;
	fleet_reduction *= (1 - electric_cars/100);

	electric_pct = (electric_cars/100)*(1-(bikes/100));

	fleet_emissions['Road'] = fleet_emissions['Road'] * fleet_reduction;

	// ASSUMPTION: any uptick in power generation required to meet
	// electric car demand, will be met proportionally by all generation sources
	// ASSUMPTION: typical EV will use 0.2 kWh for 1 km travelled
	// average travel is 12032 km per year
	// fleet size is 3341013
	ev_power_reqts = 12032 * 0.2 * 3341013 * electric_pct;
	
	// convert kwh to gwh
	ev_power_reqts = ev_power_reqts / 1000000;

	// increase generation accross the board to cope with the demand from vehicles
	var increase_in_power_reqts = ev_power_reqts / total_gen;
	for (var key in gen_production) {
		generation_delta[key] = gen_production[key] * increase_in_power_reqts;
	}

	// finally we gotta pay for all those electric cars, estimated at $40,000 each
	gen_capital_cost['Road'] = electric_pct * 3341013 * 40000;


	// -----------------
	// [2] Solar Houses
	// -----------------
	var solar_houses = inputs['solarNumber'];

	// installation cost
	gen_capital_cost['Solar'] = solar_houses * 12495;

	// ASSUMPTION - each household generates 5260 KWh per year
	var solar_production = solar_houses * 5260;
	// convert to Gwh
	solar_production = solar_production / 1000000;
	generation_delta['Solar'] = solar_production;

	// reduce proportionally all the non-solar production
	generation_delta = reduceDemand(
		generation_delta,
		gen_production,
		solar_production,
		['Solar']
	);


	// ----------
	// [3] Wind
	// ----------
	var new_wind = inputs['windfarmNumber'];
	
	// Based on: Each new wind farm is 200W; 702 GWh per annum;
	// capital cost of $521,344,918
	
	// first the capital cost, that's easy:
	gen_capital_cost['Wind'] = new_wind * 521344918;

	// new wind capacity
	generation_delta['Wind'] = new_wind * 702;

	// other production methods do proportionally less work
	// due to the extra wind production
	// (it'd be crazy to reduce any solar though!  So include solar in exceptions)
	generation_delta = reduceDemand(
		generation_delta,
		gen_production,
		generation_delta['Wind'],
		['Solar','Wind']
	);
	
	var decrease_due_to_wind = generation_delta['Wind'] / total_gen;
	for (var key in gen_production) {
		if (gen_production[key] != 'Wind') {
			var amount_to_reduce = gen_production[key] * decrease_due_to_wind;
			if (key in generation_delta) {
				generation_delta[key] -= amount_to_reduce;
			} else {
				generation_delta[key] = 0 - amount_to_reduce;
			}
		}
	}


	// --------------
	// [4] Insulation
	// --------------
	var new_insul = inputs['homeNumber'];

	// ASSUMPTION - Insulation will simply directly reduce electricity demand
	// costs $7630 per home; generates (saves) 3571 kwh per year 

	// capital cost
	gen_capital_cost['Insulation'] = new_insul * 7630;
	
	power_savings_from_insul = new_insul * 3571;
	// convert to gwh
	power_savings_from_insul = power_savings_from_insul / 1000000;

	generation_delta = reduceDemand(
		generation_delta,
		gen_production,
		power_savings_from_insul,
		[]
	);


	// --------------
	// [5] Bike
	// --------------



	// ********************************************
	// Change the world
	// ********************************************

	if (debug) {
		console.log("Delta: " + JSON.stringify(generation_delta));
	}

	// apply the required changes to production
	for (var key in gen_production) {
		gen_production[key] += generation_delta[key];
	}

	// extra generation adds more emissions
	// as per the ratios from the baseline data	
	for (var key in gen_emissions) {
		var emissions_per_unit = 0;
		if (gen_emissions[key] > 0) {
			emissions_per_unit = gen_emissions[key] / gen_production[key];
		}

		gen_emissions[key] += generation_delta[key] * emissions_per_unit;
	}

	// extra generation adds more cost
	// as per the ratios from the baseline data
	for (var key in gen_cost) {
		var cost_per_unit = 0;
		if (gen_cost[key] > 0) {
			cost_per_unit = gen_cost[key] / gen_production[key];
		}
		gen_cost[key] += generation_delta[key] * cost_per_unit;
	}


	// ********************************************
	// Data tidying
	// ********************************************
	
	// convert production cost from dollars to millions
	for (var key in gen_cost) {
		gen_cost[key] = gen_cost[key] / 1000000;
	}

	// convert capital cost from dollars to billions
	for (var key in gen_capital_cost) {
		gen_capital_cost[key] = gen_capital_cost[key] / 1000000000;
	}

	// ********************************************
	// Output
	// ********************************************
	var result = {
		'gen_production': gen_production,
		'gen_emissions': gen_emissions,
		'gen_cost': gen_cost,
		'gen_capital_cost': gen_capital_cost,
		'fleet_emissions': fleet_emissions
	}

	if (debug) {
		console.log("Result: " + JSON.stringify(result));
	}

	return result;
}


function getBaseline() {

	// ********************************************
	// Baseline data : 2013/2014
	// ********************************************

	// annual generation in Gigawatt Hours
	var gen_production = {
		'Hydro': 24095,
		'Geothermal': 6487,
		'Wind': 2187,
		'Coal': 1832,
		'Gas': 6626,
		'Solar': 0
	}

	// annual generation emissions in Kilotons of CO2 Equivalent
	var gen_emissions = {
		'Hydro': 0,
		'Geothermal': 847.32,
		'Wind': 0,
		'Coal': 1222.2,
		'Gas': 3405.51
	}

	// annual generation costs in $NZ per year (I think)
	var gen_cost = {
		'Hydro': 53872180,
		'Geothermal': 59535000,
		'Wind': 43484000,
		'Coal': 34177200,
		'Gas': 161044192
	}

	// investment cost
	var gen_capital_cost = {
		'Hydro': 0,
		'Geothermal': 0,
		'Wind': 0,
		'Coal': 0,
		'Insulation': 0,
		'Gas': 0,
		'Solar': 0,
		'Road': 0
	}

	// annual vehicle fleet emissions in Kilotons of CO2 Equivalent
	var fleet_emissions = {
		'Road': 12688
	}

	var result = {
		'gen_production': gen_production,
		'gen_emissions': gen_emissions,
		'gen_cost': gen_cost,
		'gen_capital_cost': gen_capital_cost,
		'fleet_emissions': fleet_emissions
	}

	return result;
}


// Determine change in power generation based on the requested reduction.
// Don't reduce anything in the list of exceptions.
//
// Returns: updated generation delta
function reduceDemand(generation_delta, gen_production, reduction, exceptions) {

	// work out total current generation
	var total_gen = 0;
	for (var key in gen_production) {
		total_gen += gen_production[key];
	}

	// decrease all forms of generation proportionally due to lower demand
	var decrease = reduction / total_gen;
	for (var key in gen_production) {
		if (exceptions.indexOf(key) != -1) {
			continue;
		}
		var amount_to_reduce = gen_production[key] * decrease;
		if (key in generation_delta) {
			generation_delta[key] -= amount_to_reduce;
		} else {
			generation_delta[key] = 0 - amount_to_reduce;
		}
	}

	return generation_delta;
}
	
