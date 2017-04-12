function ClassJavadoc(json) {
  this.json = json;
  this.methods_ = {};
  this.methods = [];

  var methods = this.json['methods'];
  Object.keys(methods).forEach(function(signature) {
    var methodJavadoc = new MethodJavadoc(signature, methods[signature]);
    this.methods_[signature] = methodJavadoc;
    this.methods.push(methodJavadoc);
  }.bind(this));
}

ClassJavadoc.prototype.findMethod = function(signature) {
  return this.methods_[signature];
};

function MethodJavadoc(signature, json) {
  this.signature = signature;
  this.isImplementation = json.isImplementation;
  this.returnType = json.returnType;

  var match = /^([^\s]+)\(([^)]*)\)/.exec(signature);
  this.name = match[1];
  this.paramTypes = match[2];

  this.documentation = json.documentation;
}

