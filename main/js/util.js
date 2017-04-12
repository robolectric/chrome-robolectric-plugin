function domNode(name, attrs) {
  var el = document.createElement(name);

  Object.keys(attrs || {}).forEach(function(key) {
    el.setAttribute(key, attrs[key]);
  });

  for (var i = 2; i < arguments.length; i++) {
    var child = arguments[i];
    if (typeof child == 'string') {
      child = document.createTextNode(child);
    }
    el.appendChild(child);
  }

  return el;
}
