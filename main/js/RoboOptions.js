function RoboOptions() {
}

RoboOptions.prototype.getForm = function() {
  return {
    prodSource: document.getElementById('prodSource'),
    devSource: document.getElementById('devSource'),
    prodLocation: document.getElementById('prodLocation'),
    devLocation: document.getElementById('devLocation')
  };
};

// Saves options to chrome.storage
RoboOptions.prototype.save = function(values, callback) {
  chrome.storage.sync.set(values, callback);
};

RoboOptions.prototype.saveForm = function() {
  var form = this.getForm();
  var source = form.prodSource.checked ? 'prod' : 'dev';
  var devLocation = form.devLocation.value;

  var values = {
    source: source,
    devLocation: devLocation
  };
  this.save(values, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved. Reload to see changes.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  }.bind(this));
};

RoboOptions.prototype.fillForm = function() {
  var form = this.getForm();
  form.prodLocation.innerText = RoboDefaults.prodLocation;
  this.load(function(values) {
    switch (values.source) {
      case 'prod':
        form.prodSource.checked = true;
        break;
      case 'dev':
        form.devSource.checked = true;
        break;
      default:
        break;
    }
    form.devLocation.value = values.devLocation;
  });
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
RoboOptions.prototype.load = function(callback) {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.sync.get({
    source: RoboDefaults.source,
    devLocation: RoboDefaults.devLocation
  }, callback);
};
