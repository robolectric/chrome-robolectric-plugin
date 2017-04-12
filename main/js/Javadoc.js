function Javadoc() {
}

Javadoc.urlFor = function(className) {
  if (className.match(/^org\.robolectric\./)) {
    return 'http://robolectric.org/javadoc/latest/' + className.replace(/\./g, '/') + '.html';
  } else {
    return '/reference/' + className.replace(/\./g, '/') + '.html';
  }
};

Javadoc.processTags = function(text) {
  if (text == null) return '';

  return text.replace(/\{(@[^\s]+)\s+([^}]+)\}/g, function(full, tag, str) {
    switch (tag) {
      case '@code':
        return domNode('span', {}, domNode('code', {}, str)).innerHTML;
      case '@link':
        var parts = str.split(/\./);
        return domNode('span', {}, domNode('a', {'href': Javadoc.urlFor(str)}, parts[parts.length - 1])).innerHTML;
      default:
        return full;
    }
  });
};

function ClassJavadoc(json) {
  this.json = json;
  this.methods_ = {};
  this.methods = [];

  var methods = this.json['methods'];
  Object.keys(methods).sort().forEach(function(signature) {
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

MethodJavadoc.prototype.process_ = function() {
  if (this.processed_) {
    return;
  }

  if (!this.documentation) {
    this.paragraphs_ = [];
    this.tags_ = [];
  } else {
    var firstTag = this.documentation.indexOf("\n@");
    var narrative;
    var tags = [];
    if (firstTag != -1) {
      narrative = this.documentation.substring(0, firstTag);

      var tagLines = this.documentation.substring(firstTag);
      tagLines.split(/\n@/).forEach(function(tagLine) {
        if (tagLine.trim() == '') return;
        tags.push('@' + tagLine.trim());
        console.log(tagLine);
      });
    } else {
      narrative = this.documentation;
    }
    this.paragraphs_ = narrative.split(/\n\n/);
    this.tags_ = tags;
  }

  this.processed_ = true;
};

MethodJavadoc.prototype.summary = function() {
  this.process_();
  return Javadoc.processTags(this.paragraphs_[0]);
};

MethodJavadoc.prototype.paragraphs = function() {
  this.process_();
  return this.paragraphs_.map(function(para) {
    return Javadoc.processTags(para.trim());
  });
};

MethodJavadoc.prototype.tags = function() {
  this.process_();
  return this.tags_;
};
