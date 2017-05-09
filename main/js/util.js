function domNode(name, attrs) {
  var el = document.createElement(name);

  Object.keys(attrs || {}).forEach(function(key) {
    el.setAttribute(key, attrs[key]);
  });

  for (var i = 2; i < arguments.length; i++) {
    var child = arguments[i];
    if (child instanceof Array) {
      for (var j = 0; j < child.length; j++) {
        el.appendChild(child[j]);
      }
    } else {
      if (typeof child === 'string') {
        child = document.createTextNode(child);
      }
      el.appendChild(child);
    }
  }

  return el;
}
