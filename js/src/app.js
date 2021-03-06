var totals = {
  'gwh-total': 50000,     // Start with higher than expected value, leaving room
  'cost-total': 550,      // million
  'investment-total': 50  // billion
};

document.addEventListener("DOMContentLoaded", function(event) {
  updateCharts('car', 0);
});

// Each slider's value, to pass to calculator
function getRangeValues () {
  return {
    'carNumber': document.getElementById('carNumber').value,
    'solarNumber': document.getElementById('solarNumber').value,
    'homeNumber': document.getElementById('homeNumber').value,
    'windfarmNumber': document.getElementById('windfarmNumber').value,
    'bicycleNumber': document.getElementById('bicycleNumber').value
  };
}

function updateCharts (prefix, value) {
  document.getElementById(prefix + 'Number').value = value;
  document.getElementById(prefix + 'Range').value = value;

  var data = shockingUpdate(getRangeValues());

  updateGraph('co2-chart', {
    'Geothermal': data.gen_emissions['Geothermal'],
    'Coal': data.gen_emissions['Coal'],
    'Gas': data.gen_emissions['Gas'],
    'Road': data.fleet_emissions['Road']
  });
  updateGraph('gwh-chart', data.gen_production);
  updateGraph('cost-chart', data.gen_cost);
  updateGraph('investment-chart', data.gen_capital_cost);
}
