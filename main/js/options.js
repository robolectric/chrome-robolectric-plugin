var roboOptions = new RoboOptions();

document.addEventListener('DOMContentLoaded', function() {
  roboOptions.fillForm();
});

document.getElementById('save').addEventListener('click', function() {
  roboOptions.saveForm();
});