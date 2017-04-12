function RoboPage() {
  // this.roboHome = 'https://localhost:8080';
  this.roboHome = 'https://robolectric.github.io';

  this.isReady = false;
  this._onReadyCallbacks = [];

  this._ctsResults = {};

  this.androidClassName = null;
}

RoboPage.prototype.connectToBackground = function(command, args, callback) {
  this.background = chrome.runtime.connect();
  this.backgroundCallbacks = {};
  this.nextBackgroundCallback = 0;

  this.background.onMessage.addListener(function(msg) {
    console.log('<--', msg);

    var callback = this.backgroundCallbacks[msg.id];
    delete this.backgroundCallbacks[msg.id];
    callback(msg.response);
  }.bind(this));
};

RoboPage.prototype.sendBackgroundMessage = function(command, args, callback) {
  var myId = this.nextBackgroundCallback++;
  this.backgroundCallbacks[myId] = callback;

  var message = {command: command, args: args, id: myId};
  console.log('-->', message);
  this.background.postMessage(message);
};

RoboPage.prototype.html = function(html, innerText) {
  var holder = document.createElement('div');
  holder.innerHTML = html;

  // set innerText of most deeply nested element...
  if (innerText) {
    var node = holder.firstElementChild;
    while (node.firstElementChild) {
      node = node.firstElementChild;
    }
    node.innerText = innerText;
  }

  return holder.firstElementChild;
};

RoboPage.prototype.getJavadoc = function(className, callback) {
  this.sendBackgroundMessage('getJavadoc', className, callback);
};

RoboPage.prototype.getCtsResults = function(callback) {
  this.sendBackgroundMessage('getCtsResults', [], callback);
};

RoboPage.prototype.init = function() {
  this.connectToBackground();

  this.roboPanel = this.html('<div style="position: fixed; width: 140px; right: 2em; top: 6em; z-index: 100;"/>');
  this.roboPanel.innerHTML = '<img src="' + this.roboHome + '/images/robolectric-stacked.png" alt="Robolectric" style="opacity: .1;"/>';
  this.whenReady(function() {
    document.body.appendChild(this.roboPanel);
  }.bind(this));

  var roboLogo = this.roboPanel.firstElementChild;

  this.getCtsResults(this.gotCtsResults.bind(this));

  if (document.location.pathname.startsWith('/reference/')) {
    this.androidClassName = document.location.pathname.split('/').slice(2).join('.').replace('.html', '');
  }

  if (this.androidClassName) {
    var className = this.androidClassName;
    this.roboPanel.innerHTML += '<br/>' + className;

    this.getJavadoc(className, function(javaDoc) {
      var classJavadoc = new ClassJavadoc(javaDoc);

      this.whenReady(function() {
        this.decorateJavadocPage(classJavadoc);
        roboLogo.style.opacity = '.25';
      }.bind(this));
    }.bind(this));
  }
};

RoboPage.htmlRE = /<[a]\s+href=['"]([^'"]+)['"]>([^<]+)<\/a>/g;
RoboPage.httpRE = /\/reference\/(.+)\.html/;
RoboPage.arrayRE = /([\[\]]+)$/;
RoboPage.pageSignatureRE = /^([^\s]+)\s+([^\s]+)\s*\(([^)]*)\)/;

RoboPage.prototype.extractSignature = function(html) {
  html = html.replace(RoboPage.htmlRE, function(full, url, str) {
    var urlMatch = RoboPage.httpRE.exec(url);
    var arrayMatch = RoboPage.arrayRE.exec(str);
    return urlMatch[1].replace(/\//g, '.') + (arrayMatch ? arrayMatch[0] : '');
  }).replace(/&lt;/g, '<').replace(/&gt;/g, '>');

  var match = RoboPage.pageSignatureRE.exec(html);
  if (!match) {
    return null;
  }

  //noinspection JSUnusedLocalSymbols
  var returnType = match[1];
  var methodName = match[2];
  var params = match[3].replace(/\s/g, ' ').split(/,/).map(function(x) {
    return x.trim().split(/ /)[0];
  });

  return methodName + '(' + params.join(',') + ')';
};

RoboPage.prototype.decorateJavadocPage = function(classJavadoc) {
  var allShadowMethods = classJavadoc.methods;
  var shadowMethodIndex = 0;

  // insert shadow methods and add notes to @Implemented methods...
  document.querySelectorAll('div.api pre.api-signature').forEach(function(node) {
    var html = node.innerHTML;
    var signature = this.extractSignature(html);
    console.log('inspecting', signature, node);

    if (signature) {
      console.log('signature', signature);
      var insertionPoint = node.parentElement.previousElementSibling;

      for (var i = shadowMethodIndex; i < allShadowMethods.length; i++) {
        var methodJavadoc = allShadowMethods[i];
        if (methodJavadoc.signature < signature) {
          var anchor = domNode('a', {'name': 'shadow:' + methodJavadoc.signature});
          insertionPoint.parentNode.insertBefore(anchor, insertionPoint);

          var methodDiv = domNode('div', {'class': 'api apilevel-0'},
              domNode('h3', {'class': 'api-name'}, 'shadowOf().', methodJavadoc.name),
              domNode('div', {'class': 'api-level'},
                  domNode('div', {}, 'Robolectric shadow method')
              ),
              domNode('pre', {'class': 'api-signature no-pretty-print'},
                  this.domClassNames(methodJavadoc.returnType),
                  ' ',
                  methodJavadoc.name,
                  '(',
                  this.domClassNames(methodJavadoc.paramTypes),
                  ')'
              )
          );

          methodJavadoc.paragraphs().forEach(function(para) {
            var p = domNode('p', {});
            p.innerHTML = para;
            methodDiv.appendChild(p);
          });

          console.log('tags', methodJavadoc.tags());
          methodJavadoc.tags().forEach(function(tag) {
            var p = domNode('p', {}, tag);
            methodDiv.appendChild(p);
          });

          insertionPoint.parentNode.insertBefore(methodDiv, insertionPoint);
          console.log('should insert shadowOf().', methodJavadoc.signature);
        }
        shadowMethodIndex = i;
      }

      var shadowMethodJavadoc = classJavadoc.findMethod(signature);
      if (shadowMethodJavadoc && shadowMethodJavadoc.documentation) {
        shadowMethodIndex = allShadowMethods.indexOf(shadowMethodJavadoc) + 1;
        console.log(signature, 'at', shadowMethodIndex);

        var memberDiv = node.parentElement;
        var anchorDiv = memberDiv.previousElementSibling;
        var newDiv = this.html('<div class="robolectric method"/>');
        memberDiv.parentElement.insertBefore(newDiv, memberDiv.nextSibling);
        var docHtml = Javadoc.processTags(shadowMethodJavadoc.documentation);
        newDiv.innerHTML = "<p><b><i>Robolectric notes:</i></b></p>\n" + docHtml;
      }
    }
  }.bind(this));

  var pubMethodsTable = document.getElementById('pubmethods');
  var shadowMethodsTable = this.html('<table class="responsive methods robolectric-shadow"><tbody><tr><th colspan="2"><h3>Shadow methods</h3></th></tr></tbody></table>');
  pubMethodsTable.parentNode.insertBefore(shadowMethodsTable, pubMethodsTable.nextElementSibling);
  allShadowMethods.forEach(function(methodJavadoc) {
    if (methodJavadoc.isImplementation) return;

    var td2;
    var row = domNode('tr', {'class': 'api apilevel-0 shadow'},
        domNode('td', {},
            domNode('code', {},
                this.domClassNames(methodJavadoc.returnType)
            )
        ),
        td2 = domNode('td', {'width': '100%'},
            domNode('code', {},
                'shadowOf().',
                domNode('a', {'href': '#shadow:' + methodJavadoc.signature},
                    methodJavadoc.name
                ),
                '(',
                this.domClassNames(methodJavadoc.paramTypes),
                ')'
            )
        )
    );

    if (methodJavadoc.documentation) {
      var firstParagraph = methodJavadoc.documentation.split(/\n\n/)[0]; // first paragraph
      var p = domNode('p', {}, firstParagraph);
      td2.appendChild(p);
    }

    shadowMethodsTable.firstElementChild.appendChild(row);
  }.bind(this));
};

RoboPage.prototype.domClassNames = function(className) {
  var descs = this.prettyClassNames(className);
  var dom = document.createElement('span');
  for (var i = 0; i < descs.length; i++) {
    if (i > 0) dom.appendChild(document.createTextNode(', '));

    var desc = descs[i];
    this.domClassNameRecursive_(desc, dom);
  }
  return dom;
};

RoboPage.prototype.domClassNameRecursive_ = function(classDesc, dom) {
  if (classDesc[1].match(/^[A-Z]/)) {
    var anchor = document.createElement('a');

    var className = classDesc[0];
    anchor.href = Javadoc.urlFor(className);
    anchor.innerText = classDesc[1];
    dom.appendChild(anchor);
  } else {
    // primitive
    dom.appendChild(document.createTextNode(classDesc[1]));
  }

  var generics = classDesc[2];
  if (generics.length > 0) {
    dom.appendChild(document.createTextNode('<'));
    for (var i = 0; i < generics.length; i++) {
      if (i > 0) dom.appendChild(document.createTextNode(', '));

      this.domClassNameRecursive_(generics[i], dom);
    }
    dom.appendChild(document.createTextNode('>'));
  }
};

RoboPage.prototype.prettyClassNames = function(classNames) {
  var code = document.createElement('code');

  var topNode = [null, null, []];
  var curNode = topNode;

  var cur = "";
  var stack = [];

  var chomp = null;
  var l = classNames.length;
  for (var i = 0; i < l; i++) {
    var c = classNames.charAt(i);

    //noinspection FallThroughInSwitchStatementJS
    switch (c) {
      case '>':
        if (cur == '') chomp = '';
      case '<':
      case ',':
        if (cur) chomp = cur;
        cur = "";
        break;

      default:
        cur += c;
    }

    if (chomp == null && i + 1 == l && cur) {
      chomp = cur;
    }

    if (chomp != null) {
      chomp = chomp.trim();
      if (chomp) {
        var newNode = [chomp, chomp.match(/[^.]+$/)[0], []];
        curNode[2].push(newNode);
      }
      chomp = null;

      switch (c) {
        case '<':
          stack.push(curNode);
          curNode = newNode;
          break;
        case '>':
          curNode = stack.pop();
          break;
      }
    }
  }

  return topNode[2];
};

RoboPage.prototype.findCtsResults = function(name) {
  var r = this._ctsResults[name];
  if (r == null) {
    r = this._ctsResults[name] = {pass: 0, fail: 0};
  }
  return r;
};

RoboPage.prototype.gotCtsResults = function(json) {
  var ctsPackageRE = /^(.+)\.cts\.(.+)Test$/;
  Object.keys(json['classes']).forEach(function(ctsTestClassName) {
    var match = ctsPackageRE.exec(ctsTestClassName);
    if (match) {
      var ctsPackageName = match[1];
      var ctsClassName = ctsPackageName + '.' + match[2];

      var ctsAllResults = this.findCtsResults('all');
      var ctsPackageResults = this.findCtsResults(ctsPackageName);
      var ctsClassResults = this.findCtsResults(ctsClassName);

      var methods = json['classes'][ctsTestClassName]['methods'];
      Object.keys(methods).forEach(function(ctsMethodName) {
        switch (methods[ctsMethodName]) {
          case 'PASS':
            ctsAllResults.pass++;
            ctsPackageResults.pass++;
            ctsClassResults.pass++;
            break;
          case 'FAIL':
          case 'TIMEOUT':
          case 'DISABLE':
          default:
            ctsAllResults.fail++;
            ctsPackageResults.fail++;
            ctsClassResults.fail++;
            break;
        }
      });
    }
  }.bind(this));

  this.whenReady(function() {
    var results = this._ctsResults[this.androidClassName];
    if (results) {
      var total = results.pass + results.fail;
      this.roboPanel.appendChild(this.html('<div>CTS: ' + results.pass + '/' + total + "</div>"));
    }

    results = this._ctsResults['all'];
    if (results) {
      total = results.pass + results.fail;
      this.roboPanel.appendChild(this.html('<div>All CTS: ' + results.pass + '/' + total + "</div>"));
    }

    document.querySelectorAll('.dac-reference-nav-list li a').forEach(function(node) {
      var anchor = node;
      var text = anchor.innerText.trim();
      var results = this._ctsResults[text];
      if (results) {
        var total = results.pass + results.fail;
        anchor.parentNode.insertBefore(this.html('<div class="cts-results">' + results.pass + '/' + total + '</div>'), anchor.parentNode.firstChild);
      }
    }.bind(this));
  }.bind(this));
};

RoboPage.prototype.whenReady = function(fn) {
  if (this.isReady) {
    fn();
  } else {
    this._onReadyCallbacks.push(fn);
  }
};

RoboPage.prototype.onReady = function() {
  this.isReady = true;
  var callbacks = this._onReadyCallbacks;
  this._onReadyCallbacks = null;
  callbacks.forEach(function(cb) {
    cb();
  });
};
