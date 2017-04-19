function Javadoc() {
  this.imports = {
    'Boolean': 'java.lang.Boolean',
    'Byte': 'java.lang.Byte',
    'Character': 'java.lang.Character',
    'Class': 'java.lang.Class',
    'ClassLoader': 'java.lang.ClassLoader',
    'Double': 'java.lang.Double',
    'Enum': 'java.lang.Enum',
    'Float': 'java.lang.Float',
    'Integer': 'java.lang.Integer',
    'Long': 'java.lang.Long',
    'Math': 'java.lang.Math',
    'Number': 'java.lang.Number',
    'Object': 'java.lang.Object',
    'Package': 'java.lang.Package',
    'Runtime': 'java.lang.Runtime',
    'Short': 'java.lang.Short',
    'String': 'java.lang.String',
    'StringBuffer': 'java.lang.StringBuffer',
    'StringBuilder': 'java.lang.StringBuilder',
    'System': 'java.lang.System',
    'Thread': 'java.lang.Thread',
    'Throwable': 'java.lang.Throwable',
    'Void': 'java.lang.Void',
  };
}

Javadoc.prototype.urlFor = function(signature) {
  var parts = signature.match(/^([^#]*)(#.*)?$/);
  var className = parts[1];
  var methodPart = parts[2] || '';

  var imported = this.imports[className];
  if (imported) {
    className = imported;
  }

  if (methodPart) {
    var buf = '';
    var soFar = '';
    for (var i = 0; i < methodPart.length; i++) {
      var c = methodPart.charAt(i);
      if (c.match(/[ ,\[\]\<\>\(\)]/)) {
        buf += this.imports[soFar] || soFar;
        soFar = '';
        buf += c;
      } else {
        soFar += c;
      }
    }
    methodPart = buf;
  }

  if (className.match(/^org\.robolectric\./)) {
    return 'http://robolectric.org/javadoc/latest/' + className.replace(/\./g, '/') + '.html' + methodPart;
  } else {
    return '/reference/' + className.replace(/\./g, '/') + '.html' + methodPart;
  }
};

Javadoc.prototype.processTags = function(text) {
  if (text == null) return '';

  return text.replace(/\{(@[^\s]+)\s+([^}]+)\}/g, function(full, tag, str) {
    switch (tag) {
      case '@code':
        return domNode('span', {}, domNode('code', {}, str)).innerHTML;
      case '@link':
        var parts = str.split(/\./);
        return domNode('span', {}, domNode('a', {'href': this.urlFor(str)}, parts[parts.length - 1])).innerHTML;
      default:
        return full;
    }
  }.bind(this));
};

function ClassJavadoc(json) {
  Javadoc.apply(this);

  this.json = json;
  this.methods_ = {};
  this.methods = [];

  var methods = this.json['methods'];
  Object.keys(methods).sort().forEach(function(signature) {
    var methodJavadoc = new MethodJavadoc(signature, methods[signature], this);
    this.methods_[signature] = methodJavadoc;
    this.methods.push(methodJavadoc);
  }.bind(this));

  this.json['imports'].reverse().forEach(function(className) {
    this.imports[className.match(/([^.]+)$/)[1]] = className;
  }.bind(this));
  console.log('IMPORTS', this.imports);
}

ClassJavadoc.prototype = Object.create(Javadoc.prototype);

ClassJavadoc.prototype.findMethod = function(signature) {
  return this.methods_[signature];
};

function MethodJavadoc(signature, json, classJavadoc) {
  Javadoc.apply(this);

  this.signature = signature;
  this.isImplementation = json.isImplementation;
  this.returnType = json.returnType;

  var match = /^([^\s]+)\(([^)]*)\)/.exec(signature);
  this.name = match[1];
  this.paramTypes = match[2];

  this.documentation = json.documentation;

  this.imports = classJavadoc.imports;
}

MethodJavadoc.prototype = Object.create(Javadoc.prototype);

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
  return this.processTags(this.paragraphs_[0]);
};

MethodJavadoc.prototype.paragraphs = function() {
  this.process_();
  return this.paragraphs_.map(function(para) {
    return this.processTags(para.trim());
  }.bind(this));
};

MethodJavadoc.prototype.tags = function() {
  this.process_();
  return this.tags_;
};
