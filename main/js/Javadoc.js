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
    'Void': 'java.lang.Void'
  };
}

Javadoc.prototype.urlFor = function(className, methodSignature) {
  methodSignature = methodSignature ? '#' + methodSignature : '';

  if (!className) {
    return methodSignature;
  }

  var parts = className.split(/\./);
  var path = '';
  var inClass = false;
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (path) {
      path += inClass ? '.' : '/';
    }
    if (part.match(/^[A-Z]/)) {
      inClass = true;
    }
    path += part;
  }

  if (className.match(/^org\.robolectric\./)) {
    return 'http://robolectric.org/javadoc/latest/' + path + '.html' + methodSignature;
  } else {
    return '/reference/' + path + '.html' + methodSignature;
  }
};

Javadoc.prototype.expandClass = function(className) {
  if (className && this.imports.hasOwnProperty(className)) {
    return this.imports[className];
  } else {
    return className;
  }
};

Javadoc.prototype.expandMethodSignature = function(signature) {
  if (signature) {
    var buf = '';
    var soFar = '';
    for (var i = 0; i < signature.length; i++) {
      var c = signature.charAt(i);
      if (c.match(/[ ,\[\]<>()#]/)) {
        buf += this.expandClass(soFar);
        soFar = '';
        buf += c;
      } else {
        soFar += c;
      }
    }

    if (soFar) {
      buf += soFar + '()';
    }

    return buf;
  } else {
    return signature;
  }
};

Javadoc.prototype.processTags = function(text) {
  if (text == null) return '';

  return text.replace(/\{(@[^\s]+)\s+([^}]+)\}/g, function(full, tag, str) {
    str = str.replace(/\n/g, ' ');
    switch (tag) {
      case '@code':
        return '`'+ str + '`';
      case '@link':
      case '@linkplain':
        var reParts = str.match(/^([^# ]+)?(?:#([^() ]+(?:\([^)]*\))?))?(\s+.*)?/);
        //                        1-    -1     2-                   -2  3-   -3
        var classPart = this.expandClass(reParts[1]) || '';
        var methodPart = this.expandMethodSignature(reParts[2]) || '';
        var methodDisplay = reParts[2];

        var displayString;
        if (reParts[3]) {
          displayString = reParts[3].trim();
        } else {
          displayString = methodDisplay || classPart;
          displayString = displayString.replace(/[A-Za-z0-9_$.]+\.([A-Za-z0-9_$]+)/, '$1');
        }
        var longDisplayString = classPart;
        if (methodPart) {
          if (longDisplayString) longDisplayString += '#';
          longDisplayString += methodPart;
        }
        var url = this.urlFor(classPart, methodPart);
        return '[' + displayString + '](' + url + ' "' + longDisplayString + '")';
      default:
        return full;
    }
  }.bind(this));
};

Javadoc.prototype.isPublic = function() {
  return this.modifiers.indexOf('public') > -1;
};

Javadoc.prototype.process_ = function() {
  if (this.processed_) {
    return;
  }

  if (!this.documentation) {
    this.summary_ = '';
    this.body_ = '';
    this.tags_ = [];
  } else {
    var firstTag = this.documentation.indexOf("\n@");
    var narrative;
    var tags = [];
    if (firstTag != -1) {
      narrative = this.documentation.substring(0, firstTag);

      var tagLines = this.documentation.substring(firstTag);
      tagLines.split(/\n@/).forEach(function(tagLine) {
        tagLine = tagLine.replace(/\n\s+/g, ' ').trim();
        if (tagLine == '') return;
        tags.push('@' + tagLine);
      });
    } else {
      narrative = this.documentation;
    }
    var paragraphs = narrative.split(/\n\n/);
    this.summary_ = this.processTags(paragraphs[0]);
    this.body_ = this.processTags(paragraphs.join("\n\n"));
    this.tags_ = tags;
  }

  this.processed_ = true;
};

Javadoc.prototype.summary = function() {
  this.process_();
  return this.summary_;
};

Javadoc.prototype.body = function() {
  this.process_();
  return this.body_;
};

Javadoc.prototype.tags = function() {
  this.process_();
  return this.tags_;
};

function ClassJavadoc(json) {
  Javadoc.apply(this);

  this.json = json;
  this.modifiers = ['public'];
  this.documentation = json.documentation;
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
}

ClassJavadoc.prototype = Object.create(Javadoc.prototype);

ClassJavadoc.prototype.findMethod = function(signature) {
  return this.methods_[signature];
};

function MethodJavadoc(signature, json, classJavadoc) {
  Javadoc.apply(this);

  this.fullSignature = signature;
  this.signature = Javadoc.canonicalizeMethodSignature(signature);
  this.isImplementation = json.isImplementation;
  this.returnType = json.returnType;

  var match = /^([^\s]+)\(([^)]*)\)/.exec(signature);
  this.name = match[1];
  this.paramTypes = match[2];

  this.paramNames = json.params;
  this.modifiers = json.modifiers;
  this.documentation = json.documentation;

  this.imports = classJavadoc.imports;
}

MethodJavadoc.prototype = Object.create(Javadoc.prototype);

// join(java.util.List<java.lang.String>,java.lang.String) -> join(java.util.List, java.lang.String)
Javadoc.canonicalizeMethodSignature = function(signature, removeGenerics) {
  signature = signature.replace(/,\s*/g, ', '); // one space after commas

  // remove generics...
  var s2 = '';
  var nest = 0;
  for (var i = 0; i < signature.length; i++) {
    var c = signature.charAt(i);
    switch (c) {
      case '<':
        nest++;
        break;
      case '>':
        nest--;
        break;
      default:
        if (nest === 0) s2 += c;
    }
  }
  signature = s2;

  return signature;
};