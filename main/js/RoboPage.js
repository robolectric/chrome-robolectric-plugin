function RoboPage() {
  this.isReady = false;
  this._onReadyCallbacks = [];

  this._ctsResults = {};

  this.androidClassName = null;
  this.androidShortName = null;
  this.androidVarName = null;

  this.converter_ = new showdown.Converter({
    strikethrough: true
  });
}

RoboPage.prototype.connectToBackground = function() {
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
  var holder = document.createElement('span');
  holder.innerHTML = html;

  // set innerText of most deeply nested element...
  if (innerText) {
    var node = holder.firstElementChild;
    while (node.firstElementChild) {
      node = node.firstElementChild;
    }
    node.innerText = innerText;
  }

  if (holder.childNodes.length == 1) {
    return holder.childNodes[0];
  } else {
    return holder;
  }
};

RoboPage.prototype.getJavadoc = function(className, callback) {
  this.sendBackgroundMessage('getJavadoc', className, callback);
};

RoboPage.prototype.getCtsResults = function(callback) {
  this.sendBackgroundMessage('getCtsResults', [], callback);
};

RoboPage.prototype.init = function() {
  this.connectToBackground();

  this.roboPanel = this.html('<div style="position: absolute; width: 140px; right: 2em; top: 6em; z-index: 100;"/>');
  this.roboPanel.innerHTML = '<img src="https://s3.amazonaws.com/robolectric/images/robolectric-128.png" alt="Robolectric" style="opacity: .1;"/>';
  this.whenReady(function() {
    document.body.appendChild(this.roboPanel);
  }.bind(this));

  var roboLogo = this.roboPanel.firstElementChild;

  this.getCtsResults(this.gotCtsResults.bind(this));

  if (document.location.pathname.startsWith('/reference/')) {
    var classNameParts = document.location.pathname.replace(/\.html$/, '').split('/').slice(2);
    this.androidClassName = classNameParts.join('.');
    this.androidShortName = classNameParts.pop();
    this.androidVarName = this.androidShortName.charAt(0).toLocaleLowerCase() + this.androidShortName.substring(1);
    console.log('android class name:', this.androidClassName);
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

RoboPage.prototype.padRight_ = function(s) {
  return s == '' ? '' : s + ' ';
};

RoboPage.prototype.methodSummaryRow = function(methodJavadoc) {
  var modifiers = methodJavadoc.modifiers.filter(function(modifier) {
    return modifier != 'public';
  });

  var td2;
  var row = domNode('tr', {'class': 'api apilevel-0 shadow'},
      domNode('td', {},
          domNode('code', {},
              this.padRight_(modifiers.join(' ')),
              this.domClassNames(methodJavadoc.returnType)
          )
      ),
      td2 = domNode('td', {'width': '100%'},
          domNode('code', {},
              domNode('span', {'class': 'robolectric-shadow-of'}, 'shadowOf(' + this.androidVarName + ').'),
              domNode('a', {'href': '#shadow:' + methodJavadoc.signature},
                  methodJavadoc.name
              ),
              '(',
              this.domClassNames(methodJavadoc.paramTypes, methodJavadoc.params),
              ')'
          )
      )
  );

  if (methodJavadoc.documentation) {
    var firstParagraph = this.markdownToHtml(methodJavadoc.summary());
    var p = domNode('p');
    p.innerHTML = firstParagraph;
    td2.appendChild(p);
  }
  return row;
};

RoboPage.prototype.tagMdToAppendable = function(methodJavadoc, text) {
  var dom = this.html(this.markdownToHtml(methodJavadoc.processTags(text)));
  if (dom.tagName == 'P') {
    if (dom.childNodes.length == 1) {
      return dom.childNodes[0];
    } else {
      var span = domNode('span', {});
      for (var i = 0; i < dom.childNodes.length; i++) {
        var node = dom.childNodes[i];
        span.appendChild(node);
      }
      return span;
    }
  } else {
    return dom;
  }
};

RoboPage.prototype.tagTables = function(javadoc) {
  var deprecatedRows = [];
  var paramRows = [];
  var returnRows = [];
  var throwsRows = [];
  var authorRows = [];
  var seeRows = [];
  var extras = [];

  javadoc.tags().forEach(function(tag) {
    var match = tag.match(/(@\w+)\s+(.*)/);
    var tagName = match[1];
    var rest = match[2];

    switch (tagName) {
      case '@deprecated':
        deprecatedRows.push([this.tagMdToAppendable(javadoc, rest)]);
        break;
      case '@param':
        var tagParts = rest.split(/ /);
        var paramName = tagParts.shift();
        var paramDesc = tagParts.join(' ');
        var html = this.tagMdToAppendable(javadoc, paramDesc);
        paramRows.push([domNode('code', {}, paramName), html]);
        break;
      case '@return':
        returnRows.push([this.domClassNames(javadoc.returnType), this.tagMdToAppendable(javadoc, rest)]);
        break;
      case '@throws':
        var tagParts = rest.split(/ /);
        var throwsType = tagParts.shift();
        var throwsDesc = tagParts.join(' ');
        throwsRows.push([this.domClassNames(throwsType), this.tagMdToAppendable(javadoc, throwsDesc)]);
        break;
      case '@author':
        authorRows.push([this.tagMdToAppendable(javadoc, rest)]);
        break;
      case '@see':
        var methodSig = javadoc.expandMethodSignature(rest);
        var parts = methodSig.split(/#/);
        var classPart = parts[0];
        var methodPart = parts[1];
        if (classPart === '') {
          methodPart = '#shadow:' + Javadoc.canonicalizeMethodSignature(methodPart);
        }
        seeRows.push([classPart + methodPart, rest]);
        break;
      default:
        var p = domNode('p', {}, tagName + ': ' + rest);
        extras.push(p);
        break;
    }
  }.bind(this));

  var tables = [];

  if (deprecatedRows.length > 0) {
    tables.push(this.table(domNode('th', {}, 'Deprecated'), deprecatedRows));
  }

  if (paramRows.length > 0) {
    tables.push(this.table(domNode('th', {'colspan': '2'}, 'Parameters'), paramRows));
  }

  if (returnRows.length > 0) {
    tables.push(this.table(domNode('th', {'colspan': '2'}, 'Returns'), returnRows));
  }

  if (throwsRows.length > 0) {
    tables.push(this.table(domNode('th', {'colspan': '2'}, 'Throws'), throwsRows));
  }

  if (authorRows.length > 0) {
    tables.push(this.table(domNode('th', {}, 'Author'), authorRows));
  }

  if (seeRows.length > 0) {
    tables.push(domNode('div', {},
        domNode('p', {}, domNode('b', {}, 'See also:')),
        domNode('ul', {'class': 'nolist'},
            seeRows.map(function(row) {
              return domNode('li', {},
                  domNode('code', {},
                      domNode('a', {'href': row[0]}, row[1])
                  )
              )
            })
        )
    ));
  }

  for (var i = 0; i < extras.length; i++) {
    tables.push(extras[i]);
  }

  return tables;
};

RoboPage.prototype.insertShadowMethod = function(methodJavadoc, insertionPoint) {
  var anchor = domNode('a', {'name': 'shadow:' + methodJavadoc.signature});
  insertionPoint.parentNode.insertBefore(anchor, insertionPoint);

  var methodDiv = domNode('div', {'class': 'robolectric-doc robolectric-shadow-api api apilevel-0'},
      domNode('img', {'src': 'https://s3.amazonaws.com/robolectric/images/robolectric-icon@2x.png', 'alt': '', 'class': 'robolectric-logo'}),
      domNode('h3', {'class': 'api-name'},
          domNode('span', {'class': 'robolectric-shadow-of'}, 'shadowOf(' + this.androidVarName + ').'),
          methodJavadoc.name),
      domNode('div', {'class': 'api-level'},
          domNode('div', {}, 'Robolectric extension')
      ),
      domNode('pre', {'class': 'api-signature no-pretty-print'},
          this.padRight_(methodJavadoc.modifiers.join(' ')),
          this.domClassNames(methodJavadoc.returnType),
          ' ',
          methodJavadoc.name,
          '(',
          this.domClassNames(methodJavadoc.paramTypes, methodJavadoc.paramNames),
          ')'
      )
  );

  var p = domNode('p', {});
  p.innerHTML = this.markdownToHtml(methodJavadoc.body());
  methodDiv.appendChild(p);
  var tagTables = this.tagTables(methodJavadoc);
  for (var i = 0; i < tagTables.length; i++) {
    methodDiv.appendChild(tagTables[i]);
  }

  insertionPoint.parentNode.insertBefore(methodDiv, insertionPoint);
};

RoboPage.prototype.table = function(headers, rows) {
  var tbody;
  var table = domNode('table', {'class': 'responsive'},
      tbody = domNode('tbody', {}, domNode('tr', {}, headers))
  );

  rows.forEach(function(row) {
    var tr = domNode('tr', {});
    tbody.appendChild(tr);

    for (var i = 0; i < row.length; i++) {
      var col = row[i];
      if (i == row.length - 1) {
        tr.appendChild(domNode('td', {'width': '100%'}, col));
      } else {
        tr.appendChild(domNode('td', {}, col));
      }
    }
  }.bind(this));
  return table;

};

RoboPage.prototype.decorateJavadocPage = function(classJavadoc) {
  var allShadowMethods = classJavadoc.methods.filter(function(methodJavadoc) {
    return !methodJavadoc.isImplementation && methodJavadoc.isPublic;
  });
  var shadowMethodIndex = 0;

  if (allShadowMethods.length > 0) {
    var pubMethodsAnchor = document.querySelector("#api-info-block a[href='#pubmethods']");
    var insertionPoint = pubMethodsAnchor.nextSibling;
    pubMethodsAnchor.parentNode.insertBefore(document.createTextNode(' | '), insertionPoint);
    pubMethodsAnchor.parentNode.insertBefore(
        domNode('a', {'href': '#shadowmethods'}, 'Shadow Methods'),
        insertionPoint);
  }

  // insert class-level shadow description...
  if (classJavadoc.documentation) {
    var h2s = document.getElementsByTagName('h2');
    insertionPoint = null;
    for (var i = 0; i < h2s.length; i++) {
      var h2 = h2s[i];
      if (h2.className == 'api-section' && h2.innerText == 'Summary') {
        insertionPoint = h2;
        break;
      }
    }

    if (insertionPoint) {
      var mdText = classJavadoc.processTags(classJavadoc.body());

      var docs = domNode('div', {'class': 'robolectric-doc robolectric-class-extra'},
          domNode('img', {'src': 'https://s3.amazonaws.com/robolectric/images/robolectric-icon@2x.png', 'alt': '', 'class': 'robolectric-logo'}),
          this.html(this.markdownToHtml(mdText)));

      insertionPoint.parentNode.insertBefore(domNode('hr'), insertionPoint);
      insertionPoint.parentNode.insertBefore(docs, insertionPoint);

      var tagTables = this.tagTables(classJavadoc);
      for (i = 0; i < tagTables.length; i++) {
        docs.appendChild(tagTables[i]);
        // insertionPoint.parentNode.insertBefore(tagTables[i], insertionPoint);
      }
    }
  }

  // insert shadow methods and add notes to @Implemented methods...
  document.querySelectorAll('div.api pre.api-signature').forEach(function(node) {
    var html = node.innerHTML;
    var signature = this.extractSignature(html);

    if (signature) {
      var insertionPoint = node.parentElement.previousElementSibling;

      // insert shadow methods inline with other methods...
      for (var i = shadowMethodIndex; i < allShadowMethods.length; i++) {
        var methodJavadoc = allShadowMethods[i];
        if (methodJavadoc.signature < signature) {
          this.insertShadowMethod(methodJavadoc, insertionPoint);
          shadowMethodIndex = i + 1;
        } else {
          break;
        }
      }

      // add notes to @Implemented methods
      var implMethodJavadoc = classJavadoc.findMethod(signature);
      if (implMethodJavadoc && implMethodJavadoc.documentation) {
        var memberDiv = node.parentElement;

        var lastChild = memberDiv.lastElementChild;
        while (lastChild.tagName == 'TABLE') {
          lastChild = lastChild.previousElementSibling;
        }

        var anchorDiv = memberDiv.previousElementSibling;
        var docHtml = this.markdownToHtml('_Robolectric Notes:_ ' + implMethodJavadoc.body());
        var newDiv = domNode('div', {'class': 'robolectric-doc robolectric-method-extra method'},
            domNode('img', {'src': 'https://s3.amazonaws.com/robolectric/images/robolectric-icon@2x.png', 'alt': '', 'class': 'robolectric-logo'}),
            this.html(docHtml));
        memberDiv.insertBefore(newDiv, lastChild.nextSibling);
        memberDiv.insertBefore(domNode('h2'), newDiv);
      }
    }
  }.bind(this));

  if (allShadowMethods.length > 0) {
    var pubMethodsTable = document.getElementById('pubmethods');
    var shadowMethodsTable = this.html('<table id="shadowmethods" class="responsive methods robolectric-shadow"><tbody><tr><th colspan="2"><h3>Shadow methods</h3></th></tr></tbody></table>');
    pubMethodsTable.parentNode.insertBefore(shadowMethodsTable, pubMethodsTable.nextElementSibling);
    allShadowMethods.forEach(function(methodJavadoc) {
      if (methodJavadoc.isImplementation) return;
      if (!methodJavadoc.isPublic()) return;
      var row = this.methodSummaryRow(methodJavadoc);
      shadowMethodsTable.firstElementChild.appendChild(row);
    }.bind(this));
  }
};

RoboPage.prototype.markdownToHtml = function(mdText) {
  return this.converter_.makeHtml(mdText);
};

RoboPage.prototype.domClassNames = function(className, paramNames) {
  var descs = this.prettyClassNames(className);
  var dom = document.createElement('span');
  for (var i = 0; i < descs.length; i++) {
    if (i > 0) dom.appendChild(document.createTextNode(', '));

    var desc = descs[i];
    this.domClassNameRecursive_(desc, dom);
    if (paramNames) {
      dom.appendChild(document.createTextNode(' ' + paramNames[i]));
    }
  }
  return dom;
};

RoboPage.prototype.domClassNameRecursive_ = function(classDesc, dom) {
  if (classDesc[1].match(/^[A-Z]/)) {
    var anchor = document.createElement('a');

    var className = classDesc[0];
    anchor.href = new Javadoc().urlFor(className);
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
    r = this._ctsResults[name] = {pass: [], fail: []};
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
            ctsAllResults.pass.push(ctsMethodName);
            ctsPackageResults.pass.push(ctsMethodName);
            ctsClassResults.pass.push(ctsMethodName);
            break;
          case 'FAIL':
          case 'TIMEOUT':
          case 'DISABLE':
          default:
            ctsAllResults.fail.push(ctsMethodName);
            ctsPackageResults.fail.push(ctsMethodName);
            ctsClassResults.fail.push(ctsMethodName);
            break;
        }
      });
    }
  }.bind(this));

  this.whenReady(function() {
    var results = this._ctsResults[this.androidClassName];
    if (results) {
      var total = results.pass.length + results.fail.length;
      this.roboPanel.appendChild(this.html('<div>CTS: ' + results.pass.length + '/' + total + "</div>"));
    }

    results = this._ctsResults['all'];
    if (results) {
      total = results.pass.length + results.fail.length;
      this.roboPanel.appendChild(this.html('<div>All CTS: ' + results.pass.length + '/' + total + "</div>"));
    }

    document.querySelectorAll('.dac-reference-nav-list li a').forEach(function(node) {
      var anchor = node;
      var text = anchor.innerText.trim();
      var results = this._ctsResults[text];
      if (results) {
        var total = results.pass.length + results.fail.length;
        var ctsDiv = this.html('<div class="cts-results">' + results.pass.length + '/' + total + '</div>');
        ctsDiv.addEventListener('click', function() {
          var passUl, failUl;
          var lightbox = domNode('div', {'class': 'cts-lightbox'},
              domNode('h2', {}, 'CTS Results for ' + text),
              domNode('h3', {}, 'Pass: ' + results.pass.length),
              passUl = domNode('ul', {}),
              domNode('h3', {}, 'Fail: ' + results.fail.length),
              failUl = domNode('ul', {})
          );
          var lightboxBg = domNode('div', {'class': 'cts-lightbox-bg'});
          results.pass.forEach(function(m) {
            passUl.appendChild(domNode('li', {}, m))
          });
          results.fail.forEach(function(m) {
            failUl.appendChild(domNode('li', {}, m))
          });
          var close = function() {
            document.body.removeChild(lightbox);
            document.body.removeChild(lightboxBg);
          };
          lightbox.addEventListener('click', close);
          lightboxBg.addEventListener('click', close);
          document.body.appendChild(lightbox);
          document.body.appendChild(lightboxBg);
        });
        anchor.parentNode.insertBefore(ctsDiv, anchor.parentNode.firstChild);
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
